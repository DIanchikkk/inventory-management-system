package handlers

import (
	"errors"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// InventoryHandler — сессии инвентаризации и результаты сверки.
type InventoryHandler struct {
	DB *gorm.DB
}

// resultInput: actual_quantity через *int — иначе binding:"required" на int отбрасывает законное значение 0.
type resultInput struct {
	ItemID         uuid.UUID `json:"item_id" binding:"required"`
	ActualQuantity *int      `json:"actual_quantity" binding:"required"`
}

// computeResultStatus сравнивает факт с учётным количеством из карточки объекта.
// actual должен быть >= 0 (проверяется в хендлерах).
func computeResultStatus(expected, actual int) string {
	if actual == expected {
		return models.ResultStatusMatch
	}
	if actual == 0 && expected > 0 {
		return models.ResultStatusMissing
	}
	return models.ResultStatusMismatch
}

// CreateSession — POST /inventory/sessions
func (h *InventoryHandler) CreateSession(c *gin.Context) {
	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	s := models.InventorySession{
		CreatedBy: uid,
		Status:    models.SessionStatusActive,
	}
	if err := h.DB.Create(&s).Error; err != nil {
		log.Printf("create session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusCreated, s)
}

// ListSessions — GET /inventory/sessions (user — свои сессии; admin — все).
func (h *InventoryHandler) ListSessions(c *gin.Context) {
	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	role, _ := middleware.GetRole(c)

	var sessions []models.InventorySession
	q := h.DB.Model(&models.InventorySession{})
	if role != "admin" {
		q = q.Where("created_by = ?", uid)
	}
	if err := q.Order("created_at DESC").Find(&sessions).Error; err != nil {
		log.Printf("list sessions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, sessions)
}

type sessionDetailResponse struct {
	Session models.InventorySession  `json:"session"`
	Items   []models.Item            `json:"items"`
	Results []models.InventoryResult `json:"results"`
}

// GetSession — GET /inventory/sessions/:id
func (h *InventoryHandler) GetSession(c *gin.Context) {
	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	role, _ := middleware.GetRole(c)

	sid, ok := ParseUUIDParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var s models.InventorySession
	if err := h.DB.First(&s, "id = ?", sid).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
			return
		}
		log.Printf("get session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if s.CreatedBy != uid && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var items []models.Item
	if err := h.DB.Order("name").Find(&items).Error; err != nil {
		log.Printf("get session items: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var results []models.InventoryResult
	if err := h.DB.Where("session_id = ?", sid).Find(&results).Error; err != nil {
		log.Printf("get session results: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, sessionDetailResponse{
		Session: s,
		Items:   items,
		Results: results,
	})
}

func (h *InventoryHandler) sessionForUser(c *gin.Context, uid, sid uuid.UUID, role string) (*models.InventorySession, bool) {
	var s models.InventorySession
	if err := h.DB.First(&s, "id = ?", sid).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
			return nil, false
		}
		log.Printf("session for user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return nil, false
	}
	if s.CreatedBy != uid && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return nil, false
	}
	if s.Status == models.SessionStatusCompleted {
		c.JSON(http.StatusConflict, gin.H{"error": "session already completed"})
		return nil, false
	}
	return &s, true
}

func (h *InventoryHandler) upsertResult(db *gorm.DB, sessionID, itemID uuid.UUID, actualQty int) error {
	var item models.Item
	if err := db.First(&item, "id = ?", itemID).Error; err != nil {
		return err
	}
	expected := item.Quantity
	status := computeResultStatus(expected, actualQty)

	var res models.InventoryResult
	err := db.Where("session_id = ? AND item_id = ?", sessionID, itemID).First(&res).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		res = models.InventoryResult{
			SessionID:        sessionID,
			ItemID:           itemID,
			ExpectedQuantity: expected,
			ActualQuantity:   actualQty,
			Status:           status,
		}
		return db.Create(&res).Error
	}
	if err != nil {
		return err
	}
	res.ExpectedQuantity = expected
	res.ActualQuantity = actualQty
	res.Status = status
	return db.Save(&res).Error
}

// AddResult — POST /inventory/sessions/:id/results
func (h *InventoryHandler) AddResult(c *gin.Context) {
	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	role, _ := middleware.GetRole(c)
	sid, ok := ParseUUIDParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if _, ok := h.sessionForUser(c, uid, sid, role); !ok {
		return
	}

	var in resultInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if in.ActualQuantity == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "actual_quantity is required"})
		return
	}
	if *in.ActualQuantity < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "actual_quantity must be >= 0"})
		return
	}

	if err := h.upsertResult(h.DB, sid, in.ItemID, *in.ActualQuantity); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
			return
		}
		log.Printf("add result: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var res models.InventoryResult
	if err := h.DB.Where("session_id = ? AND item_id = ?", sid, in.ItemID).First(&res).Error; err != nil {
		log.Printf("add result reload: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, res)
}

// BatchResults — POST /inventory/sessions/:id/results/batch
func (h *InventoryHandler) BatchResults(c *gin.Context) {
	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	role, _ := middleware.GetRole(c)
	sid, ok := ParseUUIDParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if _, ok := h.sessionForUser(c, uid, sid, role); !ok {
		return
	}

	var inputs []resultInput
	if err := c.ShouldBindJSON(&inputs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for _, in := range inputs {
		if in.ActualQuantity == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "actual_quantity is required", "item_id": in.ItemID})
			return
		}
		if *in.ActualQuantity < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "actual_quantity must be >= 0", "item_id": in.ItemID})
			return
		}
	}

	if err := h.DB.Transaction(func(tx *gorm.DB) error {
		for _, in := range inputs {
			if err := h.upsertResult(tx, sid, in.ItemID, *in.ActualQuantity); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
			return
		}
		log.Printf("batch result: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var results []models.InventoryResult
	if err := h.DB.Where("session_id = ?", sid).Find(&results).Error; err != nil {
		log.Printf("batch reload: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, results)
}

// CompleteSession — POST /inventory/sessions/:id/complete
func (h *InventoryHandler) CompleteSession(c *gin.Context) {
	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	role, _ := middleware.GetRole(c)
	sid, ok := ParseUUIDParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	s, ok := h.sessionForUser(c, uid, sid, role)
	if !ok {
		return
	}

	s.Status = models.SessionStatusCompleted
	if err := h.DB.Save(s).Error; err != nil {
		log.Printf("complete session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, s)
}

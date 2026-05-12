package handlers

import (
	"errors"
	"fmt"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var errInventoryCategoryMissing = errors.New("inventory: category not found")

// InventoryHandler — сессии инвентаризации и результаты сверки.
type InventoryHandler struct {
	DB *gorm.DB
}

type paginatedSessionsResponse struct {
	Sessions []models.InventorySession `json:"sessions"`
	Page     int                       `json:"page"`
	PageSize int                       `json:"page_size"`
	Total    int64                     `json:"total"`
}

// resultInput: actual_quantity через *int — иначе binding:"required" на int отбрасывает законное значение 0.
type resultInput struct {
	ItemID         uuid.UUID `json:"item_id" binding:"required"`
	ActualQuantity *int      `json:"actual_quantity" binding:"required"`
	Comment        string    `json:"comment"`
}

type createSessionRequest struct {
	ItemIDs           []uuid.UUID `json:"item_ids"`
	LocationSubstring string      `json:"location"`
	CategoryID        *uuid.UUID  `json:"category_id"`
	Notes             string      `json:"notes"`
}

// CreateSession — POST /inventory/sessions (опционально: только часть объектов по фильтрам — как выборка для документа инвентаризации).
func (h *InventoryHandler) CreateSession(c *gin.Context) {
	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var body createSessionRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	var s models.InventorySession
	if err := h.DB.Transaction(func(tx *gorm.DB) error {
		docNo, err := nextInventoryDocNo(tx)
		if err != nil {
			return err
		}
		var filterCatID *uuid.UUID
		filterCatName := ""
		if body.CategoryID != nil && *body.CategoryID != uuid.Nil {
			var cat models.Category
			if err := tx.First(&cat, "id = ?", *body.CategoryID).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errInventoryCategoryMissing
				}
				return err
			}
			cid := *body.CategoryID
			filterCatID = &cid
			filterCatName = cat.Name
		}
		s = models.InventorySession{
			CreatedBy:          uid,
			Status:             models.SessionStatusActive,
			DocumentNo:         docNo,
			Notes:              strings.TrimSpace(body.Notes),
			FilterLocation:     strings.TrimSpace(body.LocationSubstring),
			FilterCategoryID:   filterCatID,
			FilterCategoryName: filterCatName,
		}
		if err := tx.Create(&s).Error; err != nil {
			return err
		}
		q := tx.Where("retired_at IS NULL")
		if len(body.ItemIDs) > 0 {
			q = q.Where("id IN ?", body.ItemIDs)
		}
		if loc := strings.TrimSpace(body.LocationSubstring); loc != "" {
			q = q.Where("location ILIKE ?", "%"+loc+"%")
		}
		if body.CategoryID != nil && *body.CategoryID != uuid.Nil {
			q = q.Where("category_id = ?", *body.CategoryID)
		}
		var items []models.Item
		if err := q.Find(&items).Error; err != nil {
			return err
		}
		if len(items) == 0 {
			return nil
		}
		snapshots := make([]models.InventoryResult, 0, len(items))
		for _, it := range items {
			snapshots = append(snapshots, models.InventoryResult{
				SessionID:        s.ID,
				ItemID:           it.ID,
				ExpectedQuantity: it.Quantity,
				ActualQuantity:   0,
				Status:           models.ResultStatusPending,
				Comment:          "",
			})
		}
		h.logSessionEvent(tx, s.ID, &uid, "session_created", fmt.Sprintf("Создан документ инвентаризации, строк в опись: %d", len(snapshots)))
		return tx.Create(&snapshots).Error
	}); err != nil {
		if errors.Is(err, errInventoryCategoryMissing) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "category not found"})
			return
		}
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
	page := 1
	pageSize := 20
	if raw := strings.TrimSpace(c.Query("page")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			page = n
		}
	}
	if raw := strings.TrimSpace(c.Query("page_size")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			pageSize = n
		}
	}
	if pageSize > 100 {
		pageSize = 100
	}

	var sessions []models.InventorySession
	q := h.DB.Model(&models.InventorySession{})
	if role != "admin" {
		q = q.Where("created_by = ?", uid)
	}
	status := strings.TrimSpace(c.Query("status"))
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		log.Printf("list sessions count: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if err := q.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&sessions).Error; err != nil {
		log.Printf("list sessions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, paginatedSessionsResponse{
		Sessions: sessions,
		Page:     page,
		PageSize: pageSize,
		Total:    total,
	})
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

	summary, err := sessionSummaryForSession(h.DB, sid)
	if err != nil {
		log.Printf("get session summary: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, sessionDetailResponse{
		Session: s,
		Summary: summary,
	})
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

	var before models.InventoryResult
	hadBefore := false
	if err := h.DB.Where("session_id = ? AND item_id = ?", sid, in.ItemID).First(&before).Error; err == nil {
		hadBefore = before.Status != models.ResultStatusPending
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
	now := time.Now()
	comment := strings.TrimSpace(in.Comment)
	if hadBefore {
		res.RecountCount++
	}
	res.CountedBy = &uid
	res.CountedAt = &now
	res.Comment = comment
	if err := h.DB.Save(&res).Error; err != nil {
		log.Printf("add result metadata save: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	h.logSessionEvent(h.DB, sid, &uid, "result_saved", "Single result saved for item "+in.ItemID.String())
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
			var before models.InventoryResult
			hadBefore := false
			if err := tx.Where("session_id = ? AND item_id = ?", sid, in.ItemID).First(&before).Error; err == nil {
				hadBefore = before.Status != models.ResultStatusPending
			}
			if err := h.upsertResult(tx, sid, in.ItemID, *in.ActualQuantity); err != nil {
				return err
			}
			var current models.InventoryResult
			if err := tx.Where("session_id = ? AND item_id = ?", sid, in.ItemID).First(&current).Error; err != nil {
				return err
			}
			now := time.Now()
			comment := strings.TrimSpace(in.Comment)
			if hadBefore {
				current.RecountCount++
			}
			current.CountedBy = &uid
			current.CountedAt = &now
			current.Comment = comment
			if err := tx.Save(&current).Error; err != nil {
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
	h.logSessionEvent(h.DB, sid, &uid, "batch_saved", "Batch results saved")
	c.JSON(http.StatusOK, results)
}

// CompleteSession — POST /inventory/sessions/:id/complete
func (h *InventoryHandler) CompleteSession(c *gin.Context) {
	expected, allowIncomplete, bad := parseCompleteSessionBody(c)
	if bad {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body (expected_updated_at RFC3339, allow_incomplete optional)"})
		return
	}

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

	if allowIncomplete && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "принудительное завершение доступно только администратору"})
		return
	}

	s, ok := h.sessionForUser(c, uid, sid, role)
	if !ok {
		return
	}

	if !checkSessionVersion(c, s, expected) {
		return
	}

	if s.Status != models.SessionStatusReview && s.Status != models.SessionStatusActive {
		c.JSON(http.StatusConflict, gin.H{"error": "session cannot be completed from current status"})
		return
	}

	var pendingCount int64
	if err := h.DB.Model(&models.InventoryResult{}).
		Where("session_id = ? AND status = ?", sid, models.ResultStatusPending).
		Count(&pendingCount).Error; err != nil {
		log.Printf("complete session pending count: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if pendingCount > 0 && !(role == "admin" && allowIncomplete) {
		c.JSON(http.StatusConflict, gin.H{
			"error":         "есть непосчитанные позиции; укажите факт по всем строкам или (администратор) завершите с allow_incomplete",
			"code":          "pending_uncounted",
			"pending_count": pendingCount,
		})
		return
	}

	if err := h.DB.Transaction(func(tx *gorm.DB) error {
		var results []models.InventoryResult
		if err := tx.Where("session_id = ?", sid).Find(&results).Error; err != nil {
			return err
		}
		itemIDs := make([]uuid.UUID, 0, len(results))
		seen := make(map[uuid.UUID]struct{}, len(results))
		for _, res := range results {
			if res.Status == models.ResultStatusPending {
				continue
			}
			if _, ok := seen[res.ItemID]; ok {
				continue
			}
			seen[res.ItemID] = struct{}{}
			itemIDs = append(itemIDs, res.ItemID)
		}
		var stockItems []models.Item
		if len(itemIDs) > 0 {
			if err := tx.Where("id IN ? AND deleted_at IS NULL", itemIDs).Find(&stockItems).Error; err != nil {
				return err
			}
		}
		itemByID := make(map[uuid.UUID]models.Item, len(stockItems))
		for _, it := range stockItems {
			itemByID[it.ID] = it
		}
		for _, res := range results {
			if res.Status == models.ResultStatusPending {
				continue
			}
			item, ok := itemByID[res.ItemID]
			if !ok {
				return gorm.ErrRecordNotFound
			}
			before := item.Quantity
			after := res.ActualQuantity
			if before != after {
				item.Quantity = after
				if err := tx.Save(&item).Error; err != nil {
					return err
				}
				itemByID[res.ItemID] = item
				mov := models.StockMovementReceipt
				if after < before {
					mov = models.StockMovementWriteOff
				}
				led := models.InventoryStockLedger{
					SessionID:       sid,
					ItemID:          res.ItemID,
					Movement:        mov,
					AccountingQty:   res.ExpectedQuantity,
					ActualQty:       after,
					BalanceBefore:   before,
					BalanceAfter:    after,
					Delta:           after - before,
					ActorID:         &uid,
				}
				if err := tx.Create(&led).Error; err != nil {
					return err
				}
				kindRu := "оприходование по результатам инвентаризации"
				if mov == models.StockMovementWriteOff {
					kindRu = "списание по результатам инвентаризации"
				}
				saveItemHistory(tx, item.ID, &uid, fmt.Sprintf(
					"Проведение документа инвентаризации: %s; остаток %d→%d (в документе учётное %d, факт %d)",
					kindRu, before, after, res.ExpectedQuantity, after,
				))
			}
		}
		s.Status = models.SessionStatusCompleted
		if err := tx.Save(s).Error; err != nil {
			return err
		}
		h.logSessionEvent(tx, sid, &uid, "session_completed", "Документ проведён: остатки выровнены по факту, движения записаны в реестр")
		return nil
	}); err != nil {
		log.Printf("complete session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	var completedSession models.InventorySession
	if err := h.DB.First(&completedSession, "id = ?", sid).Error; err != nil {
		log.Printf("complete session reload: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, completedSession)
}

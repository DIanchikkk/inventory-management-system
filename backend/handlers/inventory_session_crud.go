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

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

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
		var err error
		s, err = h.createSessionInTx(tx, uid, body)
		return err
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

func (h *InventoryHandler) createSessionInTx(tx *gorm.DB, uid uuid.UUID, body createSessionRequest) (models.InventorySession, error) {
	docNo, err := nextInventoryDocNo(tx)
	if err != nil {
		return models.InventorySession{}, err
	}
	var filterCatID *uuid.UUID
	filterCatName := ""
	if body.CategoryID != nil && *body.CategoryID != uuid.Nil {
		var cat models.Category
		if err := tx.First(&cat, "id = ?", *body.CategoryID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return models.InventorySession{}, errInventoryCategoryMissing
			}
			return models.InventorySession{}, err
		}
		cid := *body.CategoryID
		filterCatID = &cid
		filterCatName = cat.Name
	}
	s := models.InventorySession{
		CreatedBy:          uid,
		Status:             models.SessionStatusActive,
		DocumentNo:         docNo,
		Notes:              strings.TrimSpace(body.Notes),
		FilterLocation:     strings.TrimSpace(body.LocationSubstring),
		FilterCategoryID:   filterCatID,
		FilterCategoryName: filterCatName,
	}
	if err := tx.Create(&s).Error; err != nil {
		return models.InventorySession{}, err
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
		return models.InventorySession{}, err
	}
	if len(items) == 0 {
		return s, nil
	}
	snapshots := make([]models.InventoryResult, 0, len(items))
	for _, it := range items {
		snapshots = append(snapshots, models.InventoryResult{
			SessionID:        s.ID,
			ItemID:           it.ID,
			ExpectedQuantity: it.Quantity,
			ActualQuantity:   0,
			Status:           models.ResultStatusPending,
		})
	}
	h.logSessionEvent(tx, s.ID, &uid, "session_created", fmt.Sprintf("Создан документ инвентаризации, строк в опись: %d", len(snapshots)))
	if err := tx.Create(&snapshots).Error; err != nil {
		return models.InventorySession{}, err
	}
	return s, nil
}

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
	userIDs := make([]uuid.UUID, 0, len(sessions))
	for _, s := range sessions {
		userIDs = append(userIDs, s.CreatedBy)
	}

	var users []models.User
	if len(userIDs) > 0 {
		h.DB.Where("id IN ?", userIDs).Find(&users)
	}

	usernames := make(map[uuid.UUID]string)
	for _, u := range users {
		usernames[u.ID] = u.Username
	}

	for i := range sessions {
		sessions[i].CreatedByUsername = usernames[sessions[i].CreatedBy]
	}
	c.JSON(http.StatusOK, paginatedSessionsResponse{
		Sessions: sessions,
		Page:     page,
		PageSize: pageSize,
		Total:    total,
	})
}

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
	var user models.User
	if err := h.DB.First(&user, "id = ?", s.CreatedBy).Error; err == nil {
		s.CreatedByUsername = user.Username
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

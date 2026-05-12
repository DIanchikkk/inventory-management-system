package handlers

import (
	"errors"
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

type sessionLinesResponse struct {
	Items    []models.Item            `json:"items"`
	Results  []models.InventoryResult `json:"results"`
	Page     int                      `json:"page"`
	PageSize int                      `json:"page_size"`
	Total    int64                    `json:"total"`
}

func parseInventoryPageParams(c *gin.Context, defaultSize int) (page int, pageSize int) {
	page = 1
	pageSize = defaultSize
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
	maxSize := 100
	if strings.TrimSpace(c.Query("q")) != "" {
		maxSize = 500
	}
	if pageSize > maxSize {
		pageSize = maxSize
	}
	return page, pageSize
}

func sessionLinesOrder(groupBy string) string {
	switch strings.TrimSpace(groupBy) {
	case "location":
		return "items.location ASC, items.name ASC"
	case "category":
		return "items.category ASC, items.name ASC"
	default:
		return "items.name ASC"
	}
}

func (h *InventoryHandler) linesBaseQuery(sessionID uuid.UUID, filter string, search string, locationFilter string) *gorm.DB {
	q := h.DB.Model(&models.InventoryResult{}).
		Joins("JOIN items ON items.id = inventory_results.item_id").
		Where("inventory_results.session_id = ?", sessionID)
	filter = strings.TrimSpace(filter)
	if filter != "" && filter != "all" {
		q = q.Where("inventory_results.status = ?", filter)
	}
	locationFilter = strings.TrimSpace(locationFilter)
	if locationFilter != "" {
		q = q.Where("items.location ILIKE ?", "%"+locationFilter+"%")
	}
	search = strings.TrimSpace(search)
	if search != "" {
		pattern := "%" + search + "%"
		if id, err := uuid.Parse(search); err == nil {
			q = q.Where("items.id = ? OR items.name ILIKE ? OR items.sku ILIKE ?", id, pattern, pattern)
		} else {
			q = q.Where("items.name ILIKE ? OR items.sku ILIKE ?", pattern, pattern)
		}
	}
	return q
}

// GetSessionLines — GET /inventory/sessions/:id/lines
func (h *InventoryHandler) GetSessionLines(c *gin.Context) {
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
		log.Printf("session lines session load: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if s.CreatedBy != uid && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	filter := strings.TrimSpace(c.DefaultQuery("filter", "all"))
	if filter != "" && filter != "all" && filter != models.ResultStatusPending &&
		filter != models.ResultStatusMatch && filter != models.ResultStatusMismatch && filter != models.ResultStatusMissing {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid filter"})
		return
	}

	search := strings.TrimSpace(c.Query("q"))
	locationFilter := strings.TrimSpace(c.Query("location"))
	groupBy := strings.TrimSpace(c.DefaultQuery("group_by", "none"))
	page, pageSize := parseInventoryPageParams(c, 20)

	base := h.linesBaseQuery(sid, filter, search, locationFilter)

	var total int64
	if err := base.Count(&total).Error; err != nil {
		log.Printf("session lines count: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	order := sessionLinesOrder(groupBy)
	q2 := h.linesBaseQuery(sid, filter, search, locationFilter)

	var results []models.InventoryResult
	if err := q2.Order(order).Offset((page - 1) * pageSize).Limit(pageSize).Find(&results).Error; err != nil {
		log.Printf("session lines find: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if len(results) == 0 {
		c.JSON(http.StatusOK, sessionLinesResponse{
			Items:    []models.Item{},
			Results:  []models.InventoryResult{},
			Page:     page,
			PageSize: pageSize,
			Total:    total,
		})
		return
	}

	ids := make([]uuid.UUID, len(results))
	for i := range results {
		ids[i] = results[i].ItemID
	}
	var items []models.Item
	if err := h.DB.Where("id IN ?", ids).Find(&items).Error; err != nil {
		log.Printf("session lines items: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	byID := make(map[string]models.Item, len(items))
	for _, it := range items {
		byID[it.ID.String()] = it
	}
	outItems := make([]models.Item, len(results))
	for i := range results {
		outItems[i] = byID[results[i].ItemID.String()]
	}

	c.JSON(http.StatusOK, sessionLinesResponse{
		Items:    outItems,
		Results:  results,
		Page:     page,
		PageSize: pageSize,
		Total:    total,
	})
}

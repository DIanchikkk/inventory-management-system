package handlers

import (
	"errors"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *ItemHandler) ListItems(c *gin.Context) {
	q := c.Query("q")
	sortBy := strings.TrimSpace(c.DefaultQuery("sort_by", "name"))
	sortDir := strings.ToLower(strings.TrimSpace(c.DefaultQuery("sort_dir", "asc")))
	lowStockOnly := strings.TrimSpace(c.Query("low_stock")) == "true"
	page, pageSize := parsePagination(c, 50)

	var items []models.Item
	query := h.DB.Model(&models.Item{})
	if strings.TrimSpace(c.Query("include_retired")) != "true" {
		query = query.Where("retired_at IS NULL")
	}

	if q != "" {
		pattern := "%" + q + "%"
		query = query.Where(
			"name ILIKE ? OR description ILIKE ? OR sku ILIKE ? OR category ILIKE ? OR location ILIKE ?",
			pattern, pattern, pattern, pattern, pattern,
		)
	}
	if lowStockOnly {
		query = query.Where("quantity <= min_quantity")
	}
	replacementRemind := strings.TrimSpace(c.Query("replacement_remind"))
	if replacementRemind == "true" || replacementRemind == "1" {
		today := time.Now().UTC().Truncate(24 * time.Hour)
		until := today.AddDate(0, 0, 90)
		expr := "(purchase_date::date + ((service_life_years::text || ' years')::interval))::date"
		query = query.Where("retired_at IS NULL").
			Where(expr+" <= ?", until.Format("2006-01-02"))
	}
	orderBy := "name asc"
	switch sortBy {
	case "quantity":
		orderBy = "quantity asc"
	case "purchase_date":
		orderBy = "purchase_date asc"
	case "created_at":
		orderBy = "created_at asc"
	}
	if sortDir == "desc" {
		orderBy = strings.Replace(orderBy, " asc", " desc", 1)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		log.Printf("list items count: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if err := query.Order(orderBy).Offset((page - 1) * pageSize).Limit(pageSize).Find(&items).Error; err != nil {
		log.Printf("list items: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, paginatedItemsResponse{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    total,
	})
}

func (h *ItemHandler) GetItem(c *gin.Context) {
	id, ok := ParseUUIDParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var item models.Item
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
			return
		}
		log.Printf("get item: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, item)
}

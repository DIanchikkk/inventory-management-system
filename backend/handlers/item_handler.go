package handlers

import (
	"inventory-system/backend/models"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ItemHandler struct {
	DB *gorm.DB
}

type itemRequest struct {
	Name             string `json:"name" binding:"required"`
	SKU              string `json:"sku" binding:"required"`
	CategoryID       string `json:"category_id" binding:"required"`
	Description      string `json:"description"`
	Quantity         int    `json:"quantity" binding:"gte=0"`
	Unit             string `json:"unit" binding:"required"`
	Location         string `json:"location" binding:"required"`
	MinQuantity      int    `json:"min_quantity" binding:"gte=0"`
	PurchaseDate     string `json:"purchase_date" binding:"required"`
	ImageURL         string `json:"image_url"`
	ServiceLifeYears int    `json:"service_life_years"`
	Retired          bool   `json:"retired"`
	ReplacedByItemID string `json:"replaced_by_item_id"`
}

type paginatedItemsResponse struct {
	Items    []models.Item `json:"items"`
	Page     int           `json:"page"`
	PageSize int           `json:"page_size"`
	Total    int64         `json:"total"`
}

func parsePagination(c *gin.Context, defaultSize int) (int, int) {
	page := 1
	pageSize := defaultSize
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
	return page, pageSize
}

package handlers

// При необходимости: JWT middleware на группу /items.

import (
	"errors"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type itemRequest struct {
	Name         string `json:"name" binding:"required"`
	Description  string `json:"description"`
	Quantity     int    `json:"quantity" binding:"gte=0"`
	PurchaseDate string `json:"purchase_date" binding:"required"`
}

func parsePurchaseDate(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02", s)
}

// ItemHandler держит подключение к БД; так не нужен c.MustGet("db") и паника.
type ItemHandler struct {
	DB *gorm.DB
}

// ListItems — GET /items?q=...
func (h *ItemHandler) ListItems(c *gin.Context) {
	q := c.Query("q")

	var items []models.Item
	query := h.DB.Model(&models.Item{})

	if q != "" {
		pattern := "%" + q + "%"
		query = query.Where("name ILIKE ? OR description ILIKE ?", pattern, pattern)
	}

	if err := query.Find(&items).Error; err != nil {
		log.Printf("list items: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, items)
}

// GetItem — GET /items/:id
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

// CreateItem — POST /items
func (h *ItemHandler) CreateItem(c *gin.Context) {
	var req itemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	pd, err := parsePurchaseDate(req.PurchaseDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase_date: use RFC3339 or YYYY-MM-DD"})
		return
	}

	item := models.Item{
		Name:         req.Name,
		Description:  req.Description,
		Quantity:     req.Quantity,
		PurchaseDate: pd,
	}
	if err := h.DB.Create(&item).Error; err != nil {
		log.Printf("create item: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

// UpdateItem — PUT /items/:id
func (h *ItemHandler) UpdateItem(c *gin.Context) {
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
		log.Printf("update item (load): %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var req itemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	pd, err := parsePurchaseDate(req.PurchaseDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase_date: use RFC3339 or YYYY-MM-DD"})
		return
	}

	item.Name = req.Name
	item.Description = req.Description
	item.Quantity = req.Quantity
	item.PurchaseDate = pd

	if err := h.DB.Save(&item).Error; err != nil {
		log.Printf("update item: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// DeleteItem — DELETE /items/:id (soft delete)
func (h *ItemHandler) DeleteItem(c *gin.Context) {
	id, ok := ParseUUIDParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	res := h.DB.Delete(&models.Item{}, "id = ?", id)
	if res.Error != nil {
		log.Printf("delete item: %v", res.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

package handlers

import (
	"errors"
	"fmt"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func itemWriteBadRequest(c *gin.Context, err error) {
	c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
}

func skuConflictResponse(c *gin.Context, err error) bool {
	if strings.Contains(strings.ToLower(err.Error()), "unique") && strings.Contains(strings.ToLower(err.Error()), "sku") {
		c.JSON(http.StatusConflict, gin.H{"error": "item with this sku already exists"})
		return true
	}
	return false
}

func (h *ItemHandler) CreateItem(c *gin.Context) {
	var req itemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resolved, err := resolveItemRequest(h.DB, req, uuid.Nil)
	if err != nil {
		itemWriteBadRequest(c, err)
		return
	}
	item := resolved.newItem()
	if err := h.DB.Create(&item).Error; err != nil {
		if skuConflictResponse(c, err) {
			return
		}
		log.Printf("create item: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if uid, ok := middleware.GetUserID(c); ok {
		saveItemHistory(h.DB, item.ID, &uid, fmt.Sprintf("Создан объект · %s · %s", item.SKU, item.Name))
	}
	c.JSON(http.StatusCreated, item)
}

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
	prev := item

	var req itemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resolved, err := resolveItemRequest(h.DB, req, id)
	if err != nil {
		itemWriteBadRequest(c, err)
		return
	}
	resolved.applyTo(&item, req.Retired)

	if err := h.DB.Save(&item).Error; err != nil {
		if skuConflictResponse(c, err) {
			return
		}
		log.Printf("update item: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if uid, ok := middleware.GetUserID(c); ok {
		if msg := itemChangeSummary(prev, item); msg != "" {
			saveItemHistory(h.DB, item.ID, &uid, msg)
		}
	}
	c.JSON(http.StatusOK, item)
}

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

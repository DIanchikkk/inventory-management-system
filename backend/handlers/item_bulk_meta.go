package handlers

import (
	"inventory-system/backend/catalog"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type bulkMetaRequest struct {
	IDs        []string `json:"ids" binding:"required"`
	Location   *string  `json:"location"`
	Category   *string  `json:"category"`
	CategoryID *string  `json:"category_id"`
}

func (h *ItemHandler) BulkUpdateMeta(c *gin.Context) {
	var req bulkMetaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.IDs) == 0 || len(req.IDs) > 300 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ids: от 1 до 300 записей"})
		return
	}
	loc := ""
	if req.Location != nil {
		loc = strings.TrimSpace(*req.Location)
	}
	cat := ""
	if req.Category != nil {
		cat = strings.TrimSpace(*req.Category)
	}
	var bulkCatID uuid.UUID
	if req.CategoryID != nil && strings.TrimSpace(*req.CategoryID) != "" {
		id, err := uuid.Parse(strings.TrimSpace(*req.CategoryID))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category_id"})
			return
		}
		var catRow models.Category
		if err := h.DB.First(&catRow, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "category not found"})
			return
		}
		bulkCatID = id
		cat = catRow.Name
	}
	if loc == "" && cat == "" && bulkCatID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "укажите location и/или category (или category_id)"})
		return
	}

	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var ids []uuid.UUID
	for _, s := range req.IDs {
		id, err := uuid.Parse(strings.TrimSpace(s))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id in list"})
			return
		}
		ids = append(ids, id)
	}

	tx := h.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var updated int64
	for _, id := range ids {
		var it models.Item
		if err := tx.First(&it, "id = ? AND deleted_at IS NULL", id).Error; err != nil {
			continue
		}
		prev := it
		if loc != "" {
			it.Location = loc
		}
		if bulkCatID != uuid.Nil {
			it.CategoryID = bulkCatID
			it.Category = cat
		} else if cat != "" {
			cid, err := catalog.EnsureCategory(tx, cat)
			if err != nil {
				tx.Rollback()
				log.Printf("bulk meta category: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
				return
			}
			it.CategoryID = cid
			it.Category = strings.TrimSpace(cat)
		}
		if err := tx.Save(&it).Error; err != nil {
			tx.Rollback()
			log.Printf("bulk meta: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		msg := itemChangeSummary(prev, it)
		if msg != "" {
			saveItemHistory(tx, it.ID, &uid, "Массовое изменение: "+msg)
		}
		updated++
	}
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": updated})
}

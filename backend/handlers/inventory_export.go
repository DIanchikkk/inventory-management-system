package handlers

import (
	"encoding/csv"
	"errors"
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

// ExportSessionCSV — GET /inventory/sessions/:id/export
func (h *InventoryHandler) ExportSessionCSV(c *gin.Context) {
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
		log.Printf("export session load: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if s.CreatedBy != uid && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var results []models.InventoryResult
	if err := h.DB.Where("session_id = ?", sid).Order("created_at").Find(&results).Error; err != nil {
		log.Printf("export session results: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	itemByID := make(map[uuid.UUID]models.Item, len(results))
	if len(results) > 0 {
		ids := make([]uuid.UUID, 0, len(results))
		seen := make(map[uuid.UUID]struct{}, len(results))
		for _, r := range results {
			if _, ok := seen[r.ItemID]; ok {
				continue
			}
			seen[r.ItemID] = struct{}{}
			ids = append(ids, r.ItemID)
		}
		var items []models.Item
		if err := h.DB.Where("id IN ?", ids).Find(&items).Error; err != nil {
			log.Printf("export session items: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		for _, it := range items {
			itemByID[it.ID] = it
		}
	}

	fileStem := strings.TrimSpace(s.DocumentNo)
	if fileStem == "" {
		fileStem = "session-" + sid.String()
	}
	fileStem = strings.ReplaceAll(fileStem, "/", "-")

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="`+fileStem+`.csv"`)
	if _, err := c.Writer.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return
	}

	w := csv.NewWriter(c.Writer)
	header := []string{
		"document_no", "session_notes", "filter_location", "filter_category",
		"session_id", "session_status", "item_id", "item_sku", "item_name", "item_category", "item_location",
		"expected_quantity", "actual_quantity", "delta", "result_status", "recorded_at",
	}
	if err := w.Write(header); err != nil {
		return
	}
	for _, r := range results {
		it := itemByID[r.ItemID]
		delta := r.ActualQuantity - r.ExpectedQuantity
		row := []string{
			s.DocumentNo,
			s.Notes,
			s.FilterLocation,
			s.FilterCategoryName,
			s.ID.String(),
			s.Status,
			r.ItemID.String(),
			it.SKU,
			it.Name,
			it.Category,
			it.Location,
			strconv.Itoa(r.ExpectedQuantity),
			strconv.Itoa(r.ActualQuantity),
			strconv.Itoa(delta),
			r.Status,
			r.UpdatedAt.Format(time.RFC3339),
		}
		if err := w.Write(row); err != nil {
			return
		}
	}
	w.Flush()
}

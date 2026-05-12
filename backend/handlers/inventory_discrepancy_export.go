package handlers

import (
	"encoding/csv"
	"errors"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ExportDiscrepanciesCSV — GET /inventory/sessions/:id/discrepancies/export
func (h *InventoryHandler) ExportDiscrepanciesCSV(c *gin.Context) {
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
		log.Printf("export discrepancies session load: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if s.CreatedBy != uid && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	var results []models.InventoryResult
	if err := h.DB.Where("session_id = ? AND status IN ?", sid, []string{
		models.ResultStatusMismatch, models.ResultStatusMissing,
	}).Find(&results).Error; err != nil {
		log.Printf("export discrepancies results: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	itemByID := map[uuid.UUID]models.Item{}
	if len(results) > 0 {
		ids := make([]uuid.UUID, 0, len(results))
		for _, r := range results {
			ids = append(ids, r.ItemID)
		}
		var items []models.Item
		if err := h.DB.Where("id IN ?", ids).Find(&items).Error; err != nil {
			log.Printf("export discrepancies items: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		for _, it := range items {
			itemByID[it.ID] = it
		}
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="discrepancy-act-`+sid.String()+`.csv"`)
	if _, err := c.Writer.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return
	}
	w := csv.NewWriter(c.Writer)
	header := []string{
		"session_id", "item_sku", "item_name", "item_category", "item_location",
		"expected_quantity", "actual_quantity", "delta", "status",
		"comment", "confirmed", "confirmed_by", "confirmed_at",
	}
	if err := w.Write(header); err != nil {
		return
	}
	for _, r := range results {
		it := itemByID[r.ItemID]
		delta := r.ActualQuantity - r.ExpectedQuantity
		confirmedBy := ""
		if r.ConfirmedBy != nil {
			confirmedBy = r.ConfirmedBy.String()
		}
		confirmedAt := ""
		if r.ConfirmedAt != nil {
			confirmedAt = r.ConfirmedAt.Format(time.RFC3339)
		}
		row := []string{
			s.ID.String(),
			it.SKU,
			it.Name,
			it.Category,
			it.Location,
			strconv.Itoa(r.ExpectedQuantity),
			strconv.Itoa(r.ActualQuantity),
			strconv.Itoa(delta),
			r.Status,
			r.Comment,
			strconv.FormatBool(r.DiscrepancyConfirmed),
			confirmedBy,
			confirmedAt,
		}
		if err := w.Write(row); err != nil {
			return
		}
	}
	w.Flush()
}

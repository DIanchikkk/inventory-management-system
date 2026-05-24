package handlers

import (
	"encoding/json"
	"inventory-system/backend/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func (h *ItemHandler) ExportSnapshotJSON(c *gin.Context) {
	var ic int64
	h.DB.Model(&models.Item{}).Where("deleted_at IS NULL").Count(&ic)
	if ic > 2500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "слишком много объектов для JSON (>2500); используйте экспорт CSV"})
		return
	}
	var items []models.Item
	if err := h.DB.Where("deleted_at IS NULL").Order("name").Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	var sessions []models.InventorySession
	if err := h.DB.Order("created_at DESC").Limit(500).Find(&sessions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	payload := gin.H{
		"exported_at":        time.Now().UTC().Format(time.RFC3339),
		"items":              items,
		"inventory_sessions": sessions,
		"note":               "Не полный дамп БД; для резервной копии используйте pg_dump PostgreSQL.",
	}
	b, err := json.Marshal(payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "marshal"})
		return
	}
	c.Header("Content-Type", "application/json; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="inventory-snapshot.json"`)
	c.Data(http.StatusOK, "application/json; charset=utf-8", b)
}

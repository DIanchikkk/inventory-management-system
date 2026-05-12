package handlers

import (
	"encoding/csv"
	"errors"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ExportAuditCSV — GET /inventory/sessions/:id/audit/export
func (h *InventoryHandler) ExportAuditCSV(c *gin.Context) {
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
		log.Printf("audit export session load: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if s.CreatedBy != uid && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	var events []models.InventorySessionEvent
	if err := h.DB.Where("session_id = ?", sid).Order("created_at ASC").Find(&events).Error; err != nil {
		log.Printf("audit export list: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="session-audit-`+sid.String()+`.csv"`)
	if _, err := c.Writer.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return
	}
	w := csv.NewWriter(c.Writer)
	header := []string{"created_at", "action", "actor_id", "details"}
	if err := w.Write(header); err != nil {
		return
	}
	for _, ev := range events {
		actor := ""
		if ev.ActorID != nil {
			actor = ev.ActorID.String()
		}
		row := []string{
			ev.CreatedAt.Format(time.RFC3339),
			ev.Action,
			actor,
			strings.ReplaceAll(ev.Details, "\r\n", " "),
		}
		if err := w.Write(row); err != nil {
			return
		}
	}
	w.Flush()
}

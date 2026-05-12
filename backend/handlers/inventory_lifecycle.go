package handlers

import (
	"errors"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ListAuditEvents — GET /inventory/sessions/:id/audit
func (h *InventoryHandler) ListAuditEvents(c *gin.Context) {
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
		log.Printf("audit session load: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if s.CreatedBy != uid && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	var events []models.InventorySessionEvent
	if err := h.DB.Where("session_id = ?", sid).Order("created_at DESC").Find(&events).Error; err != nil {
		log.Printf("audit list: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, events)
}

// SendToReview — POST /inventory/sessions/:id/review
func (h *InventoryHandler) SendToReview(c *gin.Context) {
	expected, bad := parseExpectedUpdatedAt(c)
	if bad {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid expected_updated_at (use RFC3339)"})
		return
	}

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
	s, ok := h.sessionForUser(c, uid, sid, role)
	if !ok {
		return
	}
	if !checkSessionVersion(c, s, expected) {
		return
	}
	if s.Status != models.SessionStatusActive {
		c.JSON(http.StatusConflict, gin.H{"error": "only active session can be sent to review"})
		return
	}
	s.Status = models.SessionStatusReview
	if err := h.DB.Save(s).Error; err != nil {
		log.Printf("send to review: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	h.logSessionEvent(h.DB, sid, &uid, "session_review", "Session moved to review")
	c.JSON(http.StatusOK, s)
}

// ArchiveSession — POST /inventory/sessions/:id/archive
func (h *InventoryHandler) ArchiveSession(c *gin.Context) {
	expected, bad := parseExpectedUpdatedAt(c)
	if bad {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid expected_updated_at (use RFC3339)"})
		return
	}

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
		log.Printf("archive session load: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if s.CreatedBy != uid && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	if s.Status != models.SessionStatusCompleted {
		c.JSON(http.StatusConflict, gin.H{"error": "only completed session can be archived"})
		return
	}
	if !checkSessionVersion(c, &s, expected) {
		return
	}
	s.Status = models.SessionStatusArchived
	if err := h.DB.Save(&s).Error; err != nil {
		log.Printf("archive session save: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	h.logSessionEvent(h.DB, sid, &uid, "session_archived", "Session archived")
	c.JSON(http.StatusOK, s)
}

type discrepancyItem struct {
	Result models.InventoryResult `json:"result"`
	Item   models.Item            `json:"item"`
}

// ListDiscrepancies — GET /inventory/sessions/:id/discrepancies
func (h *InventoryHandler) ListDiscrepancies(c *gin.Context) {
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
		log.Printf("discrepancies session load: %v", err)
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
		log.Printf("list discrepancies results: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if len(results) == 0 {
		c.JSON(http.StatusOK, []discrepancyItem{})
		return
	}
	itemIDs := make([]interface{}, 0, len(results))
	for _, r := range results {
		itemIDs = append(itemIDs, r.ItemID)
	}
	var items []models.Item
	if err := h.DB.Where("id IN ?", itemIDs).Find(&items).Error; err != nil {
		log.Printf("list discrepancies items: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	itemByID := map[string]models.Item{}
	for _, it := range items {
		itemByID[it.ID.String()] = it
	}
	out := make([]discrepancyItem, 0, len(results))
	for _, r := range results {
		out = append(out, discrepancyItem{Result: r, Item: itemByID[r.ItemID.String()]})
	}
	c.JSON(http.StatusOK, out)
}

// ConfirmDiscrepancy — POST /inventory/sessions/:id/discrepancies/:item_id/confirm (admin only)
func (h *InventoryHandler) ConfirmDiscrepancy(c *gin.Context) {
	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	sid, ok := ParseUUIDParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	itemID, ok := ParseUUIDParam(c, "item_id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid item_id"})
		return
	}
	var r models.InventoryResult
	if err := h.DB.Where("session_id = ? AND item_id = ?", sid, itemID).First(&r).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "discrepancy not found"})
			return
		}
		log.Printf("confirm discrepancy load: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if r.Status != models.ResultStatusMismatch && r.Status != models.ResultStatusMissing {
		c.JSON(http.StatusConflict, gin.H{"error": "only mismatch/missing can be confirmed"})
		return
	}
	now := time.Now()
	r.DiscrepancyConfirmed = true
	r.ConfirmedBy = &uid
	r.ConfirmedAt = &now
	if err := h.DB.Save(&r).Error; err != nil {
		log.Printf("confirm discrepancy save: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	h.logSessionEvent(h.DB, sid, &uid, "discrepancy_confirmed", "Confirmed discrepancy for item "+itemID.String())
	c.JSON(http.StatusOK, r)
}

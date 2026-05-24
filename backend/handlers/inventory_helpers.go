package handlers

import (
	"errors"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type sessionStatusSummary struct {
	Total    int64 `json:"total"`
	Pending  int64 `json:"pending"`
	Match    int64 `json:"match"`
	Mismatch int64 `json:"mismatch"`
	Missing  int64 `json:"missing"`
}

type sessionDetailResponse struct {
	Session models.InventorySession `json:"session"`
	Summary sessionStatusSummary    `json:"summary"`
}

func sessionSummaryForSession(db *gorm.DB, sessionID uuid.UUID) (sessionStatusSummary, error) {
	var agg []struct {
		Status string `gorm:"column:status"`
		N      int64  `gorm:"column:n"`
	}
	err := db.Model(&models.InventoryResult{}).
		Select("status, COUNT(*) AS n").
		Where("session_id = ?", sessionID).
		Group("status").
		Scan(&agg).Error
	if err != nil {
		return sessionStatusSummary{}, err
	}
	out := sessionStatusSummary{}
	for _, row := range agg {
		out.Total += row.N
		switch row.Status {
		case models.ResultStatusPending:
			out.Pending += row.N
		case models.ResultStatusMatch:
			out.Match += row.N
		case models.ResultStatusMismatch:
			out.Mismatch += row.N
		case models.ResultStatusMissing:
			out.Missing += row.N
		}
	}
	return out, nil
}

func parseExpectedUpdatedAt(c *gin.Context) (expected *time.Time, badRequest bool) {
	if c.Request.ContentLength == 0 {
		return nil, false
	}
	var body struct {
		ExpectedUpdatedAt *string `json:"expected_updated_at"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		return nil, true
	}
	if body.ExpectedUpdatedAt == nil || strings.TrimSpace(*body.ExpectedUpdatedAt) == "" {
		return nil, false
	}
	s := strings.TrimSpace(*body.ExpectedUpdatedAt)
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		t2, err2 := time.Parse(time.RFC3339, s)
		if err2 != nil {
			return nil, true
		}
		return &t2, false
	}
	return &t, false
}

func parseCompleteSessionBody(c *gin.Context) (expected *time.Time, allowIncomplete bool, badRequest bool) {
	if c.Request.ContentLength == 0 {
		return nil, false, false
	}
	var body struct {
		ExpectedUpdatedAt *string `json:"expected_updated_at"`
		AllowIncomplete   bool    `json:"allow_incomplete"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		return nil, false, true
	}
	if body.ExpectedUpdatedAt != nil && strings.TrimSpace(*body.ExpectedUpdatedAt) != "" {
		s := strings.TrimSpace(*body.ExpectedUpdatedAt)
		t, err := time.Parse(time.RFC3339Nano, s)
		if err != nil {
			t2, err2 := time.Parse(time.RFC3339, s)
			if err2 != nil {
				return nil, false, true
			}
			expected = &t2
		} else {
			expected = &t
		}
	}
	return expected, body.AllowIncomplete, false
}

func checkSessionVersion(c *gin.Context, s *models.InventorySession, expected *time.Time) bool {
	if expected == nil {
		return true
	}
	if s.UpdatedAt.IsZero() {
		return true
	}
	au := s.UpdatedAt.UTC().Truncate(time.Millisecond)
	eu := expected.UTC().Truncate(time.Millisecond)
	if !au.Equal(eu) {
		c.JSON(http.StatusConflict, gin.H{
			"error": "данные сессии изменились; обновите страницу и повторите действие",
			"code":  "version_mismatch",
		})
		return false
	}
	return true
}

func computeResultStatus(expected, actual int) string {
	if actual == expected {
		return models.ResultStatusMatch
	}
	if actual == 0 && expected > 0 {
		return models.ResultStatusMissing
	}
	return models.ResultStatusMismatch
}

func (h *InventoryHandler) sessionForUser(c *gin.Context, uid, sid uuid.UUID, role string) (*models.InventorySession, bool) {
	var s models.InventorySession
	if err := h.DB.First(&s, "id = ?", sid).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
			return nil, false
		}
		log.Printf("session for user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return nil, false
	}
	if s.CreatedBy != uid && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return nil, false
	}
	if s.Status == models.SessionStatusCompleted || s.Status == models.SessionStatusArchived {
		c.JSON(http.StatusConflict, gin.H{"error": "session is locked"})
		return nil, false
	}
	return &s, true
}

func (h *InventoryHandler) upsertResult(db *gorm.DB, sessionID, itemID uuid.UUID, actualQty int) error {
	var res models.InventoryResult
	err := db.Where("session_id = ? AND item_id = ?", sessionID, itemID).First(&res).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		var item models.Item
		if err := db.First(&item, "id = ?", itemID).Error; err != nil {
			return err
		}
		expected := item.Quantity
		status := computeResultStatus(expected, actualQty)
		res = models.InventoryResult{
			SessionID:        sessionID,
			ItemID:           itemID,
			ExpectedQuantity: expected,
			ActualQuantity:   actualQty,
			Status:           status,
		}
		return db.Create(&res).Error
	}
	if err != nil {
		return err
	}
	status := computeResultStatus(res.ExpectedQuantity, actualQty)
	res.ActualQuantity = actualQty
	res.Status = status
	return db.Save(&res).Error
}

func (h *InventoryHandler) logSessionEvent(db *gorm.DB, sessionID uuid.UUID, actorID *uuid.UUID, action, details string) {
	ev := models.InventorySessionEvent{
		SessionID: sessionID,
		ActorID:   actorID,
		Action:    action,
		Details:   details,
	}
	if err := db.Create(&ev).Error; err != nil {
		log.Printf("audit log failed: %v", err)
	}
}

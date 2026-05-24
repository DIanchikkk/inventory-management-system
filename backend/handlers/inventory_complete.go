package handlers

import (
	"errors"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func (h *InventoryHandler) CompleteSession(c *gin.Context) {
	expected, allowIncomplete, bad := parseCompleteSessionBody(c)
	if bad {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body (expected_updated_at RFC3339, allow_incomplete optional)"})
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

	if allowIncomplete && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "принудительное завершение доступно только администратору"})
		return
	}

	s, ok := h.sessionForUser(c, uid, sid, role)
	if !ok {
		return
	}

	if !checkSessionVersion(c, s, expected) {
		return
	}

	if s.Status != models.SessionStatusReview && s.Status != models.SessionStatusActive {
		c.JSON(http.StatusConflict, gin.H{"error": "session cannot be completed from current status"})
		return
	}

	if err := h.validateSessionReadyToComplete(c, sid, role, allowIncomplete); err != nil {
		return
	}

	if err := h.DB.Transaction(func(tx *gorm.DB) error {
		return h.completeSessionInTx(tx, s, sid, uid)
	}); err != nil {
		log.Printf("complete session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var completedSession models.InventorySession
	if err := h.DB.First(&completedSession, "id = ?", sid).Error; err != nil {
		log.Printf("complete session reload: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, completedSession)
}

func (h *InventoryHandler) validateSessionReadyToComplete(c *gin.Context, sid uuid.UUID, role string, allowIncomplete bool) error {
	var pendingCount int64
	if err := h.DB.Model(&models.InventoryResult{}).
		Where("session_id = ? AND status = ?", sid, models.ResultStatusPending).
		Count(&pendingCount).Error; err != nil {
		log.Printf("complete session pending count: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return err
	}
	if pendingCount > 0 && !(role == "admin" && allowIncomplete) {
		c.JSON(http.StatusConflict, gin.H{
			"error":         "есть непосчитанные позиции; укажите факт по всем строкам или (администратор) завершите с allow_incomplete",
			"code":          "pending_uncounted",
			"pending_count": pendingCount,
		})
		return errors.New("pending")
	}
	return nil
}

func (h *InventoryHandler) completeSessionInTx(tx *gorm.DB, s *models.InventorySession, sid, uid uuid.UUID) error {
	var results []models.InventoryResult
	if err := tx.Where("session_id = ?", sid).Find(&results).Error; err != nil {
		return err
	}
	itemIDs := make([]uuid.UUID, 0, len(results))
	seen := make(map[uuid.UUID]struct{}, len(results))
	for _, res := range results {
		if res.Status == models.ResultStatusPending {
			continue
		}
		if _, ok := seen[res.ItemID]; ok {
			continue
		}
		seen[res.ItemID] = struct{}{}
		itemIDs = append(itemIDs, res.ItemID)
	}
	var stockItems []models.Item
	if len(itemIDs) > 0 {
		if err := tx.Where("id IN ? AND deleted_at IS NULL", itemIDs).Find(&stockItems).Error; err != nil {
			return err
		}
	}
	itemByID := make(map[uuid.UUID]models.Item, len(stockItems))
	for _, it := range stockItems {
		itemByID[it.ID] = it
	}
	var ledgerDrafts []ledgerDraft
	registratorNo := strings.TrimSpace(s.DocumentNo)
	if registratorNo == "" {
		registratorNo = sid.String()
	}
	for _, res := range results {
		if res.Status == models.ResultStatusPending {
			continue
		}
		item, ok := itemByID[res.ItemID]
		if !ok {
			return gorm.ErrRecordNotFound
		}
		before := item.Quantity
		after := res.ActualQuantity
		if before == after {
			continue
		}
		item.Quantity = after
		if err := tx.Save(&item).Error; err != nil {
			return err
		}
		itemByID[res.ItemID] = item
		mov := models.StockMovementReceipt
		if after < before {
			mov = models.StockMovementWriteOff
		}
		ledgerDrafts = append(ledgerDrafts, ledgerDraft{
			itemID:   res.ItemID,
			expected: res.ExpectedQuantity,
			actual:   after,
			before:   before,
			after:    after,
			movement: mov,
		})
	}
	if err := h.postStockAdjustments(tx, sid, uid, registratorNo, ledgerDrafts); err != nil {
		return err
	}
	s.Status = models.SessionStatusCompleted
	if err := tx.Save(s).Error; err != nil {
		return err
	}
	h.logSessionEvent(tx, sid, &uid, "session_completed", "Остатки выровнены; созданы документы списания/оприходования по расхождениям")
	return nil
}

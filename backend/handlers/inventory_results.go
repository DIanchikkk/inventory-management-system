package handlers

import (
	"errors"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func (h *InventoryHandler) AddResult(c *gin.Context) {
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
	if _, ok := h.sessionForUser(c, uid, sid, role); !ok {
		return
	}

	var in resultInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateResultInput(in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.saveResultWithMetadata(h.DB, sid, uid, in)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
			return
		}
		log.Printf("add result: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	h.logSessionEvent(h.DB, sid, &uid, "result_saved", "Single result saved for item "+in.ItemID.String())
	c.JSON(http.StatusOK, res)
}

func (h *InventoryHandler) BatchResults(c *gin.Context) {
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
	if _, ok := h.sessionForUser(c, uid, sid, role); !ok {
		return
	}

	var inputs []resultInput
	if err := c.ShouldBindJSON(&inputs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	for _, in := range inputs {
		if err := validateResultInput(in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "item_id": in.ItemID})
			return
		}
	}

	if err := h.DB.Transaction(func(tx *gorm.DB) error {
		for _, in := range inputs {
			if _, err := h.saveResultWithMetadata(tx, sid, uid, in); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
			return
		}
		log.Printf("batch result: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var results []models.InventoryResult
	if err := h.DB.Where("session_id = ?", sid).Find(&results).Error; err != nil {
		log.Printf("batch reload: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	h.logSessionEvent(h.DB, sid, &uid, "batch_saved", "Batch results saved")
	c.JSON(http.StatusOK, results)
}

func validateResultInput(in resultInput) error {
	if in.ActualQuantity == nil {
		return errors.New("actual_quantity is required")
	}
	if *in.ActualQuantity < 0 {
		return errors.New("actual_quantity must be >= 0")
	}
	return nil
}

func (h *InventoryHandler) saveResultWithMetadata(db *gorm.DB, sid, uid uuid.UUID, in resultInput) (models.InventoryResult, error) {
	var before models.InventoryResult
	hadBefore := false
	if err := db.Where("session_id = ? AND item_id = ?", sid, in.ItemID).First(&before).Error; err == nil {
		hadBefore = before.Status != models.ResultStatusPending
	}
	if err := h.upsertResult(db, sid, in.ItemID, *in.ActualQuantity); err != nil {
		return models.InventoryResult{}, err
	}
	var res models.InventoryResult
	if err := db.Where("session_id = ? AND item_id = ?", sid, in.ItemID).First(&res).Error; err != nil {
		return models.InventoryResult{}, err
	}
	now := time.Now()
	if hadBefore {
		res.RecountCount++
	}
	res.CountedBy = &uid
	res.CountedAt = &now
	res.Comment = strings.TrimSpace(in.Comment)
	if err := db.Save(&res).Error; err != nil {
		return models.InventoryResult{}, err
	}
	return res, nil
}

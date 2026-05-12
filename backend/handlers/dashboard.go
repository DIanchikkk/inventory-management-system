package handlers

import (
	"inventory-system/backend/models"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// DashboardHandler — агрегированные показатели для главного экрана (КПИ по учёту).
type DashboardHandler struct {
	DB *gorm.DB
}

type dashboardSummaryResponse struct {
	ItemsTotal              int64 `json:"items_total"`
	ItemsLowStock           int64 `json:"items_low_stock"`
	ItemsReplacementOverdue int64 `json:"items_replacement_overdue"`  // плановая дата замены уже прошла
	ItemsReplacementDueSoon int64 `json:"items_replacement_due_soon"` // замена в ближайшие 90 дней
	SessionsActiveOrReview  int64 `json:"sessions_active_or_review"`
	SessionsCompleted       int64 `json:"sessions_completed"`
	SessionsArchived        int64 `json:"sessions_archived"`
}

const replacementDueDateSQL = "(purchase_date::date + ((service_life_years::text || ' years')::interval))::date"

// Summary — GET /dashboard/summary
func (h *DashboardHandler) Summary(c *gin.Context) {
	out := dashboardSummaryResponse{}
	if err := h.DB.Model(&models.Item{}).Where("retired_at IS NULL").Count(&out.ItemsTotal).Error; err != nil {
		log.Printf("dashboard items_total: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if err := h.DB.Model(&models.Item{}).
		Where("retired_at IS NULL AND quantity <= min_quantity").
		Count(&out.ItemsLowStock).Error; err != nil {
		log.Printf("dashboard low_stock: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	today := time.Now().UTC().Truncate(24 * time.Hour)
	until := today.AddDate(0, 0, 90)
	todayStr := today.Format("2006-01-02")
	untilStr := until.Format("2006-01-02")
	if err := h.DB.Model(&models.Item{}).
		Where("retired_at IS NULL").
		Where(replacementDueDateSQL+" < ?", todayStr).
		Count(&out.ItemsReplacementOverdue).Error; err != nil {
		log.Printf("dashboard replacement overdue: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if err := h.DB.Model(&models.Item{}).
		Where("retired_at IS NULL").
		Where(replacementDueDateSQL+" >= ?", todayStr).
		Where(replacementDueDateSQL+" <= ?", untilStr).
		Count(&out.ItemsReplacementDueSoon).Error; err != nil {
		log.Printf("dashboard replacement due soon: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if err := h.DB.Model(&models.InventorySession{}).
		Where("status IN ?", []string{models.SessionStatusActive, models.SessionStatusReview}).
		Count(&out.SessionsActiveOrReview).Error; err != nil {
		log.Printf("dashboard sessions active: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if err := h.DB.Model(&models.InventorySession{}).
		Where("status = ?", models.SessionStatusCompleted).
		Count(&out.SessionsCompleted).Error; err != nil {
		log.Printf("dashboard sessions completed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if err := h.DB.Model(&models.InventorySession{}).
		Where("status = ?", models.SessionStatusArchived).
		Count(&out.SessionsArchived).Error; err != nil {
		log.Printf("dashboard sessions archived: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, out)
}

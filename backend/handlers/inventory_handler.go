package handlers

import (
	"errors"
	"inventory-system/backend/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var errInventoryCategoryMissing = errors.New("inventory: category not found")

type InventoryHandler struct {
	DB *gorm.DB
}

type paginatedSessionsResponse struct {
	Sessions []models.InventorySession `json:"sessions"`
	Page     int                       `json:"page"`
	PageSize int                       `json:"page_size"`
	Total    int64                     `json:"total"`
}

type resultInput struct {
	ItemID         uuid.UUID `json:"item_id" binding:"required"`
	ActualQuantity *int      `json:"actual_quantity" binding:"required"`
	Comment        string    `json:"comment"`
}

type createSessionRequest struct {
	ItemIDs           []uuid.UUID `json:"item_ids"`
	LocationSubstring string      `json:"location"`
	CategoryID        *uuid.UUID  `json:"category_id"`
	Notes             string      `json:"notes"`
}

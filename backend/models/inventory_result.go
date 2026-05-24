package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	ResultStatusPending  = "pending"
	ResultStatusMatch    = "match"
	ResultStatusMismatch = "mismatch"
	ResultStatusMissing  = "missing"
)

type InventoryResult struct {
	ID                   uuid.UUID  `gorm:"type:uuid;primary_key;" json:"id"`
	SessionID            uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex:idx_session_item" json:"session_id"`
	ItemID               uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex:idx_session_item" json:"item_id"`
	ExpectedQuantity     int        `gorm:"not null" json:"expected_quantity"`
	ActualQuantity       int        `gorm:"not null;default:0" json:"actual_quantity"`
	Status               string     `gorm:"not null" json:"status"`
	CountedBy            *uuid.UUID `gorm:"type:uuid" json:"counted_by,omitempty"`
	CountedAt            *time.Time `json:"counted_at,omitempty"`
	Comment              string     `gorm:"not null;default:''" json:"comment"`
	RecountCount         int        `gorm:"not null;default:0" json:"recount_count"`
	DiscrepancyConfirmed bool       `gorm:"not null;default:false" json:"discrepancy_confirmed"`
	ConfirmedBy          *uuid.UUID `gorm:"type:uuid" json:"confirmed_by,omitempty"`
	ConfirmedAt          *time.Time `json:"confirmed_at,omitempty"`
	CreatedAt            time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt            time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
}

func (ir *InventoryResult) BeforeCreate(tx *gorm.DB) error {
	if ir.ID == uuid.Nil {
		ir.ID = uuid.New()
	}
	return nil
}

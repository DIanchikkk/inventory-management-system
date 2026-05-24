package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	StockMovementWriteOff = "write_off"
	StockMovementReceipt  = "receipt"
)

type InventoryStockLedger struct {
	ID                   uuid.UUID  `gorm:"type:uuid;primary_key;" json:"id"`
	SessionID            uuid.UUID  `gorm:"type:uuid;not null;index" json:"session_id"`
	AdjustmentDocumentID *uuid.UUID `gorm:"type:uuid;index" json:"adjustment_document_id,omitempty"`
	ItemID               uuid.UUID  `gorm:"type:uuid;not null;index" json:"item_id"`
	Movement             string     `gorm:"not null" json:"movement"`
	AccountingQty        int        `gorm:"not null" json:"accounting_qty"`
	ActualQty            int        `gorm:"not null" json:"actual_qty"`
	BalanceBefore        int        `gorm:"not null" json:"balance_before"`
	BalanceAfter         int        `gorm:"not null" json:"balance_after"`
	Delta                int        `gorm:"not null" json:"delta"`
	CreatedAt            time.Time  `gorm:"autoCreateTime" json:"created_at"`
	ActorID              *uuid.UUID `gorm:"type:uuid" json:"actor_id,omitempty"`
}

func (l *InventoryStockLedger) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}

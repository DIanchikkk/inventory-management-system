package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Тип движения остатка при проведении документа инвентаризации (упрощённый аналог списания/оприходования).
const (
	StockMovementWriteOff = "write_off"
	StockMovementReceipt  = "receipt"
)

// InventoryStockLedger — реестр корректировок остатков по завершённой инвентаризации (документ-регистратор = сессия).
type InventoryStockLedger struct {
	ID              uuid.UUID  `gorm:"type:uuid;primary_key;" json:"id"`
	SessionID       uuid.UUID  `gorm:"type:uuid;not null;index" json:"session_id"`
	ItemID          uuid.UUID  `gorm:"type:uuid;not null;index" json:"item_id"`
	Movement        string     `gorm:"not null" json:"movement"` // write_off | receipt
	AccountingQty   int        `gorm:"not null" json:"accounting_qty"`   // учётное кол-во в строке документа (снимок)
	ActualQty       int        `gorm:"not null" json:"actual_qty"`     // принятое фактическое
	BalanceBefore   int        `gorm:"not null" json:"balance_before"`   // остаток в карточке до проведения
	BalanceAfter    int        `gorm:"not null" json:"balance_after"`    // после проведения (= факт)
	Delta           int        `gorm:"not null" json:"delta"`            // изменение balance_after - balance_before
	CreatedAt       time.Time  `gorm:"autoCreateTime" json:"created_at"`
	ActorID         *uuid.UUID `gorm:"type:uuid" json:"actor_id,omitempty"`
}

func (l *InventoryStockLedger) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}

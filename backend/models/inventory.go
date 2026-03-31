package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Статусы инвентаризационной сессии.
const (
	SessionStatusDraft     = "draft"
	SessionStatusActive    = "active"
	SessionStatusCompleted = "completed"
)

// Статусы строки результата (сверка ожидаемого и фактического количества).
const (
	ResultStatusMatch    = "match"
	ResultStatusMismatch = "mismatch"
	ResultStatusMissing  = "missing"
)

// InventorySession — одна сессия инвентаризации (кто начал, в каком состоянии).
type InventorySession struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	CreatedBy uuid.UUID `gorm:"type:uuid;not null;index" json:"created_by"`
	Status    string    `gorm:"not null" json:"status"`
}

// InventoryResult — результат проверки одного объекта в рамках сессии.
type InventoryResult struct {
	ID               uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	SessionID        uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_session_item" json:"session_id"`
	ItemID           uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_session_item" json:"item_id"`
	ExpectedQuantity int       `gorm:"not null" json:"expected_quantity"`
	ActualQuantity   int       `gorm:"not null" json:"actual_quantity"`
	Status           string    `gorm:"not null" json:"status"`
	CreatedAt        time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (ir *InventoryResult) BeforeCreate(tx *gorm.DB) error {
	if ir.ID == uuid.Nil {
		ir.ID = uuid.New()
	}
	return nil
}

func (s *InventorySession) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

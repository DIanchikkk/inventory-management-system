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
	SessionStatusReview    = "review"
	SessionStatusCompleted = "completed"
	SessionStatusArchived  = "archived"
)

// Статусы строки результата (сверка ожидаемого и фактического количества).
const (
	ResultStatusPending  = "pending"
	ResultStatusMatch    = "match"
	ResultStatusMismatch = "mismatch"
	ResultStatusMissing  = "missing"
)

// InventorySession — документ инвентаризации (сессия): шапка + состояние жизненного цикла.
type InventorySession struct {
	ID                 uuid.UUID  `gorm:"type:uuid;primary_key;" json:"id"`
	CreatedAt          time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt          time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
	CreatedBy          uuid.UUID  `gorm:"type:uuid;not null;index" json:"created_by"`
	Status             string     `gorm:"not null" json:"status"`
	DocumentNo         string     `gorm:"not null;default:'';index" json:"document_no"` // уникальность обеспечивает счётчик INV-ГГГГ-NNNNNN
	Notes              string     `gorm:"not null;default:''" json:"notes"`
	FilterLocation     string     `gorm:"not null;default:''" json:"filter_location"`
	FilterCategoryID   *uuid.UUID `gorm:"type:uuid" json:"filter_category_id,omitempty"`
	FilterCategoryName string     `gorm:"not null;default:''" json:"filter_category_name"`
}

// InventoryResult — результат проверки одного объекта в рамках сессии.
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

// InventorySessionEvent — аудит действий по сессии.
type InventorySessionEvent struct {
	ID        uuid.UUID  `gorm:"type:uuid;primary_key;" json:"id"`
	SessionID uuid.UUID  `gorm:"type:uuid;not null;index" json:"session_id"`
	ActorID   *uuid.UUID `gorm:"type:uuid" json:"actor_id,omitempty"`
	Action    string     `gorm:"not null;index" json:"action"`
	Details   string     `gorm:"not null;default:''" json:"details"`
	CreatedAt time.Time  `gorm:"autoCreateTime" json:"created_at"`
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

func (e *InventorySessionEvent) BeforeCreate(tx *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return nil
}

package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	SessionStatusDraft     = "draft"
	SessionStatusActive    = "active"
	SessionStatusReview    = "review"
	SessionStatusCompleted = "completed"
	SessionStatusArchived  = "archived"
)

type InventorySession struct {
	ID                 uuid.UUID  `gorm:"type:uuid;primary_key;" json:"id"`
	CreatedAt          time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt          time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
	CreatedBy          uuid.UUID  `gorm:"type:uuid;not null;index" json:"created_by"`
	CreatedByUsername  string     `gorm:"-" json:"created_by_username,omitempty"`
	Status             string     `gorm:"not null" json:"status"`
	DocumentNo         string     `gorm:"not null;default:'';index" json:"document_no"`
	Notes              string     `gorm:"not null;default:''" json:"notes"`
	FilterLocation     string     `gorm:"not null;default:''" json:"filter_location"`
	FilterCategoryID   *uuid.UUID `gorm:"type:uuid" json:"filter_category_id,omitempty"`
	FilterCategoryName string     `gorm:"not null;default:''" json:"filter_category_name"`
}

func (s *InventorySession) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

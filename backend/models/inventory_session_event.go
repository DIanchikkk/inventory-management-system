package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type InventorySessionEvent struct {
	ID            uuid.UUID  `gorm:"type:uuid;primary_key;" json:"id"`
	SessionID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"session_id"`
	ActorID       *uuid.UUID `gorm:"type:uuid" json:"actor_id,omitempty"`
	ActorUsername string     `gorm:"size:64;default:''" json:"actor_username,omitempty"`
	Action        string     `gorm:"not null;index" json:"action"`
	Details       string     `gorm:"not null;default:''" json:"details"`
	CreatedAt     time.Time  `gorm:"autoCreateTime" json:"created_at"`
}

func (e *InventorySessionEvent) BeforeCreate(tx *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return nil
}

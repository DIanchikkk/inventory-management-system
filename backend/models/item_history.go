package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ItemHistoryLog struct {
	ID        uuid.UUID  `gorm:"type:uuid;primary_key" json:"id"`
	ItemID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"item_id"`
	ActorID   *uuid.UUID `gorm:"type:uuid" json:"actor_id,omitempty"`
	Message   string     `gorm:"type:text;not null" json:"message"`
	CreatedAt time.Time  `gorm:"autoCreateTime" json:"created_at"`
}

func (l *ItemHistoryLog) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}

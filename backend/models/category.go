package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Category — справочник категорий объекта учёта (отдельная таблица).
type Category struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	Name      string    `gorm:"uniqueIndex;not null" json:"name"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (c *Category) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

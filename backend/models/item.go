package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Item struct {
	ID           uuid.UUID      `gorm:"type:uuid;primary_key;" json:"id"`
	Name         string         `gorm:"not null" json:"name"`
	Description  string         `gorm:"not null" json:"description"`
	Quantity     int            `gorm:"not null" json:"quantity"`
	PurchaseDate time.Time      `gorm:"not null" json:"purchase_date"`
	CreatedAt    time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate
func (i *Item) BeforeCreate(tx *gorm.DB) error {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return nil
}

package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Item struct {
	ID               uuid.UUID      `gorm:"type:uuid;primary_key;" json:"id"`
	SKU              string         `gorm:"not null;default:'';index" json:"sku"`
	Name             string         `gorm:"not null" json:"name"`
	CategoryID       uuid.UUID      `gorm:"type:uuid;not null;index" json:"category_id"`
	Category         string         `gorm:"not null;default:'';index" json:"category"`
	Description      string         `gorm:"not null" json:"description"`
	Quantity         int            `gorm:"not null" json:"quantity"`
	Unit             string         `gorm:"not null;default:'шт'" json:"unit"`
	Location         string         `gorm:"not null;default:'';index" json:"location"`
	MinQuantity      int            `gorm:"not null;default:0" json:"min_quantity"`
	PurchaseDate     time.Time      `gorm:"not null" json:"purchase_date"`
	ImageURL         string         `gorm:"not null;default:''" json:"image_url"`
	ServiceLifeYears int            `gorm:"not null;default:4" json:"service_life_years"`
	RetiredAt        *time.Time     `json:"retired_at,omitempty"`
	ReplacedByItemID *uuid.UUID     `gorm:"type:uuid" json:"replaced_by_item_id,omitempty"`
	CreatedAt        time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

func (i *Item) BeforeCreate(tx *gorm.DB) error {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return nil
}

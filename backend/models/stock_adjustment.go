package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StockAdjustmentDocYearSeq struct {
	Year   int    `gorm:"primaryKey"`
	Kind   string `gorm:"primaryKey"`
	LastNo int    `gorm:"not null"`
}

type StockAdjustmentDocument struct {
	ID         uuid.UUID `gorm:"type:uuid;primary_key;" json:"id"`
	DocumentNo string    `gorm:"not null;index" json:"document_no"`
	Movement   string    `gorm:"not null;index" json:"movement"`
	SessionID  uuid.UUID `gorm:"type:uuid;not null;index" json:"session_id"`
	CreatedBy  uuid.UUID `gorm:"type:uuid;not null" json:"created_by"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (d *StockAdjustmentDocument) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}

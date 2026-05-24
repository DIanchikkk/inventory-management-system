package models

type InventoryDocYearSeq struct {
	Year   int `gorm:"primaryKey"`
	LastNo int `gorm:"not null"`
}

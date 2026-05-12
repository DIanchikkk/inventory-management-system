package models

// InventoryDocYearSeq — счётчик для человекочитаемых номеров документов инвентаризации (INV-ГГГГ-NNNNNN).
type InventoryDocYearSeq struct {
	Year   int `gorm:"primaryKey"`
	LastNo int `gorm:"not null"`
}

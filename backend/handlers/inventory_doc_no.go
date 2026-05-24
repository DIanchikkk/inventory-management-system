package handlers

import (
	"errors"
	"fmt"
	"inventory-system/backend/models"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func nextInventoryDocNo(tx *gorm.DB) (string, error) {
	year := time.Now().UTC().Year()
	var row models.InventoryDocYearSeq
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("year = ?", year).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		row = models.InventoryDocYearSeq{Year: year, LastNo: 1}
		if err := tx.Create(&row).Error; err != nil {
			return "", err
		}
		return fmt.Sprintf("INV-%d-%06d", year, 1), nil
	}
	if err != nil {
		return "", err
	}
	row.LastNo++
	if err := tx.Save(&row).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("INV-%d-%06d", year, row.LastNo), nil
}

func nextStockAdjustmentNo(tx *gorm.DB, movement string) (string, error) {
	prefix, kind, err := adjustmentPrefix(movement)
	if err != nil {
		return "", err
	}
	year := time.Now().UTC().Year()
	var row models.StockAdjustmentDocYearSeq
	err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("year = ? AND kind = ?", year, kind).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		row = models.StockAdjustmentDocYearSeq{Year: year, Kind: kind, LastNo: 1}
		if err := tx.Create(&row).Error; err != nil {
			return "", err
		}
		return fmt.Sprintf("%s-%d-%06d", prefix, year, 1), nil
	}
	if err != nil {
		return "", err
	}
	row.LastNo++
	if err := tx.Save(&row).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%d-%06d", prefix, year, row.LastNo), nil
}

func adjustmentPrefix(movement string) (prefix, kind string, err error) {
	switch movement {
	case models.StockMovementWriteOff:
		return "СП", models.StockMovementWriteOff, nil
	case models.StockMovementReceipt:
		return "ОП", models.StockMovementReceipt, nil
	default:
		return "", "", fmt.Errorf("unknown movement: %s", movement)
	}
}

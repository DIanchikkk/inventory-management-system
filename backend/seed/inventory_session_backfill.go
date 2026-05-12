package seed

import (
	"fmt"
	"inventory-system/backend/models"
	"strings"

	"gorm.io/gorm"
)

// BackfillInventoryDocuments проставляет номер документа старым сессиям без номера (до введения счётчика).
func BackfillInventoryDocuments(db *gorm.DB) error {
	var rows []models.InventorySession
	if err := db.Where("document_no = ?", "").Find(&rows).Error; err != nil {
		return err
	}
	for _, s := range rows {
		idCompact := strings.ReplaceAll(s.ID.String(), "-", "")
		no := fmt.Sprintf("INV-MIG-%s", idCompact[:12])
		if err := db.Model(&models.InventorySession{}).Where("id = ?", s.ID).Update("document_no", no).Error; err != nil {
			return err
		}
	}
	return nil
}

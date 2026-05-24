package seed

import (
	"inventory-system/backend/docno"
	"inventory-system/backend/models"

	"gorm.io/gorm"
)

func BackfillInventoryDocuments(db *gorm.DB) error {
	var rows []models.InventorySession
	if err := db.Where("document_no = ?", "").Find(&rows).Error; err != nil {
		return err
	}
	for _, s := range rows {
		var no string
		if err := db.Transaction(func(tx *gorm.DB) error {
			var err error
			no, err = docno.NextInventoryNo(tx)
			if err != nil {
				return err
			}
			return tx.Model(&models.InventorySession{}).Where("id = ?", s.ID).Update("document_no", no).Error
		}); err != nil {
			return err
		}
	}
	return nil
}

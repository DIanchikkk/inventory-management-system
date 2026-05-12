package seed

import (
	"inventory-system/backend/catalog"
	"inventory-system/backend/models"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PrepareItemsCategoryIDColumn — до AutoMigrate с NOT NULL: у уже существующей таблицы items добавляет
// category_id как nullable, чтобы можно было заполнить строки и не падать на ADD ... NOT NULL (SQLSTATE 23502).
func PrepareItemsCategoryIDColumn(db *gorm.DB) error {
	if !db.Migrator().HasTable(&models.Item{}) {
		return nil
	}
	if db.Migrator().HasColumn(&models.Item{}, "category_id") {
		return nil
	}
	return db.Exec(`ALTER TABLE items ADD COLUMN category_id uuid`).Error
}

// MigrateItemsCategoryID заполняет category_id у объектов после добавления справочника категорий.
func MigrateItemsCategoryID(db *gorm.DB) error {
	if !db.Migrator().HasTable(&models.Item{}) {
		return nil
	}
	if !db.Migrator().HasColumn(&models.Item{}, "category_id") {
		return nil
	}
	return db.Transaction(func(tx *gorm.DB) error {
		var names []string
		if err := tx.Model(&models.Item{}).Distinct("category").Pluck("category", &names).Error; err != nil {
			return err
		}
		for _, n := range names {
			n = strings.TrimSpace(n)
			if n == "" {
				continue
			}
			if _, err := catalog.EnsureCategory(tx, n); err != nil {
				return err
			}
		}
		miscID, err := catalog.EnsureCategory(tx, "Прочее")
		if err != nil {
			return err
		}
		var items []models.Item
		if err := tx.Find(&items).Error; err != nil {
			return err
		}
		for _, it := range items {
			if it.CategoryID != uuid.Nil {
				continue
			}
			name := strings.TrimSpace(it.Category)
			if name == "" {
				if err := tx.Model(&it).Updates(map[string]interface{}{
					"category_id": miscID,
					"category":    "Прочее",
				}).Error; err != nil {
					return err
				}
				continue
			}
			cid, err := catalog.EnsureCategory(tx, name)
			if err != nil {
				return err
			}
			if err := tx.Model(&it).Update("category_id", cid).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

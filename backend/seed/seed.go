package seed

import (
	"errors"
	"inventory-system/backend/models"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func upsertUser(db *gorm.DB, username, role, plain string) error {
	var u models.User
	err := db.Where("username = ?", username).First(&u).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		u = models.User{Username: username, Role: role}
		if err := u.SetPassword(plain); err != nil {
			return err
		}
		return db.Create(&u).Error
	}
	if err != nil {
		return err
	}
	u.Role = role
	if err := u.SetPassword(plain); err != nil {
		return err
	}
	return db.Save(&u).Error
}

func seedAdminAndUser(db *gorm.DB) error {
	log.Println("Seeding: upsert admin and user...")
	if err := upsertUser(db, "admin", "admin", "admin123"); err != nil {
		return err
	}
	if err := upsertUser(db, "user", "user", "user123"); err != nil {
		return err
	}
	log.Println("Seeding: admin (admin/admin123) and user (user/user123) are in the database")
	return nil
}

func migrateItemImageStoragePaths(db *gorm.DB) error {
	res := db.Exec(
		`UPDATE items SET image_url = REPLACE(image_url, '/uploads/items/', '/uploads/item-images/') WHERE image_url LIKE ?`,
		"%/uploads/items/%",
	)
	return res.Error
}

func resetInventoryData(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Unscoped().Where("1 = 1").Delete(&models.InventoryStockLedger{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("1 = 1").Delete(&models.StockAdjustmentDocument{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("1 = 1").Delete(&models.StockAdjustmentDocYearSeq{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("1 = 1").Delete(&models.InventorySessionEvent{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("1 = 1").Delete(&models.InventoryResult{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("1 = 1").Delete(&models.InventorySession{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("1 = 1").Delete(&models.Item{}).Error; err != nil {
			return err
		}
		return nil
	})
}

func seedDemoInventory(db *gorm.DB) error {
	var admin models.User
	if err := db.Where("username = ?", "admin").First(&admin).Error; err != nil {
		return err
	}

	var items []models.Item
	if err := db.Order("created_at asc").Limit(5).Find(&items).Error; err != nil {
		return err
	}
	if len(items) == 0 {
		return nil
	}

	var existing int64
	if err := db.Model(&models.InventorySession{}).Count(&existing).Error; err != nil {
		return err
	}
	if existing >= 3 {
		return nil
	}

	now := time.Now().UTC()
	sessions := []models.InventorySession{
		{CreatedBy: admin.ID, Status: models.SessionStatusActive},
		{CreatedBy: admin.ID, Status: models.SessionStatusReview},
		{CreatedBy: admin.ID, Status: models.SessionStatusCompleted},
	}
	for i := range sessions {
		if err := db.Create(&sessions[i]).Error; err != nil {
			return err
		}
	}

	statusesBySession := [][]string{
		{models.ResultStatusPending, models.ResultStatusPending, models.ResultStatusMatch, models.ResultStatusPending, models.ResultStatusMismatch},
		{models.ResultStatusMismatch, models.ResultStatusMatch, models.ResultStatusMissing, models.ResultStatusMatch, models.ResultStatusPending},
		{models.ResultStatusMatch, models.ResultStatusMatch, models.ResultStatusMismatch, models.ResultStatusMissing, models.ResultStatusMatch},
	}

	for si, sess := range sessions {
		for ii, item := range items {
			expected := item.Quantity
			actual := expected
			status := statusesBySession[si][ii]
			comment := ""
			var countedAt *time.Time
			var countedBy *uuid.UUID
			if status == models.ResultStatusMismatch {
				actual = expected - 1
				comment = "Расхождение: требуется повторная проверка"
			}
			if status == models.ResultStatusMissing {
				actual = 0
				comment = "Не найдено на месте хранения"
			}
			if status != models.ResultStatusPending {
				t := now.Add(-time.Duration((si+1)*(ii+1)) * time.Hour)
				countedAt = &t
				countedBy = &admin.ID
			}

			res := models.InventoryResult{
				SessionID:        sess.ID,
				ItemID:           item.ID,
				ExpectedQuantity: expected,
				ActualQuantity:   actual,
				Status:           status,
				CountedBy:        countedBy,
				CountedAt:        countedAt,
				Comment:          comment,
			}
			if err := db.Create(&res).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func Run(db *gorm.DB) error {
	if err := migrateItemImageStoragePaths(db); err != nil {
		return err
	}
	force := os.Getenv("INVENTORY_FORCE_SEED") == "1" || os.Getenv("INVENTORY_FORCE_SEED") == "true"
	resetData := os.Getenv("INVENTORY_RESET_DATA") == "1" || os.Getenv("INVENTORY_RESET_DATA") == "true"
	if resetData {
		log.Println("INVENTORY_RESET_DATA: clearing old inventory data")
		if err := resetInventoryData(db); err != nil {
			return err
		}
	}
	if force {
		log.Println("INVENTORY_FORCE_SEED: forcing test users in DB")
		if err := seedAdminAndUser(db); err != nil {
			return err
		}
		if err := seedDemoItems(db); err != nil {
			return err
		}
		return seedDemoInventory(db)
	}

	var count int64
	if err := db.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		if err := seedDemoItems(db); err != nil {
			return err
		}
		return seedDemoInventory(db)
	}

	if err := seedAdminAndUser(db); err != nil {
		return err
	}
	if err := seedDemoItems(db); err != nil {
		return err
	}
	return seedDemoInventory(db)
}

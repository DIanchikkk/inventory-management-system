package seed

import (
	"errors"
	"inventory-system/backend/models"
	"log"
	"os"

	"gorm.io/gorm"
)

// upsertUser создаёт пользователя или обновляет роль и пароль (для dev).
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

// Run создаёт тестовых пользователей, если таблица users пустая.
// Если задано INVENTORY_FORCE_SEED=1 или true — всегда создаёт/обновляет admin и user
// (удобно для локальной разработки; в production не включать).
func Run(db *gorm.DB) error {
	force := os.Getenv("INVENTORY_FORCE_SEED") == "1" || os.Getenv("INVENTORY_FORCE_SEED") == "true"
	if force {
		log.Println("INVENTORY_FORCE_SEED: forcing test users in DB")
		return seedAdminAndUser(db)
	}

	var count int64
	if err := db.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	return seedAdminAndUser(db)
}

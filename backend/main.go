package main

import (
	"inventory-system/backend/config"
	"inventory-system/backend/database"
	"inventory-system/backend/models"
	"inventory-system/backend/seed"
	"log"

	"gorm.io/gorm"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	if err := migrateAndSeed(db); err != nil {
		log.Fatalf("migrate/seed: %v", err)
	}

	r := setupRouter(db, cfg)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server: %v", err)
	}
}

func migrateAndSeed(db *gorm.DB) error {
	if err := db.AutoMigrate(&models.User{}, &models.Item{}, &models.InventorySession{}, &models.InventoryResult{}); err != nil {
		return err
	}
	return seed.Run(db)
}

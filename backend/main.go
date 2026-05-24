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
	// Сначала справочник категорий и (при старой БД) nullable category_id + бэкфилл — иначе AutoMigrate на Item
	// сгенерирует ADD category_id NOT NULL и PostgreSQL упадёт на уже существующих строках (23502).
	if err := db.AutoMigrate(&models.User{}, &models.Category{}); err != nil {
		return err
	}
	if err := seed.PrepareItemsCategoryIDColumn(db); err != nil {
		return err
	}
	if err := seed.MigrateItemsCategoryID(db); err != nil {
		return err
	}
	if err := db.AutoMigrate(
		&models.Item{},
		&models.ItemHistoryLog{},
		&models.InventorySession{},
		&models.InventoryResult{},
		&models.InventorySessionEvent{},
		&models.InventoryStockLedger{},
		&models.InventoryDocYearSeq{},
		&models.StockAdjustmentDocument{},
		&models.StockAdjustmentDocYearSeq{},
	); err != nil {
		return err
	}
	if err := seed.MigrateItemsCategoryID(db); err != nil {
		return err
	}
	if err := seed.BackfillInventoryDocuments(db); err != nil {
		return err
	}
	if err := seed.Run(db); err != nil {
		return err
	}
	if err := seed.BackfillAuditActorUsernames(db); err != nil {
		return err
	}
	if err := seed.BackfillStockAdjustmentDocuments(db); err != nil {
		return err
	}
	return seed.BackfillInventoryDocuments(db)
}

package main

import (
	"inventory-system/backend/config"
	"inventory-system/backend/database"
	"inventory-system/backend/handlers"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"inventory-system/backend/seed"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	gin.SetMode(cfg.GinMode)

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	db.AutoMigrate(&models.User{}, &models.Item{}, &models.InventorySession{}, &models.InventoryResult{})
	if err := seed.Run(db); err != nil {
		log.Fatalf("Seed failed: %v", err)
	}

	r := gin.Default()
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	auth := &handlers.AuthHandler{DB: db, JWTSecret: cfg.JWTSecret, JWTTTL: cfg.JWTTTL}
	r.POST("/auth/login", auth.Login)

	protected := r.Group("")
	protected.Use(middleware.AuthRequired(cfg.JWTSecret))
	protected.GET("/auth/me", auth.Me)

	items := &handlers.ItemHandler{DB: db}
	protected.GET("/items", items.ListItems)
	protected.POST("/items", items.CreateItem)
	protected.GET("/items/:id", items.GetItem)
	protected.PUT("/items/:id", items.UpdateItem)
	protected.DELETE("/items/:id", items.DeleteItem)

	inv := &handlers.InventoryHandler{DB: db}
	protected.POST("/inventory/sessions", inv.CreateSession)
	protected.GET("/inventory/sessions", inv.ListSessions)
	protected.GET("/inventory/sessions/:id", inv.GetSession)
	protected.POST("/inventory/sessions/:id/complete", inv.CompleteSession)
	protected.POST("/inventory/sessions/:id/results/batch", inv.BatchResults)
	protected.POST("/inventory/sessions/:id/results", inv.AddResult)

	r.Run(":" + cfg.Port)
}

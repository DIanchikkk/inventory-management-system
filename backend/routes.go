package main

import (
	"context"
	"inventory-system/backend/config"
	"inventory-system/backend/handlers"
	"inventory-system/backend/middleware"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func setupRouter(db *gorm.DB, cfg *config.Config) *gin.Engine {
	gin.SetMode(cfg.GinMode)

	r := gin.Default()
	r.Use(middleware.CORS(cfg.CORSOrigins))

	r.GET("/health", healthHandler(db))

	auth := &handlers.AuthHandler{DB: db, JWTSecret: cfg.JWTSecret, JWTTTL: cfg.JWTTTL}
	r.POST("/auth/login", auth.Login)

	protected := r.Group("")
	protected.Use(middleware.AuthRequired(cfg.JWTSecret))
	protected.GET("/auth/me", auth.Me)

	items := &handlers.ItemHandler{DB: db}
	protected.GET("/items", items.ListItems)
	protected.GET("/items/:id", items.GetItem)

	admin := protected.Group("")
	admin.Use(middleware.RequireAdmin())
	admin.GET("/items/export", items.ExportCSV)
	admin.POST("/items", items.CreateItem)
	admin.PUT("/items/:id", items.UpdateItem)
	admin.DELETE("/items/:id", items.DeleteItem)

	inv := &handlers.InventoryHandler{DB: db}
	protected.POST("/inventory/sessions", inv.CreateSession)
	protected.GET("/inventory/sessions", inv.ListSessions)
	protected.GET("/inventory/sessions/:id", inv.GetSession)
	protected.POST("/inventory/sessions/:id/complete", inv.CompleteSession)
	protected.POST("/inventory/sessions/:id/results/batch", inv.BatchResults)
	protected.POST("/inventory/sessions/:id/results", inv.AddResult)

	return r
}

func healthHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sqlDB, err := db.DB()
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "database": "error"})
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := sqlDB.PingContext(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "degraded", "database": "down"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok", "database": "up"})
	}
}

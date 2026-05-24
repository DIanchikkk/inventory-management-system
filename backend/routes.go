package main

import (
	"context"
	"inventory-system/backend/config"
	"inventory-system/backend/handlers"
	"inventory-system/backend/middleware"
	"inventory-system/backend/uploads"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func uploadsCORPHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/uploads/") {
			c.Header("Cross-Origin-Resource-Policy", "cross-origin")
		}
		c.Next()
	}
}

func setupRouter(db *gorm.DB, cfg *config.Config) *gin.Engine {
	gin.SetMode(cfg.GinMode)

	r := gin.Default()
	r.Use(middleware.CORS(cfg.CORSOrigins, cfg.CORSAllowLAN))
	r.Use(uploadsCORPHeaders())

	uploadsRoot := uploads.ResolveRoot()
	if abs, err := filepath.Abs(uploadsRoot); err == nil {
		uploadsRoot = abs
	}
	if err := os.MkdirAll(filepath.Join(uploadsRoot, "item-images"), 0o755); err != nil {
		log.Printf("uploads: mkdir %s: %v", uploadsRoot, err)
	}
	if !uploads.ItemImagesHasJPEG(uploadsRoot) {
		log.Printf("uploads: в %s/item-images нет JPEG — демо-фото не отдадутся; задайте INVENTORY_UPLOADS_ROOT или положите файлы в frontend/src/assets/uploads/item-images", uploadsRoot)
	} else {
		log.Printf("uploads: раздача статики из %s", uploadsRoot)
	}

	uploadsHTTP := http.StripPrefix("/uploads", http.FileServer(http.Dir(uploadsRoot)))
	serveUploads := func(c *gin.Context) {
		c.Header("Cache-Control", "no-cache, must-revalidate")
		uploadsHTTP.ServeHTTP(c.Writer, c.Request)
	}
	r.GET("/uploads/*filepath", serveUploads)
	r.HEAD("/uploads/*filepath", serveUploads)

	r.GET("/health", healthHandler(db))

	authHandler := &handlers.AuthHandler{DB: db, JWTSecret: cfg.JWTSecret, JWTTTL: cfg.JWTTTL}
	r.POST("/auth/login", middleware.LoginRateLimit(), authHandler.Login)

	protected := r.Group("")
	protected.Use(middleware.AuthRequired(cfg.JWTSecret))
	protected.Use(middleware.SyncRoleFromDB(db))
	protected.GET("/auth/me", authHandler.Me)

	itemsHandler := &handlers.ItemHandler{DB: db}
	cats := &handlers.CategoryHandler{DB: db}
	protected.GET("/categories", cats.ListCategories)
	protected.GET("/items", itemsHandler.ListItems)
	protected.GET("/items/:id/history", itemsHandler.ListItemHistory)
	protected.GET("/items/:id", itemsHandler.GetItem)

	dash := &handlers.DashboardHandler{DB: db}
	protected.GET("/dashboard/summary", dash.Summary)

	admin := protected.Group("")
	admin.Use(middleware.RequireAdmin())
	admin.GET("/items/export", itemsHandler.ExportCSV)
	admin.POST("/items/import", itemsHandler.ImportCSV)
	admin.POST("/items/bulk-meta", itemsHandler.BulkUpdateMeta)
	admin.GET("/export/snapshot.json", itemsHandler.ExportSnapshotJSON)
	admin.POST("/categories", cats.CreateCategory)
	admin.POST("/items", itemsHandler.CreateItem)
	admin.PUT("/items/:id", itemsHandler.UpdateItem)
	admin.DELETE("/items/:id", itemsHandler.DeleteItem)

	inv := &handlers.InventoryHandler{DB: db}
	protected.GET("/inventory/stock-ledger/global", inv.ListGlobalStockLedger)
	protected.GET("/inventory/stock-adjustments", inv.ListGlobalStockAdjustments)
	protected.GET("/inventory/stock-adjustments/:id", inv.GetStockAdjustment)
	protected.POST("/inventory/sessions", inv.CreateSession)
	protected.GET("/inventory/sessions", inv.ListSessions)
	protected.GET("/inventory/sessions/:id", inv.GetSession)
	protected.GET("/inventory/sessions/:id/lines", inv.GetSessionLines)
	protected.GET("/inventory/sessions/:id/export", inv.ExportSessionCSV)
	protected.GET("/inventory/sessions/:id/discrepancies", inv.ListDiscrepancies)
	protected.GET("/inventory/sessions/:id/audit", inv.ListAuditEvents)
	protected.GET("/inventory/sessions/:id/audit/export", inv.ExportAuditCSV)
	protected.GET("/inventory/sessions/:id/stock-ledger", inv.ListSessionStockLedger)
	protected.GET("/inventory/sessions/:id/stock-adjustments", inv.ListSessionStockAdjustments)
	protected.GET("/inventory/sessions/:id/discrepancies/export", inv.ExportDiscrepanciesCSV)
	protected.POST("/inventory/sessions/:id/review", inv.SendToReview)
	protected.POST("/inventory/sessions/:id/complete", inv.CompleteSession)
	protected.POST("/inventory/sessions/:id/archive", inv.ArchiveSession)
	protected.POST("/inventory/sessions/:id/results/batch", inv.BatchResults)
	protected.POST("/inventory/sessions/:id/results", inv.AddResult)
	admin.POST("/inventory/sessions/:id/discrepancies/:item_id/confirm", inv.ConfirmDiscrepancy)

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

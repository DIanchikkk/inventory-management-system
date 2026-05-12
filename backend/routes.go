package main

import (
	"context"
	"inventory-system/backend/config"
	"inventory-system/backend/handlers"
	"inventory-system/backend/middleware"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// uploadsItemImagesHasJPEG true, если в каталоге есть хотя бы один .jpg (не пустая заглушка после mkdir).
func uploadsItemImagesHasJPEG(root string) bool {
	dir := filepath.Join(root, "item-images")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if strings.HasSuffix(strings.ToLower(e.Name()), ".jpg") {
			return true
		}
	}
	return false
}

// uploadsRootCandidates — абсолютные пути: cwd, родители, каталог бинарника (go run кладёт exe во временную папку).
func uploadsRootCandidates() []string {
	wd, err := os.Getwd()
	if err != nil {
		wd = "."
	}
	raw := []string{
		filepath.Join(wd, "uploads"),
		filepath.Join(wd, "..", "uploads"),
		filepath.Join(wd, "..", "..", "uploads"),
		"uploads",
		filepath.Join("..", "uploads"),
	}
	if exe, err := os.Executable(); err == nil {
		exedir := filepath.Dir(exe)
		raw = append(raw,
			filepath.Join(exedir, "uploads"),
			filepath.Join(exedir, "..", "uploads"),
		)
	}
	seen := map[string]struct{}{}
	var out []string
	for _, p := range raw {
		abs, err := filepath.Abs(filepath.Clean(p))
		if err != nil {
			continue
		}
		if _, ok := seen[abs]; ok {
			continue
		}
		seen[abs] = struct{}{}
		out = append(out, abs)
	}
	return out
}

// uploadsRootDir — корень раздачи GET /uploads/...
// Переменная INVENTORY_UPLOADS_ROOT переопределяет поиск (абсолютный или относительный путь к каталогу uploads).
func uploadsRootDir() string {
	if v := strings.TrimSpace(os.Getenv("INVENTORY_UPLOADS_ROOT")); v != "" {
		abs, err := filepath.Abs(filepath.Clean(v))
		if err != nil {
			return filepath.Clean(v)
		}
		return abs
	}
	for _, root := range uploadsRootCandidates() {
		if uploadsItemImagesHasJPEG(root) {
			return root
		}
	}
	for _, root := range uploadsRootCandidates() {
		if fi, err := os.Stat(filepath.Join(root, "item-images")); err == nil && fi.IsDir() {
			return root
		}
		if fi, err := os.Stat(filepath.Join(root, "items")); err == nil && fi.IsDir() {
			return root
		}
	}
	abs, _ := filepath.Abs(filepath.Join(".", "uploads"))
	return abs
}

// uploadsCORPHeaders — чтобы <img src="http://API:8080/uploads/..."> с фронта (другой origin) не блокировались политикой CORP в браузере.
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

	uploadsRoot := uploadsRootDir()
	if abs, err := filepath.Abs(uploadsRoot); err == nil {
		uploadsRoot = abs
	}
	if err := os.MkdirAll(filepath.Join(uploadsRoot, "item-images"), 0o755); err != nil {
		log.Printf("uploads: mkdir %s: %v", uploadsRoot, err)
	}
	if !uploadsItemImagesHasJPEG(uploadsRoot) {
		log.Printf("uploads: в %s/item-images нет JPEG — демо-фото не отдадутся; задайте INVENTORY_UPLOADS_ROOT или запускайте API из корня репозитория / папки backend рядом с uploads", uploadsRoot)
	} else {
		log.Printf("uploads: раздача статики из %s", uploadsRoot)
	}
	// Не используем gin.Router.Static: в gin v1.9.1 createStaticHandler с Dir(list=false) сначала пишет 404 и при промахе fs.Open
	// подменяет ответ на noRoute («404 page not found»), из‑за чего файлы с диска не отдаются.
	uploadsHTTP := http.StripPrefix("/uploads", http.FileServer(http.Dir(uploadsRoot)))
	serveUploads := func(c *gin.Context) {
		uploadsHTTP.ServeHTTP(c.Writer, c.Request)
	}
	r.GET("/uploads/*filepath", serveUploads)
	r.HEAD("/uploads/*filepath", serveUploads)

	r.GET("/health", healthHandler(db))

	auth := &handlers.AuthHandler{DB: db, JWTSecret: cfg.JWTSecret, JWTTTL: cfg.JWTTTL}
	r.POST("/auth/login", middleware.LoginRateLimit(), auth.Login)

	protected := r.Group("")
	protected.Use(middleware.AuthRequired(cfg.JWTSecret))
	protected.Use(middleware.SyncRoleFromDB(db))
	protected.GET("/auth/me", auth.Me)

	items := &handlers.ItemHandler{DB: db}
	cats := &handlers.CategoryHandler{DB: db}
	protected.GET("/categories", cats.ListCategories)
	protected.GET("/items", items.ListItems)
	protected.GET("/items/:id/history", items.ListItemHistory)
	protected.GET("/items/:id", items.GetItem)

	dash := &handlers.DashboardHandler{DB: db}
	protected.GET("/dashboard/summary", dash.Summary)

	admin := protected.Group("")
	admin.Use(middleware.RequireAdmin())
	admin.GET("/items/export", items.ExportCSV)
	admin.POST("/items/import", items.ImportCSV)
	admin.POST("/items/bulk-meta", items.BulkUpdateMeta)
	admin.GET("/export/snapshot.json", items.ExportSnapshotJSON)
	admin.POST("/categories", cats.CreateCategory)
	admin.POST("/items", items.CreateItem)
	admin.PUT("/items/:id", items.UpdateItem)
	admin.DELETE("/items/:id", items.DeleteItem)

	inv := &handlers.InventoryHandler{DB: db}
	protected.GET("/inventory/stock-ledger/global", inv.ListGlobalStockLedger)
	protected.POST("/inventory/sessions", inv.CreateSession)
	protected.GET("/inventory/sessions", inv.ListSessions)
	protected.GET("/inventory/sessions/:id", inv.GetSession)
	protected.GET("/inventory/sessions/:id/lines", inv.GetSessionLines)
	protected.GET("/inventory/sessions/:id/export", inv.ExportSessionCSV)
	protected.GET("/inventory/sessions/:id/discrepancies", inv.ListDiscrepancies)
	protected.GET("/inventory/sessions/:id/audit", inv.ListAuditEvents)
	protected.GET("/inventory/sessions/:id/audit/export", inv.ExportAuditCSV)
	protected.GET("/inventory/sessions/:id/stock-ledger", inv.ListSessionStockLedger)
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

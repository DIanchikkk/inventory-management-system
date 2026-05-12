package handlers

import (
	"encoding/csv"
	"errors"
	"fmt"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type itemRequest struct {
	Name         string `json:"name" binding:"required"`
	SKU          string `json:"sku" binding:"required"`
	CategoryID   string `json:"category_id" binding:"required"`
	Description  string `json:"description"`
	Quantity     int    `json:"quantity" binding:"gte=0"`
	Unit         string `json:"unit" binding:"required"`
	Location     string `json:"location" binding:"required"`
	MinQuantity  int    `json:"min_quantity" binding:"gte=0"`
	PurchaseDate string `json:"purchase_date" binding:"required"`
	ImageURL     string `json:"image_url"`
	// ServiceLifeYears 0 → сохранить значение по умолчанию (4 года).
	ServiceLifeYears int    `json:"service_life_years"`
	Retired          bool   `json:"retired"`
	ReplacedByItemID string `json:"replaced_by_item_id"`
}

func clampServiceLifeYears(n int) int {
	if n < 1 {
		return 4
	}
	if n > 40 {
		return 40
	}
	return n
}

func parseSuccessorItemID(raw string, selfID uuid.UUID, db *gorm.DB) (*uuid.UUID, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return nil, nil
	}
	id, err := uuid.Parse(s)
	if err != nil {
		return nil, err
	}
	if selfID != uuid.Nil && id == selfID {
		return nil, errors.New("successor cannot be the same item")
	}
	var cnt int64
	if err := db.Model(&models.Item{}).Where("id = ? AND deleted_at IS NULL", id).Count(&cnt).Error; err != nil {
		return nil, err
	}
	if cnt == 0 {
		return nil, errors.New("successor item not found")
	}
	return &id, nil
}

func parsePurchaseDate(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02", s)
}

// ItemHandler держит подключение к БД; так не нужен c.MustGet("db") и паника.
type ItemHandler struct {
	DB *gorm.DB
}

type paginatedItemsResponse struct {
	Items    []models.Item `json:"items"`
	Page     int           `json:"page"`
	PageSize int           `json:"page_size"`
	Total    int64         `json:"total"`
}

func parsePagination(c *gin.Context, defaultSize int) (int, int) {
	page := 1
	pageSize := defaultSize
	if raw := strings.TrimSpace(c.Query("page")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			page = n
		}
	}
	if raw := strings.TrimSpace(c.Query("page_size")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			pageSize = n
		}
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

// ListItems — GET /items?q=...
func (h *ItemHandler) ListItems(c *gin.Context) {
	q := c.Query("q")
	sortBy := strings.TrimSpace(c.DefaultQuery("sort_by", "name"))
	sortDir := strings.ToLower(strings.TrimSpace(c.DefaultQuery("sort_dir", "asc")))
	lowStockOnly := strings.TrimSpace(c.Query("low_stock")) == "true"
	page, pageSize := parsePagination(c, 50)

	var items []models.Item
	query := h.DB.Model(&models.Item{})
	if strings.TrimSpace(c.Query("include_retired")) != "true" {
		query = query.Where("retired_at IS NULL")
	}

	if q != "" {
		pattern := "%" + q + "%"
		query = query.Where(
			"name ILIKE ? OR description ILIKE ? OR sku ILIKE ? OR category ILIKE ? OR location ILIKE ?",
			pattern, pattern, pattern, pattern, pattern,
		)
	}
	if lowStockOnly {
		query = query.Where("quantity <= min_quantity")
	}
	replacementRemind := strings.TrimSpace(c.Query("replacement_remind"))
	if replacementRemind == "true" || replacementRemind == "1" {
		today := time.Now().UTC().Truncate(24 * time.Hour)
		until := today.AddDate(0, 0, 90)
		expr := "(purchase_date::date + ((service_life_years::text || ' years')::interval))::date"
		query = query.Where("retired_at IS NULL").
			Where(expr+" <= ?", until.Format("2006-01-02"))
	}
	orderBy := "name asc"
	switch sortBy {
	case "quantity":
		orderBy = "quantity asc"
	case "purchase_date":
		orderBy = "purchase_date asc"
	case "created_at":
		orderBy = "created_at asc"
	}
	if sortDir == "desc" {
		orderBy = strings.Replace(orderBy, " asc", " desc", 1)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		log.Printf("list items count: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if err := query.Order(orderBy).Offset((page - 1) * pageSize).Limit(pageSize).Find(&items).Error; err != nil {
		log.Printf("list items: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, paginatedItemsResponse{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    total,
	})
}

// GetItem — GET /items/:id
func (h *ItemHandler) GetItem(c *gin.Context) {
	id, ok := ParseUUIDParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var item models.Item
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
			return
		}
		log.Printf("get item: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// CreateItem — POST /items
func (h *ItemHandler) CreateItem(c *gin.Context) {
	var req itemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	pd, err := parsePurchaseDate(req.PurchaseDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase_date: use RFC3339 or YYYY-MM-DD"})
		return
	}
	name := strings.TrimSpace(req.Name)
	sku := strings.TrimSpace(req.SKU)
	catID, err := uuid.Parse(strings.TrimSpace(req.CategoryID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category_id"})
		return
	}
	catRow, err := categoryByID(h.DB, catID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "category not found"})
			return
		}
		log.Printf("create item category: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	category := catRow.Name
	unit := strings.TrimSpace(req.Unit)
	location := strings.TrimSpace(req.Location)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name must not be empty"})
		return
	}
	if sku == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sku must not be empty"})
		return
	}
	if unit == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unit must not be empty"})
		return
	}
	if location == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "location must not be empty"})
		return
	}

	life := clampServiceLifeYears(req.ServiceLifeYears)
	if strings.TrimSpace(req.ReplacedByItemID) != "" && !req.Retired {
		c.JSON(http.StatusBadRequest, gin.H{"error": "UUID преемника задаётся только вместе со списанием"})
		return
	}
	var retiredAt *time.Time
	var succPtr *uuid.UUID
	if req.Retired {
		t := time.Now().UTC()
		retiredAt = &t
		if strings.TrimSpace(req.ReplacedByItemID) != "" {
			sid, err := parseSuccessorItemID(req.ReplacedByItemID, uuid.Nil, h.DB)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			succPtr = sid
		}
	}
	item := models.Item{
		SKU:              sku,
		Name:             name,
		CategoryID:       catID,
		Category:         category,
		Description:      strings.TrimSpace(req.Description),
		Quantity:         req.Quantity,
		Unit:             unit,
		Location:         location,
		MinQuantity:      req.MinQuantity,
		PurchaseDate:     pd,
		ImageURL:         strings.TrimSpace(req.ImageURL),
		ServiceLifeYears: life,
		RetiredAt:        retiredAt,
		ReplacedByItemID: succPtr,
	}
	if err := h.DB.Create(&item).Error; err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") && strings.Contains(strings.ToLower(err.Error()), "sku") {
			c.JSON(http.StatusConflict, gin.H{"error": "item with this sku already exists"})
			return
		}
		log.Printf("create item: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if uid, ok := middleware.GetUserID(c); ok {
		saveItemHistory(h.DB, item.ID, &uid, fmt.Sprintf("Создан объект · %s · %s", item.SKU, item.Name))
	}
	c.JSON(http.StatusCreated, item)
}

// UpdateItem — PUT /items/:id
func (h *ItemHandler) UpdateItem(c *gin.Context) {
	id, ok := ParseUUIDParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var item models.Item
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
			return
		}
		log.Printf("update item (load): %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	prev := item

	var req itemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	pd, err := parsePurchaseDate(req.PurchaseDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase_date: use RFC3339 or YYYY-MM-DD"})
		return
	}
	name := strings.TrimSpace(req.Name)
	sku := strings.TrimSpace(req.SKU)
	catID, err := uuid.Parse(strings.TrimSpace(req.CategoryID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category_id"})
		return
	}
	catRow, err := categoryByID(h.DB, catID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "category not found"})
			return
		}
		log.Printf("update item category: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	category := catRow.Name
	unit := strings.TrimSpace(req.Unit)
	location := strings.TrimSpace(req.Location)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name must not be empty"})
		return
	}
	if sku == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sku must not be empty"})
		return
	}
	if unit == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unit must not be empty"})
		return
	}
	if location == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "location must not be empty"})
		return
	}

	if strings.TrimSpace(req.ReplacedByItemID) != "" && !req.Retired {
		c.JSON(http.StatusBadRequest, gin.H{"error": "UUID преемника задаётся только вместе со списанием"})
		return
	}
	life := clampServiceLifeYears(req.ServiceLifeYears)
	var succPtr *uuid.UUID
	if req.Retired && strings.TrimSpace(req.ReplacedByItemID) != "" {
		sid, err := parseSuccessorItemID(req.ReplacedByItemID, id, h.DB)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		succPtr = sid
	}

	item.SKU = sku
	item.Name = name
	item.CategoryID = catID
	item.Category = category
	item.Description = strings.TrimSpace(req.Description)
	item.Quantity = req.Quantity
	item.Unit = unit
	item.Location = location
	item.MinQuantity = req.MinQuantity
	item.PurchaseDate = pd
	item.ImageURL = strings.TrimSpace(req.ImageURL)
	item.ServiceLifeYears = life
	if req.Retired {
		if item.RetiredAt == nil {
			t := time.Now().UTC()
			item.RetiredAt = &t
		}
		item.ReplacedByItemID = succPtr
	} else {
		item.RetiredAt = nil
		item.ReplacedByItemID = nil
	}

	if err := h.DB.Save(&item).Error; err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") && strings.Contains(strings.ToLower(err.Error()), "sku") {
			c.JSON(http.StatusConflict, gin.H{"error": "item with this sku already exists"})
			return
		}
		log.Printf("update item: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if uid, ok := middleware.GetUserID(c); ok {
		if msg := itemChangeSummary(prev, item); msg != "" {
			saveItemHistory(h.DB, item.ID, &uid, msg)
		}
	}
	c.JSON(http.StatusOK, item)
}

// DeleteItem — DELETE /items/:id (soft delete)
func (h *ItemHandler) DeleteItem(c *gin.Context) {
	id, ok := ParseUUIDParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	res := h.DB.Delete(&models.Item{}, "id = ?", id)
	if res.Error != nil {
		log.Printf("delete item: %v", res.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ExportCSV — GET /items/export (UTF-8 CSV, отличительная фича для отчётов и экспорта)
func (h *ItemHandler) ExportCSV(c *gin.Context) {
	var items []models.Item
	if err := h.DB.Order("name").Find(&items).Error; err != nil {
		log.Printf("export csv: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="items.csv"`)

	// BOM: Excel на Windows корректно открывает UTF-8
	if _, err := c.Writer.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return
	}

	w := csv.NewWriter(c.Writer)
	header := []string{
		"id", "sku", "name", "category_id", "category", "description", "quantity", "unit", "location", "min_quantity",
		"purchase_date", "image_url", "service_life_years", "retired_at", "replaced_by_item_id",
		"created_at", "updated_at",
	}
	if err := w.Write(header); err != nil {
		return
	}
	for _, it := range items {
		retired := ""
		if it.RetiredAt != nil {
			retired = it.RetiredAt.UTC().Format(time.RFC3339)
		}
		repl := ""
		if it.ReplacedByItemID != nil {
			repl = it.ReplacedByItemID.String()
		}
		row := []string{
			it.ID.String(),
			it.SKU,
			it.Name,
			it.CategoryID.String(),
			it.Category,
			it.Description,
			strconv.Itoa(it.Quantity),
			it.Unit,
			it.Location,
			strconv.Itoa(it.MinQuantity),
			it.PurchaseDate.Format(time.RFC3339),
			it.ImageURL,
			strconv.Itoa(it.ServiceLifeYears),
			retired,
			repl,
			it.CreatedAt.Format(time.RFC3339),
			it.UpdatedAt.Format(time.RFC3339),
		}
		if err := w.Write(row); err != nil {
			return
		}
	}
	w.Flush()
}

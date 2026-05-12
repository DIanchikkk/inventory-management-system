package handlers

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"errors"
	"io"
	"inventory-system/backend/catalog"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type bulkMetaRequest struct {
	IDs        []string `json:"ids" binding:"required"`
	Location   *string  `json:"location"`
	Category   *string  `json:"category"`
	CategoryID *string  `json:"category_id"`
}

func (h *ItemHandler) BulkUpdateMeta(c *gin.Context) {
	var req bulkMetaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.IDs) == 0 || len(req.IDs) > 300 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ids: от 1 до 300 записей"})
		return
	}
	loc := ""
	if req.Location != nil {
		loc = strings.TrimSpace(*req.Location)
	}
	cat := ""
	if req.Category != nil {
		cat = strings.TrimSpace(*req.Category)
	}
	var bulkCatID uuid.UUID
	if req.CategoryID != nil && strings.TrimSpace(*req.CategoryID) != "" {
		id, err := uuid.Parse(strings.TrimSpace(*req.CategoryID))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category_id"})
			return
		}
		var catRow models.Category
		if err := h.DB.First(&catRow, "id = ?", id).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "category not found"})
			return
		}
		bulkCatID = id
		cat = catRow.Name
	}
	if loc == "" && cat == "" && bulkCatID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "укажите location и/или category (или category_id)"})
		return
	}

	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var ids []uuid.UUID
	for _, s := range req.IDs {
		id, err := uuid.Parse(strings.TrimSpace(s))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id in list"})
			return
		}
		ids = append(ids, id)
	}

	tx := h.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var updated int64
	for _, id := range ids {
		var it models.Item
		if err := tx.First(&it, "id = ? AND deleted_at IS NULL", id).Error; err != nil {
			continue
		}
		prev := it
		if loc != "" {
			it.Location = loc
		}
		if bulkCatID != uuid.Nil {
			it.CategoryID = bulkCatID
			it.Category = cat
		} else if cat != "" {
			cid, err := catalog.EnsureCategory(tx, cat)
			if err != nil {
				tx.Rollback()
				log.Printf("bulk meta category: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
				return
			}
			it.CategoryID = cid
			it.Category = strings.TrimSpace(cat)
		}
		if err := tx.Save(&it).Error; err != nil {
			tx.Rollback()
			log.Printf("bulk meta: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		msg := itemChangeSummary(prev, it)
		if msg != "" {
			saveItemHistory(tx, it.ID, &uid, "Массовое изменение: "+msg)
		}
		updated++
	}
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": updated})
}

func csvIdx(header []string, name string) int {
	for i, h := range header {
		if strings.TrimSpace(strings.ToLower(h)) == strings.ToLower(name) {
			return i
		}
	}
	return -1
}

func cell(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}

func (h *ItemHandler) ImportCSV(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "нужен файл form-data поле file"})
		return
	}
	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot open file"})
		return
	}
	defer f.Close()

	raw, err := io.ReadAll(f)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read file"})
		return
	}
	raw = bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})

	r := csv.NewReader(bytes.NewReader(raw))
	r.FieldsPerRecord = -1
	header, err := r.Read()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "пустой или битый CSV"})
		return
	}

	idxSKU := csvIdx(header, "sku")
	idxName := csvIdx(header, "name")
	idxCat := csvIdx(header, "category")
	idxDesc := csvIdx(header, "description")
	idxQty := csvIdx(header, "quantity")
	idxUnit := csvIdx(header, "unit")
	idxLoc := csvIdx(header, "location")
	idxMin := csvIdx(header, "min_quantity")
	idxPurch := csvIdx(header, "purchase_date")
	idxImg := csvIdx(header, "image_url")
	idxLife := csvIdx(header, "service_life_years")
	idxID := csvIdx(header, "id")

	if idxSKU < 0 || idxName < 0 || idxCat < 0 || idxQty < 0 || idxUnit < 0 || idxLoc < 0 || idxMin < 0 || idxPurch < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CSV: нужны колонки sku,name,category,quantity,unit,location,min_quantity,purchase_date"})
		return
	}

	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var imported, updated int
	var errs []string
	lineNum := 1

	for {
		row, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			errs = append(errs, fmtLineErr(lineNum, "чтение строки"))
			break
		}
		lineNum++
		if len(errs) >= 40 {
			errs = append(errs, "...слишком много ошибок, импорт прерван")
			break
		}

		sku := cell(row, idxSKU)
		name := cell(row, idxName)
		if sku == "" || name == "" {
			errs = append(errs, fmtLineErr(lineNum, "пустой sku или name"))
			continue
		}

		qty, err := strconv.Atoi(cell(row, idxQty))
		if err != nil || qty < 0 {
			errs = append(errs, fmtLineErr(lineNum, "quantity"))
			continue
		}
		minQ, err := strconv.Atoi(cell(row, idxMin))
		if err != nil || minQ < 0 {
			errs = append(errs, fmtLineErr(lineNum, "min_quantity"))
			continue
		}
		pd, err := parsePurchaseDate(cell(row, idxPurch))
		if err != nil {
			errs = append(errs, fmtLineErr(lineNum, "purchase_date"))
			continue
		}
		life := 4
		if idxLife >= 0 && cell(row, idxLife) != "" {
			if n, err := strconv.Atoi(cell(row, idxLife)); err == nil {
				life = clampServiceLifeYears(n)
			}
		}
		desc := ""
		if idxDesc >= 0 {
			desc = cell(row, idxDesc)
		}
		img := ""
		if idxImg >= 0 {
			img = cell(row, idxImg)
		}
		catName := strings.TrimSpace(cell(row, idxCat))
		if catName == "" {
			errs = append(errs, fmtLineErr(lineNum, "пустая category"))
			continue
		}
		catIDImported, err := catalog.EnsureCategory(h.DB, catName)
		if err != nil {
			errs = append(errs, fmtLineErr(lineNum, "category: "+err.Error()))
			continue
		}
		unitStr := strings.TrimSpace(cell(row, idxUnit))
		if unitStr == "" {
			unitStr = "шт"
		}
		locStr := strings.TrimSpace(cell(row, idxLoc))

		var target models.Item
		var found bool
		if idxID >= 0 && cell(row, idxID) != "" {
			if id, err := uuid.Parse(cell(row, idxID)); err == nil {
				if err := h.DB.First(&target, "id = ? AND deleted_at IS NULL", id).Error; err == nil {
					found = true
				}
			}
		}
		if !found {
			if err := h.DB.First(&target, "sku = ? AND deleted_at IS NULL", sku).Error; err == nil {
				found = true
			}
		}

		if found {
			prev := target
			target.Name = strings.TrimSpace(name)
			target.CategoryID = catIDImported
			target.Category = catName
			target.Description = strings.TrimSpace(desc)
			target.Quantity = qty
			target.Unit = unitStr
			target.Location = locStr
			target.MinQuantity = minQ
			target.PurchaseDate = pd
			target.ImageURL = strings.TrimSpace(img)
			target.ServiceLifeYears = clampServiceLifeYears(life)
			if err := h.DB.Save(&target).Error; err != nil {
				errs = append(errs, fmtLineErr(lineNum, err.Error()))
				continue
			}
			if msg := itemChangeSummary(prev, target); msg != "" {
				saveItemHistory(h.DB, target.ID, &uid, "Импорт CSV: "+msg)
			}
			updated++
			continue
		}

		item := models.Item{
			SKU: sku, Name: name, CategoryID: catIDImported, Category: catName,
			Description: strings.TrimSpace(desc), Quantity: qty,
			Unit: unitStr, Location: locStr,
			MinQuantity: minQ, PurchaseDate: pd, ImageURL: strings.TrimSpace(img),
			ServiceLifeYears: clampServiceLifeYears(life),
		}
		if err := h.DB.Create(&item).Error; err != nil {
			errs = append(errs, fmtLineErr(lineNum, err.Error()))
			continue
		}
		saveItemHistory(h.DB, item.ID, &uid, "Импорт CSV: создан объект · "+item.SKU)
		imported++
	}

	c.JSON(http.StatusOK, gin.H{"created": imported, "updated": updated, "errors": errs})
}

func fmtLineErr(line int, msg string) string {
	return "стр. " + strconv.Itoa(line) + ": " + msg
}

func (h *ItemHandler) ExportSnapshotJSON(c *gin.Context) {
	var ic int64
	h.DB.Model(&models.Item{}).Where("deleted_at IS NULL").Count(&ic)
	if ic > 2500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "слишком много объектов для JSON (>2500); используйте экспорт CSV"})
		return
	}
	var items []models.Item
	if err := h.DB.Where("deleted_at IS NULL").Order("name").Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	var sessions []models.InventorySession
	if err := h.DB.Order("created_at DESC").Limit(500).Find(&sessions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	payload := gin.H{
		"exported_at":          time.Now().UTC().Format(time.RFC3339),
		"items":                items,
		"inventory_sessions":   sessions,
		"note":                 "Не полный дамп БД; для резервной копии используйте pg_dump PostgreSQL.",
	}
	b, err := json.Marshal(payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "marshal"})
		return
	}
	c.Header("Content-Type", "application/json; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="inventory-snapshot.json"`)
	c.Data(http.StatusOK, "application/json; charset=utf-8", b)
}

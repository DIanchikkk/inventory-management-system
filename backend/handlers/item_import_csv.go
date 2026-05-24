package handlers

import (
	"bytes"
	"encoding/csv"
	"errors"
	"io"
	"inventory-system/backend/catalog"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

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

func fmtLineErr(line int, msg string) string {
	return "стр. " + strconv.Itoa(line) + ": " + msg
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

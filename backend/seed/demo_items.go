package seed

import (
	_ "embed"
	"encoding/json"
	"errors"
	"inventory-system/backend/catalog"
	"inventory-system/backend/models"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var demoItemsJSON []byte

type demoItemRow struct {
	SKU              string `json:"sku"`
	Name             string `json:"name"`
	Category         string `json:"category"`
	Description      string `json:"description"`
	Quantity         int    `json:"quantity"`
	Unit             string `json:"unit"`
	Location         string `json:"location"`
	MinQuantity      int    `json:"min_quantity"`
	PurchaseDate     string `json:"purchase_date"`
	ServiceLifeYears int    `json:"service_life_years"`
	ImageURL         string `json:"image_url"`
}

func demoItemImageURL(r demoItemRow) string {
	if u := strings.TrimSpace(r.ImageURL); u != "" {
		return u
	}
	return demoItemImagePath(strings.TrimSpace(r.SKU))
}

func demoItemImagePath(sku string) string {
	s := strings.TrimSpace(sku)
	if s == "" {
		return ""
	}
	s = strings.ToLower(strings.ReplaceAll(s, " ", "-"))
	return "/uploads/item-images/seed-" + s + ".jpg"
}

func syncDemoSeedImageURLs(db *gorm.DB, rows []demoItemRow) error {
	for _, r := range rows {
		sku := strings.TrimSpace(r.SKU)
		if sku == "" {
			continue
		}
		want := demoItemImageURL(r)
		if want == "" {
			continue
		}
		if err := db.Model(&models.Item{}).Where("sku = ?", sku).Update("image_url", want).Error; err != nil {
			return err
		}
	}
	return nil
}

func seedDemoItems(db *gorm.DB) error {
	var rows []demoItemRow
	if err := json.Unmarshal(demoItemsJSON, &rows); err != nil {
		return err
	}
	catIDs := make(map[string]uuid.UUID)
	for _, r := range rows {
		name := strings.TrimSpace(r.Category)
		if name == "" {
			continue
		}
		if _, ok := catIDs[name]; ok {
			continue
		}
		id, err := catalog.EnsureCategory(db, name)
		if err != nil {
			return err
		}
		catIDs[name] = id
	}

	for _, r := range rows {
		pd, err := time.Parse(time.RFC3339, r.PurchaseDate)
		if err != nil {
			return err
		}
		unit := strings.TrimSpace(r.Unit)
		if unit == "" {
			unit = "шт"
		}
		catName := strings.TrimSpace(r.Category)
		item := models.Item{
			SKU:              strings.TrimSpace(r.SKU),
			Name:             strings.TrimSpace(r.Name),
			CategoryID:       catIDs[catName],
			Category:         catName,
			Description:      strings.TrimSpace(r.Description),
			Quantity:         r.Quantity,
			Unit:             unit,
			Location:         strings.TrimSpace(r.Location),
			MinQuantity:      r.MinQuantity,
			PurchaseDate:     pd,
			ImageURL:         demoItemImageURL(r),
			ServiceLifeYears: r.ServiceLifeYears,
		}
		if item.ServiceLifeYears < 1 {
			item.ServiceLifeYears = 4
		}

		var existing models.Item
		err = db.Where("sku = ?", item.SKU).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := db.Create(&item).Error; err != nil {
				return err
			}
			continue
		}
		if err != nil {
			return err
		}
	}
	return syncDemoSeedImageURLs(db, rows)
}

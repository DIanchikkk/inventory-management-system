package handlers

import (
	"errors"
	"inventory-system/backend/models"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type resolvedItemInput struct {
	Name             string
	SKU              string
	Category         string
	CategoryID       uuid.UUID
	Description      string
	Quantity         int
	Unit             string
	Location         string
	MinQuantity      int
	PurchaseDate     time.Time
	ImageURL         string
	ServiceLifeYears int
	RetiredAt        *time.Time
	ReplacedByItemID *uuid.UUID
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

func resolveItemRequest(db *gorm.DB, req itemRequest, selfID uuid.UUID) (resolvedItemInput, error) {
	pd, err := parsePurchaseDate(req.PurchaseDate)
	if err != nil {
		return resolvedItemInput{}, errors.New("invalid purchase_date: use RFC3339 or YYYY-MM-DD")
	}
	name := strings.TrimSpace(req.Name)
	sku := strings.TrimSpace(req.SKU)
	catID, err := uuid.Parse(strings.TrimSpace(req.CategoryID))
	if err != nil {
		return resolvedItemInput{}, errors.New("invalid category_id")
	}
	catRow, err := categoryByID(db, catID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return resolvedItemInput{}, errors.New("category not found")
		}
		return resolvedItemInput{}, err
	}
	unit := strings.TrimSpace(req.Unit)
	location := strings.TrimSpace(req.Location)
	if name == "" {
		return resolvedItemInput{}, errors.New("name must not be empty")
	}
	if sku == "" {
		return resolvedItemInput{}, errors.New("sku must not be empty")
	}
	if unit == "" {
		return resolvedItemInput{}, errors.New("unit must not be empty")
	}
	if location == "" {
		return resolvedItemInput{}, errors.New("location must not be empty")
	}
	if strings.TrimSpace(req.ReplacedByItemID) != "" && !req.Retired {
		return resolvedItemInput{}, errors.New("UUID преемника задаётся только вместе со списанием")
	}
	var retiredAt *time.Time
	var succPtr *uuid.UUID
	if req.Retired {
		t := time.Now().UTC()
		retiredAt = &t
		if strings.TrimSpace(req.ReplacedByItemID) != "" {
			sid, err := parseSuccessorItemID(req.ReplacedByItemID, selfID, db)
			if err != nil {
				return resolvedItemInput{}, err
			}
			succPtr = sid
		}
	}
	return resolvedItemInput{
		Name:             name,
		SKU:              sku,
		Category:         catRow.Name,
		CategoryID:       catID,
		Description:      strings.TrimSpace(req.Description),
		Quantity:         req.Quantity,
		Unit:             unit,
		Location:         location,
		MinQuantity:      req.MinQuantity,
		PurchaseDate:     pd,
		ImageURL:         strings.TrimSpace(req.ImageURL),
		ServiceLifeYears: clampServiceLifeYears(req.ServiceLifeYears),
		RetiredAt:        retiredAt,
		ReplacedByItemID: succPtr,
	}, nil
}

func (in resolvedItemInput) newItem() models.Item {
	return models.Item{
		SKU:              in.SKU,
		Name:             in.Name,
		CategoryID:       in.CategoryID,
		Category:         in.Category,
		Description:      in.Description,
		Quantity:         in.Quantity,
		Unit:             in.Unit,
		Location:         in.Location,
		MinQuantity:      in.MinQuantity,
		PurchaseDate:     in.PurchaseDate,
		ImageURL:         in.ImageURL,
		ServiceLifeYears: in.ServiceLifeYears,
		RetiredAt:        in.RetiredAt,
		ReplacedByItemID: in.ReplacedByItemID,
	}
}

func (in resolvedItemInput) applyTo(item *models.Item, retired bool) {
	item.SKU = in.SKU
	item.Name = in.Name
	item.CategoryID = in.CategoryID
	item.Category = in.Category
	item.Description = in.Description
	item.Quantity = in.Quantity
	item.Unit = in.Unit
	item.Location = in.Location
	item.MinQuantity = in.MinQuantity
	item.PurchaseDate = in.PurchaseDate
	item.ImageURL = in.ImageURL
	item.ServiceLifeYears = in.ServiceLifeYears
	if retired {
		if item.RetiredAt == nil {
			t := time.Now().UTC()
			item.RetiredAt = &t
		}
		item.ReplacedByItemID = in.ReplacedByItemID
	} else {
		item.RetiredAt = nil
		item.ReplacedByItemID = nil
	}
}

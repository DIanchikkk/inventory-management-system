package catalog

import (
	"errors"
	"inventory-system/backend/models"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// EnsureCategory возвращает id категории по имени; при отсутствии создаёт запись в справочнике.
func EnsureCategory(db *gorm.DB, name string) (uuid.UUID, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		name = "Прочее"
	}
	var c models.Category
	err := db.Where("name = ?", name).First(&c).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c = models.Category{Name: name}
		if err := db.Create(&c).Error; err != nil {
			return uuid.Nil, err
		}
		return c.ID, nil
	}
	if err != nil {
		return uuid.Nil, err
	}
	return c.ID, nil
}

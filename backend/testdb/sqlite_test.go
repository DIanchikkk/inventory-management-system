package testdb

import (
	"inventory-system/backend/models"
	"testing"
)

func TestOpenMemory_migrates(t *testing.T) {
	db := OpenMemory(t, &models.Category{})
	var n int64
	if err := db.Model(&models.Category{}).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
}

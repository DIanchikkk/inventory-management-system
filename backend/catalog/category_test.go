package catalog

import (
	"inventory-system/backend/models"
	"inventory-system/backend/testdb"
	"testing"
)

func TestEnsureCategory_createsAndReuses(t *testing.T) {
	db := testdb.OpenMemory(t, &models.Category{})

	id1, err := EnsureCategory(db, "  Офис  ")
	if err != nil {
		t.Fatal(err)
	}
	id2, err := EnsureCategory(db, "Офис")
	if err != nil {
		t.Fatal(err)
	}
	if id1 != id2 {
		t.Fatalf("expected same category id, got %v and %v", id1, id2)
	}
}

func TestEnsureCategory_emptyNameUsesDefault(t *testing.T) {
	db := testdb.OpenMemory(t, &models.Category{})

	id, err := EnsureCategory(db, "   ")
	if err != nil {
		t.Fatal(err)
	}
	var c models.Category
	if err := db.First(&c, "id = ?", id).Error; err != nil {
		t.Fatal(err)
	}
	if c.Name != "Прочее" {
		t.Fatalf("name = %q, want Прочее", c.Name)
	}
}

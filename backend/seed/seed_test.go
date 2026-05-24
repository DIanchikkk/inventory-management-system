package seed

import (
	"inventory-system/backend/models"
	"inventory-system/backend/testdb"
	"testing"
)

func TestUpsertUser_createsAndUpdatesRole(t *testing.T) {
	db := testdb.OpenMemory(t, &models.User{})

	if err := upsertUser(db, "admin", "admin", "admin123"); err != nil {
		t.Fatal(err)
	}
	var u models.User
	if err := db.Where("username = ?", "admin").First(&u).Error; err != nil {
		t.Fatal(err)
	}
	if u.Role != "admin" {
		t.Fatalf("role = %q", u.Role)
	}
	if !u.CheckPassword("admin123") {
		t.Fatal("password not set")
	}

	if err := upsertUser(db, "admin", "user", "newpass"); err != nil {
		t.Fatal(err)
	}
	if err := db.Where("username = ?", "admin").First(&u).Error; err != nil {
		t.Fatal(err)
	}
	if u.Role != "user" {
		t.Fatalf("role after update = %q", u.Role)
	}
	if !u.CheckPassword("newpass") {
		t.Fatal("password not updated")
	}
}

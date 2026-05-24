package models

import (
	"testing"

	"github.com/google/uuid"
)

func TestBeforeCreate_assignsUUID(t *testing.T) {
	check := func(t *testing.T, id uuid.UUID) {
		t.Helper()
		if id == uuid.Nil {
			t.Fatal("expected generated UUID")
		}
	}

	t.Run("Item", func(t *testing.T) {
		var item Item
		item.Name = "Стул"
		item.CategoryID = uuid.New()
		if err := item.BeforeCreate(nil); err != nil {
			t.Fatal(err)
		}
		check(t, item.ID)
	})

	t.Run("Category", func(t *testing.T) {
		var cat Category
		if err := cat.BeforeCreate(nil); err != nil {
			t.Fatal(err)
		}
		check(t, cat.ID)
	})

	t.Run("InventorySession", func(t *testing.T) {
		var sess InventorySession
		if err := sess.BeforeCreate(nil); err != nil {
			t.Fatal(err)
		}
		check(t, sess.ID)
	})

	t.Run("InventoryResult", func(t *testing.T) {
		var res InventoryResult
		if err := res.BeforeCreate(nil); err != nil {
			t.Fatal(err)
		}
		check(t, res.ID)
	})

	t.Run("InventoryStockLedger", func(t *testing.T) {
		var led InventoryStockLedger
		if err := led.BeforeCreate(nil); err != nil {
			t.Fatal(err)
		}
		check(t, led.ID)
	})

	t.Run("StockAdjustmentDocument", func(t *testing.T) {
		var doc StockAdjustmentDocument
		if err := doc.BeforeCreate(nil); err != nil {
			t.Fatal(err)
		}
		check(t, doc.ID)
	})

	t.Run("InventorySessionEvent", func(t *testing.T) {
		var ev InventorySessionEvent
		if err := ev.BeforeCreate(nil); err != nil {
			t.Fatal(err)
		}
		check(t, ev.ID)
	})
}

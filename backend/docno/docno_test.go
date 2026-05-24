package docno

import (
	"fmt"
	"inventory-system/backend/models"
	"inventory-system/backend/testdb"
	"testing"
	"time"
)

func TestNextInventoryNo_firstAndSecond(t *testing.T) {
	db := testdb.OpenMemory(t, &models.InventoryDocYearSeq{})
	year := time.Now().UTC().Year()

	no1, err := NextInventoryNo(db)
	if err != nil {
		t.Fatal(err)
	}
	want1 := fmt.Sprintf("INV-%d-%06d", year, 1)
	if no1 != want1 {
		t.Fatalf("first no = %q, want %q", no1, want1)
	}

	no2, err := NextInventoryNo(db)
	if err != nil {
		t.Fatal(err)
	}
	want2 := fmt.Sprintf("INV-%d-%06d", year, 2)
	if no2 != want2 {
		t.Fatalf("second no = %q, want %q", no2, want2)
	}
}

func TestNextStockAdjustmentNo_writeOff(t *testing.T) {
	db := testdb.OpenMemory(t, &models.StockAdjustmentDocYearSeq{})
	year := time.Now().UTC().Year()

	no, err := NextStockAdjustmentNo(db, models.StockMovementWriteOff)
	if err != nil {
		t.Fatal(err)
	}
	want := fmt.Sprintf("СП-%d-%06d", year, 1)
	if no != want {
		t.Fatalf("got %q, want %q", no, want)
	}
}

package handlers

import (
	"testing"
	"time"

	"inventory-system/backend/models"
)

func TestClampServiceLifeYears(t *testing.T) {
	tests := []struct {
		in, want int
	}{
		{0, 4},
		{1, 1},
		{40, 40},
		{99, 40},
	}
	for _, tt := range tests {
		if got := clampServiceLifeYears(tt.in); got != tt.want {
			t.Errorf("clampServiceLifeYears(%d) = %d, want %d", tt.in, got, tt.want)
		}
	}
}

func TestParsePurchaseDate(t *testing.T) {
	d, err := parsePurchaseDate("2024-06-15")
	if err != nil {
		t.Fatal(err)
	}
	if d.Year() != 2024 || d.Month() != time.June || d.Day() != 15 {
		t.Fatalf("date = %v", d)
	}
}

func TestCsvIdx_and_cell(t *testing.T) {
	header := []string{" SKU ", "Name"}
	skuIdx := csvIdx(header, "sku")
	if skuIdx != 0 {
		t.Fatalf("sku idx = %d", skuIdx)
	}
	row := []string{"  A-1  ", "Стул"}
	if got := cell(row, skuIdx); got != "A-1" {
		t.Fatalf("cell = %q", got)
	}
	if cell(row, -1) != "" || cell(row, 9) != "" {
		t.Fatal("expected empty for bad index")
	}
}

func TestStockMovementLabelRu(t *testing.T) {
	if got := stockMovementLabelRu(models.StockMovementWriteOff); got != "Списание" {
		t.Fatalf("got %q", got)
	}
	if got := stockMovementLabelRu(models.StockMovementReceipt); got != "Оприходование" {
		t.Fatalf("got %q", got)
	}
}

func TestSessionLinesOrder(t *testing.T) {
	tests := []struct {
		group, want string
	}{
		{"location", "items.location ASC, items.name ASC"},
		{"category", "items.category ASC, items.name ASC"},
		{"", "items.name ASC"},
		{"  ", "items.name ASC"},
	}
	for _, tt := range tests {
		if got := sessionLinesOrder(tt.group); got != tt.want {
			t.Errorf("sessionLinesOrder(%q) = %q, want %q", tt.group, got, tt.want)
		}
	}
}

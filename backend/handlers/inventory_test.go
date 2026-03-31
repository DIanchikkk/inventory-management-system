package handlers

import (
	"inventory-system/backend/models"
	"testing"
)

func TestComputeResultStatus(t *testing.T) {
	tests := []struct {
		name     string
		expected int
		actual   int
		want     string
	}{
		{"match", 10, 10, models.ResultStatusMatch},
		{"missing", 5, 0, models.ResultStatusMissing},
		{"mismatch", 5, 3, models.ResultStatusMismatch},
		{"zero both", 0, 0, models.ResultStatusMatch},
		{"mismatch from zero expected", 0, 1, models.ResultStatusMismatch},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := computeResultStatus(tt.expected, tt.actual); got != tt.want {
				t.Errorf("computeResultStatus(%d,%d) = %q, want %q", tt.expected, tt.actual, got, tt.want)
			}
		})
	}
}

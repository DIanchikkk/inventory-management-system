package docno

import (
	"inventory-system/backend/models"
	"testing"
)

func TestAdjustmentPrefix(t *testing.T) {
	tests := []struct {
		name       string
		movement   string
		wantPrefix string
		wantKind   string
		wantErr    bool
	}{
		{
			name:       "write-off SP",
			movement:   models.StockMovementWriteOff,
			wantPrefix: "СП",
			wantKind:   models.StockMovementWriteOff,
		},
		{
			name:       "receipt OP",
			movement:   models.StockMovementReceipt,
			wantPrefix: "ОП",
			wantKind:   models.StockMovementReceipt,
		},
		{
			name:     "unknown movement",
			movement: "transfer",
			wantErr:  true,
		},
		{
			name:     "empty movement",
			movement: "",
			wantErr:  true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			prefix, kind, err := adjustmentPrefix(tt.movement)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if prefix != tt.wantPrefix || kind != tt.wantKind {
				t.Fatalf("got prefix=%q kind=%q, want %q %q", prefix, kind, tt.wantPrefix, tt.wantKind)
			}
		})
	}
}

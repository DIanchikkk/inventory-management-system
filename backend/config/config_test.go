package config

import (
	"testing"
	"time"
)

func TestParseJWTTTL(t *testing.T) {
	tests := []struct {
		in   string
		want time.Duration
	}{
		{"", 24 * time.Hour},
		{"24", 24 * time.Hour},
		{"1", 1 * time.Hour},
		{"8760", 8760 * time.Hour},
		{"0", 24 * time.Hour},
		{"8761", 24 * time.Hour},
		{"abc", 24 * time.Hour},
	}
	for _, tt := range tests {
		if got := parseJWTTTL(tt.in); got != tt.want {
			t.Errorf("parseJWTTTL(%q) = %v, want %v", tt.in, got, tt.want)
		}
	}
}

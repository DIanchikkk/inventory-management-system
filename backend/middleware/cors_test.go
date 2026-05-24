package middleware

import "testing"

func TestOriginIsPrivateLAN(t *testing.T) {
	tests := []struct {
		origin string
		want   bool
	}{
		{"http://192.168.1.10:5173", true},
		{"https://10.0.0.5", true},
		{"http://localhost:5173", false},
		{"http://8.8.8.8", false},
		{"not-a-url", false},
		{"", false},
	}
	for _, tt := range tests {
		t.Run(tt.origin, func(t *testing.T) {
			if got := originIsPrivateLAN(tt.origin); got != tt.want {
				t.Fatalf("originIsPrivateLAN(%q) = %v, want %v", tt.origin, got, tt.want)
			}
		})
	}
}

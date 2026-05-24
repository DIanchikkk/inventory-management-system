package uploads

import "testing"

func TestImageFileCacheKey_nonUploadURL(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{"empty", ""},
		{"external https", "https://cdn.example/item.jpg"},
		{"relative without prefix", "items/photo.jpg"},
		{"whitespace only", "   "},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ImageFileCacheKey(tt.url); got != "" {
				t.Fatalf("ImageFileCacheKey(%q) = %q, want empty", tt.url, got)
			}
		})
	}
}

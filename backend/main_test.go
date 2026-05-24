package main

import (
	"inventory-system/backend/uploads"
	"os"
	"path/filepath"
	"testing"
)

func TestUploadsItemImagesHasJPEG(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "item-images")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if uploads.ItemImagesHasJPEG(root) {
		t.Fatal("expected false without jpeg")
	}
	if err := os.WriteFile(filepath.Join(dir, "photo.jpg"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if !uploads.ItemImagesHasJPEG(root) {
		t.Fatal("expected true when jpeg present")
	}
}

func TestUploadsRootCandidates_noDuplicates(t *testing.T) {
	paths := uploads.RootCandidates()
	if len(paths) == 0 {
		t.Fatal("expected at least one candidate")
	}
	seen := make(map[string]struct{}, len(paths))
	for _, p := range paths {
		if !filepath.IsAbs(p) {
			t.Fatalf("path must be absolute: %q", p)
		}
		if _, ok := seen[p]; ok {
			t.Fatalf("duplicate path %q", p)
		}
		seen[p] = struct{}{}
	}
}

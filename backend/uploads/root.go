package uploads

import (
	"os"
	"path/filepath"
	"strings"
)

func ItemImagesHasJPEG(root string) bool {
	return itemImagesHasJPEG(root)
}

func itemImagesHasJPEG(root string) bool {
	dir := filepath.Join(root, "item-images")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if strings.HasSuffix(strings.ToLower(e.Name()), ".jpg") {
			return true
		}
	}
	return false
}

func RootCandidates() []string {
	return rootCandidates()
}

func rootCandidates() []string {
	wd, err := os.Getwd()
	if err != nil {
		wd = "."
	}
	raw := []string{
		filepath.Join(wd, "frontend", "src", "assets", "uploads"),
		filepath.Join(wd, "..", "frontend", "src", "assets", "uploads"),
		filepath.Join(wd, "..", "..", "frontend", "src", "assets", "uploads"),
		filepath.Join(wd, "uploads"),
		filepath.Join(wd, "..", "uploads"),
		filepath.Join(wd, "..", "..", "uploads"),
		"uploads",
		filepath.Join("..", "uploads"),
	}
	if exe, err := os.Executable(); err == nil {
		exedir := filepath.Dir(exe)
		raw = append(raw,
			filepath.Join(exedir, "uploads"),
			filepath.Join(exedir, "..", "uploads"),
			filepath.Join(exedir, "..", "frontend", "src", "assets", "uploads"),
		)
	}
	seen := map[string]struct{}{}
	var out []string
	for _, p := range raw {
		abs, err := filepath.Abs(filepath.Clean(p))
		if err != nil {
			continue
		}
		if _, ok := seen[abs]; ok {
			continue
		}
		seen[abs] = struct{}{}
		out = append(out, abs)
	}
	return out
}

func ResolveRoot() string {
	if v := strings.TrimSpace(os.Getenv("INVENTORY_UPLOADS_ROOT")); v != "" {
		abs, err := filepath.Abs(filepath.Clean(v))
		if err != nil {
			return filepath.Clean(v)
		}
		return abs
	}
	for _, root := range rootCandidates() {
		if itemImagesHasJPEG(root) {
			return root
		}
	}
	for _, root := range rootCandidates() {
		if fi, err := os.Stat(filepath.Join(root, "item-images")); err == nil && fi.IsDir() {
			return root
		}
		if fi, err := os.Stat(filepath.Join(root, "items")); err == nil && fi.IsDir() {
			return root
		}
	}
	abs, _ := filepath.Abs(filepath.Join("frontend", "src", "assets", "uploads"))
	return abs
}

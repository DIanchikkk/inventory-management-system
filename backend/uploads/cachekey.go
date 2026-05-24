package uploads

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func Root() string {
	return ResolveRoot()
}

func ImageFileCacheKey(imageURL string) string {
	u := strings.TrimSpace(imageURL)
	if !strings.HasPrefix(u, "/uploads/") {
		return ""
	}
	rel := strings.TrimPrefix(u, "/uploads/")
	full := filepath.Join(Root(), filepath.FromSlash(rel))
	fi, err := os.Stat(full)
	if err != nil || fi.IsDir() {
		return ""
	}
	return strconv.FormatInt(fi.ModTime().Unix(), 10)
}

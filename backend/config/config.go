package config

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL string
	JWTSecret   string
	JWTTTL      time.Duration
	Port        string
	GinMode     string
	CORSOrigins []string
}

func Load() (*Config, error) {
	godotenv.Load(".env")
	godotenv.Load("backend/.env")
	dataBase := getEnv("DATABASE_URL", "host=localhost port=5432 user=postgres password=postgres dbname=inventory_db sslmode=disable")
	jwt := getEnv("JWT_SECRET", "your-secret-key-change-me")
	port := getEnv("PORT", "8080")
	ginMode := getEnv("GIN_MODE", "debug")

	return &Config{
		DatabaseURL: dataBase,
		JWTSecret:   jwt,
		JWTTTL:      parseJWTTTL(getEnv("JWT_EXPIRE_HOURS", "24")),
		Port:        port,
		GinMode:     ginMode,
		CORSOrigins: parseCORSOrigins(getEnv("CORS_ORIGINS", "")),
	}, nil
}

// defaultCORSOrigins — типичные origin Vite (5173 занят →5174/5175) и vite preview (4173).
var defaultCORSOrigins = []string{
	"http://localhost:5173", "http://127.0.0.1:5173",
	"http://localhost:5174", "http://127.0.0.1:5174",
	"http://localhost:5175", "http://127.0.0.1:5175",
	"http://localhost:4173", "http://127.0.0.1:4173",
}

// parseCORSOrigins — список origin через запятую; по умолчанию Vite dev.
func parseCORSOrigins(s string) []string {
	if s == "" {
		return defaultCORSOrigins
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return []string{"http://localhost:5173"}
	}
	return out
}

// parseJWTTTL — часы из env; при ошибке или вне 1…8760 — 24 ч.
func parseJWTTTL(s string) time.Duration {
	h, err := strconv.Atoi(s)
	if err != nil || h < 1 || h > 8760 {
		return 24 * time.Hour
	}
	return time.Duration(h) * time.Hour
}

func getEnv(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}

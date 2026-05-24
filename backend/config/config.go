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
	CORSAllowLAN bool
}

func Load() (*Config, error) {
	godotenv.Load(".env")
	godotenv.Load("backend/.env")
	dataBase := getEnv("DATABASE_URL", "host=localhost port=5432 user=postgres password=postgres dbname=inventory_db sslmode=disable")
	jwt := getEnv("JWT_SECRET", "your-secret-key-change-me")
	port := getEnv("PORT", "8080")
	ginMode := getEnv("GIN_MODE", "debug")
	corsAllowLANRaw := strings.TrimSpace(getEnv("CORS_ALLOW_LAN", ""))

	return &Config{
		DatabaseURL: dataBase,
		JWTSecret:   jwt,
		JWTTTL:      parseJWTTTL(getEnv("JWT_EXPIRE_HOURS", "24")),
		Port:        port,
		GinMode:     ginMode,
		CORSOrigins: parseCORSOrigins(getEnv("CORS_ORIGINS", "")),
		CORSAllowLAN: corsAllowLANRaw == "1" || strings.EqualFold(corsAllowLANRaw, "true"),
	}, nil
}

var defaultCORSOrigins = []string{
	"http://127.0.0.1:5174",
}

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
		return defaultCORSOrigins
	}
	return out
}

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

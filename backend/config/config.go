package config

import (
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL string
	JWTSecret   string
	JWTTTL      time.Duration
	Port        string
	GinMode     string
}

func Load() (*Config, error) {
	godotenv.Load(".env")
	godotenv.Load("backend/.env")
	dataBase := getEnv("DATABASE_URL", "host=localhost port=5432 user=dianayusupova dbname=inventory_db sslmode=disable")
	jwt := getEnv("JWT_SECRET", "your-secret-key-change-me")
	port := getEnv("PORT", "8080")
	ginMode := getEnv("GIN_MODE", "debug")

	return &Config{
		DatabaseURL: dataBase,
		JWTSecret:   jwt,
		JWTTTL:      parseJWTTTL(getEnv("JWT_EXPIRE_HOURS", "24")),
		Port:        port,
		GinMode:     ginMode,
	}, nil
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

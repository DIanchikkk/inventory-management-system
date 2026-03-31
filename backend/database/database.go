package database

import (
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Connect открывает соединение с PostgreSQL через GORM.
func Connect(dsn string) (*gorm.DB, error) {
	return gorm.Open(postgres.Open(dsn), &gorm.Config{})
}

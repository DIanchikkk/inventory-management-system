package database

import "testing"

func TestConnect_invalidDSN(t *testing.T) {
	_, err := Connect("not-a-valid-postgres-dsn")
	if err == nil {
		t.Fatal("expected error for invalid DSN")
	}
}

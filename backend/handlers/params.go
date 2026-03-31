package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ParseUUIDParam читает :key из пути и парсит как UUID.
func ParseUUIDParam(c *gin.Context, key string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(key))
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}

package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetUserID возвращает UUID пользователя, установленный AuthRequired.
func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	v, ok := c.Get(ContextUserIDKey)
	if !ok {
		return uuid.Nil, false
	}
	uid, ok := v.(uuid.UUID)
	return uid, ok
}

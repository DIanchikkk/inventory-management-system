package middleware

import (
	"errors"
	"inventory-system/backend/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func SyncRoleFromDB(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, ok := c.Get(ContextUserIDKey)
		if !ok {
			c.Next()
			return
		}
		uid, ok := raw.(uuid.UUID)
		if !ok {
			c.Next()
			return
		}
		var u models.User
		if err := db.First(&u, "id = ?", uid).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
				return
			}
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		c.Set(ContextRoleKey, u.Role)
		c.Next()
	}
}

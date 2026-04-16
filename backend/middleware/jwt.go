package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	ContextUserIDKey = "user_id"
	ContextRoleKey   = "role"
)

// AuthRequired проверяет Authorization: Bearer <JWT> и кладёт user_id и role в контекст.
func AuthRequired(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if h == "" || !strings.HasPrefix(h, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		raw := strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
		if raw == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		claims := jwt.MapClaims{}
		_, err := jwt.ParseWithClaims(raw, &claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(secret), nil
		})
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		sub, _ := claims["sub"].(string)
		uid, err := uuid.Parse(sub)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		role, _ := claims["role"].(string)

		c.Set(ContextUserIDKey, uid)
		c.Set(ContextRoleKey, role)
		c.Next()
	}
}

// GetRole — роль из контекста после AuthRequired.
func GetRole(c *gin.Context) (string, bool) {
	v, ok := c.Get(ContextRoleKey)
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	return s, ok
}

// RequireAdmin возвращает 403, если в токене role != "admin".
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get(ContextRoleKey)
		rs, _ := role.(string)
		if rs != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Next()
	}
}

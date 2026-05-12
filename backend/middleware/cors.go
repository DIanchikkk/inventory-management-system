package middleware

import (
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

func CORS(allowedOrigins []string, allowLAN bool) gin.HandlerFunc {
	allow := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		o = strings.TrimSpace(o)
		if o != "" {
			allow[o] = struct{}{}
		}
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		corsOK := false
		if origin != "" {
			if _, ok := allow[origin]; ok {
				corsOK = true
			} else if allowLAN && originIsPrivateLAN(origin) {
				corsOK = true
			}
		}
		if corsOK {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		c.Header("Access-Control-Expose-Headers", "Content-Disposition")
		c.Header("Access-Control-Max-Age", "43200")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func originIsPrivateLAN(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil || u.Scheme != "http" && u.Scheme != "https" {
		return false
	}
	host := u.Hostname()
	if host == "" {
		return false
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsPrivate()
}

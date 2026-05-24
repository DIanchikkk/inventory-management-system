package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	loginMaxPerWindow = 18
	loginWindow       = time.Minute
)

type slidingCounter struct {
	mu    sync.Mutex
	times map[string][]time.Time
	max   int
	win   time.Duration
}

func newSlidingCounter(max int, win time.Duration) *slidingCounter {
	return &slidingCounter{
		times: make(map[string][]time.Time),
		max:   max,
		win:   win,
	}
}

func (s *slidingCounter) allow(key string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	cutoff := now.Add(-s.win)
	prev := s.times[key]
	kept := prev[:0]
	for _, t := range prev {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= s.max {
		s.times[key] = kept
		return false
	}
	kept = append(kept, now)
	s.times[key] = kept
	return true
}

var loginBurstLimiter = newSlidingCounter(loginMaxPerWindow, loginWindow)

func LoginRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if ip == "" {
			ip = "unknown"
		}
		if !loginBurstLimiter.allow(ip) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "слишком много попыток входа с этого адреса; подождите около минуты",
			})
			return
		}
		c.Next()
	}
}

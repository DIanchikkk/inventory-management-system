package middleware

import (
	"testing"
	"time"
)

func TestSlidingCounter_allow(t *testing.T) {
	s := newSlidingCounter(2, time.Minute)

	if !s.allow("10.0.0.1") {
		t.Fatal("first attempt should pass")
	}
	if !s.allow("10.0.0.1") {
		t.Fatal("second attempt should pass")
	}
	if s.allow("10.0.0.1") {
		t.Fatal("third attempt within window should be blocked")
	}
	if !s.allow("10.0.0.2") {
		t.Fatal("different IP should have its own limit")
	}
}

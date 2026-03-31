package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestParseUUIDParam(t *testing.T) {
	gin.SetMode(gin.TestMode)
	id := uuid.MustParse("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "id", Value: id.String()}}

	got, ok := ParseUUIDParam(c, "id")
	if !ok || got != id {
		t.Fatalf("ParseUUIDParam valid: ok=%v got=%v want=%v", ok, got, id)
	}

	c.Params = gin.Params{gin.Param{Key: "id", Value: "not-a-uuid"}}
	_, ok = ParseUUIDParam(c, "id")
	if ok {
		t.Fatal("ParseUUIDParam invalid: expected ok=false")
	}
}

func TestParseUUIDParam_Missing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	_, ok := ParseUUIDParam(c, "id")
	if ok {
		t.Fatal("expected ok=false for empty param")
	}
}

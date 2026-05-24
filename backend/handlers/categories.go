package handlers

import (
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CategoryHandler struct {
	DB *gorm.DB
}

func (h *CategoryHandler) ListCategories(c *gin.Context) {
	var cats []models.Category
	if err := h.DB.Order("name ASC").Find(&cats).Error; err != nil {
		log.Printf("list categories: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, cats)
}

type createCategoryBody struct {
	Name string `json:"name" binding:"required"`
}

func (h *CategoryHandler) CreateCategory(c *gin.Context) {
	var body createCategoryBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name must not be empty"})
		return
	}
	var n int64
	if err := h.DB.Model(&models.Category{}).Where("name = ?", name).Count(&n).Error; err != nil {
		log.Printf("create category count: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if n > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "категория с таким названием уже есть"})
		return
	}
	cat := models.Category{Name: name}
	if err := h.DB.Create(&cat).Error; err != nil {
		log.Printf("create category: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusCreated, cat)
}

func categoryByID(db *gorm.DB, id interface{}) (models.Category, error) {
	var cat models.Category
	err := db.First(&cat, "id = ?", id).Error
	return cat, err
}

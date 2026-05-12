package handlers

import (
	"fmt"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func itemChangeSummary(prev, cur models.Item) string {
	var p []string
	if prev.SKU != cur.SKU {
		p = append(p, fmt.Sprintf("SKU: «%s» → «%s»", prev.SKU, cur.SKU))
	}
	if prev.Name != cur.Name {
		p = append(p, "название обновлено")
	}
	if prev.CategoryID != cur.CategoryID || prev.Category != cur.Category {
		p = append(p, fmt.Sprintf("категория: «%s» → «%s»", prev.Category, cur.Category))
	}
	if prev.Description != cur.Description {
		p = append(p, "описание изменено")
	}
	if prev.Quantity != cur.Quantity {
		p = append(p, fmt.Sprintf("количество: %d → %d", prev.Quantity, cur.Quantity))
	}
	if prev.Unit != cur.Unit {
		p = append(p, fmt.Sprintf("ед.: «%s» → «%s»", prev.Unit, cur.Unit))
	}
	if prev.Location != cur.Location {
		p = append(p, fmt.Sprintf("локация: «%s» → «%s»", prev.Location, cur.Location))
	}
	if prev.MinQuantity != cur.MinQuantity {
		p = append(p, fmt.Sprintf("мин. остаток: %d → %d", prev.MinQuantity, cur.MinQuantity))
	}
	if !prev.PurchaseDate.Equal(cur.PurchaseDate) {
		p = append(p, "дата поступления изменена")
	}
	if strings.TrimSpace(prev.ImageURL) != strings.TrimSpace(cur.ImageURL) {
		p = append(p, "ссылка на фото изменена")
	}
	if prev.ServiceLifeYears != cur.ServiceLifeYears {
		p = append(p, fmt.Sprintf("срок службы (лет): %d → %d", prev.ServiceLifeYears, cur.ServiceLifeYears))
	}
	prevRet := prev.RetiredAt != nil
	curRet := cur.RetiredAt != nil
	if prevRet != curRet || (prev.RetiredAt != nil && cur.RetiredAt != nil && !prev.RetiredAt.Equal(*cur.RetiredAt)) {
		p = append(p, "статус списания изменён")
	}
	pid, cid := uuid.Nil, uuid.Nil
	if prev.ReplacedByItemID != nil {
		pid = *prev.ReplacedByItemID
	}
	if cur.ReplacedByItemID != nil {
		cid = *cur.ReplacedByItemID
	}
	if pid != cid {
		p = append(p, "связь «заменено на» изменена")
	}
	if len(p) == 0 {
		return ""
	}
	return strings.Join(p, "; ")
}

func saveItemHistory(db *gorm.DB, itemID uuid.UUID, actor *uuid.UUID, msg string) {
	if db == nil {
		return
	}
	msg = strings.TrimSpace(msg)
	if msg == "" {
		return
	}
	rec := models.ItemHistoryLog{ItemID: itemID, ActorID: actor, Message: msg}
	if err := db.Create(&rec).Error; err != nil {
		log.Printf("item history: %v", err)
	}
}

func (h *ItemHandler) ListItemHistory(c *gin.Context) {
	id, ok := ParseUUIDParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var n int64
	if err := h.DB.Model(&models.Item{}).Where("id = ?", id).Count(&n).Error; err != nil || n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
		return
	}
	var logs []models.ItemHistoryLog
	if err := h.DB.Where("item_id = ?", id).Order("created_at DESC").Limit(80).Find(&logs).Error; err != nil {
		log.Printf("item history list: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"history": logs})
}

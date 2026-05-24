package handlers

import (
	"encoding/csv"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func (h *ItemHandler) ExportCSV(c *gin.Context) {
	var items []models.Item
	if err := h.DB.Order("name").Find(&items).Error; err != nil {
		log.Printf("export csv: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="items.csv"`)

	if _, err := c.Writer.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return
	}

	w := csv.NewWriter(c.Writer)
	header := []string{
		"id", "sku", "name", "category_id", "category", "description", "quantity", "unit", "location", "min_quantity",
		"purchase_date", "image_url", "service_life_years", "retired_at", "replaced_by_item_id",
		"created_at", "updated_at",
	}
	if err := w.Write(header); err != nil {
		return
	}
	for _, it := range items {
		retired := ""
		if it.RetiredAt != nil {
			retired = it.RetiredAt.UTC().Format(time.RFC3339)
		}
		repl := ""
		if it.ReplacedByItemID != nil {
			repl = it.ReplacedByItemID.String()
		}
		row := []string{
			it.ID.String(),
			it.SKU,
			it.Name,
			it.CategoryID.String(),
			it.Category,
			it.Description,
			strconv.Itoa(it.Quantity),
			it.Unit,
			it.Location,
			strconv.Itoa(it.MinQuantity),
			it.PurchaseDate.Format(time.RFC3339),
			it.ImageURL,
			strconv.Itoa(it.ServiceLifeYears),
			retired,
			repl,
			it.CreatedAt.Format(time.RFC3339),
			it.UpdatedAt.Format(time.RFC3339),
		}
		if err := w.Write(row); err != nil {
			return
		}
	}
	w.Flush()
}

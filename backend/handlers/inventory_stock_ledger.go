package handlers

import (
	"errors"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type stockLedgerRowDTO struct {
	models.InventoryStockLedger
	MovementLabel        string `json:"movement_label"`
	AdjustmentDocumentNo string `json:"adjustment_document_no,omitempty"`
	ItemSKU              string `json:"item_sku"`
	ItemName             string `json:"item_name"`
}

func adjustmentDocNosByLedger(db *gorm.DB, ledgers []models.InventoryStockLedger) map[string]string {
	ids := make([]uuid.UUID, 0)
	seen := make(map[string]struct{})
	for _, L := range ledgers {
		if L.AdjustmentDocumentID == nil {
			continue
		}
		k := L.AdjustmentDocumentID.String()
		if _, ok := seen[k]; ok {
			continue
		}
		seen[k] = struct{}{}
		ids = append(ids, *L.AdjustmentDocumentID)
	}
	out := make(map[string]string)
	if len(ids) == 0 {
		return out
	}
	var docs []models.StockAdjustmentDocument
	if err := db.Where("id IN ?", ids).Find(&docs).Error; err != nil {
		return out
	}
	for _, d := range docs {
		out[d.ID.String()] = d.DocumentNo
	}
	return out
}

func stockMovementLabelRu(m string) string {
	switch m {
	case models.StockMovementWriteOff:
		return "Списание"
	case models.StockMovementReceipt:
		return "Оприходование"
	default:
		return m
	}
}

func (h *InventoryHandler) ListSessionStockLedger(c *gin.Context) {
	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	role, _ := middleware.GetRole(c)
	sid, ok := ParseUUIDParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var sess models.InventorySession
	if err := h.DB.First(&sess, "id = ?", sid).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
			return
		}
		log.Printf("stock ledger session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if sess.CreatedBy != uid && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var ledgers []models.InventoryStockLedger
	if err := h.DB.Where("session_id = ?", sid).Order("created_at ASC").Find(&ledgers).Error; err != nil {
		log.Printf("stock ledger list: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if len(ledgers) == 0 {
		c.JSON(http.StatusOK, gin.H{"rows": []stockLedgerRowDTO{}, "document_no": sess.DocumentNo})
		return
	}
	ids := make([]interface{}, 0, len(ledgers))
	for _, L := range ledgers {
		ids = append(ids, L.ItemID)
	}
	var items []models.Item
	if err := h.DB.Where("id IN ?", ids).Find(&items).Error; err != nil {
		log.Printf("stock ledger items: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	byID := make(map[string]models.Item, len(items))
	for _, it := range items {
		byID[it.ID.String()] = it
	}
	adjNoByID := adjustmentDocNosByLedger(h.DB, ledgers)
	out := make([]stockLedgerRowDTO, 0, len(ledgers))
	for _, L := range ledgers {
		it := byID[L.ItemID.String()]
		adjNo := ""
		if L.AdjustmentDocumentID != nil {
			adjNo = adjNoByID[L.AdjustmentDocumentID.String()]
		}
		out = append(out, stockLedgerRowDTO{
			InventoryStockLedger: L,
			MovementLabel:        stockMovementLabelRu(L.Movement),
			AdjustmentDocumentNo: adjNo,
			ItemSKU:              it.SKU,
			ItemName:             it.Name,
		})
	}
	c.JSON(http.StatusOK, gin.H{"rows": out, "document_no": sess.DocumentNo})
}

type globalStockLedgerRowDTO struct {
	ID                   uuid.UUID  `json:"id"`
	SessionID            uuid.UUID  `json:"session_id"`
	DocumentNo           string     `json:"document_no"`
	AdjustmentDocumentID *uuid.UUID `json:"adjustment_document_id,omitempty"`
	AdjustmentDocumentNo string     `json:"adjustment_document_no,omitempty"`
	ItemID               uuid.UUID  `json:"item_id"`
	ItemSKU              string     `json:"item_sku"`
	ItemName             string     `json:"item_name"`
	Movement             string     `json:"movement"`
	MovementLabel        string     `json:"movement_label"`
	AccountingQty        int        `json:"accounting_qty"`
	ActualQty            int        `json:"actual_qty"`
	BalanceBefore        int        `json:"balance_before"`
	BalanceAfter         int        `json:"balance_after"`
	Delta                int        `json:"delta"`
	CreatedAt            time.Time  `json:"created_at"`
	ActorID              *uuid.UUID `json:"actor_id,omitempty"`
}

type globalLedgerJoinScan struct {
	ID                   uuid.UUID  `gorm:"column:id"`
	SessionID            uuid.UUID  `gorm:"column:session_id"`
	DocumentNo           string     `gorm:"column:document_no"`
	AdjustmentDocumentID *uuid.UUID `gorm:"column:adjustment_document_id"`
	AdjustmentDocumentNo string     `gorm:"column:adjustment_document_no"`
	ItemID               uuid.UUID  `gorm:"column:item_id"`
	ItemSKU              string     `gorm:"column:item_sku"`
	ItemName             string     `gorm:"column:item_name"`
	Movement             string     `gorm:"column:movement"`
	AccountingQty        int        `gorm:"column:accounting_qty"`
	ActualQty            int        `gorm:"column:actual_qty"`
	BalanceBefore        int        `gorm:"column:balance_before"`
	BalanceAfter         int        `gorm:"column:balance_after"`
	Delta                int        `gorm:"column:delta"`
	CreatedAt            time.Time  `gorm:"column:created_at"`
	ActorID              *uuid.UUID `gorm:"column:actor_id"`
}

type paginatedGlobalStockLedgerResponse struct {
	Rows     []globalStockLedgerRowDTO `json:"rows"`
	Page     int                       `json:"page"`
	PageSize int                       `json:"page_size"`
	Total    int64                     `json:"total"`
}

func (h *InventoryHandler) ListGlobalStockLedger(c *gin.Context) {
	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	role, _ := middleware.GetRole(c)

	page := 1
	pageSize := 30
	if raw := strings.TrimSpace(c.Query("page")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			page = n
		}
	}
	if raw := strings.TrimSpace(c.Query("page_size")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			pageSize = n
		}
	}
	if pageSize > 100 {
		pageSize = 100
	}

	joinQ := func() *gorm.DB {
		q := h.DB.Table("inventory_stock_ledgers AS l").
			Joins("INNER JOIN inventory_sessions AS s ON s.id = l.session_id").
			Joins("INNER JOIN items AS i ON i.id = l.item_id AND i.deleted_at IS NULL").
			Where("s.status = ?", models.SessionStatusCompleted)
		if role != "admin" {
			q = q.Where("s.created_by = ?", uid)
		}
		return q
	}

	var total int64
	if err := joinQ().Count(&total).Error; err != nil {
		log.Printf("global stock ledger count: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var scans []globalLedgerJoinScan
	if err := joinQ().
		Select(`l.id, l.session_id, COALESCE(NULLIF(TRIM(s.document_no), ''), s.id::text) AS document_no,
			l.adjustment_document_id,
			COALESCE(NULLIF(TRIM(adj.document_no), ''), '') AS adjustment_document_no,
			l.item_id, i.sku AS item_sku, i.name AS item_name, l.movement,
			l.accounting_qty, l.actual_qty, l.balance_before, l.balance_after, l.delta, l.created_at, l.actor_id`).
		Joins("LEFT JOIN stock_adjustment_documents AS adj ON adj.id = l.adjustment_document_id").
		Order("l.created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&scans).Error; err != nil {
		log.Printf("global stock ledger list: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	out := make([]globalStockLedgerRowDTO, 0, len(scans))
	for _, r := range scans {
		out = append(out, globalStockLedgerRowDTO{
			ID:                   r.ID,
			SessionID:            r.SessionID,
			DocumentNo:           r.DocumentNo,
			AdjustmentDocumentID: r.AdjustmentDocumentID,
			AdjustmentDocumentNo: r.AdjustmentDocumentNo,
			ItemID:               r.ItemID,
			ItemSKU:              r.ItemSKU,
			ItemName:             r.ItemName,
			Movement:             r.Movement,
			MovementLabel:        stockMovementLabelRu(r.Movement),
			AccountingQty:        r.AccountingQty,
			ActualQty:            r.ActualQty,
			BalanceBefore:        r.BalanceBefore,
			BalanceAfter:         r.BalanceAfter,
			Delta:                r.Delta,
			CreatedAt:            r.CreatedAt,
			ActorID:              r.ActorID,
		})
	}

	c.JSON(http.StatusOK, paginatedGlobalStockLedgerResponse{
		Rows:     out,
		Page:     page,
		PageSize: pageSize,
		Total:    total,
	})
}

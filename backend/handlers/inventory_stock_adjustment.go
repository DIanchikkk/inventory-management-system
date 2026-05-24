package handlers

import (
	"errors"
	"inventory-system/backend/middleware"
	"inventory-system/backend/models"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type stockAdjustmentSummaryDTO struct {
	ID                    uuid.UUID `json:"id"`
	DocumentNo            string    `json:"document_no"`
	Movement              string    `json:"movement"`
	MovementLabel         string    `json:"movement_label"`
	SessionID             uuid.UUID `json:"session_id"`
	RegistratorDocumentNo string    `json:"registrator_document_no"`
	LineCount             int       `json:"line_count"`
	CreatedAt             string    `json:"created_at"`
}

type stockAdjustmentLineDTO struct {
	models.InventoryStockLedger
	MovementLabel string `json:"movement_label"`
	ItemSKU       string `json:"item_sku"`
	ItemName      string `json:"item_name"`
}

type stockAdjustmentDetailDTO struct {
	Document              stockAdjustmentSummaryDTO `json:"document"`
	Lines                 []stockAdjustmentLineDTO  `json:"lines"`
	RegistratorDocumentNo string                    `json:"registrator_document_no"`
}

func (h *InventoryHandler) ListSessionStockAdjustments(c *gin.Context) {
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
		log.Printf("session stock adjustments: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if sess.CreatedBy != uid && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	docs, err := h.listAdjustmentSummariesForSession(sid, sess.DocumentNo)
	if err != nil {
		log.Printf("list session adjustments: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"documents": docs})
}

func (h *InventoryHandler) listAdjustmentSummariesForSession(sessionID uuid.UUID, registratorNo string) ([]stockAdjustmentSummaryDTO, error) {
	regNo := strings.TrimSpace(registratorNo)
	if regNo == "" {
		regNo = sessionID.String()
	}
	var docs []models.StockAdjustmentDocument
	if err := h.DB.Where("session_id = ?", sessionID).Order("created_at ASC").Find(&docs).Error; err != nil {
		return nil, err
	}
	out := make([]stockAdjustmentSummaryDTO, 0, len(docs))
	for _, d := range docs {
		var cnt int64
		if err := h.DB.Model(&models.InventoryStockLedger{}).
			Where("adjustment_document_id = ?", d.ID).Count(&cnt).Error; err != nil {
			return nil, err
		}
		out = append(out, stockAdjustmentSummaryDTO{
			ID:                    d.ID,
			DocumentNo:            d.DocumentNo,
			Movement:              d.Movement,
			MovementLabel:         stockMovementLabelRu(d.Movement),
			SessionID:             d.SessionID,
			RegistratorDocumentNo: regNo,
			LineCount:             int(cnt),
			CreatedAt:             d.CreatedAt.Format(timeRFC3339Local),
		})
	}
	return out, nil
}

const timeRFC3339Local = "2006-01-02T15:04:05Z07:00"

func (h *InventoryHandler) GetStockAdjustment(c *gin.Context) {
	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	role, _ := middleware.GetRole(c)
	aid, ok := ParseUUIDParam(c, "id")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var doc models.StockAdjustmentDocument
	if err := h.DB.First(&doc, "id = ?", aid).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
			return
		}
		log.Printf("get stock adjustment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	var sess models.InventorySession
	if err := h.DB.First(&sess, "id = ?", doc.SessionID).Error; err != nil {
		log.Printf("adjustment session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if sess.CreatedBy != uid && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	regNo := strings.TrimSpace(sess.DocumentNo)
	if regNo == "" {
		regNo = sess.ID.String()
	}
	var ledgers []models.InventoryStockLedger
	if err := h.DB.Where("adjustment_document_id = ?", aid).Order("created_at ASC").Find(&ledgers).Error; err != nil {
		log.Printf("adjustment lines: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	lines, err := enrichLedgerRows(h.DB, ledgers)
	if err != nil {
		log.Printf("adjustment enrich: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	var cnt int64
	_ = h.DB.Model(&models.InventoryStockLedger{}).Where("adjustment_document_id = ?", aid).Count(&cnt)
	c.JSON(http.StatusOK, stockAdjustmentDetailDTO{
		Document: stockAdjustmentSummaryDTO{
			ID:                    doc.ID,
			DocumentNo:            doc.DocumentNo,
			Movement:              doc.Movement,
			MovementLabel:         stockMovementLabelRu(doc.Movement),
			SessionID:             doc.SessionID,
			RegistratorDocumentNo: regNo,
			LineCount:             int(cnt),
			CreatedAt:             doc.CreatedAt.Format(timeRFC3339Local),
		},
		Lines:                 lines,
		RegistratorDocumentNo: regNo,
	})
}

func enrichLedgerRows(db *gorm.DB, ledgers []models.InventoryStockLedger) ([]stockAdjustmentLineDTO, error) {
	if len(ledgers) == 0 {
		return []stockAdjustmentLineDTO{}, nil
	}
	ids := make([]interface{}, 0, len(ledgers))
	for _, L := range ledgers {
		ids = append(ids, L.ItemID)
	}
	var items []models.Item
	if err := db.Where("id IN ?", ids).Find(&items).Error; err != nil {
		return nil, err
	}
	byID := make(map[string]models.Item, len(items))
	for _, it := range items {
		byID[it.ID.String()] = it
	}
	out := make([]stockAdjustmentLineDTO, 0, len(ledgers))
	for _, L := range ledgers {
		it := byID[L.ItemID.String()]
		out = append(out, stockAdjustmentLineDTO{
			InventoryStockLedger: L,
			MovementLabel:        stockMovementLabelRu(L.Movement),
			ItemSKU:              it.SKU,
			ItemName:             it.Name,
		})
	}
	return out, nil
}

type paginatedAdjustmentListResponse struct {
	Documents []stockAdjustmentSummaryDTO `json:"documents"`
	Page      int                         `json:"page"`
	PageSize  int                         `json:"page_size"`
	Total     int64                       `json:"total"`
}

func (h *InventoryHandler) ListGlobalStockAdjustments(c *gin.Context) {
	uid, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	role, _ := middleware.GetRole(c)
	page, pageSize := paginationFromQuery(c, 30, 100)

	q := h.DB.Table("stock_adjustment_documents AS d").
		Joins("INNER JOIN inventory_sessions AS s ON s.id = d.session_id").
		Where("s.status IN ?", []string{models.SessionStatusCompleted, models.SessionStatusArchived})
	if role != "admin" {
		q = q.Where("s.created_by = ?", uid)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		log.Printf("global adjustments count: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	type rowScan struct {
		ID         uuid.UUID `gorm:"column:id"`
		DocumentNo string    `gorm:"column:document_no"`
		Movement   string    `gorm:"column:movement"`
		SessionID  uuid.UUID `gorm:"column:session_id"`
		InvDocNo   string    `gorm:"column:inv_doc_no"`
		CreatedAt  string    `gorm:"column:created_at"`
		LineCount  int       `gorm:"column:line_count"`
	}
	var scans []rowScan
	if err := q.Select(`d.id, d.document_no, d.movement, d.session_id,
		COALESCE(NULLIF(TRIM(s.document_no), ''), s.id::text) AS inv_doc_no,
		d.created_at::text AS created_at,
		(SELECT COUNT(*)::int FROM inventory_stock_ledgers l WHERE l.adjustment_document_id = d.id) AS line_count`).
		Order("d.created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&scans).Error; err != nil {
		log.Printf("global adjustments list: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	out := make([]stockAdjustmentSummaryDTO, 0, len(scans))
	for _, r := range scans {
		out = append(out, stockAdjustmentSummaryDTO{
			ID:                    r.ID,
			DocumentNo:            r.DocumentNo,
			Movement:              r.Movement,
			MovementLabel:         stockMovementLabelRu(r.Movement),
			SessionID:             r.SessionID,
			RegistratorDocumentNo: r.InvDocNo,
			LineCount:             r.LineCount,
			CreatedAt:             r.CreatedAt,
		})
	}
	c.JSON(http.StatusOK, paginatedAdjustmentListResponse{
		Documents: out,
		Page:      page,
		PageSize:  pageSize,
		Total:     total,
	})
}

func paginationFromQuery(c *gin.Context, defaultSize, maxSize int) (page, pageSize int) {
	page = 1
	pageSize = defaultSize
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
	if pageSize > maxSize {
		pageSize = maxSize
	}
	return page, pageSize
}

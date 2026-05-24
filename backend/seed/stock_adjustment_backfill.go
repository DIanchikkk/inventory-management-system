package seed

import (
	"inventory-system/backend/docno"
	"inventory-system/backend/models"
	"log"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func BackfillStockAdjustmentDocuments(db *gorm.DB) error {
	var ledgers []models.InventoryStockLedger
	if err := db.Where("adjustment_document_id IS NULL").Order("session_id, movement, created_at").Find(&ledgers).Error; err != nil {
		return err
	}
	if len(ledgers) == 0 {
		return nil
	}
	type groupKey struct {
		sessionID uuid.UUID
		movement  string
	}
	groups := make(map[groupKey][]models.InventoryStockLedger)
	for _, L := range ledgers {
		k := groupKey{sessionID: L.SessionID, movement: L.Movement}
		groups[k] = append(groups[k], L)
	}
	for k, lines := range groups {
		var sess models.InventorySession
		if err := db.First(&sess, "id = ?", k.sessionID).Error; err != nil {
			log.Printf("backfill adjustment: session %s: %v", k.sessionID, err)
			continue
		}
		actor := sess.CreatedBy
		if lines[0].ActorID != nil {
			actor = *lines[0].ActorID
		}
		err := db.Transaction(func(tx *gorm.DB) error {
			docNo, err := docno.NextStockAdjustmentNo(tx, k.movement)
			if err != nil {
				return err
			}
			doc := models.StockAdjustmentDocument{
				DocumentNo: docNo,
				Movement:   k.movement,
				SessionID:  k.sessionID,
				CreatedBy:  actor,
			}
			if err := tx.Create(&doc).Error; err != nil {
				return err
			}
			docID := doc.ID
			for _, L := range lines {
				if err := tx.Model(&models.InventoryStockLedger{}).
					Where("id = ?", L.ID).
					Update("adjustment_document_id", docID).Error; err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			log.Printf("backfill adjustment doc %s %s: %v", k.sessionID, k.movement, err)
		}
	}
	return nil
}

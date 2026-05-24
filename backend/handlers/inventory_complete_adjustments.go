package handlers

import (
	"inventory-system/backend/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ledgerDraft struct {
	itemID          uuid.UUID
	expected        int
	actual          int
	before          int
	after           int
	movement        string
}

func (h *InventoryHandler) postStockAdjustments(
	tx *gorm.DB,
	sessionID, actorID uuid.UUID,
	registratorNo string,
	drafts []ledgerDraft,
) error {
	if len(drafts) == 0 {
		return nil
	}
	byMovement := map[string][]ledgerDraft{}
	for _, d := range drafts {
		byMovement[d.movement] = append(byMovement[d.movement], d)
	}
	for movement, lines := range byMovement {
		if len(lines) == 0 {
			continue
		}
		docNo, err := nextStockAdjustmentNo(tx, movement)
		if err != nil {
			return err
		}
		doc := models.StockAdjustmentDocument{
			DocumentNo: docNo,
			Movement:   movement,
			SessionID:  sessionID,
			CreatedBy:  actorID,
		}
		if err := tx.Create(&doc).Error; err != nil {
			return err
		}
		docID := doc.ID
		for _, ln := range lines {
			led := models.InventoryStockLedger{
				SessionID:            sessionID,
				AdjustmentDocumentID: &docID,
				ItemID:               ln.itemID,
				Movement:             ln.movement,
				AccountingQty:        ln.expected,
				ActualQty:            ln.actual,
				BalanceBefore:        ln.before,
				BalanceAfter:         ln.after,
				Delta:                ln.after - ln.before,
				ActorID:              &actorID,
			}
			if err := tx.Create(&led).Error; err != nil {
				return err
			}
			kindRu := "оприходование"
			if ln.movement == models.StockMovementWriteOff {
				kindRu = "списание"
			}
			saveItemHistory(tx, ln.itemID, &actorID, formatAdjustmentHistory(
				kindRu, docNo, registratorNo, ln.before, ln.after, ln.expected, ln.actual,
			))
		}
	}
	return nil
}

func formatAdjustmentHistory(kindRu, adjNo, invNo string, before, after, expected, actual int) string {
	return "Документ " + kindRu + " " + adjNo + " (основание: инвентаризация " + invNo + "); остаток " +
		itoa(before) + "→" + itoa(after) + " (учётное " + itoa(expected) + ", факт " + itoa(actual) + ")"
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [16]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

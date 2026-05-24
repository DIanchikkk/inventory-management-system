import type { InventoryResult, Item } from "@/shared/types";
import {
  effectiveActualQuantity,
  quantityDelta,
  sessionRowStatus,
  sessionRowTone,
  type SessionRowTone,
} from "@/shared/utils/inventoryDisplay";
import styles from "./SessionDetailLines.module.css";

export type LineRowModel = {
  kind: ReturnType<typeof sessionRowStatus>;
  tone: SessionRowTone;
  actual: number | null;
  delta: number | null;
  commentMissing: boolean;
  rowClass: string;
  deltaClass: string;
  cardTone: string;
};

export function buildLineRowModel(
  it: Item,
  draft: string,
  comment: string,
  res: InventoryResult | undefined,
  locked: boolean,
): LineRowModel {
  const kind = sessionRowStatus(it, draft, res?.status);
  const tone = sessionRowTone(kind);
  const actual = effectiveActualQuantity(draft, res?.actual_quantity, res?.status);
  const delta = quantityDelta(it, actual);
  const commentText = comment.trim();
  const commentMissing = !locked && (kind === "mismatch" || kind === "missing") && commentText === "";
  return {
    kind,
    tone,
    actual,
    delta,
    commentMissing,
    rowClass:
      tone === "success"
        ? styles.rowSuccess
        : tone === "error"
          ? styles.rowError
          : tone === "warning"
            ? styles.rowWarning
            : styles.rowNeutral,
    deltaClass:
      tone === "success"
        ? styles.deltaOk
        : tone === "error"
          ? styles.deltaBad
          : tone === "warning"
            ? styles.deltaWarn
            : styles.deltaMuted,
    cardTone:
      tone === "success"
        ? styles.cardToneSuccess
        : tone === "error"
          ? styles.cardToneError
          : tone === "warning"
            ? styles.cardToneWarning
            : styles.cardToneNeutral,
  };
}

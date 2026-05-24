import type { InventorySessionEvent } from "@/shared/types";

/** Логин автора документа (без UUID в интерфейсе). */
export function sessionCreatorLabel(session: { created_by_username?: string }): string {
  const name = session.created_by_username?.trim();
  return name || "—";
}

/** Логин того, кто ввёл фактическое количество в опись. */
export function resultCounterLabel(result: {
  counted_by_username?: string;
  counted_by?: string;
} | null | undefined): string {
  const name = result?.counted_by_username?.trim();
  if (name) return name;
  return "—";
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  session_created: "Документ создан",
  session_review: "Передан на проверку",
  session_completed: "Документ проведён",
  session_archived: "Документ в архиве",
  session_unarchived: "Возврат из архива",
  batch_saved: "Сохранены строки опись",
  result_saved: "Сохранена строка",
  discrepancy_confirmed: "Подтверждено расхождение",
};

/** Старые записи в БД с английским текстом в details. */
const LEGACY_AUDIT_DETAILS_RU: Record<string, string> = {
  "Session archived": "Документ перенесён в архив",
  "Session moved to review": "Документ передан на проверку",
  "Batch results saved": "Сохранены результаты пересчёта",
  "Single result saved for item": "Сохранена строка опись",
};

/** Подпись действия в журнале аудита (без технического кода). */
export function auditActionLabel(action: string): string {
  const key = action.trim();
  return AUDIT_ACTION_LABELS[key] ?? (key || "—");
}

function normalizeAuditDetails(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (LEGACY_AUDIT_DETAILS_RU[t]) return LEGACY_AUDIT_DETAILS_RU[t];
  if (t.startsWith("Single result saved for item ")) {
    return "Сохранена строка опись";
  }
  if (t.startsWith("Confirmed discrepancy for item ")) {
    return "Подтверждено расхождение";
  }
  if (t.startsWith("Подтверждено расхождение по объекту ")) {
    return "Подтверждено расхождение";
  }
  return t;
}

/** Текст события: только если отличается от заголовка действия. */
export function auditDetailsLabel(ev: Pick<InventorySessionEvent, "action" | "details">): string | null {
  const details = normalizeAuditDetails(ev.details ?? "");
  if (!details) return null;
  const action = auditActionLabel(ev.action);
  if (details === action) return null;
  if (details.startsWith(action + ":") || details.startsWith(action + " ")) return null;
  return details;
}

/** Логин исполнителя в журнале аудита. */
export function auditActorLabel(
  ev: { actor_username?: string; actor_id?: string },
  session?: { created_by?: string; created_by_username?: string },
): string {
  const name = ev.actor_username?.trim();
  if (name) return name;
  if (
    ev.actor_id?.trim() &&
    session?.created_by?.trim() &&
    ev.actor_id === session.created_by
  ) {
    const author = sessionCreatorLabel(session);
    if (author !== "—") return author;
  }
  if (ev.actor_id?.trim()) return "—";
  return "система";
}

import { Button } from "@/shared/components/ui/Button";
import { auditActionLabel, auditActorLabel, auditDetailsLabel } from "@/shared/utils/sessionDisplay";
import type { SessionDetailPageModel } from "./types";
import styles from "./SessionDetailExtras.module.css";

type Props = { m: SessionDetailPageModel };

export function SessionDetailExtras({ m }: Props) {
  const { discrepancies, auditEvents, isAdmin, detail } = m;

  return (
    <>
      {discrepancies.length > 0 && (
        <section className={styles.discrepancies}>
          <h2 className={styles.discrepanciesTitle}>Расхождения ({discrepancies.length})</h2>
          <div className={styles.discrepancyList}>
            {discrepancies.map((d) => (
              <article
                key={d.result.item_id}
                className={[styles.discrepancyCard, !d.result.comment?.trim() ? styles.discrepancyCommentWarn : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                <p className={styles.discrepancyName}>
                  {d.item.sku} · {d.item.name}
                </p>
                <p className={styles.discrepancyMeta}>
                  Учётное: {d.result.expected_quantity}, фактическое: {d.result.actual_quantity}, статус: {d.result.status}
                </p>
                <p className={styles.discrepancyMeta}>Комментарий: {d.result.comment || "—"}</p>
                <p className={styles.discrepancyMeta}>
                  Подтверждено: {d.result.discrepancy_confirmed ? "да" : "нет"}
                  {d.result.confirmed_at ? ` (${new Date(d.result.confirmed_at).toLocaleString("ru-RU")})` : ""}
                </p>
                {isAdmin && !d.result.discrepancy_confirmed && (
                  <Button
                    type="button"
                    variant="outline"
                    responsiveFull
                    onClick={() => void m.onConfirmDiscrepancy(d.result.item_id)}
                  >
                    Подтвердить расхождение
                  </Button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {auditEvents.length > 0 && (
        <section className={styles.discrepancies}>
          <h2 className={styles.discrepanciesTitle}>Аудит действий ({auditEvents.length})</h2>
          <div className={styles.discrepancyList}>
            {auditEvents.map((ev) => {
              const details = auditDetailsLabel(ev);
              return (
                <article key={ev.id} className={styles.discrepancyCard}>
                  <p className={styles.discrepancyName}>{auditActionLabel(ev.action)}</p>
                  {details ? <p className={styles.discrepancyMeta}>{details}</p> : null}
                  <p className={styles.discrepancyMeta}>
                    Кто: {auditActorLabel(ev, detail?.session)} · Когда:{" "}
                    {new Date(ev.created_at).toLocaleString("ru-RU")}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

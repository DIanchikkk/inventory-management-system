import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchSessionDetail, fetchSessionRegistryRows } from "@/shared/api/inventory.api";
import type { InventorySessionDetail } from "@/shared/types";
import { Alert } from "@/shared/components/ui/Alert";
import { Button } from "@/shared/components/ui/Button";
import { Spinner } from "@/shared/components/ui/Spinner";
import { getErrorMessage } from "@/shared/utils/errors";
import {
  effectiveActualQuantity,
  formatDelta,
  quantityDelta,
  sessionRowStatus,
  sessionStatusLabel,
} from "@/shared/utils/inventoryDisplay";
import { sessionCreatorLabel } from "@/shared/utils/sessionDisplay";
import styles from "./SessionPrintSheetPage.module.css";

export function SessionPrintSheetPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [detail, setDetail] = useState<InventorySessionDetail | null>(null);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchSessionRegistryRows>>["rows"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setError("Сессия не указана");
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [d, registry] = await Promise.all([fetchSessionDetail(sessionId), fetchSessionRegistryRows(sessionId)]);
        if (!cancelled) {
          setDetail(d);
          setRows(registry.rows);
        }
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const pendingCount = useMemo(
    () =>
      rows.filter(({ item, result }) => sessionRowStatus(item, undefined, result?.status) === "pending").length,
    [rows],
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.screenBar}>
        <Link className={styles.backLink} to={sessionId ? `/inventory/sessions/${sessionId}` : "/inventory/sessions"}>
          ← К документу
        </Link>
        <Button type="button" variant="outline" onClick={() => window.print()} disabled={loading || !!error}>
          Печать
        </Button>
      </div>

      {loading && <Spinner />}
      {error && !loading && <Alert>{error}</Alert>}

      {!loading && detail && (
        <article className={styles.sheet}>
          <p className={styles.disclaimer}>
            Упрощённая внутренняя форма для сверки остатков. Не является регламентированным документом (ИНВ-3, ИНВ-19 и т.п.).
          </p>

          <h1 className={styles.docTitle}>Инвентаризационная опись</h1>

          <div className={styles.metaGrid}>
            <div>
              <span className={styles.metaLabel}>Номер документа</span>
              <span className={styles.metaValue}>{detail.session.document_no?.trim() || "—"}</span>
            </div>
            <div>
              <span className={styles.metaLabel}>Дата создания документа</span>
              <span className={styles.metaValue}>{new Date(detail.session.created_at).toLocaleString("ru-RU")}</span>
            </div>
            <div>
              <span className={styles.metaLabel}>Статус</span>
              <span className={styles.metaValue}>{sessionStatusLabel(detail.session.status)}</span>
            </div>
            <div>
              <span className={styles.metaLabel}>Автор</span>
              <span className={styles.metaValue}>{sessionCreatorLabel(detail.session)}</span>
            </div>
            <div>
              <span className={styles.metaLabel}>Внутренний UUID</span>
              <span className={styles.metaValueMono}>{detail.session.id}</span>
            </div>
          </div>

          <div className={styles.blankRow}>
            <span className={styles.blankLabel}>Организация / подразделение</span>
            <span className={styles.blankLine} />
          </div>
          <div className={styles.blankRow}>
            <span className={styles.blankLabel}>Место хранения / объект</span>
            <span className={styles.blankLine} />
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colNum}>№ п/п</th>
                <th>Наименование</th>
                <th className={styles.colSku}>Код (SKU)</th>
                <th className={styles.colUnit}>Ед.</th>
                <th className={styles.colQty}>По учёту</th>
                <th className={styles.colQty}>Фактически</th>
                <th className={styles.colDelta}>Отклонение</th>
                <th className={styles.colNote}>Примечание</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, result }, idx) => {
                const actual = effectiveActualQuantity(undefined, result?.actual_quantity, result?.status);
                const delta = quantityDelta(item, actual);
                const status = sessionRowStatus(item, undefined, result?.status);
                const actualLabel = actual === null ? "—" : String(actual);
                const pendingMark = status === "pending" ? "не сохранено" : "";
                const comment = [result?.comment?.trim(), pendingMark].filter(Boolean).join(" · ") || "—";
                return (
                  <tr key={item.id}>
                    <td className={styles.colNum}>{idx + 1}</td>
                    <td>{item.name}</td>
                    <td className={styles.colSku}>{item.sku}</td>
                    <td className={styles.colUnit}>{item.unit || "—"}</td>
                    <td className={styles.colQty}>{item.quantity}</td>
                    <td className={styles.colQty}>{actualLabel}</td>
                    <td className={styles.colDelta}>{formatDelta(delta)}</td>
                    <td className={styles.colNote}>{comment}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className={styles.footerNote}>
            Всего позиций в описи: {rows.length}.
            {pendingCount > 0 ? ` Строк без сохранённого факта: ${pendingCount}.` : ""}
          </p>

          <section className={styles.signatures} aria-label="Подписи">
            <p className={styles.signTitle}>Подписи ответственных лиц</p>
            <div className={styles.signGrid}>
              <div className={styles.signCell}>
                <span>Председатель комиссии</span>
                <span className={styles.signLine} />
              </div>
              <div className={styles.signCell}>
                <span>Члены комиссии</span>
                <span className={styles.signLine} />
              </div>
              <div className={styles.signCell}>
                <span>Материально ответственное лицо</span>
                <span className={styles.signLine} />
              </div>
            </div>
          </section>
        </article>
      )}
    </div>
  );
}

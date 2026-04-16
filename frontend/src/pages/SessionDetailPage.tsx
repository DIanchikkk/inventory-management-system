import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  completeSession,
  fetchSessionDetail,
  postSessionResultsBatch,
} from "../api/inventory.api";
import type { InventorySessionDetail } from "../types";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Spinner } from "../components/ui/Spinner";
import { getErrorMessage } from "../utils/errors";
import {
  formatDelta,
  effectiveActualQuantity,
  quantityDelta,
  sessionRowStatus,
  sessionRowTone,
  sessionStatusLabel,
} from "../utils/inventoryDisplay";
import styles from "./SessionDetailPage.module.css";

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const focusItemId = (location.state as { focusItemId?: string } | null)?.focusItemId;

  const [detail, setDetail] = useState<InventorySessionDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchSessionDetail(id);
      setDetail(d);
      const next: Record<string, string> = {};
      for (const r of d.results) {
        next[r.item_id] = String(r.actual_quantity);
      }
      setDrafts(next);
    } catch (e) {
      setError(getErrorMessage(e));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setError("Сессия не указана");
      return;
    }
    void loadDetail(sessionId);
  }, [sessionId, loadDetail]);

  useEffect(() => {
    if (!detail?.items?.length || !focusItemId) return;
    requestAnimationFrame(() => {
      document.getElementById(`inv-${focusItemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [detail, focusItemId]);

  const completed = detail?.session.status === "completed";

  async function saveBatch() {
    if (!detail || !sessionId || completed) return;
    const rows: { item_id: string; actual_quantity: number }[] = [];
    for (const it of detail.items) {
      const raw = drafts[it.id];
      if (raw === undefined || raw === "") continue;
      const n = Number.parseInt(raw, 10);
      if (Number.isNaN(n) || n < 0) continue;
      rows.push({ item_id: it.id, actual_quantity: n });
    }
    if (rows.length === 0) {
      setError("Укажите фактическое количество хотя бы по одной позиции.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await postSessionResultsBatch(sessionId, rows);
      await loadDetail(sessionId);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    if (!sessionId || !detail || completed) return;
    if (!confirm("Завершить инвентаризацию? После этого правки будут недоступны.")) return;
    setSaving(true);
    setError(null);
    try {
      await completeSession(sessionId);
      await loadDetail(sessionId);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function setDraft(id: string, v: string) {
    setDrafts((prev) => ({ ...prev, [id]: v }));
  }

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link className={styles.backLink} to="/inventory/sessions">
          ← К списку сессий
        </Link>
      </p>

      {loading && <Spinner />}
      {error && !loading && <Alert>{error}</Alert>}

      {!loading && detail && (
        <>
          <header className={styles.top}>
            <div>
              <h1 className={styles.title}>Сессия от {new Date(detail.session.created_at).toLocaleString("ru-RU")}</h1>
              <p className={styles.subtitle}>
                {sessionStatusLabel(detail.session.status)}
                {detail.session.created_by ? ` · ${detail.session.created_by}` : ""}
              </p>
            </div>
            <div className={styles.topActions}>
              {!completed && (
                <>
                  <Button type="button" variant="outline" onClick={() => void saveBatch()} disabled={saving}>
                    {saving ? "Сохранение…" : "Сохранить"}
                  </Button>
                  <Button type="button" variant="primary" onClick={() => void finish()} disabled={saving}>
                    Завершить
                  </Button>
                </>
              )}
            </div>
          </header>

          {completed && (
            <p className={styles.banner}>Сессия завершена. Данные только для просмотра.</p>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Объект</th>
                  <th>По учёту</th>
                  <th>Факт</th>
                  <th>Отклонение</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it) => {
                  const res = detail.results.find((r) => r.item_id === it.id);
                  const draft = drafts[it.id] ?? "";
                  const kind = sessionRowStatus(it, draft, res?.status);
                  const tone = sessionRowTone(kind);
                  const actual = effectiveActualQuantity(draft, res?.actual_quantity);
                  const delta = quantityDelta(it, actual);
                  const rowClass =
                    tone === "success"
                      ? styles.rowSuccess
                      : tone === "error"
                        ? styles.rowError
                        : tone === "warning"
                          ? styles.rowWarning
                          : styles.rowNeutral;
                  const deltaClass =
                    tone === "success"
                      ? styles.deltaOk
                      : tone === "error"
                        ? styles.deltaBad
                        : tone === "warning"
                          ? styles.deltaWarn
                          : styles.deltaMuted;
                  return (
                    <tr key={it.id} id={`inv-${it.id}`} className={rowClass}>
                      <td className={styles.nameCell}>{it.name}</td>
                      <td>{it.quantity}</td>
                      <td>
                        <input
                          className={styles.qtyInput}
                          type="number"
                          min={0}
                          disabled={completed}
                          value={draft}
                          onChange={(e) => setDraft(it.id, e.target.value)}
                          aria-label={`Факт для ${it.name}`}
                        />
                      </td>
                      <td className={`${styles.deltaCell} ${deltaClass}`}>{formatDelta(delta)}</td>
                      <td>
                        <StatusBadge kind={kind} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.cardList}>
            {detail.items.map((it) => {
              const res = detail.results.find((r) => r.item_id === it.id);
              const draft = drafts[it.id] ?? "";
              const kind = sessionRowStatus(it, draft, res?.status);
              const tone = sessionRowTone(kind);
              const actual = effectiveActualQuantity(draft, res?.actual_quantity);
              const delta = quantityDelta(it, actual);
              const cardTone =
                tone === "success"
                  ? styles.cardToneSuccess
                  : tone === "error"
                    ? styles.cardToneError
                    : tone === "warning"
                      ? styles.cardToneWarning
                      : styles.cardToneNeutral;
              const deltaClass =
                tone === "success"
                  ? styles.deltaOk
                  : tone === "error"
                    ? styles.deltaBad
                    : tone === "warning"
                      ? styles.deltaWarn
                      : styles.deltaMuted;
              return (
                <article key={it.id} className={`${styles.card} ${cardTone}`} id={`inv-m-${it.id}`}>
                  <div className={styles.cardTitle}>{it.name}</div>
                  <div className={styles.cardRow}>
                    <span>По учёту: {it.quantity}</span>
                    <StatusBadge kind={kind} />
                  </div>
                  <p className={`${styles.cardDelta} ${deltaClass}`}>
                    Отклонение: <strong>{formatDelta(delta)}</strong>
                  </p>
                  <label className={styles.cardLabel}>
                    Фактическое количество
                    <input
                      className={styles.qtyInput}
                      type="number"
                      min={0}
                      disabled={completed}
                      value={draft}
                      onChange={(e) => setDraft(it.id, e.target.value)}
                    />
                  </label>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

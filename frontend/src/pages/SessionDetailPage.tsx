import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  archiveSession,
  completeSession,
  confirmDiscrepancy,
  exportSessionCsv,
  exportDiscrepanciesCsv,
  exportSessionAuditCsv,
  fetchSessionAudit,
  fetchSessionLines,
  fetchDiscrepancies,
  fetchSessionDetail,
  fetchSessionStockLedger,
  postSessionResultsBatch,
  sendSessionToReview,
} from "../api/inventory.api";
import type {
  DiscrepancyItem,
  InventorySessionDetail,
  InventorySessionEvent,
  InventoryResult,
  Item,
  StockLedgerRow,
} from "../types";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Spinner } from "../components/ui/Spinner";
import { useAuth } from "../context/useAuth";
import { ApiError, getErrorMessage } from "../utils/errors";
import {
  formatDelta,
  effectiveActualQuantity,
  quantityDelta,
  sessionRowStatus,
  sessionRowTone,
  sessionStatusLabel,
} from "../utils/inventoryDisplay";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { extractUuidFromScan } from "../utils/scanExtract";
import styles from "./SessionDetailPage.module.css";

type RowFilter = "all" | "pending" | "mismatch" | "missing" | "match";
type GroupBy = "none" | "location" | "category";
const PAGE_SIZE = 20;

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const focusItemId = (location.state as { focusItemId?: string } | null)?.focusItemId;

  const [detail, setDetail] = useState<InventorySessionDetail | null>(null);
  const [lineItems, setLineItems] = useState<Item[]>([]);
  const [lineResults, setLineResults] = useState<InventoryResult[]>([]);
  const [linesTotal, setLinesTotal] = useState(0);
  const [linesPage, setLinesPage] = useState(1);
  const [lineQuery, setLineQuery] = useState<string | undefined>(undefined);
  const [locationFilterRaw, setLocationFilterRaw] = useState("");
  const debouncedLocation = useDebouncedValue(locationFilterRaw, 350);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [linesLoading, setLinesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowFilter, setRowFilter] = useState<RowFilter>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [scanQuery, setScanQuery] = useState("");
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  const [focusAfterFilter, setFocusAfterFilter] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<InventorySessionEvent[]>([]);
  const [stockLedgerPack, setStockLedgerPack] = useState<{
    rows: StockLedgerRow[];
    document_no?: string;
  } | null>(null);
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const skipLinesEffectOnce = useRef(false);
  const { isAdmin } = useAuth();

  const mergeFromLines = useCallback((results: InventoryResult[]) => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const r of results) {
        if (next[r.item_id] === undefined) {
          next[r.item_id] = r.status !== "pending" ? String(r.actual_quantity) : "";
        }
      }
      return next;
    });
    setComments((prev) => {
      const next = { ...prev };
      for (const r of results) {
        if (next[r.item_id] === undefined) {
          next[r.item_id] = r.comment ?? "";
        }
      }
      return next;
    });
  }, []);

  const refreshHeaderAndExtras = useCallback(async (id: string) => {
    const d = await fetchSessionDetail(id);
    setDetail(d);
    const [nextDiscrepancies, nextAudit] = await Promise.all([fetchDiscrepancies(id), fetchSessionAudit(id)]);
    setDiscrepancies(nextDiscrepancies);
    setAuditEvents(nextAudit);
    if (d.session.status === "completed") {
      try {
        const led = await fetchSessionStockLedger(id);
        setStockLedgerPack({ rows: led.rows ?? [], document_no: led.document_no });
      } catch {
        setStockLedgerPack({ rows: [], document_no: undefined });
      }
    } else {
      setStockLedgerPack(null);
    }
    return d;
  }, []);

  const loadLines = useCallback(async () => {
    if (!sessionId) return;
    setLinesLoading(true);
    setError(null);
    try {
      const data = await fetchSessionLines(sessionId, {
        page: linesPage,
        page_size: PAGE_SIZE,
        filter: rowFilter,
        group_by: groupBy,
        q: lineQuery,
        location: debouncedLocation.trim() || undefined,
      });
      setLineItems(data.items);
      setLineResults(data.results);
      setLinesTotal(data.total);
      mergeFromLines(data.results);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLinesLoading(false);
    }
  }, [sessionId, linesPage, rowFilter, groupBy, lineQuery, debouncedLocation, mergeFromLines]);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setError("Сессия не указана");
      return;
    }
    setDrafts({});
    setComments({});
    setLineItems([]);
    setLineResults([]);
    setLinesTotal(0);
    setLinesPage(1);
    setLineQuery(undefined);
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await refreshHeaderAndExtras(sessionId);
      } catch (e) {
        setError(getErrorMessage(e));
        setDetail(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, refreshHeaderAndExtras]);

  useEffect(() => {
    if (!saveNotice) return;
    const t = window.setTimeout(() => setSaveNotice(null), 4500);
    return () => window.clearTimeout(t);
  }, [saveNotice]);

  useEffect(() => {
    setLinesPage(1);
    setLineQuery(undefined);
  }, [rowFilter, groupBy, debouncedLocation]);

  useEffect(() => {
    if (!sessionId) return;
    if (skipLinesEffectOnce.current) {
      skipLinesEffectOnce.current = false;
      return;
    }
    void loadLines();
  }, [sessionId, linesPage, rowFilter, groupBy, lineQuery, loadLines]);

  useEffect(() => {
    if (!lineItems.length || !focusItemId) return;
    requestAnimationFrame(() => {
      document.getElementById(`inv-${focusItemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [lineItems, focusItemId]);

  const completed = detail?.session.status === "completed";
  const sum = detail?.summary;
  const totalCount = sum?.total ?? 0;
  const countedCount = totalCount > 0 && sum ? totalCount - sum.pending : 0;
  const progressPercent = totalCount > 0 ? Math.round((countedCount / totalCount) * 100) : 0;

  const totalPages = Math.max(1, Math.ceil(linesTotal / PAGE_SIZE));

  const groupedPageItems = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", title: "Все позиции", items: lineItems }];
    const map = new Map<string, typeof lineItems>();
    for (const it of lineItems) {
      const k = groupBy === "location" ? it.location : it.category;
      const arr = map.get(k) ?? [];
      arr.push(it);
      map.set(k, arr);
    }
    return Array.from(map.entries()).map(([key, items]) => ({ key, title: key || "Без значения", items }));
  }, [groupBy, lineItems]);

  const refreshAfterMutation = useCallback(async () => {
    if (!sessionId) return;
    await refreshHeaderAndExtras(sessionId);
    const data = await fetchSessionLines(sessionId, {
      page: linesPage,
      page_size: PAGE_SIZE,
      filter: rowFilter,
      group_by: groupBy,
      q: lineQuery,
      location: debouncedLocation.trim() || undefined,
    });
    setLineItems(data.items);
    setLineResults(data.results);
    setLinesTotal(data.total);
    mergeFromLines(data.results);
  }, [
    sessionId,
    refreshHeaderAndExtras,
    linesPage,
    rowFilter,
    groupBy,
    lineQuery,
    mergeFromLines,
    debouncedLocation,
  ]);

  const saveBatch = useCallback(
    async (scope: "all" | "visible" = "all") => {
      if (!detail || !sessionId || completed) return;
      const rows: { item_id: string; actual_quantity: number; comment?: string }[] = [];
      if (scope === "visible") {
        for (const it of lineItems) {
          const raw = drafts[it.id];
          if (raw === undefined || raw === "") continue;
          const n = Number.parseInt(raw, 10);
          if (Number.isNaN(n) || n < 0) continue;
          rows.push({ item_id: it.id, actual_quantity: n, comment: comments[it.id]?.trim() || undefined });
        }
      } else {
        for (const itemId of Object.keys(drafts)) {
          const raw = drafts[itemId];
          if (raw === undefined || raw === "") continue;
          const n = Number.parseInt(raw, 10);
          if (Number.isNaN(n) || n < 0) continue;
          rows.push({ item_id: itemId, actual_quantity: n, comment: comments[itemId]?.trim() || undefined });
        }
      }
      if (rows.length === 0) {
        setError("Укажите фактическое количество хотя бы по одной позиции.");
        return;
      }
      setSaving(true);
      setError(null);
      setSaveNotice(null);
      try {
        const batchResults = await postSessionResultsBatch(sessionId, rows);
        setDrafts((prev) => {
          const next = { ...prev };
          for (const r of batchResults) {
            next[r.item_id] = r.status !== "pending" ? String(r.actual_quantity) : "";
          }
          return next;
        });
        setComments((prev) => {
          const next = { ...prev };
          for (const r of batchResults) {
            next[r.item_id] = r.comment ?? "";
          }
          return next;
        });
        await refreshAfterMutation();
        setSaveNotice("Изменения сохранены.");
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setSaving(false);
      }
    },
    [comments, completed, detail, drafts, lineItems, refreshAfterMutation, sessionId],
  );

  const sessionVersionBody = detail?.session.updated_at
    ? { expected_updated_at: detail.session.updated_at }
    : {};

  async function finish() {
    if (!sessionId || !detail || completed) return;
    if (
      !confirm(
        "Провести документ инвентаризации? Остатки в карточках объектов обновятся по сохранённому фактическому количеству; строки без сохранённого факта склад не изменят. Разницы фиксируются в реестре корректировок. После проведения редактирование строк будет недоступно.",
      )
    )
      return;
    setSaving(true);
    setError(null);
    try {
      await completeSession(sessionId, sessionVersionBody);
      await refreshAfterMutation();
    } catch (e) {
      const pendingUncounted =
        isAdmin &&
        e instanceof ApiError &&
        e.status === 409 &&
        typeof e.body === "object" &&
        e.body !== null &&
        "code" in e.body &&
        (e.body as { code?: string }).code === "pending_uncounted";
      if (pendingUncounted) {
        const n = (e.body as { pending_count?: number }).pending_count;
        const extra = typeof n === "number" ? ` (${n} поз.)` : "";
        if (
          confirm(
            `Есть непосчитанные строки${extra}. Завершить принудительно? Доступно только администратору.`,
          )
        ) {
          try {
            await completeSession(sessionId, {
              ...sessionVersionBody,
              allow_incomplete: true,
            });
            await refreshAfterMutation();
          } catch (e2) {
            setError(getErrorMessage(e2));
          }
        }
      } else {
        setError(getErrorMessage(e));
      }
    } finally {
      setSaving(false);
    }
  }

  async function toReview() {
    if (!sessionId || !detail) return;
    setSaving(true);
    setError(null);
    try {
      await sendSessionToReview(sessionId, sessionVersionBody);
      await refreshAfterMutation();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function toArchive() {
    if (!sessionId || !detail) return;
    setSaving(true);
    setError(null);
    try {
      await archiveSession(sessionId, sessionVersionBody);
      await refreshAfterMutation();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmDiscrepancy(itemId: string) {
    if (!sessionId) return;
    try {
      await confirmDiscrepancy(sessionId, itemId);
      const d = await fetchDiscrepancies(sessionId);
      setDiscrepancies(d);
      await refreshAfterMutation();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  function setDraft(id: string, v: string) {
    setDrafts((prev) => ({ ...prev, [id]: v }));
  }

  function setComment(id: string, v: string) {
    setComments((prev) => ({ ...prev, [id]: v }));
  }

  function focusNextQtyInput(currentId: string) {
    const idx = lineItems.findIndex((it) => it.id === currentId);
    if (idx < 0) return;
    const next = lineItems[idx + 1];
    if (!next) return;
    qtyRefs.current[next.id]?.focus();
    qtyRefs.current[next.id]?.select();
  }

  const focusFirstVisibleQtyInput = useCallback(() => {
    const first = lineItems[0];
    if (!first) return;
    qtyRefs.current[first.id]?.focus();
    qtyRefs.current[first.id]?.select();
  }, [lineItems]);

  async function runScan(raw: string) {
    const trimmed = raw.trim();
    const q = extractUuidFromScan(trimmed) ?? trimmed;
    if (!q || !sessionId || !detail) return;
    skipLinesEffectOnce.current = true;
    setLinesLoading(true);
    setError(null);
    try {
      setRowFilter("all");
      setLineQuery(q);
      setLinesPage(1);
      const data = await fetchSessionLines(sessionId, {
        page: 1,
        page_size: PAGE_SIZE,
        filter: "all",
        group_by: groupBy,
        q,
        location: debouncedLocation.trim() || undefined,
      });
      setLineItems(data.items);
      setLineResults(data.results);
      setLinesTotal(data.total);
      mergeFromLines(data.results);
      const found = data.items[0];
      if (!found || data.total === 0) {
        setScanStatus("Позиция не найдена");
        setHighlightItemId(null);
        return;
      }
      setScanStatus(`Найдено: ${found.sku} · ${found.name}`);
      setHighlightItemId(found.id);
      requestAnimationFrame(() => {
        document.getElementById(`inv-${found.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        qtyRefs.current[found.id]?.focus();
        qtyRefs.current[found.id]?.select();
      });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLinesLoading(false);
    }
  }

  function onQtyKeyDown(e: ReactKeyboardEvent<HTMLInputElement>, itemId: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      focusNextQtyInput(itemId);
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!completed && !saving) {
          void saveBatch("visible");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [completed, saveBatch, saving]);

  useEffect(() => {
    if (!focusAfterFilter) return;
    focusFirstVisibleQtyInput();
    setFocusAfterFilter(false);
  }, [focusAfterFilter, focusFirstVisibleQtyInput, lineItems]);

  const resultByItemId = useMemo(() => {
    const m = new Map<string, InventoryResult>();
    for (const r of lineResults) m.set(r.item_id, r);
    return m;
  }, [lineResults]);

  const hasUnsavedOnPage = useMemo(() => {
    if (completed || lineItems.length === 0) return false;
    for (const it of lineItems) {
      const res = resultByItemId.get(it.id);
      const serverQtyStr = res && res.status !== "pending" ? String(res.actual_quantity) : "";
      const shownQtyRaw = drafts[it.id] !== undefined ? drafts[it.id]! : serverQtyStr;
      if (shownQtyRaw.trim() !== serverQtyStr.trim()) return true;
      const serverCommRaw = res?.comment ?? "";
      const shownCommRaw = comments[it.id] !== undefined ? comments[it.id]! : serverCommRaw;
      if (shownCommRaw.trim() !== serverCommRaw.trim()) return true;
    }
    return false;
  }, [completed, lineItems, drafts, comments, resultByItemId]);

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link className={styles.backLink} to="/inventory/sessions">
          ← К списку документов
        </Link>
      </p>

      {loading && <Spinner />}
      {saveNotice && !loading && <Alert variant="success">{saveNotice}</Alert>}
      {error && !loading && <Alert>{error}</Alert>}

      {!loading && detail && (
        <>
          <header className={styles.top}>
            <div>
              <h1 className={styles.title}>
                {(detail.session.document_no ?? "").trim()
                  ? `${detail.session.document_no} · `
                  : ""}
                документ от {new Date(detail.session.created_at).toLocaleString("ru-RU")}
              </h1>
              <p className={styles.subtitle}>
                {sessionStatusLabel(detail.session.status)}
                {detail.session.created_by ? ` · создал: ${detail.session.created_by}` : ""}
              </p>
              {(detail.session.notes?.trim() ||
                detail.session.filter_location?.trim() ||
                detail.session.filter_category_name?.trim()) && (
                <dl className={styles.docMeta}>
                  {detail.session.notes?.trim() ? (
                    <>
                      <dt className={styles.docMetaDt}>Примечание</dt>
                      <dd className={styles.docMetaDd}>{detail.session.notes.trim()}</dd>
                    </>
                  ) : null}
                  {detail.session.filter_location?.trim() ? (
                    <>
                      <dt className={styles.docMetaDt}>Выборка: локация</dt>
                      <dd className={styles.docMetaDd}>{detail.session.filter_location.trim()}</dd>
                    </>
                  ) : null}
                  {detail.session.filter_category_name?.trim() ? (
                    <>
                      <dt className={styles.docMetaDt}>Выборка: категория</dt>
                      <dd className={styles.docMetaDd}>{detail.session.filter_category_name.trim()}</dd>
                    </>
                  ) : null}
                </dl>
              )}
              <p className={styles.subtitle}>
                Прогресс: {countedCount}/{totalCount} ({progressPercent}%)
              </p>
            </div>
            <div className={`${styles.topActions} ${styles.noPrint}`}>
              {!completed && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    responsiveFull
                    onClick={() => void saveBatch("all")}
                    disabled={saving}
                  >
                    {saving ? "Сохранение…" : "Сохранить"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    responsiveFull
                    onClick={() => void saveBatch("visible")}
                    disabled={saving}
                  >
                    {saving ? "Сохранение…" : "Сохранить видимые"}
                  </Button>
                  {detail.session.status === "active" && (
                    <Button type="button" variant="secondary" responsiveFull onClick={() => void toReview()} disabled={saving}>
                      На проверку
                    </Button>
                  )}
                  {(detail.session.status === "review" || detail.session.status === "active") && (
                    <Button type="button" variant="primary" responsiveFull onClick={() => void finish()} disabled={saving}>
                      Провести документ
                    </Button>
                  )}
                </>
              )}
              {detail.session.status === "completed" && (
                <Button type="button" variant="outline" responsiveFull onClick={() => void toArchive()} disabled={saving}>
                  В архив
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                responsiveFull
                onClick={() => sessionId && void exportSessionCsv(sessionId)}
              >
                Экспорт отчета CSV
              </Button>
              <Button
                type="button"
                variant="secondary"
                responsiveFull
                onClick={() => sessionId && void exportDiscrepanciesCsv(sessionId)}
              >
                Акт расхождений CSV
              </Button>
              <Button
                type="button"
                variant="secondary"
                responsiveFull
                onClick={() => sessionId && void exportSessionAuditCsv(sessionId)}
              >
                Журнал аудита CSV
              </Button>
              {sessionId ? (
                <Link className={styles.sheetLink} to={`/inventory/sessions/${sessionId}/print-sheet`}>
                  Опись для печати
                </Link>
              ) : null}
            </div>
          </header>
          <div className={`${styles.filters} ${styles.noPrint}`} role="group" aria-label="Фильтр позиций">
            <Button
              type="button"
              variant={rowFilter === "all" ? "primary" : "outline"}
              responsiveFull
              onClick={() => setRowFilter("all")}
            >
              Все
            </Button>
            <Button
              type="button"
              variant={rowFilter === "pending" ? "primary" : "outline"}
              responsiveFull
              onClick={() => setRowFilter("pending")}
            >
              Не посчитано
            </Button>
            <Button
              type="button"
              variant={rowFilter === "mismatch" ? "primary" : "outline"}
              responsiveFull
              onClick={() => setRowFilter("mismatch")}
            >
              Расхождения
            </Button>
            <Button
              type="button"
              variant={rowFilter === "missing" ? "primary" : "outline"}
              responsiveFull
              onClick={() => setRowFilter("missing")}
            >
              Отсутствуют
            </Button>
            <Button
              type="button"
              variant={rowFilter === "match" ? "primary" : "outline"}
              responsiveFull
              onClick={() => setRowFilter("match")}
            >
              Совпадения
            </Button>
            <Button
              type="button"
              variant="secondary"
              responsiveFull
              onClick={() => {
                setRowFilter("mismatch");
                setFocusAfterFilter(true);
              }}
            >
              Быстрый пересчет
            </Button>
          </div>
          <div className={`${styles.grouping} ${styles.noPrint}`}>
            <span className={styles.groupingLabel}>Группировка:</span>
            <Button type="button" variant={groupBy === "none" ? "primary" : "outline"} onClick={() => setGroupBy("none")}>
              Нет
            </Button>
            <Button
              type="button"
              variant={groupBy === "location" ? "primary" : "outline"}
              onClick={() => setGroupBy("location")}
            >
              По локации
            </Button>
            <Button
              type="button"
              variant={groupBy === "category" ? "primary" : "outline"}
              onClick={() => setGroupBy("category")}
            >
              По категории
            </Button>
          </div>
          <div className={`${styles.locationRow} ${styles.noPrint}`}>
            <label className={styles.locationLabel} htmlFor="sess-location-filter">
              Локация (фильтр)
            </label>
            <input
              id="sess-location-filter"
              className={styles.locationInput}
              type="search"
              value={locationFilterRaw}
              onChange={(e) => setLocationFilterRaw(e.target.value)}
              placeholder="Подстрока, например «цех»"
              aria-label="Фильтр строк таблицы по локации объекта"
              autoComplete="off"
            />
          </div>
          {sum && (
            <>
              <div className={styles.metrics}>
                <article className={styles.metricCard}>
                  <p className={styles.metricLabel}>Не посчитано</p>
                  <p className={styles.metricValue}>{sum.pending}</p>
                </article>
                <article className={styles.metricCard}>
                  <p className={styles.metricLabel}>Совпадает</p>
                  <p className={styles.metricValue}>{sum.match}</p>
                </article>
                <article className={styles.metricCard}>
                  <p className={styles.metricLabel}>Расхождения</p>
                  <p className={styles.metricValue}>{sum.mismatch}</p>
                </article>
                <article className={styles.metricCard}>
                  <p className={styles.metricLabel}>Отсутствует</p>
                  <p className={styles.metricValue}>{sum.missing}</p>
                </article>
              </div>
              <p className={styles.metricsHint}>
                Верхний блок — сводка по уже сохранённым в базе результатам. После «Сохранить» счётчики совпадут с учётными статусами.
              </p>
              {!completed && hasUnsavedOnPage && (
                <p className={styles.metricsHintWarn} role="status">
                  На текущей странице есть несохранённые изменения в количестве или комментарии.
                </p>
              )}
            </>
          )}
          <section className={`${styles.onboarding} ${styles.noPrint}`} aria-label="Краткая инструкция">
            <p className={styles.onboardingTitle}>Как работает документ</p>
            <p className={styles.onboardingText}>
              «Учётное количество» — остаток по данным системы на момент создания документа. «Фактическое количество» —
              результат пересчёта на месте хранения (после скана QR найдите строку и введите число). Сохраняйте строки. По
              команде «Провести документ» остатки в карточках приводятся к сохранённому факту; отклонения отражаются в реестре
              корректировок ниже.
            </p>
          </section>
          <details className={`${styles.glossary} ${styles.noPrint}`}>
            <summary className={styles.glossarySummary}>Термины и статусы</summary>
            <dl className={styles.glossaryBody}>
              <dt className={styles.glossaryDt}>Не посчитано</dt>
              <dd className={styles.glossaryDd}>Фактическое количество ещё не сохранено в базе.</dd>
              <dt className={styles.glossaryDt}>Расхождение</dt>
              <dd className={styles.glossaryDd}>Факт не совпал с количеством по учёту; желательно указать комментарий.</dd>
              <dt className={styles.glossaryDt}>Отсутствует</dt>
              <dd className={styles.glossaryDd}>По результатам пересчёта количество ноль при ненулевом учёте.</dd>
              <dt className={styles.glossaryDt}>На проверке</dt>
              <dd className={styles.glossaryDd}>Сессию отправили администратору перед закрытием.</dd>
            </dl>
          </details>
          <div className={`${styles.scanBar} ${styles.noPrint}`}>
            <input
              className={styles.scanInput}
              type="text"
              value={scanQuery}
              onChange={(e) => setScanQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runScan(scanQuery);
                }
              }}
              placeholder="SKU, название, UUID или URL из QR — Enter"
              aria-label="Скан-поиск позиции"
            />
            <Button type="button" variant="outline" responsiveFull onClick={() => void runScan(scanQuery)}>
              Найти
            </Button>
          </div>
          {scanStatus && <p className={styles.scanStatus}>{scanStatus}</p>}
          <p className={`${styles.hotkeysHint} ${styles.noPrint}`}>
            Горячие клавиши: Enter — следующая позиция, Ctrl/Cmd+S — сохранить видимые.
          </p>

          {completed && (
            <>
              <p className={styles.banner}>Документ проведён. Остатки выровнены по факту. Строки только для просмотра.</p>
              <p className={`${styles.ledgerGlobalLink} ${styles.noPrint}`}>
                <Link to="/reports/stock-ledger">Реестр движений по всем проведённым документам</Link>
              </p>
              {stockLedgerPack && stockLedgerPack.rows.length > 0 ? (
                <section className={styles.ledgerSection} aria-label="Реестр движений по документу">
                  <h2 className={styles.ledgerTitle}>Реестр корректировок остатков</h2>
                  <p className={styles.ledgerDocNo}>
                    Основание: документ инвентаризации{" "}
                    <strong>{stockLedgerPack.document_no?.trim() || detail?.session.document_no?.trim() || "—"}</strong>. Каждая
                    строка — списание или оприходование, зафиксированные при проведении этого документа.
                  </p>
                  <p className={styles.ledgerLead}>
                    Запись появляется только если при проведении фактическое количество отличалось от остатка в карточке объекта
                    учёта.
                  </p>
                  <div className={styles.ledgerTableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Объект</th>
                          <th>Вид движения</th>
                          <th>Учётное кол-во в строке</th>
                          <th>Фактическое</th>
                          <th>Было → стало</th>
                          <th>Δ</th>
                          <th>Время</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockLedgerPack.rows.map((row) => (
                          <tr key={row.id}>
                            <td>
                              {row.item_sku} · {row.item_name}
                            </td>
                            <td>{row.movement_label}</td>
                            <td>{row.accounting_qty}</td>
                            <td>{row.actual_qty}</td>
                            <td>
                              {row.balance_before} → {row.balance_after}
                            </td>
                            <td>{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
                            <td className={styles.ledgerTime}>{new Date(row.created_at).toLocaleString("ru-RU")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </>
          )}

          {linesLoading && lineItems.length === 0 && <Spinner />}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Объект</th>
                  <th>Учётное количество</th>
                  <th>Фактическое количество (на складе)</th>
                  <th>Комментарий</th>
                  <th>Кто/когда</th>
                  <th>Отклонение</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {groupedPageItems.map((g) => (
                  <Fragment key={`group-${g.key}`}>
                    {groupBy !== "none" && (
                      <tr className={styles.groupRow}>
                        <td colSpan={7}>{g.title}</td>
                      </tr>
                    )}
                    {g.items.map((it) => {
                      const res = resultByItemId.get(it.id);
                      const draft = drafts[it.id] ?? "";
                      const kind = sessionRowStatus(it, draft, res?.status);
                      const tone = sessionRowTone(kind);
                      const actual = effectiveActualQuantity(draft, res?.actual_quantity, res?.status);
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
                      const commentText = (comments[it.id] ?? res?.comment ?? "").trim();
                      const commentMissing =
                        !completed && (kind === "mismatch" || kind === "missing") && commentText === "";
                      return (
                        <tr
                          key={it.id}
                          id={`inv-${it.id}`}
                          className={`${rowClass} ${highlightItemId === it.id ? styles.rowHighlight : ""}`.trim()}
                        >
                          <td className={styles.nameCell}>{it.name}</td>
                          <td>{it.quantity}</td>
                          <td>
                            <input
                              className={styles.qtyInput}
                              type="number"
                              min={0}
                              disabled={completed}
                              value={draft}
                              ref={(el) => {
                                qtyRefs.current[it.id] = el;
                              }}
                              onChange={(e) => setDraft(it.id, e.target.value)}
                              onKeyDown={(e) => onQtyKeyDown(e, it.id)}
                              aria-label={`Фактическое количество для ${it.name}`}
                            />
                          </td>
                          <td className={commentMissing ? styles.commentCellWarn : undefined}>
                            <input
                              className={[styles.commentInput, commentMissing ? styles.commentInputWarn : ""]
                                .filter(Boolean)
                                .join(" ")}
                              type="text"
                              maxLength={200}
                              disabled={completed}
                              value={comments[it.id] ?? ""}
                              onChange={(e) => setComment(it.id, e.target.value)}
                              placeholder={commentMissing ? "Укажите причину расхождения" : "Причина расхождения"}
                              aria-label={`Комментарий для ${it.name}`}
                              aria-invalid={commentMissing}
                            />
                          </td>
                          <td className={styles.metaCell}>
                            {res?.counted_by ? <div>{res.counted_by}</div> : <div>—</div>}
                            {res?.counted_at ? <div>{new Date(res.counted_at).toLocaleString("ru-RU")}</div> : null}
                            {res?.recount_count ? <div>Пересчетов: {res.recount_count}</div> : null}
                          </td>
                          <td className={`${styles.deltaCell} ${deltaClass}`}>{formatDelta(delta)}</td>
                          <td>
                            <StatusBadge kind={kind} />
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`${styles.cardList} ${styles.noPrint}`}>
            {groupedPageItems.map((g) => (
              <div key={`card-group-${g.key}`}>
                {groupBy !== "none" && <p className={styles.cardGroupTitle}>{g.title}</p>}
                {g.items.map((it) => {
                  const res = resultByItemId.get(it.id);
                  const draft = drafts[it.id] ?? "";
                  const kind = sessionRowStatus(it, draft, res?.status);
                  const tone = sessionRowTone(kind);
                  const actual = effectiveActualQuantity(draft, res?.actual_quantity, res?.status);
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
                  const commentText = (comments[it.id] ?? res?.comment ?? "").trim();
                  const commentMissing =
                    !completed && (kind === "mismatch" || kind === "missing") && commentText === "";
                  return (
                    <article
                      key={it.id}
                      className={`${styles.card} ${cardTone} ${highlightItemId === it.id ? styles.cardHighlight : ""}`.trim()}
                      id={`inv-m-${it.id}`}
                    >
                      <div className={styles.cardTitle}>{it.name}</div>
                      <div className={styles.cardRow}>
                        <span>Учётное количество: {it.quantity}</span>
                        <StatusBadge kind={kind} />
                      </div>
                      <p className={`${styles.cardDelta} ${deltaClass}`}>
                        Отклонение: <strong>{formatDelta(delta)}</strong>
                      </p>
                      <label className={styles.cardLabel}>
                        Фактическое количество (на складе)
                        <input
                          className={styles.qtyInput}
                          type="number"
                          min={0}
                          disabled={completed}
                          value={draft}
                          ref={(el) => {
                            qtyRefs.current[it.id] = el;
                          }}
                          onChange={(e) => setDraft(it.id, e.target.value)}
                          onKeyDown={(e) => onQtyKeyDown(e, it.id)}
                        />
                      </label>
                      <label className={styles.cardLabel}>
                        Комментарий
                        <input
                          className={[styles.commentInput, commentMissing ? styles.commentInputWarn : ""]
                            .filter(Boolean)
                            .join(" ")}
                          type="text"
                          maxLength={200}
                          disabled={completed}
                          value={comments[it.id] ?? ""}
                          onChange={(e) => setComment(it.id, e.target.value)}
                          placeholder={commentMissing ? "Укажите причину расхождения" : "Причина расхождения"}
                          aria-invalid={commentMissing}
                        />
                      </label>
                      <p className={styles.cardMeta}>
                        Кто: {res?.counted_by ?? "—"}
                        <br />
                        Когда: {res?.counted_at ? new Date(res.counted_at).toLocaleString("ru-RU") : "—"}
                        {res?.recount_count ? (
                          <>
                            <br />
                            Пересчетов: {res.recount_count}
                          </>
                        ) : null}
                      </p>
                    </article>
                  );
                })}
              </div>
            ))}
          </div>
          {linesTotal === 0 && !linesLoading && <p className={styles.banner}>По выбранному фильтру нет позиций.</p>}
          {linesTotal > 0 && (
            <div className={`${styles.pagination} ${styles.noPrint}`}>
              <Button type="button" variant="outline" disabled={linesPage <= 1} onClick={() => setLinesPage((p) => p - 1)}>
                Назад
              </Button>
              <span className={styles.pageInfo}>
                Страница {linesPage} из {totalPages} · всего по фильтру {linesTotal} позиций
                {lineQuery ? ` · поиск «${lineQuery}»` : ""}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={linesPage >= totalPages}
                onClick={() => setLinesPage((p) => p + 1)}
              >
                Вперёд
              </Button>
            </div>
          )}
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
                      <Button type="button" variant="outline" responsiveFull onClick={() => void onConfirmDiscrepancy(d.result.item_id)}>
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
                {auditEvents.map((ev) => (
                  <article key={ev.id} className={styles.discrepancyCard}>
                    <p className={styles.discrepancyName}>{ev.action}</p>
                    <p className={styles.discrepancyMeta}>{ev.details || "—"}</p>
                    <p className={styles.discrepancyMeta}>
                      Кто: {ev.actor_id ?? "система"} · Когда: {new Date(ev.created_at).toLocaleString("ru-RU")}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

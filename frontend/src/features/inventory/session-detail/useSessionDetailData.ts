import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  fetchDiscrepancies,
  fetchSessionAudit,
  fetchSessionDetail,
  fetchSessionLines,
  fetchSessionStockAdjustments,
  fetchSessionStockLedger,
} from "@/shared/api/inventory.api";
import type {
  DiscrepancyItem,
  InventorySessionDetail,
  InventorySessionEvent,
  InventoryResult,
  Item,
  StockAdjustmentSummary,
  StockLedgerRow,
} from "@/shared/types";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { getErrorMessage } from "@/shared/utils/errors";
import { PAGE_SIZE, type GroupBy, type RowFilter } from "./constants";
import { groupLineItems } from "./groupLines";

export function useSessionDetailData() {
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
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustmentSummary[]>([]);

  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const skipLinesEffectOnce = useRef(false);

  const mergeFromLines = useCallback((items: Item[], results: InventoryResult[]) => {
    const resultByItem = new Map(results.map((r) => [r.item_id, r]));
    setDrafts((prev) => {
      const next = { ...prev };
      for (const it of items) {
        if (next[it.id] !== undefined) continue;
        const r = resultByItem.get(it.id);
        if (r && r.status !== "pending") {
          next[it.id] = String(r.actual_quantity);
        } else {
          next[it.id] = String(it.quantity);
        }
      }
      return next;
    });
    setComments((prev) => {
      const next = { ...prev };
      for (const r of results) {
        if (next[r.item_id] === undefined) next[r.item_id] = r.comment ?? "";
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
    if (d.session.status === "completed" || d.session.status === "archived") {
      try {
        const [led, adj] = await Promise.all([fetchSessionStockLedger(id), fetchSessionStockAdjustments(id)]);
        setStockLedgerPack({ rows: led.rows ?? [], document_no: led.document_no });
        setStockAdjustments(adj);
      } catch {
        setStockLedgerPack({ rows: [], document_no: undefined });
        setStockAdjustments([]);
      }
    } else {
      setStockLedgerPack(null);
      setStockAdjustments([]);
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
      mergeFromLines(data.items, data.results);
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

  const archived = detail?.session.status === "archived";
  const completed = detail?.session.status === "completed";
  const locked = completed || archived;
  const sum = detail?.summary;
  const totalCount = sum?.total ?? 0;
  const countedCount = totalCount > 0 && sum ? totalCount - sum.pending : 0;
  const progressPercent = totalCount > 0 ? Math.round((countedCount / totalCount) * 100) : 0;
  const totalPages = Math.max(1, Math.ceil(linesTotal / PAGE_SIZE));
  const groupedPageItems = useMemo(() => groupLineItems(lineItems, groupBy), [groupBy, lineItems]);

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
    mergeFromLines(data.items, data.results);
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

  const resultByItemId = useMemo(() => {
    const m = new Map<string, InventoryResult>();
    for (const r of lineResults) m.set(r.item_id, r);
    return m;
  }, [lineResults]);

  const hasUnsavedOnPage = useMemo(() => {
    if (locked || lineItems.length === 0) return false;
    for (const it of lineItems) {
      const res = resultByItemId.get(it.id);
      const serverQtyStr =
        res && res.status !== "pending" ? String(res.actual_quantity) : String(it.quantity);
      const shownQtyRaw = drafts[it.id] ?? serverQtyStr;
      if (shownQtyRaw.trim() !== serverQtyStr.trim()) return true;
      const serverCommRaw = res?.comment ?? "";
      const shownCommRaw = comments[it.id] !== undefined ? comments[it.id]! : serverCommRaw;
      if (shownCommRaw.trim() !== serverCommRaw.trim()) return true;
    }
    return false;
  }, [locked, lineItems, drafts, comments, resultByItemId]);

  const sessionVersionBody = detail?.session.updated_at ? { expected_updated_at: detail.session.updated_at } : {};

  return {
    sessionId,
    detail,
    lineItems,
    linesTotal,
    linesPage,
    setLinesPage,
    lineQuery,
    setLineQuery,
    locationFilterRaw,
    setLocationFilterRaw,
    debouncedLocation,
    drafts,
    setDrafts,
    comments,
    setComments,
    loading,
    linesLoading,
    error,
    setError,
    saveNotice,
    setSaveNotice,
    saving,
    setSaving,
    rowFilter,
    setRowFilter,
    groupBy,
    setGroupBy,
    scanQuery,
    setScanQuery,
    scanStatus,
    setScanStatus,
    highlightItemId,
    setHighlightItemId,
    focusAfterFilter,
    setFocusAfterFilter,
    discrepancies,
    setDiscrepancies,
    auditEvents,
    stockLedgerPack,
    stockAdjustments,
    qtyRefs,
    skipLinesEffectOnce,
    archived,
    completed,
    locked,
    sum,
    countedCount,
    totalCount,
    progressPercent,
    totalPages,
    groupedPageItems,
    refreshAfterMutation,
    resultByItemId,
    hasUnsavedOnPage,
    sessionVersionBody,
    mergeFromLines,
    setLineItems,
    setLineResults,
    setLinesTotal,
    setLinesLoading,
  };
}

export type SessionDetailData = ReturnType<typeof useSessionDetailData>;

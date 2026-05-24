import { useCallback, useEffect, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  archiveSession,
  completeSession,
  confirmDiscrepancy,
  fetchDiscrepancies,
  fetchSessionLines,
  postSessionResultsBatch,
  sendSessionToReview,
} from "@/shared/api/inventory.api";
import { useAuth } from "@/shared/context/useAuth";
import { ApiError, getErrorMessage } from "@/shared/utils/errors";
import { extractUuidFromScan, isUuid } from "@/shared/utils/scanExtract";
import { PAGE_SIZE } from "./constants";
import type { SessionDetailData } from "./useSessionDetailData";

export function useSessionDetailActions(d: SessionDetailData) {
  const { isAdmin } = useAuth();

  const setDraft = useCallback((id: string, v: string) => {
    d.setDrafts((prev) => ({ ...prev, [id]: v }));
  }, [d]);

  const setComment = useCallback((id: string, v: string) => {
    d.setComments((prev) => ({ ...prev, [id]: v }));
  }, [d]);

  const focusNextQtyInput = useCallback(
    (currentId: string) => {
      const idx = d.lineItems.findIndex((it) => it.id === currentId);
      if (idx < 0) return;
      const next = d.lineItems[idx + 1];
      if (!next) return;
      d.qtyRefs.current[next.id]?.focus();
      d.qtyRefs.current[next.id]?.select();
    },
    [d],
  );

  const focusFirstVisibleQtyInput = useCallback(() => {
    const first = d.lineItems[0];
    if (!first) return;
    d.qtyRefs.current[first.id]?.focus();
    d.qtyRefs.current[first.id]?.select();
  }, [d]);

  const saveBatch = useCallback(
    async (scope: "all" | "visible" = "all") => {
      if (!d.detail || !d.sessionId || d.locked) return;
      const rows: { item_id: string; actual_quantity: number; comment?: string }[] = [];
      const pushRow = (itemId: string, raw: string) => {
        const id = itemId.trim();
        if (!isUuid(id)) return;
        const n = Number.parseInt(raw, 10);
        if (Number.isNaN(n) || n < 0) return;
        rows.push({
          item_id: id,
          actual_quantity: n,
          comment: d.comments[id]?.trim() || undefined,
        });
      };
      if (scope === "visible") {
        for (const it of d.lineItems) {
          if (!isUuid(it.id)) continue;
          const raw = d.drafts[it.id];
          if (raw === undefined || raw === "") continue;
          pushRow(it.id, raw);
        }
      } else {
        for (const itemId of Object.keys(d.drafts)) {
          const raw = d.drafts[itemId];
          if (raw === undefined || raw === "") continue;
          pushRow(itemId, raw);
        }
      }
      if (rows.length === 0) {
        d.setError(
          "Укажите фактическое количество в белом поле хотя бы по одной строке (0 — если ничего нет), затем нажмите «Сохранить». Одного комментария недостаточно.",
        );
        return;
      }
      d.setSaving(true);
      d.setError(null);
      d.setSaveNotice(null);
      try {
        const batchResults = await postSessionResultsBatch(d.sessionId, rows);
        d.setDrafts((prev) => {
          const next = { ...prev };
          for (const r of batchResults) {
            next[r.item_id] = r.status !== "pending" ? String(r.actual_quantity) : "";
          }
          return next;
        });
        d.setComments((prev) => {
          const next = { ...prev };
          for (const r of batchResults) next[r.item_id] = r.comment ?? "";
          return next;
        });
        await d.refreshAfterMutation();
        d.setSaveNotice("Изменения сохранены.");
      } catch (e) {
        d.setError(getErrorMessage(e));
      } finally {
        d.setSaving(false);
      }
    },
    [d],
  );

  const finish = useCallback(async () => {
    if (!d.sessionId || !d.detail || d.locked) return;
    if (
      !confirm(
        "Провести документ инвентаризации?\n\n• Остатки в карточках выровняются по сохранённому фактическому количеству.\n• Строки без сохранённого факта склад не изменят.\n• При расхождении в реестре движений появятся записи «Списание» или «Оприходование» с этим документом как основанием.\n\nПосле проведения редактирование строк будет недоступно.",
      )
    )
      return;
    d.setSaving(true);
    d.setError(null);
    try {
      await completeSession(d.sessionId, d.sessionVersionBody);
      await d.refreshAfterMutation();
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
        if (confirm(`Есть непосчитанные строки${extra}. Завершить принудительно? Доступно только администратору.`)) {
          try {
            await completeSession(d.sessionId, { ...d.sessionVersionBody, allow_incomplete: true });
            await d.refreshAfterMutation();
          } catch (e2) {
            d.setError(getErrorMessage(e2));
          }
        }
      } else {
        d.setError(getErrorMessage(e));
      }
    } finally {
      d.setSaving(false);
    }
  }, [d, isAdmin]);

  const toReview = useCallback(async () => {
    if (!d.sessionId || !d.detail) return;
    d.setSaving(true);
    d.setError(null);
    try {
      await sendSessionToReview(d.sessionId, d.sessionVersionBody);
      await d.refreshAfterMutation();
    } catch (e) {
      d.setError(getErrorMessage(e));
    } finally {
      d.setSaving(false);
    }
  }, [d]);

  const toArchive = useCallback(async () => {
    if (!d.sessionId || !d.detail) return;
    d.setSaving(true);
    d.setError(null);
    try {
      await archiveSession(d.sessionId, d.sessionVersionBody);
      await d.refreshAfterMutation();
    } catch (e) {
      d.setError(getErrorMessage(e));
    } finally {
      d.setSaving(false);
    }
  }, [d]);

  const onConfirmDiscrepancy = useCallback(
    async (itemId: string) => {
      if (!d.sessionId) return;
      try {
        await confirmDiscrepancy(d.sessionId, itemId);
        const next = await fetchDiscrepancies(d.sessionId);
        d.setDiscrepancies(next);
        await d.refreshAfterMutation();
      } catch (e) {
        d.setError(getErrorMessage(e));
      }
    },
    [d],
  );

  const runScan = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      const q = extractUuidFromScan(trimmed) ?? trimmed;
      if (!q || !d.sessionId || !d.detail) return;
      d.skipLinesEffectOnce.current = true;
      d.setLinesLoading(true);
      d.setError(null);
      try {
        d.setRowFilter("all");
        d.setLineQuery(q);
        d.setLinesPage(1);
        const data = await fetchSessionLines(d.sessionId, {
          page: 1,
          page_size: PAGE_SIZE,
          filter: "all",
          group_by: d.groupBy,
          q,
          location: d.debouncedLocation.trim() || undefined,
        });
        d.setLineItems(data.items);
        d.setLineResults(data.results);
        d.setLinesTotal(data.total);
        d.mergeFromLines(data.items, data.results);
        const found = data.items[0];
        if (!found || data.total === 0) {
          d.setScanStatus("Позиция не найдена");
          d.setHighlightItemId(null);
          return;
        }
        d.setScanStatus(`Найдено: ${found.sku} · ${found.name}`);
        d.setHighlightItemId(found.id);
        requestAnimationFrame(() => {
          document.getElementById(`inv-${found.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          d.qtyRefs.current[found.id]?.focus();
          d.qtyRefs.current[found.id]?.select();
        });
      } catch (e) {
        d.setError(getErrorMessage(e));
      } finally {
        d.setLinesLoading(false);
      }
    },
    [d],
  );

  const onQtyKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>, itemId: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        focusNextQtyInput(itemId);
      }
    },
    [focusNextQtyInput],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!d.locked && !d.saving) void saveBatch("visible");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [d.locked, d.saving, saveBatch]);

  const { focusAfterFilter, setFocusAfterFilter } = d;

  useEffect(() => {
    if (!focusAfterFilter) return;
    focusFirstVisibleQtyInput();
    setFocusAfterFilter(false);
  }, [focusAfterFilter, focusFirstVisibleQtyInput, setFocusAfterFilter]);

  return {
    isAdmin,
    setDraft,
    setComment,
    saveBatch,
    finish,
    toReview,
    toArchive,
    onConfirmDiscrepancy,
    runScan,
    onQtyKeyDown,
  };
}

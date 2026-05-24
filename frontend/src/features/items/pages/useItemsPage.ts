import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { fetchCategories } from "@/shared/api/categories.api";
import { fetchItems } from "@/shared/api/items.api";
import type { Category, Item } from "@/shared/types";
import type { DashboardOutletContext } from "@/layouts/DashboardLayout";
import { useAuth } from "@/shared/context/useAuth";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import type { SortDirection } from "@/shared/components/ui/Table";
import { getErrorMessage } from "@/shared/utils/errors";
import { ITEMS_PAGE_SIZE, type ItemsSortKey, type ItemsStockFilter } from "./itemsPageTypes";

export function useItemsPage() {
  const { dashboardSummary: summary, refreshDashboardSummary } = useOutletContext<DashboardOutletContext>();
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const replacementRemind = searchParams.get("replacement_remind") === "1";
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [sortKey, setSortKey] = useState<ItemsSortKey>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [stockFilter, setStockFilter] = useState<ItemsStockFilter>("all");
  const [includeRetired, setIncludeRetired] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkLocation, setBulkLocation] = useState("");
  const [bulkCategories, setBulkCategories] = useState<Category[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkErr, setBulkErr] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / ITEMS_PAGE_SIZE)), [total]);

  const toggleSort = useCallback(
    (key: ItemsSortKey) => {
      setPage(1);
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  useEffect(() => {
    if (!bulkOpen || !isAdmin) return;
    void fetchCategories().then(setBulkCategories).catch(() => setBulkCategories([]));
  }, [bulkOpen, isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchItems({
        q: debouncedQ || undefined,
        page,
        pageSize: ITEMS_PAGE_SIZE,
        lowStock: stockFilter === "low",
        includeRetired: isAdmin ? includeRetired : false,
        replacementRemind,
        sortBy: sortKey,
        sortDir,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, includeRetired, isAdmin, page, replacementRemind, sortDir, sortKey, stockFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, stockFilter, includeRetired, replacementRemind]);

  useEffect(() => {
    const visible = new Set(items.map((it) => it.id));
    setSelectedIds((prev) => prev.filter((id) => visible.has(id)));
  }, [items]);

  const allVisibleSelected = items.length > 0 && items.every((it) => selectedIds.includes(it.id));

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleSelectVisible = useCallback(() => {
    setSelectedIds((prev) => {
      if (items.length === 0) return prev;
      const visible = items.map((it) => it.id);
      const allSelected = visible.every((id) => prev.includes(id));
      if (allSelected) return prev.filter((id) => !visible.includes(id));
      return Array.from(new Set([...prev, ...visible]));
    });
  }, [items]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((item: Item) => {
    setEditing(item);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  const openBulk = useCallback(() => {
    setBulkErr(null);
    setBulkLocation("");
    setBulkCategoryId("");
    setBulkOpen(true);
  }, []);

  return {
    summary,
    refreshDashboardSummary,
    isAdmin,
    searchParams,
    setSearchParams,
    replacementRemind,
    q,
    setQ,
    items,
    error,
    loading,
    exportErr,
    setExportErr,
    modalOpen,
    editing,
    sortKey,
    sortDir,
    toggleSort,
    stockFilter,
    setStockFilter,
    includeRetired,
    setIncludeRetired,
    page,
    setPage,
    total,
    totalPages,
    selectedIds,
    toggleSelect,
    toggleSelectVisible,
    allVisibleSelected,
    bulkOpen,
    setBulkOpen,
    bulkLocation,
    setBulkLocation,
    bulkCategories,
    bulkCategoryId,
    setBulkCategoryId,
    bulkSaving,
    setBulkSaving,
    bulkErr,
    setBulkErr,
    load,
    openCreate,
    openEdit,
    closeModal,
    openBulk,
  };
}

export type ItemsPageState = ReturnType<typeof useItemsPage>;

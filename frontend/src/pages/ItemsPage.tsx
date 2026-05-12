import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { fetchCategories } from "../api/categories.api";
import { bulkUpdateMeta, deleteItem, exportItemsCsv, fetchItems } from "../api/items.api";
import type { Category, Item } from "../types";
import { ItemFormModal } from "../components/items/ItemFormModal";
import { ItemImage } from "../components/items/ItemImage";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Spinner } from "../components/ui/Spinner";
import {
  SortTh,
  Table,
  TableScroll,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  type SortDirection,
} from "../components/ui/Table";
import { useAuth } from "../context/useAuth";
import type { DashboardOutletContext } from "../layouts/DashboardLayout";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { getErrorMessage } from "../utils/errors";
import styles from "./ItemsPage.module.css";

const PAGE_SIZE = 12;

type SortKey = "name" | "quantity" | "purchase_date";
type StockFilter = "all" | "low";

export function ItemsPage() {
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
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
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

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  function toggleSort(key: SortKey) {
    setPage(1);
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

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
        pageSize: PAGE_SIZE,
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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectVisible() {
    setSelectedIds((prev) => {
      if (items.length === 0) return prev;
      const visible = items.map((it) => it.id);
      const allSelected = visible.every((id) => prev.includes(id));
      if (allSelected) return prev.filter((id) => !visible.includes(id));
      return Array.from(new Set([...prev, ...visible]));
    });
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Объекты учёта"
        subtitle="Номенклатура, количества, статус проверки в инвентаризации"
        actions={
          isAdmin ? (
            <>
              <Button
                type="button"
                variant="primary"
                responsiveFull
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                Добавить
              </Button>
              <Button
                type="button"
                variant="outline"
                responsiveFull
                onClick={async () => {
                  setExportErr(null);
                  try {
                    await exportItemsCsv();
                  } catch (e) {
                    setExportErr(getErrorMessage(e));
                  }
                }}
              >
                Экспорт CSV
              </Button>
              <Link className={styles.actionLink} to={`/reports/labels?${searchParams.toString()}`}>
                QR-этикетки
              </Link>
              {selectedIds.length > 0 && (
                <Link className={styles.actionLink} to={`/reports/labels?ids=${selectedIds.join(",")}`}>
                  QR выбранных ({selectedIds.length})
                </Link>
              )}
              <Button
                type="button"
                variant="outline"
                responsiveFull
                disabled={selectedIds.length === 0}
                title={
                  selectedIds.length === 0
                    ? "Отметьте строки в таблице чекбоксами"
                    : `Выбрано строк: ${selectedIds.length}`
                }
                onClick={() => {
                  setBulkErr(null);
                  setBulkLocation("");
                  setBulkCategoryId("");
                  setBulkOpen(true);
                }}
              >
                Выбранным: локация и категория
              </Button>
            </>
          ) : null
        }
      />

      <div className={styles.toolbar}>
        <Input
          id="items-search"
          label="Поиск"
          type="search"
          placeholder="Название или описание"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className={styles.filters} role="group" aria-label="Фильтр остатков">
        <Button
          type="button"
          variant={stockFilter === "all" ? "primary" : "outline"}
          responsiveFull
          onClick={() => setStockFilter("all")}
        >
          Все
        </Button>
        <Button
          type="button"
          variant={stockFilter === "low" ? "primary" : "outline"}
          responsiveFull
          onClick={() => setStockFilter("low")}
        >
          Ниже минимума
        </Button>
        {isAdmin && (
          <Button
            type="button"
            variant={includeRetired ? "primary" : "outline"}
            responsiveFull
            onClick={() => setIncludeRetired((v) => !v)}
          >
            Списанные
          </Button>
        )}
        <Button
          type="button"
          variant={replacementRemind ? "primary" : "outline"}
          responsiveFull
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            if (replacementRemind) next.delete("replacement_remind");
            else next.set("replacement_remind", "1");
            setSearchParams(next);
          }}
        >
          Срок замены
        </Button>
        <Button type="button" variant={allVisibleSelected ? "primary" : "outline"} responsiveFull onClick={toggleSelectVisible}>
          {allVisibleSelected ? "Снять выбор" : "Выбрать видимые"}
        </Button>
      </div>

      {summary !== null && summary.items_low_stock > 0 ? (
        <div className={styles.lowStockBanner} role="status">
          <strong>Мало на складе:</strong>
          <span>
            {summary.items_low_stock.toLocaleString("ru-RU")} поз. ниже минимального остатка.
          </span>
          <button
            type="button"
            className={styles.lowStockAction}
            onClick={() => {
              setStockFilter("low");
              setPage(1);
            }}
          >
            Показать список
          </button>
        </div>
      ) : null}

      {exportErr && <Alert>{exportErr}</Alert>}
      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className={styles.desktopOnly}>
            <TableScroll>
              <Table>
                <Thead>
                  <Tr>
                    <Th>
                      <input
                        type="checkbox"
                        className={styles.pick}
                        checked={allVisibleSelected}
                        onChange={toggleSelectVisible}
                        aria-label="Выбрать все видимые"
                      />
                    </Th>
                    <Th>Фото</Th>
                    <SortTh active={sortKey === "name"} direction={sortDir} onToggle={() => toggleSort("name")}>
                      Название
                    </SortTh>
                    <Th>SKU</Th>
                    <Th>Категория</Th>
                    <Th>Локация</Th>
                    <SortTh
                      active={sortKey === "quantity"}
                      direction={sortDir}
                      onToggle={() => toggleSort("quantity")}
                    >
                      Количество
                    </SortTh>
                    <Th>Статус</Th>
                    <SortTh
                      active={sortKey === "purchase_date"}
                      direction={sortDir}
                      onToggle={() => toggleSort("purchase_date")}
                    >
                      Дата покупки
                    </SortTh>
                    {isAdmin && <Th />}
                  </Tr>
                </Thead>
                <Tbody>
                  {items.map((it) => (
                    <Tr key={it.id}>
                      <Td>
                        <input
                          type="checkbox"
                          className={styles.pick}
                          checked={selectedIds.includes(it.id)}
                          onChange={() => toggleSelect(it.id)}
                          aria-label={`Выбрать ${it.name}`}
                        />
                      </Td>
                      <Td>
                        {it.image_url?.trim() ? (
                          <ItemImage className={styles.thumb} src={it.image_url} alt="" />
                        ) : (
                          <span className={styles.thumbDash}>—</span>
                        )}
                      </Td>
                      <Td>
                        <Link className={styles.cellLink} to={`/items/${it.id}`}>
                          {it.name}
                        </Link>
                      </Td>
                      <Td>{it.sku}</Td>
                      <Td className={styles.nowrapCell}>{it.category}</Td>
                      <Td className={styles.nowrapCell}>{it.location}</Td>
                      <Td>{it.quantity}</Td>
                      <Td className={styles.nowrapCell}>
                        {it.retired_at ? (
                          <span className={styles.retiredMark}>Списано</span>
                        ) : (
                          <StatusBadge kind={it.quantity <= it.min_quantity ? "mismatch" : "pending"} />
                        )}
                      </Td>
                      <Td>{it.purchase_date.slice(0, 10)}</Td>
                      {isAdmin && (
                        <Td className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.textBtn}
                            onClick={() => {
                              setEditing(it);
                              setModalOpen(true);
                            }}
                          >
                            Изменить
                          </button>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={async () => {
                              if (!confirm(`Удалить «${it.name}»?`)) return;
                              try {
                                await deleteItem(it.id);
                                void load();
                              } catch (e) {
                                alert(getErrorMessage(e));
                              }
                            }}
                          >
                            Удалить
                          </Button>
                        </Td>
                      )}
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableScroll>
          </div>

          <div className={styles.mobileCards}>
            {items.map((it) => (
              <article key={it.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <label className={styles.pickInline}>
                    <input
                      type="checkbox"
                      className={styles.pick}
                      checked={selectedIds.includes(it.id)}
                      onChange={() => toggleSelect(it.id)}
                      aria-label={`Выбрать ${it.name}`}
                    />
                    <span>Выбрать</span>
                  </label>
                  <Link className={styles.cardTitle} to={`/items/${it.id}`}>
                    {it.name}
                  </Link>
                  {it.retired_at ? (
                    <span className={styles.retiredMark}>Списано</span>
                  ) : (
                    <StatusBadge kind={it.quantity <= it.min_quantity ? "mismatch" : "pending"} />
                  )}
                </div>
                {it.image_url?.trim() ? (
                  <ItemImage className={styles.cardThumb} src={it.image_url} alt="" />
                ) : null}
                <div className={styles.cardMeta}>
                  <span>SKU: {it.sku}</span>
                  <span>{it.category}</span>
                </div>
                <div className={styles.cardMeta}>
                  <span>Локация: {it.location}</span>
                  <span>
                    Кол-во: {it.quantity} {it.unit}
                  </span>
                  <span>Мин: {it.min_quantity}</span>
                  <span>{it.purchase_date.slice(0, 10)}</span>
                </div>
                {isAdmin && (
                  <div className={styles.cardActions}>
                    <Button
                      type="button"
                      variant="outline"
                      responsiveFull
                      onClick={() => {
                        setEditing(it);
                        setModalOpen(true);
                      }}
                    >
                      Изменить
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      responsiveFull
                      onClick={async () => {
                        if (!confirm(`Удалить «${it.name}»?`)) return;
                        try {
                          await deleteItem(it.id);
                          void load();
                        } catch (e) {
                          alert(getErrorMessage(e));
                        }
                      }}
                    >
                      Удалить
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Назад
              </Button>
              <span className={styles.pageInfo}>
                Стр. {page} из {totalPages} ({total} записей)
                {stockFilter === "low" ? " · Фильтр: ниже минимума" : ""}
                {isAdmin && includeRetired ? " · Включая списанные" : ""}
                {replacementRemind ? " · Фильтр: срок замены" : ""}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Вперёд
              </Button>
            </div>
          )}
        </>
      )}

      {!loading && items.length === 0 && !error && <p className={styles.empty}>Ничего не найдено.</p>}

      <ItemFormModal
        open={modalOpen}
        item={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSaved={() => void load()}
      />

      <Modal
        open={bulkOpen}
        title="Локация и категория для выбранных строк"
        onClose={() => !bulkSaving && setBulkOpen(false)}
        footer={
          <>
            <Button type="button" variant="outline" disabled={bulkSaving} onClick={() => setBulkOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={
                bulkSaving ||
                selectedIds.length === 0 ||
                (!bulkLocation.trim() && !bulkCategoryId)
              }
              onClick={() => {
                void (async () => {
                  setBulkSaving(true);
                  setBulkErr(null);
                  try {
                    await bulkUpdateMeta({
                      ids: selectedIds,
                      location: bulkLocation.trim() || undefined,
                      category_id: bulkCategoryId || undefined,
                    });
                    setBulkOpen(false);
                    void refreshDashboardSummary();
                    void load();
                  } catch (err) {
                    setBulkErr(getErrorMessage(err));
                  } finally {
                    setBulkSaving(false);
                  }
                })();
              }}
            >
              {bulkSaving ? "Сохранение…" : "Применить"}
            </Button>
          </>
        }
      >
        <p className={styles.modalHint}>Выбрано объектов: {selectedIds.length}. Заполните хотя бы одно поле.</p>
        {bulkErr ? <Alert>{bulkErr}</Alert> : null}
        <div className={styles.modalField}>
          <Input
            id="bulk-location"
            label="Локация"
            value={bulkLocation}
            onChange={(e) => setBulkLocation(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className={styles.modalField}>
          <label className={styles.bulkLabel} htmlFor="bulk-category">
            Категория (справочник)
          </label>
          <select
            id="bulk-category"
            className={styles.bulkSelect}
            value={bulkCategoryId}
            onChange={(e) => setBulkCategoryId(e.target.value)}
          >
            <option value="">— не менять —</option>
            {bulkCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}

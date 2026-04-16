import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteItem, exportItemsCsv, fetchItems } from "../api/items.api";
import type { Item } from "../types";
import { ItemFormModal } from "../components/items/ItemFormModal";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
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
import { useAuth } from "../context/AuthContext";
import { useClientPagination } from "../hooks/useClientPagination";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { getErrorMessage } from "../utils/errors";
import styles from "./ItemsPage.module.css";

const PAGE_SIZE = 12;

type SortKey = "name" | "quantity" | "purchase_date";

export function ItemsPage() {
  const { isAdmin } = useAuth();
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

  const sortedItems = useMemo(() => {
    const arr = [...items];
    const m = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      if (sortKey === "name") return m * a.name.localeCompare(b.name, "ru");
      if (sortKey === "quantity") return m * (a.quantity - b.quantity);
      return m * a.purchase_date.localeCompare(b.purchase_date);
    });
    return arr;
  }, [items, sortKey, sortDir]);

  const { page, setPage, totalPages, pageItems } = useClientPagination(sortedItems, PAGE_SIZE, debouncedQ);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchItems(debouncedQ || undefined));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Объекты учёта</h1>
          <p className={styles.subtitle}>Номенклатура, количества, статус проверки в инвентаризации</p>
        </div>
        <div className={styles.actions}>
          {isAdmin && (
            <>
              <Button
                type="button"
                variant="primary"
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
            </>
          )}
        </div>
      </header>

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
                    <SortTh active={sortKey === "name"} direction={sortDir} onToggle={() => toggleSort("name")}>
                      Название
                    </SortTh>
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
                  {pageItems.map((it) => (
                    <Tr key={it.id}>
                      <Td>
                        <Link className={styles.cellLink} to={`/items/${it.id}`}>
                          {it.name}
                        </Link>
                      </Td>
                      <Td>{it.quantity}</Td>
                      <Td>
                        <StatusBadge kind="pending" />
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
            {pageItems.map((it) => (
              <article key={it.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <Link className={styles.cardTitle} to={`/items/${it.id}`}>
                    {it.name}
                  </Link>
                  <StatusBadge kind="pending" />
                </div>
                <div className={styles.cardMeta}>
                  <span>Кол-во: {it.quantity}</span>
                  <span>{it.purchase_date.slice(0, 10)}</span>
                </div>
                {isAdmin && (
                  <div className={styles.cardActions}>
                    <Button
                      type="button"
                      variant="outline"
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
                Стр. {page} из {totalPages} ({sortedItems.length} записей)
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
    </div>
  );
}

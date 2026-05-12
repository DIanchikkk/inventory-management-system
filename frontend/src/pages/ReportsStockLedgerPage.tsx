import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchGlobalStockLedger } from "../api/inventory.api";
import type { GlobalStockLedgerRow } from "../types";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";
import { Table, TableScroll, Tbody, Td, Th, Thead, Tr } from "../components/ui/Table";
import { getErrorMessage } from "../utils/errors";
import styles from "./ReportsStockLedgerPage.module.css";

const PAGE_SIZE = 30;

export function ReportsStockLedgerPage() {
  const [rows, setRows] = useState<GlobalStockLedgerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGlobalStockLedger(p, PAGE_SIZE);
      setRows(data.rows as GlobalStockLedgerRow[]);
      setTotal(data.total);
      setPage(data.page);
    } catch (e) {
      setError(getErrorMessage(e));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link className={styles.backLink} to="/reports">
          ← К отчётам
        </Link>
      </p>
      <PageHeader
        title="Реестр движений остатков"
        subtitle="Списания и оприходования по проведённым документам инвентаризации. Обычный пользователь видит записи по своим документам; администратор — по всем."
      />
      <p className={styles.lead}>
        Каждая строка фиксирует, <strong>на основании какого документа</strong> и <strong>когда</strong> изменился остаток
        объекта учёта. Ссылка ведёт к проведённому документу, где можно сверить учётное и фактическое количество.
      </p>

      <div className={styles.metrics}>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Записей в реестре (всего)</p>
          <p className={styles.metricValue}>{total.toLocaleString("ru-RU")}</p>
        </article>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>На странице</p>
          <p className={styles.metricValue}>{rows.length}</p>
        </article>
      </div>

      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}

      {!loading && rows.length === 0 && !error && <p className={styles.empty}>Записей пока нет (нет проведённых документов с расхождениями).</p>}

      {!loading && rows.length > 0 && (
        <>
          <div className={styles.desktopOnly}>
            <TableScroll>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Время</Th>
                    <Th>Документ</Th>
                    <Th>Объект</Th>
                    <Th>Вид</Th>
                    <Th>Учётное</Th>
                    <Th>Факт</Th>
                    <Th>Было → стало</Th>
                    <Th>Δ</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  {rows.map((row) => (
                    <Tr key={row.id}>
                      <Td>{new Date(row.created_at).toLocaleString("ru-RU")}</Td>
                      <Td>{row.document_no || "—"}</Td>
                      <Td>
                        {row.item_sku} · {row.item_name}
                      </Td>
                      <Td>{row.movement_label}</Td>
                      <Td>{row.accounting_qty}</Td>
                      <Td>{row.actual_qty}</Td>
                      <Td>
                        {row.balance_before} → {row.balance_after}
                      </Td>
                      <Td>{row.delta > 0 ? `+${row.delta}` : row.delta}</Td>
                      <Td>
                        <Link className={styles.cardLink} to={`/inventory/sessions/${row.session_id}`}>
                          Документ
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableScroll>
          </div>

          <div className={styles.mobileCards}>
            {rows.map((row) => (
              <article key={row.id} className={styles.card}>
                <p className={styles.cardDoc}>{row.document_no || "—"}</p>
                <p className={styles.cardTime}>{new Date(row.created_at).toLocaleString("ru-RU")}</p>
                <p className={styles.cardItem}>
                  {row.item_sku} · {row.item_name}
                </p>
                <p className={styles.cardMeta}>
                  {row.movement_label}: учётн. {row.accounting_qty}, факт {row.actual_qty}. Было {row.balance_before} → стало{" "}
                  {row.balance_after} (Δ {row.delta > 0 ? `+${row.delta}` : row.delta})
                </p>
                <Link className={styles.cardLink} to={`/inventory/sessions/${row.session_id}`}>
                  Открыть документ инвентаризации
                </Link>
              </article>
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <Button type="button" variant="outline" disabled={page <= 1} onClick={() => void load(page - 1)}>
                Назад
              </Button>
              <span className={styles.pageInfo}>
                Стр. {page} из {totalPages} · всего записей {total}
              </span>
              <Button type="button" variant="outline" disabled={page >= totalPages} onClick={() => void load(page + 1)}>
                Вперёд
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchGlobalStockAdjustments } from "@/shared/api/inventory.api";
import { AdjustmentDocsColumns } from "@/features/inventory/components/AdjustmentDocsColumns";
import type { StockAdjustmentSummary } from "@/shared/types";
import { Alert } from "@/shared/components/ui/Alert";
import { Button } from "@/shared/components/ui/Button";
import { PageHeader } from "@/shared/components/ui/PageHeader";
import { Spinner } from "@/shared/components/ui/Spinner";
import { Table, TableScroll, Tbody, Td, Th, Thead, Tr } from "@/shared/components/ui/Table";
import { getErrorMessage } from "@/shared/utils/errors";
import styles from "./ReportsStockAdjustmentsPage.module.css";

const PAGE_SIZE = 30;

export function ReportsStockAdjustmentsPage() {
  const [docs, setDocs] = useState<StockAdjustmentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGlobalStockAdjustments(p, PAGE_SIZE);
      setDocs(data.documents);
      setTotal(data.total);
      setPage(data.page);
    } catch (e) {
      setError(getErrorMessage(e));
      setDocs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const writeOffDocs = useMemo(() => docs.filter((d) => d.movement === "write_off"), [docs]);
  const receiptDocs = useMemo(() => docs.filter((d) => d.movement === "receipt"), [docs]);

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link className={styles.backLink} to="/reports">
          ← К отчётам
        </Link>
      </p>
      <PageHeader title="Документы списания и оприходования" />
      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}
      {!loading && !error && (
        <>
          <AdjustmentDocsColumns documents={docs} />
          {docs.length === 0 ? <p className={styles.empty}>Документов пока нет.</p> : null}
          {docs.length > 0 ? (
            <>
          <h2 className={styles.tableTitle}>Все документы</h2>
          <TableScroll>
            <Table>
              <Thead>
                <Tr>
                  <Th>Номер</Th>
                  <Th>Вид</Th>
                  <Th>Регистратор</Th>
                  <Th>Строк</Th>
                  <Th>Дата</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {[...writeOffDocs, ...receiptDocs].map((d) => (
                  <Tr key={d.id}>
                    <Td className={styles.docNo}>{d.document_no}</Td>
                    <Td>{d.movement_label}</Td>
                    <Td>
                      <Link to={`/inventory/sessions/${d.session_id}`}>{d.registrator_document_no}</Link>
                    </Td>
                    <Td>{d.line_count}</Td>
                    <Td>{new Date(d.created_at).toLocaleString("ru-RU")}</Td>
                    <Td>
                      <Link className={styles.openLink} to={`/reports/stock-adjustments/${d.id}`}>
                        Открыть
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableScroll>
          {totalPages > 1 && (
            <div className={styles.pager}>
              <Button type="button" variant="outline" disabled={page <= 1} onClick={() => void load(page - 1)}>
                Назад
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => void load(page + 1)}
              >
                Вперёд
              </Button>
            </div>
          )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

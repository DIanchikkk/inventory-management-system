import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchStockAdjustment } from "@/shared/api/inventory.api";
import { StockMovementBadge } from "@/features/inventory/components/StockMovementBadge";
import type { StockAdjustmentDetail } from "@/shared/types";
import { Alert } from "@/shared/components/ui/Alert";
import { PageHeader } from "@/shared/components/ui/PageHeader";
import { Spinner } from "@/shared/components/ui/Spinner";
import { Table, TableScroll, Tbody, Td, Th, Thead, Tr } from "@/shared/components/ui/Table";
import { getErrorMessage } from "@/shared/utils/errors";
import styles from "./StockAdjustmentDetailPage.module.css";

export function StockAdjustmentDetailPage() {
  const { adjustmentId } = useParams<{ adjustmentId: string }>();
  const [detail, setDetail] = useState<StockAdjustmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adjustmentId) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchStockAdjustment(adjustmentId));
    } catch (e) {
      setError(getErrorMessage(e));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [adjustmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const doc = detail?.document;

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link className={styles.backLink} to="/reports/stock-adjustments">
          ← К документам списания и оприходования
        </Link>
      </p>
      <PageHeader
        title={doc ? `${doc.movement_label} ${doc.document_no}` : "Документ корректировки"}
      />
      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}
      {!loading && doc && (
        <>
          <dl className={styles.meta}>
            <div>
              <dt>Вид документа</dt>
              <dd>
                <StockMovementBadge movement={doc.movement} label={doc.movement_label} />
              </dd>
            </div>
            <div>
              <dt>Документ-регистратор (инвентаризация)</dt>
              <dd>
                <Link to={`/inventory/sessions/${doc.session_id}`}>{detail.registrator_document_no}</Link>
              </dd>
            </div>
            <div>
              <dt>Строк</dt>
              <dd>{doc.line_count}</dd>
            </div>
            <div>
              <dt>Создан</dt>
              <dd>{new Date(doc.created_at).toLocaleString("ru-RU")}</dd>
            </div>
          </dl>
          {detail.lines.length === 0 ? (
            <p className={styles.empty}>Строк нет.</p>
          ) : (
            <TableScroll>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Объект</Th>
                    <Th>Учётное</Th>
                    <Th>Факт</Th>
                    <Th>Было → стало</Th>
                    <Th>Δ</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {detail.lines.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        {row.item_sku} · {row.item_name}
                      </Td>
                      <Td>{row.accounting_qty}</Td>
                      <Td>{row.actual_qty}</Td>
                      <Td>
                        {row.balance_before} → {row.balance_after}
                      </Td>
                      <Td>{row.delta > 0 ? `+${row.delta}` : row.delta}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableScroll>
          )}
        </>
      )}
    </div>
  );
}

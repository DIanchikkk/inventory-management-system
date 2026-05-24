import { Link } from "react-router-dom";
import { AdjustmentDocsColumns } from "@/features/inventory/components/AdjustmentDocsColumns";
import { StockMovementBadge } from "@/features/inventory/components/StockMovementBadge";
import type { SessionDetailPageModel } from "./types";
import common from "./sessionDetailCommon.module.css";
import page from "./SessionDetailPage.module.css";
import table from "./SessionDetailTable.module.css";
import styles from "./SessionDetailStockLedger.module.css";

type Props = { m: SessionDetailPageModel };

export function SessionDetailStockLedger({ m }: Props) {
  const { locked, stockLedgerPack, stockAdjustments, detail } = m;
  if (!locked) return null;

  const docNo =
    stockLedgerPack?.document_no?.trim() || detail?.session.document_no?.trim() || "—";
  const rows = stockLedgerPack?.rows ?? [];

  return (
    <>
      <p className={page.banner}>{m.archived ? "Документ в архиве." : "Документ проведён."}</p>
      <section className={styles.ledgerSection} aria-label="Документы корректировки остатков">
        <h2 className={styles.ledgerTitle}>Списание и оприходование · {docNo}</h2>
        <p className={`${styles.ledgerGlobalLink} ${common.noPrint}`}>
          <Link to="/reports/stock-adjustments">Все документы СП/ОП</Link>
          {" · "}
          <Link to="/reports/stock-ledger">Реестр движений</Link>
        </p>
        <AdjustmentDocsColumns documents={stockAdjustments} />
        <h3 className={styles.ledgerSubTitle}>Строки реестра</h3>
        {rows.length === 0 ? (
          <p className={styles.ledgerEmpty}>Записей в реестре нет.</p>
        ) : (
          <div className={styles.ledgerTableWrap}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th>Объект</th>
                  <th>Документ</th>
                  <th>Вид</th>
                  <th>Учётное</th>
                  <th>Факт</th>
                  <th>Было → стало</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.item_sku} · {row.item_name}
                    </td>
                    <td>
                      {row.adjustment_document_no ? (
                        row.adjustment_document_id ? (
                          <Link to={`/reports/stock-adjustments/${row.adjustment_document_id}`}>
                            {row.adjustment_document_no}
                          </Link>
                        ) : (
                          row.adjustment_document_no
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <StockMovementBadge movement={row.movement} label={row.movement_label} />
                    </td>
                    <td>{row.accounting_qty}</td>
                    <td>{row.actual_qty}</td>
                    <td>
                      {row.balance_before} → {row.balance_after}
                    </td>
                    <td>{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

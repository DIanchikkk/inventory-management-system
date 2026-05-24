import { Link } from "react-router-dom";
import type { StockAdjustmentSummary } from "@/shared/types";
import { StockMovementBadge } from "./StockMovementBadge";
import styles from "./AdjustmentDocsColumns.module.css";

type Props = {
  documents: StockAdjustmentSummary[];
};

function DocColumn({
  title,
  movement,
  documents,
}: {
  title: string;
  movement: "write_off" | "receipt";
  documents: StockAdjustmentSummary[];
}) {
  const items = documents.filter((d) => d.movement === movement);

  return (
    <div className={styles.column}>
      <h3 className={styles.columnTitle}>
        <StockMovementBadge
          movement={movement}
          label={movement === "write_off" ? "Списание" : "Оприходование"}
        />
        <span>{title}</span>
      </h3>
      {items.length === 0 ? (
        <p className={styles.columnEmpty}>Нет документа</p>
      ) : (
        <ul className={styles.list}>
          {items.map((d) => (
            <li key={d.id} className={styles.item}>
              <Link className={styles.docLink} to={`/reports/stock-adjustments/${d.id}`}>
                {d.document_no}
              </Link>
              <span className={styles.meta}>
                {d.line_count} {d.line_count === 1 ? "строка" : "строк"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Две колонки: документы списания (СП) и оприходования (ОП) рядом. */
export function AdjustmentDocsColumns({ documents }: Props) {
  return (
    <div className={styles.pair}>
      <DocColumn title="СП" movement="write_off" documents={documents} />
      <DocColumn title="ОП" movement="receipt" documents={documents} />
    </div>
  );
}

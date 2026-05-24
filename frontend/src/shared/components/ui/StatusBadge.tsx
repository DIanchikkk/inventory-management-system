import type { DiscrepancyKind } from "@/shared/utils/inventoryDisplay";
import styles from "./StatusBadge.module.css";

const labels: Record<DiscrepancyKind, string> = {
  match: "Совпадает",
  mismatch: "Расхождение",
  missing: "Отсутствует",
  pending: "Не проверено",
};

export function StatusBadge({ kind }: { kind: DiscrepancyKind }) {
  const mod =
    kind === "match"
      ? styles["status--match"]
      : kind === "mismatch"
        ? styles["status--mismatch"]
        : kind === "missing"
          ? styles["status--missing"]
          : styles["status--pending"];

  return <span className={`${styles.status} ${mod}`}>{labels[kind]}</span>;
}

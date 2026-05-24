import styles from "./StockMovementBadge.module.css";

type Props = {
  movement: string;
  label: string;
};

export function StockMovementBadge({ movement, label }: Props) {
  const mod =
    movement === "write_off" ? styles.writeOff : movement === "receipt" ? styles.receipt : styles.neutral;
  return (
    <span className={`${styles.badge} ${mod}`} title={label}>
      {label}
    </span>
  );
}

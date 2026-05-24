import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import styles from "./Table.module.css";

export type SortDirection = "asc" | "desc";

export function TableScroll({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.scroll} ${className}`.trim()}>{children}</div>;
}

export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <table className={`${styles.table} ${className}`.trim()}>{children}</table>;
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className={styles.thead}>{children}</thead>;
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={className}>{children}</tr>;
}

export function Th({ children, className = "", ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`${styles.th} ${className}`.trim()} {...rest}>
      {children}
    </th>
  );
}

export function SortTh({
  children,
  active,
  direction,
  onToggle,
  className = "",
  ...rest
}: Omit<ThHTMLAttributes<HTMLTableCellElement>, "children" | "scope"> & {
  children: ReactNode;
  active: boolean;
  direction: SortDirection;
  onToggle: () => void;
}) {
  const mark = active ? (direction === "asc" ? "\u2191" : "\u2193") : "\u2195";
  return (
    <th className={`${styles.th} ${styles.thSortable} ${className}`.trim()} scope="col" {...rest}>
      <button type="button" className={styles.sortBtn} onClick={onToggle}>
        <span>{children}</span>
        <span className={styles.sortMark} aria-hidden>
          {mark}
        </span>
      </button>
    </th>
  );
}

export function Td({ children, className = "", ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`${styles.td} ${className}`.trim()} {...rest}>
      {children}
    </td>
  );
}

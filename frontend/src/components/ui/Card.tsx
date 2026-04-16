import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** max-width ~520px, centered */
  narrow?: boolean;
  /** max-width ~400px (login) */
  narrowSm?: boolean;
};

export function Card({
  children,
  narrow = false,
  narrowSm = false,
  className = "",
  ...rest
}: CardProps) {
  const mods = [
    styles.card,
    narrow ? styles["card--narrow"] : "",
    narrowSm ? styles["card--narrow-sm"] : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={mods} {...rest}>
      {children}
    </div>
  );
}

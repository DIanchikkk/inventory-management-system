import type { HTMLAttributes } from "react";
import styles from "./Spinner.module.css";

export type SpinnerProps = HTMLAttributes<HTMLParagraphElement> & {
  inline?: boolean;
};

export function Spinner({ inline = false, className = "", ...rest }: SpinnerProps) {
  return (
    <p
      className={[styles.spinner, inline ? styles["spinner--inline"] : "", className]
        .filter(Boolean)
        .join(" ")}
      aria-live="polite"
      {...rest}
    >
      Загрузка…
    </p>
  );
}

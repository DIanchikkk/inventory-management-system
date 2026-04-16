import type { HTMLAttributes, ReactNode } from "react";
import styles from "./MutedText.module.css";

export function MutedText({ children, className = "", ...rest }: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return (
    <span className={[styles.muted, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </span>
  );
}

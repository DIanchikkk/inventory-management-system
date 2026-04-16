import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Alert.module.css";

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: "error";
};

export function Alert({
  children,
  variant = "error",
  className = "",
  role = "alert",
  ...rest
}: AlertProps) {
  const mod = variant === "error" ? styles["alert--error"] : "";
  return (
    <div className={[styles.alert, mod, className].filter(Boolean).join(" ")} role={role} {...rest}>
      {children}
    </div>
  );
}

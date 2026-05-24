import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Alert.module.css";

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: "error" | "success";
};

export function Alert({
  children,
  variant = "error",
  className = "",
  role,
  ...rest
}: AlertProps) {
  const defaultRole = variant === "success" ? "status" : "alert";
  const mod =
    variant === "error" ? styles["alert--error"] : variant === "success" ? styles["alert--success"] : "";
  return (
    <div className={[styles.alert, mod, className].filter(Boolean).join(" ")} role={role ?? defaultRole} {...rest}>
      {children}
    </div>
  );
}

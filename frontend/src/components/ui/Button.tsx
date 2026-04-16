import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
  /** Full width on phones; normal width from 480px */
  responsiveFull?: boolean;
};

export function Button({
  variant = "outline",
  responsiveFull = false,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  const mod =
    variant === "primary"
      ? styles["button--primary"]
      : variant === "secondary"
        ? styles["button--secondary"]
        : variant === "ghost"
          ? styles["button--ghost"]
          : variant === "danger"
            ? styles["button--danger"]
            : styles["button--outline"];

  const full = responsiveFull ? styles["button--responsive-full"] : "";

  return (
    <button
      type={type}
      className={[styles.button, mod, full, className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}

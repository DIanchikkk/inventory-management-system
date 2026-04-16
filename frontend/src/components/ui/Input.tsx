import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./Input.module.css";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  hint?: ReactNode;
  /** Текст ошибки: бордер и подпись */
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, id, hint, error, className = "", ...inputProps },
  ref,
) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {hint && <span className={styles.hint}>{hint}</span>}
      <input
        ref={ref}
        id={id}
        className={[styles.input, error ? styles.inputError : "", className].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        {...inputProps}
      />
      {error && (
        <span id={`${id}-err`} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
});

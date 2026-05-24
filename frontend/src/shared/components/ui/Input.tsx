import { forwardRef, type InputHTMLAttributes, type ReactNode, useState } from "react";
import styles from "./Input.module.css";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  hint?: ReactNode;
  error?: string;
  passwordToggle?: boolean;
};

function IconEye() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M1 1l22 22" strokeLinecap="round" />
    </svg>
  );
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, id, hint, error, className = "", passwordToggle = false, ...inputProps },
  ref,
) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const usePwToggle = passwordToggle && inputProps.type === "password";
  const inputType = usePwToggle ? (passwordVisible ? "text" : "password") : inputProps.type;

  const inputClass = [
    styles.input,
    usePwToggle ? styles.inputWithToggle : "",
    error ? styles.inputError : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const control = (
    <input
      ref={ref}
      id={id}
      className={inputClass}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-err` : undefined}
      {...inputProps}
      type={inputType}
    />
  );

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {hint && <span className={styles.hint}>{hint}</span>}
      {usePwToggle ? (
        <div className={styles.inputWrap}>
          {control}
          <button
            type="button"
            className={styles.passwordToggleBtn}
            aria-label={passwordVisible ? "Скрыть пароль" : "Показать пароль"}
            aria-pressed={passwordVisible}
            onClick={() => setPasswordVisible((v) => !v)}
          >
            {passwordVisible ? <IconEye /> : <IconEyeOff />}
          </button>
        </div>
      ) : (
        control
      )}
      {error && (
        <span id={`${id}-err`} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
});

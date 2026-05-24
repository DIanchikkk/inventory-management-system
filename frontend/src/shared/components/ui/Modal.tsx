import { type ReactNode, useEffect } from "react";
import styles from "./Modal.module.css";

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  titleId?: string;
  /** Закрытие кликом по затемнённому фону (по умолчанию выкл.). */
  closeOnBackdrop?: boolean;
};

export function Modal({
  open,
  title,
  children,
  footer,
  onClose,
  titleId = "modal-title",
  closeOnBackdrop = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.titleRow}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}

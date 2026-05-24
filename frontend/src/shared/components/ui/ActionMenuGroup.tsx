import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, type LinkProps } from "react-router-dom";
import { Button, type ButtonProps } from "./Button";
import styles from "./ActionMenuGroup.module.css";

type Variant = NonNullable<ButtonProps["variant"]>;

type PanelAlign = "start" | "end";

type Props = {
  label: string;
  triggerLabel: string;
  triggerVariant?: Variant;
  /** Куда раскрывать меню относительно кнопки (end — по правому краю кнопки). */
  panelAlign?: PanelAlign;
  disabled?: boolean;
  children: ReactNode;
};

function wrapItem(child: ReactNode, onClose: () => void): ReactNode {
  if (!isValidElement(child)) return child;
  const el = child as ReactElement<{ onClick?: (e: React.MouseEvent) => void; className?: string }>;
  const prev = el.props.onClick;
  return cloneElement(el, {
    className: [el.props.className, styles.menuItem].filter(Boolean).join(" "),
    onClick: (e: React.MouseEvent) => {
      prev?.(e);
      if (!e.defaultPrevented) onClose();
    },
  });
}

/** Группа действий: одна кнопка, остальные — выпадающим списком вниз по клику. */
export function ActionMenuGroup({
  label,
  triggerLabel,
  triggerVariant = "outline",
  panelAlign = "start",
  disabled = false,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const items = Children.toArray(children).filter(Boolean);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;

    function place() {
      const trigger = rootRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const gap = 6;

      const style: CSSProperties = {
        position: "fixed",
        top: rect.bottom + gap,
        minWidth: Math.max(rect.width, 200),
        zIndex: 200,
      };

      if (panelAlign === "end") {
        style.left = rect.right;
        style.transform = "translateX(-100%)";
      } else {
        style.left = rect.left;
      }

      setPanelStyle(style);
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, panelAlign, items.length]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  if (items.length === 1) {
    return <div className={styles.single}>{items[0]}</div>;
  }

  const close = () => {
    setOpen(false);
    setPanelStyle(null);
  };

  const panel =
    open && panelStyle ? (
      <div ref={panelRef} className={styles.panelShell} style={panelStyle}>
        <div id={menuId} role="menu" aria-label={label} className={styles.panelFloating}>
          {items.map((child, i) => (
            <div key={i} role="none">
              {wrapItem(child, close)}
            </div>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={styles.group}>
      <Button
        type="button"
        variant={triggerVariant}
        disabled={disabled}
        className={[
          styles.trigger,
          open && triggerVariant === "outline" ? styles.triggerOpen : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((v) => {
            if (v) setPanelStyle(null);
            return !v;
          });
        }}
      >
        <span>{triggerLabel}</span>
        <span className={[styles.chevron, open ? styles.chevronOpen : ""].filter(Boolean).join(" ")} aria-hidden>
          ▾
        </span>
      </Button>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

export function ActionMenuLink({ className = "", ...rest }: LinkProps) {
  return <Link className={[styles.menuLink, className].filter(Boolean).join(" ")} {...rest} />;
}

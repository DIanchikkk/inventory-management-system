import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout as authLogout } from "@/shared/api/auth.api";
import { fetchDashboardSummary } from "@/shared/api/dashboard.api";
import type { DashboardSummary } from "@/shared/types";
import { useAuth } from "@/shared/context/useAuth";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import styles from "./DashboardLayout.module.css";

export type DashboardOutletContext = {
  dashboardSummary: DashboardSummary | null;
  refreshDashboardSummary: () => Promise<void>;
};

async function fetchDashboardSummarySafe(): Promise<DashboardSummary | null> {
  try {
    return await fetchDashboardSummary();
  } catch {
    return null;
  }
}

function IconBox({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconGear({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function NavItem({
  to,
  icon,
  children,
  onNavigate,
}: {
  to: string;
  icon: ReactNode;
  children: ReactNode;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [styles.navItem, isActive ? styles.navActive : styles.navLink].filter(Boolean).join(" ")
      }
      onClick={onNavigate}
    >
      {icon}
      <span className={styles.navLabel}>{children}</span>
    </NavLink>
  );
}

function badgeFromUsername(username: string): string {
  const parts = username
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  const plain = parts[0] ?? "";
  return plain.slice(0, 2).toUpperCase() || "U";
}

export function DashboardLayout() {
  const nav = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 960px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, refreshUser, setUser } = useAuth();
  const location = useLocation();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const narrow = isDesktop && sidebarCollapsed;
  const userBadgeText = user ? (user.role === "admin" ? "A" : badgeFromUsername(user.username)) : "U";

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const refreshDashboardSummary = useCallback(async () => {
    const s = await fetchDashboardSummarySafe();
    if (s !== null) setSummary(s);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchDashboardSummarySafe().then((s) => {
      if (!cancelled && s !== null) setSummary(s);
    });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  function doLogout() {
    authLogout();
    setUser(null);
    nav("/login", { replace: true });
  }

  useEffect(() => {
    if (!userMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [userMenuOpen]);

  function closeMobileNav() {
    if (!isDesktop) setSidebarOpen(false);
  }

  return (
    <div className={styles.shell}>
      {!isDesktop && sidebarOpen && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Закрыть меню"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        id="app-sidebar"
        className={[
          styles.sidebar,
          !isDesktop && sidebarOpen ? styles.sidebarOpen : "",
          narrow ? styles.sidebarNarrow : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Основная навигация"
      >
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden />
          <div className={styles.brandText}>
            <div className={styles.brandTitle}>Inventory</div>
            <div className={styles.brandSub}>Учёт объектов и инвентаризация</div>
          </div>
        </div>
        <nav className={styles.nav}>
          <NavItem to="/items" icon={<IconBox className={styles.navIcon} />} onNavigate={closeMobileNav}>
            Объекты учёта
          </NavItem>
          <NavItem
            to="/inventory/sessions"
            icon={<IconClipboard className={styles.navIcon} />}
            onNavigate={closeMobileNav}
          >
            Документы инвентаризации
          </NavItem>
          <NavItem to="/reports" icon={<IconChart className={styles.navIcon} />} onNavigate={closeMobileNav}>
            Отчёты
          </NavItem>
          <NavItem to="/settings" icon={<IconGear className={styles.navIcon} />} onNavigate={closeMobileNav}>
            Настройки
          </NavItem>
        </nav>
        {isDesktop && (
          <div className={styles.sidebarFooter}>
            <button
              type="button"
              className={styles.collapseBtn}
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-expanded={!sidebarCollapsed}
              aria-controls="app-sidebar"
            >
              <span className={styles.collapseIcon} aria-hidden>
                {sidebarCollapsed ? "⟩" : "⟨"}
              </span>
              <span className={styles.collapseLabel}>{sidebarCollapsed ? "Развернуть" : "Свернуть"}</span>
            </button>
          </div>
        )}
      </aside>

      <div className={styles.column}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            {!isDesktop && (
              <button
              type="button"
              className={styles.menuBtn}
              aria-expanded={sidebarOpen}
              aria-controls="app-sidebar"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              ☰
            </button>
            )}
            <span className={styles.headerCrumb}>
              {location.pathname.startsWith("/reports")
                ? "Отчёты"
                : location.pathname.startsWith("/settings")
                  ? "Настройки"
                  : location.pathname.startsWith("/inventory")
                    ? "Документы инвентаризации"
                    : "Объекты учёта"}
            </span>
          </div>
          <div className={styles.headerRight}>
            {user && (
              <div className={styles.userMenuWrap} ref={userMenuRef}>
                {user.role === "admin" && <span className={styles.userRoleInline}>Администратор</span>}
                <button
                  type="button"
                  className={styles.userMenuBtn}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  title={user.username}
                >
                  {userBadgeText}
                </button>
                {userMenuOpen && (
                  <div className={styles.userMenu} role="menu" aria-label="Меню пользователя">
                    <p className={styles.userMenuName}>{user.username}</p>
                    <button type="button" className={styles.userMenuItem} onClick={() => nav("/settings")}>
                      Настройки
                    </button>
                    <div className={styles.userMenuDivider} />
                    <button type="button" className={`${styles.userMenuItem} ${styles.userMenuItemDanger}`} onClick={doLogout}>
                      Выйти
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        <main className={styles.main}>
          <div className={styles.mainInner}>
            {summary && (
              <section className={styles.summaryStrip} aria-label="Сводка по системе">
                <span className={styles.summaryStripTitle}>Сводка:</span>
                <span className={styles.summaryMetric}>
                  объектов учёта <strong>{summary.items_total.toLocaleString("ru-RU")}</strong>
                </span>
                <span className={styles.summaryMetric}>
                  ниже мин. остатка <strong>{summary.items_low_stock.toLocaleString("ru-RU")}</strong>
                </span>
                <span className={styles.summaryMetric}>
                  сессий в работе <strong>{summary.sessions_active_or_review.toLocaleString("ru-RU")}</strong>
                </span>
                <span className={styles.summaryMetric}>
                  завершено <strong>{summary.sessions_completed.toLocaleString("ru-RU")}</strong>
                </span>
                <span className={styles.summaryMetric}>
                  в архиве <strong>{summary.sessions_archived.toLocaleString("ru-RU")}</strong>
                </span>
                <Link
                  className={[
                    styles.summaryMetric,
                    styles.summaryRemind,
                    (summary.items_replacement_overdue ?? 0) > 0 ? styles.summaryRemindUrgent : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  to="/items?replacement_remind=1"
                  title="Открыть объекты с наступившим или близким сроком замены"
                >
                  замена просрочена{" "}
                  <strong>{(summary.items_replacement_overdue ?? 0).toLocaleString("ru-RU")}</strong>
                  {" · "}
                  до 90 дн.{" "}
                  <strong>{(summary.items_replacement_due_soon ?? 0).toLocaleString("ru-RU")}</strong>
                </Link>
              </section>
            )}
            <Outlet context={{ dashboardSummary: summary, refreshDashboardSummary } satisfies DashboardOutletContext} />
          </div>
        </main>
      </div>
    </div>
  );
}

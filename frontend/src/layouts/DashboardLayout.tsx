import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout as authLogout } from "../api/auth.api";
import { useAuth } from "../context/AuthContext";
import { useMediaQuery } from "../hooks/useMediaQuery";
import styles from "./DashboardLayout.module.css";

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

export function DashboardLayout() {
  const nav = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 960px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, refreshUser, setUser } = useAuth();
  const location = useLocation();

  const narrow = isDesktop && sidebarCollapsed;

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  function doLogout() {
    authLogout();
    setUser(null);
    nav("/login", { replace: true });
  }

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
            <div className={styles.brandSub}>Производственный учёт</div>
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
            Инвентаризация
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
                Меню
              </button>
            )}
            <span className={styles.headerCrumb}>
              {location.pathname.startsWith("/reports")
                ? "Отчёты"
                : location.pathname.startsWith("/settings")
                  ? "Настройки"
                  : location.pathname.startsWith("/inventory")
                    ? "Инвентаризация"
                    : "Объекты учёта"}
            </span>
          </div>
          <div className={styles.headerRight}>
            {user && (
              <div className={styles.user}>
                <span className={styles.userName}>{user.username}</span>
                <span className={styles.userRole}>
                  {user.role === "admin" ? "Администратор" : "Пользователь"}
                </span>
              </div>
            )}
            <button type="button" className={styles.logoutBtn} onClick={doLogout}>
              Выйти
            </button>
          </div>
        </header>
        <main className={styles.main}>
          <div className={styles.mainInner}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

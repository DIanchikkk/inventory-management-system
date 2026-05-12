import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/auth.api";
import { useAuth } from "../context/useAuth";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { getErrorMessage } from "../utils/errors";
import styles from "./LoginPage.module.css";

const DARK_BG_KEY = "inventory-login-dark";

function readDarkPreference(): boolean {
  try {
    return localStorage.getItem(DARK_BG_KEY) === "1";
  } catch {
    return false;
  }
}

function IconMoon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

export function LoginPage() {
  const nav = useNavigate();
  const { setUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [darkBg, setDarkBg] = useState(readDarkPreference);

  function toggleDarkBg() {
    setDarkBg((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DARK_BG_KEY, next ? "1" : "0");
      } catch {
        void 0;
      }
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login(username, password);
      setUser(data.user);
      nav("/items", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={[styles.wrap, darkBg ? styles.wrapDark : ""].filter(Boolean).join(" ")}>
      <button
        type="button"
        className={styles.themeToggle}
        onClick={toggleDarkBg}
        aria-pressed={darkBg}
        title={darkBg ? "Обычный фон" : "Тёмный фон"}
        aria-label={darkBg ? "Переключить на обычный фон" : "Переключить на тёмный фон"}
      >
        {darkBg ? <IconSun /> : <IconMoon />}
      </button>
      <div className={styles.cardWrap}>
        <Card narrowSm>
          <h1 className={styles.title}>Вход в систему</h1>
          <p className={styles.lead}>Учёт объектов и инвентаризация</p>
          {error && <Alert>{error}</Alert>}
          <form onSubmit={onSubmit}>
            <Input
              id="login-user"
              label="Логин"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <Input
              id="login-pass"
              label="Пароль"
              type="password"
              passwordToggle
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Button type="submit" variant="primary" disabled={loading} responsiveFull>
              {loading ? "Вход…" : "Войти"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

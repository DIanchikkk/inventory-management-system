import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createSession, fetchSessions } from "../api/inventory.api";
import type { InventorySession } from "../types";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { Table, TableScroll, Tbody, Td, Th, Thead, Tr } from "../components/ui/Table";
import { getErrorMessage } from "../utils/errors";
import { sessionStatusLabel } from "../utils/inventoryDisplay";
import styles from "./InventorySessionsPage.module.css";

export function InventorySessionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const focusItemId = (location.state as { focusItemId?: string } | null)?.focusItemId;

  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSessions();
      list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setSessions(list);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusItemId || loading || sessions.length === 0) return;
    const actives = sessions
      .filter((s) => s.status === "active")
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const target = actives[0];
    if (target) {
      navigate(`/inventory/sessions/${target.id}`, { replace: true, state: { focusItemId } });
    }
  }, [focusItemId, loading, navigate, sessions]);

  async function onCreate() {
    setCreating(true);
    setError(null);
    try {
      const s = await createSession();
      const state = focusItemId ? { focusItemId } : undefined;
      navigate(`/inventory/sessions/${s.id}`, { state });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Инвентаризация</h1>
          <p className={styles.subtitle}>Сессии подсчёта: ожидаемое и фактическое количество</p>
        </div>
        <Button type="button" variant="primary" onClick={() => void onCreate()} disabled={creating}>
          {creating ? "Создание…" : "Новая сессия"}
        </Button>
      </header>

      {focusItemId && !loading && sessions.every((s) => s.status !== "active") && (
        <Alert>
          Нет активной сессии. Создайте новую — карточка объекта будет подсвечена после открытия сессии.
        </Alert>
      )}

      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}

      {!loading && sessions.length === 0 && (
        <p className={styles.empty}>Сессий пока нет. Нажмите «Новая сессия», чтобы начать.</p>
      )}

      {!loading && sessions.length > 0 && (
        <TableScroll>
          <Table>
            <Thead>
              <Tr>
                <Th>Создана</Th>
                <Th>Статус</Th>
                <Th>Создал</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {sessions.map((s) => (
                <Tr key={s.id}>
                  <Td>{new Date(s.created_at).toLocaleString("ru-RU")}</Td>
                  <Td>
                    <span
                      className={
                        s.status === "active"
                          ? styles.badgeActive
                          : s.status === "completed"
                            ? styles.badgeDone
                            : styles.badgeOther
                      }
                    >
                      {sessionStatusLabel(s.status)}
                    </span>
                  </Td>
                  <Td className={styles.muted}>{s.created_by}</Td>
                  <Td className={styles.rowAction}>
                    <Link
                      className={styles.openLink}
                      to={`/inventory/sessions/${s.id}`}
                      state={focusItemId ? { focusItemId } : undefined}
                    >
                      Открыть
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableScroll>
      )}
    </div>
  );
}

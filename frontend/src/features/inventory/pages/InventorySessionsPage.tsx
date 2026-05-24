import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createSession, fetchSessions } from "@/shared/api/inventory.api";
import type { InventorySession } from "@/shared/types";
import { Alert } from "@/shared/components/ui/Alert";
import { Button } from "@/shared/components/ui/Button";
import { PageHeader } from "@/shared/components/ui/PageHeader";
import { Spinner } from "@/shared/components/ui/Spinner";
import { Table, TableScroll, Tbody, Td, Th, Thead, Tr } from "@/shared/components/ui/Table";
import { getErrorMessage } from "@/shared/utils/errors";
import { sessionStatusLabel } from "@/shared/utils/inventoryDisplay";
import { sessionCreatorLabel } from "@/shared/utils/sessionDisplay";
import styles from "./InventorySessionsPage.module.css";

export function InventorySessionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const focusItemId = (location.state as { focusItemId?: string } | null)?.focusItemId;

  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSessions(page, 20);
      setSessions(data.sessions);
      setTotal(data.total);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / 20));

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
      <PageHeader
        title="Документы инвентаризации"
        actions={
          <Button type="button" variant="primary" responsiveFull onClick={() => void onCreate()} disabled={creating}>
            {creating ? "Создание…" : "Новый документ"}
          </Button>
        }
      />


      {focusItemId && !loading && sessions.every((s) => s.status !== "active") && (
        <Alert>Нет активного документа. Создайте новый.</Alert>
      )}

      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}

      {!loading && sessions.length === 0 && (
        <p className={styles.empty}>Документов пока нет. Нажмите «Новый документ», чтобы начать.</p>
      )}

      {!loading && sessions.length > 0 && (
        <>
          <div className={styles.desktopOnly}>
            <TableScroll>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Номер</Th>
                    <Th>Создана</Th>
                    <Th>Статус</Th>
                    <Th>Автор</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  {sessions.map((s) => (
                    <Tr key={s.id}>
                      <Td className={styles.docNoCell}>{s.document_no || "—"}</Td>
                      <Td>{new Date(s.created_at).toLocaleString("ru-RU")}</Td>
                      <Td>
                        <span
                          className={
                            s.status === "active"
                              ? styles.badgeActive
                              : s.status === "completed" || s.status === "archived"
                                ? styles.badgeDone
                                : styles.badgeOther
                          }
                        >
                          {sessionStatusLabel(s.status)}
                        </span>
                      </Td>
                      <Td className={styles.muted}>{sessionCreatorLabel(s)}</Td>
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
          </div>

          <div className={styles.mobileCards}>
            {sessions.map((s) => (
              <article key={s.id} className={styles.card}>
                <p className={styles.cardDocNo}>{s.document_no || "—"}</p>
                <div className={styles.cardTop}>
                  <p className={styles.cardDate}>{new Date(s.created_at).toLocaleString("ru-RU")}</p>
                  <span
                    className={
                      s.status === "active"
                        ? styles.badgeActive
                        : s.status === "completed" || s.status === "archived"
                          ? styles.badgeDone
                          : styles.badgeOther
                    }
                  >
                    {sessionStatusLabel(s.status)}
                  </span>
                </div>
                <p className={styles.cardUser}>{sessionCreatorLabel(s)}</p>
                <Button
                  type="button"
                  variant="outline"
                  responsiveFull
                  onClick={() =>
                    navigate(`/inventory/sessions/${s.id}`, { state: focusItemId ? { focusItemId } : undefined })
                  }
                >
                  Открыть
                </Button>
              </article>
            ))}
          </div>
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Назад
              </Button>
              <span className={styles.pageInfo}>
                Стр. {page} из {totalPages} ({total} сессий)
              </span>
              <Button type="button" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Вперёд
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

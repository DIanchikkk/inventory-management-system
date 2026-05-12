import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { fetchCategories } from "../api/categories.api";
import { createSession, fetchSessions, type CreateSessionBody } from "../api/inventory.api";
import type { Category, InventorySession } from "../types";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newDocLocation, setNewDocLocation] = useState("");
  const [newDocCategoryId, setNewDocCategoryId] = useState("");
  const [newDocNotes, setNewDocNotes] = useState("");

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
    void fetchCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

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
      const body: CreateSessionBody = {};
      if (newDocLocation.trim()) body.location = newDocLocation.trim();
      if (newDocCategoryId) body.category_id = newDocCategoryId;
      if (newDocNotes.trim()) body.notes = newDocNotes.trim();
      const s = await createSession(Object.keys(body).length ? body : undefined);
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
        subtitle="Учётное и фактическое количество по строкам; проведение документа выравнивает остатки и формирует реестр движений."
        actions={
          <Button type="button" variant="primary" responsiveFull onClick={() => void onCreate()} disabled={creating}>
            {creating ? "Создание…" : "Новый документ"}
          </Button>
        }
      />

      <details className={styles.newDocFilters}>
        <summary className={styles.newDocSummary}>Параметры нового документа (необязательно)</summary>
        <p className={styles.newDocHint}>
          В опись документа попадут только объекты, учтённые в системе и подходящие под фильтры ниже. Если фильтры не заданы —
          все позиции, не помеченные как списанные.
        </p>
        <div className={styles.newDocRow}>
          <label className={styles.newDocLabel} htmlFor="inv-new-loc">
            Локация содержит
          </label>
          <input
            id="inv-new-loc"
            className={styles.newDocInput}
            value={newDocLocation}
            onChange={(e) => setNewDocLocation(e.target.value)}
            placeholder="Например: Склад"
            autoComplete="off"
          />
        </div>
        <div className={styles.newDocRow}>
          <label className={styles.newDocLabel} htmlFor="inv-new-cat">
            Категория
          </label>
          <select
            id="inv-new-cat"
            className={styles.newDocSelect}
            value={newDocCategoryId}
            onChange={(e) => setNewDocCategoryId(e.target.value)}
          >
            <option value="">Все категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.newDocRow}>
          <label className={styles.newDocLabel} htmlFor="inv-new-notes">
            Примечание к документу
          </label>
          <textarea
            id="inv-new-notes"
            className={styles.newDocTextarea}
            value={newDocNotes}
            onChange={(e) => setNewDocNotes(e.target.value)}
            placeholder="Например: пересчёт склада А, ответственный участок…"
            rows={2}
          />
        </div>
      </details>

      {focusItemId && !loading && sessions.every((s) => s.status !== "active") && (
        <Alert>
          Нет активной сессии. Создайте новую — карточка объекта будет подсвечена после открытия сессии.
        </Alert>
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
                    <Th>Создал</Th>
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
                <p className={styles.cardUser}>{s.created_by}</p>
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

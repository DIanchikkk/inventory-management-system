import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchSessions } from "../api/inventory.api";
import type { InventorySession } from "../types";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";
import { Table, TableScroll, Tbody, Td, Th, Thead, Tr } from "../components/ui/Table";
import { getErrorMessage } from "../utils/errors";
import { sessionStatusLabel } from "../utils/inventoryDisplay";
import styles from "./ReportsPage.module.css";

type Filter = "all" | "active" | "completed";

export function ReportsPage() {
  const goToSession = (id: string) => `/inventory/sessions/${id}`;
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [filter, setFilter] = useState<Filter>("completed");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pageSize = 100;
      let page = 1;
      let total = 0;
      const all: InventorySession[] = [];
      do {
        const data = await fetchSessions(page, pageSize);
        total = data.total;
        all.push(...data.sessions);
        page += 1;
      } while (all.length < total);
      setSessions(all);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return sessions;
    return sessions.filter((s) => s.status === filter);
  }, [sessions, filter]);

  const completedCount = useMemo(() => sessions.filter((s) => s.status === "completed").length, [sessions]);
  const activeCount = useMemo(() => sessions.filter((s) => s.status === "active").length, [sessions]);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Отчёты и документы"
        subtitle={`Завершённые документы инвентаризации: ${completedCount}. Откройте документ, чтобы увидеть расхождения, реестр движений и фактические количества.`}
        actions={
          <>
            <Link className={styles.quickLink} to="/reports/replacement">
              К замене
            </Link>
            <Link className={styles.quickLink} to="/reports/labels">
              QR-этикетки
            </Link>
            <Link className={styles.quickLink} to="/reports/stock-ledger">
              Реестр движений
            </Link>
          </>
        }
      />

      <div className={styles.filters} role="group" aria-label="Фильтр документов инвентаризации">
        {(
          [
            ["completed", "Проведённые"],
            ["active", "В работе"],
            ["all", "Все"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            variant={filter === key ? "primary" : "outline"}
            responsiveFull
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className={styles.metrics}>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Всего документов</p>
          <p className={styles.metricValue}>{sessions.length}</p>
        </article>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Активные</p>
          <p className={styles.metricValue}>{activeCount}</p>
        </article>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Проведённые</p>
          <p className={styles.metricValue}>{completedCount}</p>
        </article>
      </div>

      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}

      {!loading && filtered.length === 0 && (
        <p className={styles.empty}>Нет документов для выбранного фильтра.</p>
      )}

      {!loading && filtered.length > 0 && (
        <>
          <div className={styles.desktopOnly}>
            <TableScroll>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Номер</Th>
                    <Th>Дата</Th>
                    <Th>Статус</Th>
                    <Th>Создал</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  {filtered.map((s) => (
                    <Tr key={s.id}>
                      <Td>{s.document_no || "—"}</Td>
                      <Td>{new Date(s.created_at).toLocaleString("ru-RU")}</Td>
                      <Td>{sessionStatusLabel(s.status)}</Td>
                      <Td className={styles.muted}>{s.created_by}</Td>
                      <Td className={styles.action}>
                        <Link className={styles.link} to={`/inventory/sessions/${s.id}`}>
                          {s.status === "completed" ? "Открыть документ" : "Открыть"}
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableScroll>
          </div>

          <div className={styles.mobileCards}>
            {filtered.map((s) => (
              <article key={s.id} className={styles.card}>
                <p className={styles.cardDocNo}>{s.document_no || "—"}</p>
                <p className={styles.cardDate}>{new Date(s.created_at).toLocaleString("ru-RU")}</p>
                <p className={styles.cardStatus}>Статус: {sessionStatusLabel(s.status)}</p>
                <p className={styles.cardUser}>{s.created_by}</p>
                <Link className={styles.cardLink} to={goToSession(s.id)}>
                  {s.status === "completed" ? "Открыть документ" : "Открыть"}
                </Link>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

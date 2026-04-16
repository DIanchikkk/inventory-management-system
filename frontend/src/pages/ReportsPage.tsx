import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchSessions } from "../api/inventory.api";
import type { InventorySession } from "../types";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { Table, TableScroll, Tbody, Td, Th, Thead, Tr } from "../components/ui/Table";
import { getErrorMessage } from "../utils/errors";
import { sessionStatusLabel } from "../utils/inventoryDisplay";
import styles from "./ReportsPage.module.css";

type Filter = "all" | "active" | "completed";

export function ReportsPage() {
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [filter, setFilter] = useState<Filter>("completed");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    if (filter === "all") return sessions;
    return sessions.filter((s) => s.status === filter);
  }, [sessions, filter]);

  const completedCount = useMemo(() => sessions.filter((s) => s.status === "completed").length, [sessions]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Отчёты и результаты</h1>
          <p className={styles.subtitle}>
            Завершённые сессии: {completedCount}. Откройте сессию, чтобы увидеть расхождения и сохранённые фактические
            количества.
          </p>
        </div>
      </header>

      <div className={styles.filters} role="group" aria-label="Фильтр сессий">
        {(
          [
            ["completed", "Завершённые"],
            ["active", "Активные"],
            ["all", "Все"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            variant={filter === key ? "primary" : "outline"}
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}

      {!loading && filtered.length === 0 && (
        <p className={styles.empty}>Нет сессий для выбранного фильтра.</p>
      )}

      {!loading && filtered.length > 0 && (
        <TableScroll>
          <Table>
            <Thead>
              <Tr>
                <Th>Дата</Th>
                <Th>Статус</Th>
                <Th>Создал</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((s) => (
                <Tr key={s.id}>
                  <Td>{new Date(s.created_at).toLocaleString("ru-RU")}</Td>
                  <Td>{sessionStatusLabel(s.status)}</Td>
                  <Td className={styles.muted}>{s.created_by}</Td>
                  <Td className={styles.action}>
                    <Link className={styles.link} to={`/inventory/sessions/${s.id}`}>
                      {s.status === "completed" ? "Отчёт по сессии" : "Открыть"}
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

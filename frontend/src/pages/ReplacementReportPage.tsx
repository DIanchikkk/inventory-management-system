import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchItems } from "../api/items.api";
import type { Item } from "../types";
import { Alert } from "../components/ui/Alert";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";
import { Table, TableScroll, Tbody, Td, Th, Thead, Tr } from "../components/ui/Table";
import { getErrorMessage } from "../utils/errors";
import { plannedReplacementLabel } from "../utils/assetLife";
import styles from "./ReplacementReportPage.module.css";

function daysUntil(dateIso: string, lifeYears: number): number | null {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + (lifeYears > 0 ? lifeYears : 4));
  const diffMs = d.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function ReplacementReportPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pageSize = 100;
      let page = 1;
      let total = 0;
      const all: Item[] = [];
      do {
        const data = await fetchItems({
          page,
          pageSize,
          includeRetired: false,
          replacementRemind: true,
          sortBy: "purchase_date",
          sortDir: "asc",
        });
        total = data.total;
        all.push(...data.items);
        page += 1;
      } while (all.length < total);
      setItems(all);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    let overdue = 0;
    let soon = 0;
    for (const it of items) {
      const d = daysUntil(it.purchase_date, it.service_life_years ?? 4);
      if (d === null) continue;
      if (d < 0) overdue += 1;
      else if (d <= 90) soon += 1;
    }
    return { overdue, soon };
  }, [items]);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Отчёт: объекты к замене"
        subtitle={`Просрочено: ${stats.overdue}. В ближайшие 90 дней: ${stats.soon}.`}
      />

      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}
      {!loading && !error && items.length === 0 && (
        <p className={styles.empty}>Нет объектов с наступающим сроком замены.</p>
      )}

      {!loading && items.length > 0 && (
        <TableScroll>
          <Table>
            <Thead>
              <Tr>
                <Th>Объект</Th>
                <Th>SKU</Th>
                <Th>Локация</Th>
                <Th>Плановая замена</Th>
                <Th>Осталось дней</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((it) => {
                const left = daysUntil(it.purchase_date, it.service_life_years ?? 4);
                return (
                  <Tr key={it.id}>
                    <Td>
                      <Link className={styles.itemLink} to={`/items/${it.id}`}>
                        {it.name}
                      </Link>
                    </Td>
                    <Td>{it.sku}</Td>
                    <Td>{it.location}</Td>
                    <Td>{plannedReplacementLabel(it.purchase_date, it.service_life_years ?? 4)}</Td>
                    <Td className={left !== null && left < 0 ? styles.overdue : styles.soon}>
                      {left === null ? "—" : left < 0 ? `просрочено на ${Math.abs(left)} дн.` : `${left} дн.`}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableScroll>
      )}
    </div>
  );
}

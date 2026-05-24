import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { fetchItem, fetchItems } from "@/shared/api/items.api";
import type { Item } from "@/shared/types";
import { Alert } from "@/shared/components/ui/Alert";
import { Button } from "@/shared/components/ui/Button";
import { PageHeader } from "@/shared/components/ui/PageHeader";
import { Spinner } from "@/shared/components/ui/Spinner";
import { getErrorMessage } from "@/shared/utils/errors";
import { publicOrigin } from "@/shared/utils/publicOrigin";
import styles from "./QrLabelsPage.module.css";

export function QrLabelsPage() {
  const [sp] = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = sp.get("q") ?? undefined;
  const replacementRemind = sp.get("replacement_remind") === "1";
  const idsRaw = sp.get("ids") ?? "";
  const ids = useMemo(
    () =>
      idsRaw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 200), // предохранитель от слишком длинного query
    [idsRaw],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (ids.length > 0) {
        const settled = await Promise.allSettled(ids.map(async (id) => fetchItem(id)));
        const ok: Item[] = [];
        let failed = 0;
        for (const r of settled) {
          if (r.status === "fulfilled") ok.push(r.value);
          else failed += 1;
        }
        setItems(ok.filter((it) => !it.retired_at));
        if (failed > 0) {
          setError(`Часть выбранных позиций не загрузилась (${failed}). Остальные доступны для печати.`);
        }
        return;
      }
      const pageSize = 100;
      let page = 1;
      let total = 0;
      const all: Item[] = [];
      do {
        const data = await fetchItems({
          q: query,
          page,
          pageSize,
          replacementRemind,
          includeRetired: false,
          sortBy: "name",
          sortDir: "asc",
        });
        total = data.total;
        all.push(...data.items);
        page += 1;
      } while (all.length < total && all.length < 300);
      setItems(all);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [ids, query, replacementRemind]);

  useEffect(() => {
    void load();
  }, [load]);

  const base = publicOrigin();
  return (
    <div className={styles.page}>
      <PageHeader
        title="QR-этикетки"
        subtitle={items.length > 0 ? `${items.length} шт.` : undefined}
        actions={
          <Button type="button" variant="primary" onClick={() => window.print()} disabled={loading || items.length === 0}>
            Печать
          </Button>
        }
      />
      <p className={styles.back}>
        <Link className={styles.backLink} to="/items">
          ← К объектам
        </Link>
      </p>
      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}
      {!loading && !error && items.length === 0 && <p className={styles.empty}>Нет данных для печати.</p>}
      <section className={styles.sheet} aria-label="Лист QR-этикеток">
        {items.map((it) => {
          const url = `${base}/items/${it.id}`;
          return (
            <article key={it.id} className={styles.label}>
              <QRCodeSVG value={url} size={88} level="M" />
              <p className={styles.sku}>{it.sku}</p>
              <p className={styles.name}>{it.name}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}

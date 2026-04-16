import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchItem } from "../api/items.api";
import type { Item } from "../types";
import { QrBlock } from "../components/items/QrBlock";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { getErrorMessage } from "../utils/errors";
import styles from "./ItemDetailPage.module.css";

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchItem(id);
        if (!cancelled) setItem(data);
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const shareUrl =
    typeof window !== "undefined" && id ? `${window.location.origin}/items/${id}` : "";

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link className={styles.backLink} to="/items">
          ← К списку
        </Link>
      </p>
      {loading && <Spinner />}
      {error && <Alert>{error}</Alert>}
      {item && (
        <Card narrow className={styles.card}>
          <h1 className={styles.h1}>{item.name}</h1>
          <p className={styles.desc}>{item.description || "—"}</p>
          <ul className={styles.facts}>
            <li>
              <strong>Количество:</strong> {item.quantity}
            </li>
            <li>
              <strong>Дата покупки:</strong> {item.purchase_date.slice(0, 10)}
            </li>
          </ul>
          <div className={styles.actions}>
            <Button
              type="button"
              variant="primary"
              onClick={() => nav("/inventory/sessions", { state: { focusItemId: item.id } })}
            >
              Использовать в инвентаризации
            </Button>
          </div>
          <QrBlock url={shareUrl} />
        </Card>
      )}
    </div>
  );
}

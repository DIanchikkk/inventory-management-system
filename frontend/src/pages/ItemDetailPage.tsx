import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchItem, fetchItemHistory } from "../api/items.api";
import type { Item, ItemHistoryLog } from "../types";
import { ItemImage } from "../components/items/ItemImage";
import { QrBlock } from "../components/items/QrBlock";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { plannedReplacementLabel } from "../utils/assetLife";
import { getErrorMessage } from "../utils/errors";
import { publicOrigin } from "../utils/publicOrigin";
import styles from "./ItemDetailPage.module.css";

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<ItemHistoryLog[]>([]);
  const [historyErr, setHistoryErr] = useState<string | null>(null);
  const [successor, setSuccessor] = useState<Item | null>(null);

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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setHistoryErr(null);
    void fetchItemHistory(id)
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch((e) => {
        if (!cancelled) setHistoryErr(getErrorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!item?.replaced_by_item_id) {
      setSuccessor(null);
      return;
    }
    let cancelled = false;
    void fetchItem(item.replaced_by_item_id)
      .then((s) => {
        if (!cancelled) setSuccessor(s);
      })
      .catch(() => {
        if (!cancelled) setSuccessor(null);
      });
    return () => {
      cancelled = true;
    };
  }, [item?.replaced_by_item_id]);

  const origin = publicOrigin();
  const shareUrl = origin && id ? `${origin}/items/${id}` : "";
  const inventoryQrUrl = origin && id ? `${origin}/inventory/item/${id}` : "";
  const replacementDate = item ? plannedReplacementLabel(item.purchase_date, item.service_life_years ?? 4) : "—";
  const timeline = item
    ? [
        `Поступление в учёт: ${item.purchase_date.slice(0, 10)}`,
        `Плановая дата замены: ${replacementDate}`,
        item.retired_at
          ? `Списано/заменено: ${new Date(item.retired_at).toLocaleDateString("ru-RU")}`
          : "Статус: в эксплуатации",
      ]
    : [];

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
          {item.retired_at && (
            <p className={styles.retiredNote}>
              Единица списана или заменена ({new Date(item.retired_at).toLocaleDateString("ru-RU")}). Запись сохранена для
              истории инвентаризаций.
            </p>
          )}
          {item.image_url?.trim() ? (
            <ItemImage className={styles.photo} src={item.image_url} alt="" />
          ) : null}
          <section className={styles.timeline} aria-label="Жизненный цикл объекта">
            <p className={styles.timelineTitle}>Жизненный цикл</p>
            <ul className={styles.timelineList}>
              {timeline.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
          <ul className={styles.facts}>
            <li>
              <strong>Код (SKU):</strong> {item.sku}
            </li>
            <li>
              <strong>Категория:</strong> {item.category}
            </li>
            <li>
              <strong>Локация:</strong> {item.location}
            </li>
            <li>
              <strong>Количество:</strong> {item.quantity}
              {item.unit ? ` ${item.unit}` : ""}
            </li>
            <li>
              <strong>Минимальный остаток (порог):</strong> {item.min_quantity}{" "}
              {item.unit?.trim() ? item.unit : "шт"}
            </li>
            <li>
              <strong>Дата покупки / поступления:</strong> {item.purchase_date.slice(0, 10)}
            </li>
            <li>
              <strong>Нормативный срок до замены:</strong> {item.service_life_years ?? 4} лет
            </li>
            <li>
              <strong>Плановая дата замены (ориентир):</strong>{" "}
              {replacementDate}
            </li>
            {item.replaced_by_item_id ? (
              <li>
                <strong>Заменено на объект (преемник):</strong>{" "}
                {successor ? (
                  <>
                    <span className={styles.successorMeta}>
                      {successor.sku} — {successor.name}
                    </span>{" "}
                    <Link className={styles.successorLink} to={`/items/${item.replaced_by_item_id}`}>
                      карточка замены
                    </Link>
                  </>
                ) : (
                  <Link className={styles.successorLink} to={`/items/${item.replaced_by_item_id}`}>
                    открыть карточку замены (UUID в базе)
                  </Link>
                )}
              </li>
            ) : null}
          </ul>
          <details className={styles.helpDetails}>
            <summary className={styles.helpSummary}>Зачем нужен минимальный остаток?</summary>
            <p className={styles.helpBody}>
              Это <strong>не</strong> влияет на проведение инвентаризации и на «учётное» количество в документе. Порог нужен,
              чтобы отмечать позиции «мало на складе» в списке объектов и в сводке: когда фактический остаток не превышает
              минимум, объект попадает в контрольный список для закупки или перераспределения.
            </p>
          </details>
          <section className={styles.history} aria-label="История изменений">
            <p className={styles.historyTitle}>История изменений</p>
            {historyErr ? <p className={styles.historyErr}>{historyErr}</p> : null}
            {!historyErr && history.length === 0 ? (
              <p className={styles.historyEmpty}>Записей пока нет.</p>
            ) : null}
            {!historyErr && history.length > 0 ? (
              <ul className={styles.historyList}>
                {history.map((row) => (
                  <li key={row.id} className={styles.historyRow}>
                    <time className={styles.historyTime} dateTime={row.created_at}>
                      {new Date(row.created_at).toLocaleString("ru-RU")}
                    </time>
                    <span className={styles.historyMsg}>{row.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          <div className={styles.noPrint}>
            <div className={styles.actions}>
              <Button
                type="button"
                variant="primary"
                onClick={() => nav("/inventory/sessions", { state: { focusItemId: item.id } })}
              >
                Использовать в инвентаризации
              </Button>
            </div>
            <QrBlock
              title="QR — карточка объекта"
              url={shareUrl}
              hint="Кодируется только ссылка на эту страницу. Рисуется в браузере библиотекой qrcode.react (формат QR по стандарту ISO/IEC 18004). При добавлении объекта QR появляется сразу — отдельный файл на сервере не хранится."
            />
            <QrBlock
              title="QR — режим инвентаризации"
              url={inventoryQrUrl}
              hint="Ведёт на страницу быстрого входа в сессию с подсветкой этой позиции: отсканировали → вводите учётное и фактическое количество в документе инвентаризации."
            />
          </div>
        </Card>
      )}
    </div>
  );
}

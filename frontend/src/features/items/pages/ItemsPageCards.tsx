import { Link } from "react-router-dom";
import { deleteItem } from "@/shared/api/items.api";
import type { Item } from "@/shared/types";
import { ItemImage } from "@/features/items/components/ItemImage";
import { Button } from "@/shared/components/ui/Button";
import { StatusBadge } from "@/shared/components/ui/StatusBadge";
import { getErrorMessage } from "@/shared/utils/errors";
import type { ItemsPageState } from "./useItemsPage";
import styles from "./ItemsPage.module.css";

type Props = Pick<
  ItemsPageState,
  "items" | "selectedIds" | "isAdmin" | "toggleSelect" | "openEdit" | "load"
>;

export function ItemsPageCards({ items, selectedIds, isAdmin, toggleSelect, openEdit, load }: Props) {
  async function handleDelete(it: Item) {
    if (!confirm(`Удалить «${it.name}»?`)) return;
    try {
      await deleteItem(it.id);
      void load();
    } catch (e) {
      alert(getErrorMessage(e));
    }
  }

  return (
    <div className={styles.mobileCards}>
      {items.map((it) => (
        <article key={it.id} className={styles.card}>
          <div className={styles.cardTop}>
            <label className={styles.pickInline}>
              <input
                type="checkbox"
                className={styles.pick}
                checked={selectedIds.includes(it.id)}
                onChange={() => toggleSelect(it.id)}
                aria-label={`Выбрать ${it.name}`}
              />
              <span>Выбрать</span>
            </label>
            <Link className={styles.cardTitle} to={`/items/${it.id}`}>
              {it.name}
            </Link>
            {it.retired_at ? (
              <span className={styles.retiredMark}>Списано</span>
            ) : (
              <StatusBadge kind={it.quantity <= it.min_quantity ? "mismatch" : "pending"} />
            )}
          </div>
          {it.image_url?.trim() ? (
            <ItemImage
              className={styles.cardThumb}
              src={it.image_url}
              cacheKey={it.image_cache_key ?? it.updated_at}
              alt=""
            />
          ) : null}
          <div className={styles.cardMeta}>
            <span>SKU: {it.sku}</span>
            <span>{it.category}</span>
          </div>
          <div className={styles.cardMeta}>
            <span>Локация: {it.location}</span>
            <span>
              Кол-во: {it.quantity} {it.unit}
            </span>
            <span>Мин: {it.min_quantity}</span>
            <span>{it.purchase_date.slice(0, 10)}</span>
          </div>
          {isAdmin && (
            <div className={styles.cardActions}>
              <Button type="button" variant="outline" responsiveFull onClick={() => openEdit(it)}>
                Изменить
              </Button>
              <Button type="button" variant="danger" responsiveFull onClick={() => void handleDelete(it)}>
                Удалить
              </Button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

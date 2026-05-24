import { Button } from "@/shared/components/ui/Button";
import type { ItemsPageState } from "./useItemsPage";
import styles from "./ItemsPage.module.css";

type Props = Pick<
  ItemsPageState,
  | "page"
  | "setPage"
  | "totalPages"
  | "total"
  | "stockFilter"
  | "isAdmin"
  | "includeRetired"
  | "replacementRemind"
>;

export function ItemsPagePagination({
  page,
  setPage,
  totalPages,
  total,
  stockFilter,
  isAdmin,
  includeRetired,
  replacementRemind,
}: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className={styles.pagination}>
      <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
        Назад
      </Button>
      <span className={styles.pageInfo}>
        Стр. {page} из {totalPages} ({total} записей)
        {stockFilter === "low" ? " · Фильтр: ниже минимума" : ""}
        {isAdmin && includeRetired ? " · Включая списанные" : ""}
        {replacementRemind ? " · Фильтр: срок замены" : ""}
      </span>
      <Button type="button" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
        Вперёд
      </Button>
    </div>
  );
}

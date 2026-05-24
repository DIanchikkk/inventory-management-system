import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import type { ItemsPageState } from "./useItemsPage";
import styles from "./ItemsPage.module.css";

type Props = Pick<
  ItemsPageState,
  | "q"
  | "setQ"
  | "stockFilter"
  | "setStockFilter"
  | "includeRetired"
  | "setIncludeRetired"
  | "isAdmin"
  | "replacementRemind"
  | "searchParams"
  | "setSearchParams"
  | "allVisibleSelected"
  | "toggleSelectVisible"
  | "summary"
  | "setPage"
>;

export function ItemsPageFilters({
  q,
  setQ,
  stockFilter,
  setStockFilter,
  includeRetired,
  setIncludeRetired,
  isAdmin,
  replacementRemind,
  searchParams,
  setSearchParams,
  allVisibleSelected,
  toggleSelectVisible,
  summary,
  setPage,
}: Props) {
  return (
    <>
      <div className={styles.toolbar}>
        <Input
          id="items-search"
          label="Поиск"
          type="search"
          placeholder="Название или описание"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className={styles.filters} role="group" aria-label="Фильтр остатков">
        <Button
          type="button"
          variant={stockFilter === "all" ? "primary" : "outline"}
          responsiveFull
          onClick={() => setStockFilter("all")}
        >
          Все
        </Button>
        <Button
          type="button"
          variant={stockFilter === "low" ? "primary" : "outline"}
          responsiveFull
          onClick={() => setStockFilter("low")}
        >
          Ниже минимума
        </Button>
        {isAdmin && (
          <Button
            type="button"
            variant={includeRetired ? "primary" : "outline"}
            responsiveFull
            onClick={() => setIncludeRetired((v) => !v)}
          >
            Списанные
          </Button>
        )}
        <Button
          type="button"
          variant={replacementRemind ? "primary" : "outline"}
          responsiveFull
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            if (replacementRemind) next.delete("replacement_remind");
            else next.set("replacement_remind", "1");
            setSearchParams(next);
          }}
        >
          Срок замены
        </Button>
        <Button
          type="button"
          variant={allVisibleSelected ? "primary" : "outline"}
          responsiveFull
          onClick={toggleSelectVisible}
        >
          {allVisibleSelected ? "Снять выбор" : "Выбрать видимые"}
        </Button>
      </div>

      {summary !== null && summary.items_low_stock > 0 ? (
        <div className={styles.lowStockBanner} role="status">
          <strong>Мало на складе:</strong>
          <span>{summary.items_low_stock.toLocaleString("ru-RU")} поз. ниже минимального остатка.</span>
          <button
            type="button"
            className={styles.lowStockAction}
            onClick={() => {
              setStockFilter("low");
              setPage(1);
            }}
          >
            Показать список
          </button>
        </div>
      ) : null}
    </>
  );
}

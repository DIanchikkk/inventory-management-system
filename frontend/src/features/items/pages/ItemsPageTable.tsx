import { Link } from "react-router-dom";
import { deleteItem } from "@/shared/api/items.api";
import type { Item } from "@/shared/types";
import { ItemImage } from "@/features/items/components/ItemImage";
import { Button } from "@/shared/components/ui/Button";
import { StatusBadge } from "@/shared/components/ui/StatusBadge";
import {
  SortTh,
  Table,
  TableScroll,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/shared/components/ui/Table";
import { getErrorMessage } from "@/shared/utils/errors";
import type { ItemsPageState } from "./useItemsPage";
import styles from "./ItemsPage.module.css";

type Props = Pick<
  ItemsPageState,
  | "items"
  | "selectedIds"
  | "isAdmin"
  | "sortKey"
  | "sortDir"
  | "toggleSort"
  | "toggleSelect"
  | "toggleSelectVisible"
  | "allVisibleSelected"
  | "openEdit"
  | "load"
>;

export function ItemsPageTable({
  items,
  selectedIds,
  isAdmin,
  sortKey,
  sortDir,
  toggleSort,
  toggleSelect,
  toggleSelectVisible,
  allVisibleSelected,
  openEdit,
  load,
}: Props) {
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
    <div className={styles.desktopOnly}>
      <TableScroll>
        <Table>
          <Thead>
            <Tr>
              <Th>
                <input
                  type="checkbox"
                  className={styles.pick}
                  checked={allVisibleSelected}
                  onChange={toggleSelectVisible}
                  aria-label="Выбрать все видимые"
                />
              </Th>
              <Th>Фото</Th>
              <SortTh active={sortKey === "name"} direction={sortDir} onToggle={() => toggleSort("name")}>
                Название
              </SortTh>
              <Th>SKU</Th>
              <Th>Категория</Th>
              <Th>Локация</Th>
              <SortTh active={sortKey === "quantity"} direction={sortDir} onToggle={() => toggleSort("quantity")}>
                Количество
              </SortTh>
              <Th>Статус</Th>
              <SortTh active={sortKey === "purchase_date"} direction={sortDir} onToggle={() => toggleSort("purchase_date")}>
                Дата покупки
              </SortTh>
              {isAdmin && <Th />}
            </Tr>
          </Thead>
          <Tbody>
            {items.map((it) => (
              <Tr key={it.id}>
                <Td>
                  <input
                    type="checkbox"
                    className={styles.pick}
                    checked={selectedIds.includes(it.id)}
                    onChange={() => toggleSelect(it.id)}
                    aria-label={`Выбрать ${it.name}`}
                  />
                </Td>
                <Td>
                  {it.image_url?.trim() ? (
                    <ItemImage
                      className={styles.thumb}
                      src={it.image_url}
                      cacheKey={it.image_cache_key ?? it.updated_at}
                      alt=""
                    />
                  ) : (
                    <span className={styles.thumbDash}>—</span>
                  )}
                </Td>
                <Td>
                  <Link className={styles.cellLink} to={`/items/${it.id}`}>
                    {it.name}
                  </Link>
                </Td>
                <Td>{it.sku}</Td>
                <Td className={styles.nowrapCell}>{it.category}</Td>
                <Td className={styles.nowrapCell}>{it.location}</Td>
                <Td>{it.quantity}</Td>
                <Td className={styles.nowrapCell}>
                  {it.retired_at ? (
                    <span className={styles.retiredMark}>Списано</span>
                  ) : (
                    <StatusBadge kind={it.quantity <= it.min_quantity ? "mismatch" : "pending"} />
                  )}
                </Td>
                <Td>{it.purchase_date.slice(0, 10)}</Td>
                {isAdmin && (
                  <Td className={styles.rowActions}>
                    <button type="button" className={styles.textBtn} onClick={() => openEdit(it)}>
                      Изменить
                    </button>
                    <Button type="button" variant="danger" onClick={() => void handleDelete(it)}>
                      Удалить
                    </Button>
                  </Td>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableScroll>
    </div>
  );
}

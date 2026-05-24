import { Link } from "react-router-dom";
import { exportItemsCsv } from "@/shared/api/items.api";
import { Button } from "@/shared/components/ui/Button";
import { PageHeader } from "@/shared/components/ui/PageHeader";
import { getErrorMessage } from "@/shared/utils/errors";
import type { ItemsPageState } from "./useItemsPage";
import styles from "./ItemsPage.module.css";

type Props = Pick<
  ItemsPageState,
  | "isAdmin"
  | "searchParams"
  | "selectedIds"
  | "setExportErr"
  | "openCreate"
  | "openBulk"
>;

export function ItemsPageHeader({ isAdmin, searchParams, selectedIds, setExportErr, openCreate, openBulk }: Props) {
  if (!isAdmin) {
    return <PageHeader title="Объекты учёта" />;
  }

  return (
    <PageHeader
      title="Объекты учёта"
      actions={
        <>
          <Button type="button" variant="primary" responsiveFull onClick={openCreate}>
            Добавить
          </Button>
          <Button
            type="button"
            variant="outline"
            responsiveFull
            onClick={async () => {
              setExportErr(null);
              try {
                await exportItemsCsv();
              } catch (e) {
                setExportErr(getErrorMessage(e));
              }
            }}
          >
            Экспорт CSV
          </Button>
          <Link className={styles.actionLink} to={`/reports/labels?${searchParams.toString()}`}>
            QR-этикетки
          </Link>
          {selectedIds.length > 0 && (
            <Link className={styles.actionLink} to={`/reports/labels?ids=${selectedIds.join(",")}`}>
              QR выбранных ({selectedIds.length})
            </Link>
          )}
          <Button
            type="button"
            variant="outline"
            responsiveFull
            disabled={selectedIds.length === 0}
            title={
              selectedIds.length === 0
                ? "Отметьте строки в таблице чекбоксами"
                : `Выбрано строк: ${selectedIds.length}`
            }
            onClick={openBulk}
          >
            Выбранным: локация и категория
          </Button>
        </>
      }
    />
  );
}

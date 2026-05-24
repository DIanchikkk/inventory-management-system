import { bulkUpdateMeta } from "@/shared/api/items.api";
import { Alert } from "@/shared/components/ui/Alert";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Modal } from "@/shared/components/ui/Modal";
import { getErrorMessage } from "@/shared/utils/errors";
import type { ItemsPageState } from "./useItemsPage";
import styles from "./ItemsPage.module.css";

type Props = Pick<
  ItemsPageState,
  | "bulkOpen"
  | "setBulkOpen"
  | "bulkSaving"
  | "setBulkSaving"
  | "bulkErr"
  | "setBulkErr"
  | "selectedIds"
  | "bulkLocation"
  | "setBulkLocation"
  | "bulkCategoryId"
  | "setBulkCategoryId"
  | "bulkCategories"
  | "refreshDashboardSummary"
  | "load"
>;

export function ItemsPageBulkModal({
  bulkOpen,
  setBulkOpen,
  bulkSaving,
  setBulkSaving,
  bulkErr,
  setBulkErr,
  selectedIds,
  bulkLocation,
  setBulkLocation,
  bulkCategoryId,
  setBulkCategoryId,
  bulkCategories,
  refreshDashboardSummary,
  load,
}: Props) {
  return (
    <Modal
      open={bulkOpen}
      title="Локация и категория для выбранных строк"
      closeOnBackdrop
      onClose={() => !bulkSaving && setBulkOpen(false)}
      footer={
        <>
          <Button type="button" variant="outline" disabled={bulkSaving} onClick={() => setBulkOpen(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={bulkSaving || selectedIds.length === 0 || (!bulkLocation.trim() && !bulkCategoryId)}
            onClick={() => {
              void (async () => {
                setBulkSaving(true);
                setBulkErr(null);
                try {
                  await bulkUpdateMeta({
                    ids: selectedIds,
                    location: bulkLocation.trim() || undefined,
                    category_id: bulkCategoryId || undefined,
                  });
                  setBulkOpen(false);
                  void refreshDashboardSummary();
                  void load();
                } catch (err) {
                  setBulkErr(getErrorMessage(err));
                } finally {
                  setBulkSaving(false);
                }
              })();
            }}
          >
            {bulkSaving ? "Сохранение…" : "Применить"}
          </Button>
        </>
      }
    >
      <p className={styles.modalHint}>Выбрано: {selectedIds.length}</p>
      {bulkErr ? <Alert>{bulkErr}</Alert> : null}
      <div className={styles.modalField}>
        <Input
          id="bulk-location"
          label="Локация"
          value={bulkLocation}
          onChange={(e) => setBulkLocation(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className={styles.modalField}>
        <label className={styles.bulkLabel} htmlFor="bulk-category">
          Категория (справочник)
        </label>
        <select
          id="bulk-category"
          className={styles.bulkSelect}
          value={bulkCategoryId}
          onChange={(e) => setBulkCategoryId(e.target.value)}
        >
          <option value="">— не менять —</option>
          {bulkCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </Modal>
  );
}

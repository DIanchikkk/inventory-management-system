import { ItemFormModal } from "@/features/items/components/ItemFormModal";
import { Alert } from "@/shared/components/ui/Alert";
import { Spinner } from "@/shared/components/ui/Spinner";
import { ItemsPageBulkModal } from "./ItemsPageBulkModal";
import { ItemsPageCards } from "./ItemsPageCards";
import { ItemsPageFilters } from "./ItemsPageFilters";
import { ItemsPageHeader } from "./ItemsPageHeader";
import { ItemsPagePagination } from "./ItemsPagePagination";
import { ItemsPageTable } from "./ItemsPageTable";
import { useItemsPage } from "./useItemsPage";
import styles from "./ItemsPage.module.css";

export function ItemsPage() {
  const s = useItemsPage();

  return (
    <div className={styles.page}>
      <ItemsPageHeader
        isAdmin={s.isAdmin}
        searchParams={s.searchParams}
        selectedIds={s.selectedIds}
        setExportErr={s.setExportErr}
        openCreate={s.openCreate}
        openBulk={s.openBulk}
      />

      <ItemsPageFilters
        q={s.q}
        setQ={s.setQ}
        stockFilter={s.stockFilter}
        setStockFilter={s.setStockFilter}
        includeRetired={s.includeRetired}
        setIncludeRetired={s.setIncludeRetired}
        isAdmin={s.isAdmin}
        replacementRemind={s.replacementRemind}
        searchParams={s.searchParams}
        setSearchParams={s.setSearchParams}
        allVisibleSelected={s.allVisibleSelected}
        toggleSelectVisible={s.toggleSelectVisible}
        summary={s.summary}
        setPage={s.setPage}
      />

      {s.exportErr && <Alert>{s.exportErr}</Alert>}
      {s.error && <Alert>{s.error}</Alert>}
      {s.loading && <Spinner />}

      {!s.loading && !s.error && s.items.length > 0 && (
        <>
          <ItemsPageTable
            items={s.items}
            selectedIds={s.selectedIds}
            isAdmin={s.isAdmin}
            sortKey={s.sortKey}
            sortDir={s.sortDir}
            toggleSort={s.toggleSort}
            toggleSelect={s.toggleSelect}
            toggleSelectVisible={s.toggleSelectVisible}
            allVisibleSelected={s.allVisibleSelected}
            openEdit={s.openEdit}
            load={s.load}
          />
          <ItemsPageCards
            items={s.items}
            selectedIds={s.selectedIds}
            isAdmin={s.isAdmin}
            toggleSelect={s.toggleSelect}
            openEdit={s.openEdit}
            load={s.load}
          />
          <ItemsPagePagination
            page={s.page}
            setPage={s.setPage}
            totalPages={s.totalPages}
            total={s.total}
            stockFilter={s.stockFilter}
            isAdmin={s.isAdmin}
            includeRetired={s.includeRetired}
            replacementRemind={s.replacementRemind}
          />
        </>
      )}

      {!s.loading && s.items.length === 0 && !s.error && <p className={styles.empty}>Ничего не найдено.</p>}

      <ItemFormModal open={s.modalOpen} item={s.editing} onClose={s.closeModal} onSaved={() => void s.load()} />

      <ItemsPageBulkModal
        bulkOpen={s.bulkOpen}
        setBulkOpen={s.setBulkOpen}
        bulkSaving={s.bulkSaving}
        setBulkSaving={s.setBulkSaving}
        bulkErr={s.bulkErr}
        setBulkErr={s.setBulkErr}
        selectedIds={s.selectedIds}
        bulkLocation={s.bulkLocation}
        setBulkLocation={s.setBulkLocation}
        bulkCategoryId={s.bulkCategoryId}
        setBulkCategoryId={s.setBulkCategoryId}
        bulkCategories={s.bulkCategories}
        refreshDashboardSummary={s.refreshDashboardSummary}
        load={s.load}
      />
    </div>
  );
}

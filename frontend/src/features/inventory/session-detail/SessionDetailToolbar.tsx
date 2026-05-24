import { ActionMenuGroup } from "@/shared/components/ui/ActionMenuGroup";
import actionMenuStyles from "@/shared/components/ui/ActionMenuGroup.module.css";
import { Button } from "@/shared/components/ui/Button";
import { ROW_FILTER_LABELS, type RowFilter } from "./constants";
import type { SessionDetailPageModel } from "./types";
import common from "./sessionDetailCommon.module.css";
import styles from "./SessionDetailToolbar.module.css";

type Props = { m: SessionDetailPageModel };

export function SessionDetailToolbar({ m }: Props) {
  const { sum, locked, hasUnsavedOnPage, scanQuery, scanStatus } = m;

  return (
    <>
      <div className={`${styles.filters} ${common.noPrint}`}>
        <ActionMenuGroup
          label="Фильтр позиций"
          triggerLabel={ROW_FILTER_LABELS[m.rowFilter]}
          triggerVariant={m.rowFilter === "all" ? "primary" : "outline"}
        >
          {(Object.keys(ROW_FILTER_LABELS) as RowFilter[]).map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              className={m.rowFilter === key ? actionMenuStyles.menuItemActive : undefined}
              onClick={() => m.setRowFilter(key)}
            >
              {ROW_FILTER_LABELS[key]}
            </Button>
          ))}
        </ActionMenuGroup>
        <Button
          type="button"
          variant="outline"
          responsiveFull
          onClick={() => {
            m.setRowFilter("mismatch");
            m.setFocusAfterFilter(true);
          }}
        >
          Быстрый пересчет
        </Button>
      </div>
      <div className={`${styles.grouping} ${common.noPrint}`}>
        <span className={styles.groupingLabel}>Группировка:</span>
        <Button type="button" variant={m.groupBy === "none" ? "primary" : "outline"} onClick={() => m.setGroupBy("none")}>
          Нет
        </Button>
        <Button
          type="button"
          variant={m.groupBy === "location" ? "primary" : "outline"}
          onClick={() => m.setGroupBy("location")}
        >
          По локации
        </Button>
        <Button
          type="button"
          variant={m.groupBy === "category" ? "primary" : "outline"}
          onClick={() => m.setGroupBy("category")}
        >
          По категории
        </Button>
      </div>
      <div className={`${styles.locationRow} ${common.noPrint}`}>
        <label className={styles.locationLabel} htmlFor="sess-location-filter">
          Локация (фильтр)
        </label>
        <input
          id="sess-location-filter"
          className={styles.locationInput}
          type="search"
          value={m.locationFilterRaw}
          onChange={(e) => m.setLocationFilterRaw(e.target.value)}
          placeholder="Например: Склад-1 или A-203"
          aria-label="Фильтр строк по локации из карточки объекта"
          autoComplete="off"
        />
      </div>
      {sum && (
        <>
          <div className={styles.metrics}>
            <article className={styles.metricCard}>
              <p className={styles.metricLabel}>Не посчитано</p>
              <p className={styles.metricValue}>{sum.pending}</p>
            </article>
            <article className={styles.metricCard}>
              <p className={styles.metricLabel}>Совпадает</p>
              <p className={styles.metricValue}>{sum.match}</p>
            </article>
            <article className={styles.metricCard}>
              <p className={styles.metricLabel}>Расхождения</p>
              <p className={styles.metricValue}>{sum.mismatch}</p>
            </article>
            <article className={styles.metricCard}>
              <p className={styles.metricLabel}>Отсутствует</p>
              <p className={styles.metricValue}>{sum.missing}</p>
            </article>
          </div>
          {!locked && hasUnsavedOnPage && (
            <p className={styles.metricsHintWarn} role="status">
              Есть несохранённые изменения.
            </p>
          )}
        </>
      )}
      <div className={`${styles.scanBar} ${common.noPrint}`}>
        <input
          className={styles.scanInput}
          type="text"
          value={scanQuery}
          onChange={(e) => m.setScanQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void m.runScan(scanQuery);
            }
          }}
          placeholder="SKU или название"
          aria-label="Поиск позиции в документе"
        />
        <Button type="button" variant="outline" responsiveFull onClick={() => void m.runScan(scanQuery)}>
          Найти
        </Button>
      </div>
      {scanStatus && <p className={styles.scanStatus}>{scanStatus}</p>}
    </>
  );
}

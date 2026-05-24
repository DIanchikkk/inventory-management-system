import { Fragment } from "react";
import { formatDelta } from "@/shared/utils/inventoryDisplay";
import { resultCounterLabel } from "@/shared/utils/sessionDisplay";
import { StatusBadge } from "@/shared/components/ui/StatusBadge";
import { buildLineRowModel } from "./lineRowModel";
import type { SessionDetailPageModel } from "./types";
import inputs from "./SessionDetailLinesInputs.module.css";
import styles from "./SessionDetailLines.module.css";
import table from "./SessionDetailTable.module.css";

type Props = { m: SessionDetailPageModel };

export function SessionDetailLinesTable({ m }: Props) {
  const { groupedPageItems, groupBy, resultByItemId, drafts, comments, locked, highlightItemId } = m;

  return (
    <div className={styles.tableWrap}>
      <table className={table.table}>
        <thead>
          <tr>
            <th>Объект</th>
            <th>Учётное количество</th>
            <th>Фактическое</th>
            <th>Комментарий</th>
            <th>Кто/когда</th>
            <th>Отклонение</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {groupedPageItems.map((g) => (
            <Fragment key={`group-${g.key}`}>
              {groupBy !== "none" && (
                <tr className={styles.groupRow}>
                  <td colSpan={7}>{g.title}</td>
                </tr>
              )}
              {g.items.map((it) => {
                const res = resultByItemId.get(it.id);
                const draft = drafts[it.id] ?? "";
                const row = buildLineRowModel(it, draft, comments[it.id] ?? "", res, locked);
                return (
                  <tr
                    key={it.id}
                    id={`inv-${it.id}`}
                    className={`${row.rowClass} ${highlightItemId === it.id ? styles.rowHighlight : ""}`.trim()}
                  >
                    <td className={styles.nameCell}>{it.name}</td>
                    <td>{it.quantity}</td>
                    <td>
                      <input
                        className={inputs.qtyInput}
                        type="number"
                        min={0}
                        disabled={locked}
                        value={draft}
                        ref={(el) => {
                          m.qtyRefs.current[it.id] = el;
                        }}
                        onChange={(e) => m.setDraft(it.id, e.target.value)}
                        onKeyDown={(e) => m.onQtyKeyDown(e, it.id)}
                        aria-label={`Фактическое количество для ${it.name}`}
                      />
                    </td>
                    <td className={row.commentMissing ? inputs.commentCellWarn : undefined}>
                      <input
                        className={[inputs.commentInput, row.commentMissing ? inputs.commentInputWarn : ""]
                          .filter(Boolean)
                          .join(" ")}
                        type="text"
                        maxLength={200}
                        disabled={locked}
                        value={comments[it.id] ?? ""}
                        onChange={(e) => m.setComment(it.id, e.target.value)}
                        placeholder={row.commentMissing ? "Причина" : "Комментарий"}
                        aria-label={`Комментарий для ${it.name}`}
                        aria-invalid={row.commentMissing}
                      />
                    </td>
                    <td className={styles.metaCell}>
                      <div>{resultCounterLabel(res)}</div>
                      {res?.counted_at ? <div>{new Date(res.counted_at).toLocaleString("ru-RU")}</div> : null}
                      {res?.recount_count ? <div>Пересчетов: {res.recount_count}</div> : null}
                    </td>
                    <td className={`${styles.deltaCell} ${row.deltaClass}`}>{formatDelta(row.delta)}</td>
                    <td>
                      <StatusBadge kind={row.kind} />
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

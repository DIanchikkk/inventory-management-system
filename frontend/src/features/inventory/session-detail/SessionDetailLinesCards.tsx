import { formatDelta } from "@/shared/utils/inventoryDisplay";
import { resultCounterLabel } from "@/shared/utils/sessionDisplay";
import { StatusBadge } from "@/shared/components/ui/StatusBadge";
import { buildLineRowModel } from "./lineRowModel";
import type { SessionDetailPageModel } from "./types";
import common from "./sessionDetailCommon.module.css";
import cards from "./SessionDetailLinesCards.module.css";
import inputs from "./SessionDetailLinesInputs.module.css";
import styles from "./SessionDetailLines.module.css";

type Props = { m: SessionDetailPageModel };

export function SessionDetailLinesCards({ m }: Props) {
  const { groupedPageItems, groupBy, resultByItemId, drafts, comments, locked, highlightItemId } = m;

  return (
    <div className={`${cards.cardList} ${common.noPrint}`}>
      {groupedPageItems.map((g) => (
        <div key={`card-group-${g.key}`}>
          {groupBy !== "none" && <p className={cards.cardGroupTitle}>{g.title}</p>}
          {g.items.map((it) => {
            const res = resultByItemId.get(it.id);
            const draft = drafts[it.id] ?? "";
            const row = buildLineRowModel(it, draft, comments[it.id] ?? "", res, locked);
            return (
              <article
                key={it.id}
                className={`${cards.card} ${row.cardTone} ${highlightItemId === it.id ? cards.cardHighlight : ""}`.trim()}
                id={`inv-m-${it.id}`}
              >
                <div className={cards.cardTitle}>{it.name}</div>
                <div className={cards.cardRow}>
                  <span>Учётное количество: {it.quantity}</span>
                  <StatusBadge kind={row.kind} />
                </div>
                <p className={`${styles.cardDelta} ${row.deltaClass}`}>
                  Отклонение: <strong>{formatDelta(row.delta)}</strong>
                </p>
                <label className={cards.cardLabel}>
                  Фактическое
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
                  />
                </label>
                <label className={cards.cardLabel}>
                  Комментарий
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
                    aria-invalid={row.commentMissing}
                  />
                </label>
                <p className={cards.cardMeta}>
                  Кто: {resultCounterLabel(res)}
                  <br />
                  Когда: {res?.counted_at ? new Date(res.counted_at).toLocaleString("ru-RU") : "—"}
                  {res?.recount_count ? (
                    <>
                      <br />
                      Пересчетов: {res.recount_count}
                    </>
                  ) : null}
                </p>
              </article>
            );
          })}
        </div>
      ))}
    </div>
  );
}

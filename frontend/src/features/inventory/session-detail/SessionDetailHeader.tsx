import {
  exportDiscrepanciesCsv,
  exportSessionAuditCsv,
  exportSessionCsv,
} from "@/shared/api/inventory.api";
import { ActionMenuGroup, ActionMenuLink } from "@/shared/components/ui/ActionMenuGroup";
import { Button } from "@/shared/components/ui/Button";
import { sessionCreatorLabel } from "@/shared/utils/sessionDisplay";
import { sessionStatusLabel } from "@/shared/utils/inventoryDisplay";
import type { SessionDetailPageModel } from "./types";
import common from "./sessionDetailCommon.module.css";
import styles from "./SessionDetailHeader.module.css";

type Props = { m: SessionDetailPageModel };

export function SessionDetailHeader({ m }: Props) {
  const { detail, locked, saving, countedCount, totalCount, progressPercent } = m;
  if (!detail) return null;

  return (
    <header className={styles.top}>
      <div className={styles.topMain}>
        <h1 className={styles.title}>
          {(detail.session.document_no ?? "").trim() ? `${detail.session.document_no} · ` : ""}
          документ от {new Date(detail.session.created_at).toLocaleString("ru-RU")}
        </h1>
        <p className={styles.subtitle}>
          Статус: {sessionStatusLabel(detail.session.status)} · Автор: {sessionCreatorLabel(detail.session)}
        </p>
        {(detail.session.notes?.trim() ||
          detail.session.filter_location?.trim() ||
          detail.session.filter_category_name?.trim()) && (
          <dl className={styles.docMeta}>
            {detail.session.notes?.trim() ? (
              <>
                <dt className={styles.docMetaDt}>Примечание</dt>
                <dd className={styles.docMetaDd}>{detail.session.notes.trim()}</dd>
              </>
            ) : null}
            {detail.session.filter_location?.trim() ? (
              <>
                <dt className={styles.docMetaDt}>Выборка: локация</dt>
                <dd className={styles.docMetaDd}>{detail.session.filter_location.trim()}</dd>
              </>
            ) : null}
            {detail.session.filter_category_name?.trim() ? (
              <>
                <dt className={styles.docMetaDt}>Выборка: категория</dt>
                <dd className={styles.docMetaDd}>{detail.session.filter_category_name.trim()}</dd>
              </>
            ) : null}
          </dl>
        )}
        <p className={styles.subtitle}>
          Прогресс: {countedCount}/{totalCount} ({progressPercent}%)
        </p>
        <div className={`${styles.topActions} ${common.noPrint}`}>
          {!locked && (
            <>
              <ActionMenuGroup
                label="Сохранение результатов"
                triggerLabel={saving ? "Сохранение…" : "Сохранить"}
                triggerVariant="primary"
                disabled={saving}
              >
                <Button type="button" variant="outline" onClick={() => void m.saveBatch("all")} disabled={saving}>
                  {saving ? "Сохранение…" : "Сохранить"}
                </Button>
                <Button type="button" variant="outline" onClick={() => void m.saveBatch("visible")} disabled={saving}>
                  {saving ? "Сохранение…" : "Сохранить видимые"}
                </Button>
              </ActionMenuGroup>
              {(detail.session.status === "active" || detail.session.status === "review") && (
                <ActionMenuGroup
                  label="Этап документа"
                  triggerLabel={detail.session.status === "review" ? "Провести документ" : "На проверку"}
                  triggerVariant="outline"
                  disabled={saving}
                >
                  {detail.session.status === "active" ? (
                    <Button type="button" variant="outline" onClick={() => void m.toReview()} disabled={saving}>
                      На проверку
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={() => void m.finish()} disabled={saving}>
                    Провести документ
                  </Button>
                </ActionMenuGroup>
              )}
            </>
          )}
          {detail.session.status === "completed" && (
            <Button type="button" variant="outline" onClick={() => void m.toArchive()} disabled={saving}>
              В архив
            </Button>
          )}
          <ActionMenuGroup label="Экспорт и печать" triggerLabel="Экспорт" triggerVariant="outline" panelAlign="end">
            <Button type="button" variant="outline" onClick={() => m.sessionId && void exportSessionCsv(m.sessionId)}>
              Экспорт отчета CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => m.sessionId && void exportDiscrepanciesCsv(m.sessionId)}
            >
              Акт расхождений CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => m.sessionId && void exportSessionAuditCsv(m.sessionId)}>
              Журнал аудита CSV
            </Button>
            {m.sessionId ? (
              <ActionMenuLink to={`/inventory/sessions/${m.sessionId}/print-sheet`}>Опись для печати</ActionMenuLink>
            ) : null}
          </ActionMenuGroup>
        </div>
      </div>
    </header>
  );
}

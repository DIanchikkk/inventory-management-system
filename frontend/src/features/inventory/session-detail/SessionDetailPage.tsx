import { Link } from "react-router-dom";
import { Alert } from "@/shared/components/ui/Alert";
import { Button } from "@/shared/components/ui/Button";
import { Spinner } from "@/shared/components/ui/Spinner";
import { SessionDetailExtras } from "./SessionDetailExtras";
import { SessionDetailHeader } from "./SessionDetailHeader";
import { SessionDetailLinesCards } from "./SessionDetailLinesCards";
import { SessionDetailLinesTable } from "./SessionDetailLinesTable";
import { SessionDetailStockLedger } from "./SessionDetailStockLedger";
import { SessionDetailToolbar } from "./SessionDetailToolbar";
import { useSessionDetailActions } from "./useSessionDetailActions";
import { useSessionDetailData } from "./useSessionDetailData";
import common from "./sessionDetailCommon.module.css";
import styles from "./SessionDetailPage.module.css";

export function SessionDetailPage() {
  const data = useSessionDetailData();
  const actions = useSessionDetailActions(data);
  const m = { ...data, ...actions };

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link className={styles.backLink} to="/inventory/sessions">
          ← К списку документов
        </Link>
      </p>

      {m.loading && <Spinner />}
      {m.saveNotice && !m.loading && <Alert variant="success">{m.saveNotice}</Alert>}
      {m.error && !m.loading && <Alert>{m.error}</Alert>}

      {!m.loading && m.detail && (
        <>
          <SessionDetailHeader m={m} />
          <SessionDetailToolbar m={m} />
          <SessionDetailStockLedger m={m} />

          {m.linesLoading && m.lineItems.length === 0 && <Spinner />}
          <SessionDetailLinesTable m={m} />
          <SessionDetailLinesCards m={m} />

          {m.linesTotal === 0 && !m.linesLoading && <p className={styles.banner}>По выбранному фильтру нет позиций.</p>}
          {m.linesTotal > 0 && (
            <div className={`${styles.pagination} ${common.noPrint}`}>
              <Button type="button" variant="outline" disabled={m.linesPage <= 1} onClick={() => m.setLinesPage((p) => p - 1)}>
                Назад
              </Button>
              <span className={styles.pageInfo}>
                Страница {m.linesPage} из {m.totalPages} · всего по фильтру {m.linesTotal} позиций
                {m.lineQuery ? ` · поиск «${m.lineQuery}»` : ""}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={m.linesPage >= m.totalPages}
                onClick={() => m.setLinesPage((p) => p + 1)}
              >
                Вперёд
              </Button>
            </div>
          )}
          <SessionDetailExtras m={m} />
        </>
      )}
    </div>
  );
}

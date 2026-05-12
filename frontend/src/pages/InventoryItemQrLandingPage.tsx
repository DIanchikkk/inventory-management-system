import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Spinner } from "../components/ui/Spinner";
import styles from "./InventoryItemQrLandingPage.module.css";

export function InventoryItemQrLandingPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!itemId) {
      navigate("/inventory/sessions", { replace: true });
      return;
    }
    navigate("/inventory/sessions", {
      replace: true,
      state: { focusItemId: itemId },
    });
  }, [itemId, navigate]);

  return (
    <div className={styles.wrap}>
      <Spinner />
      <p className={styles.hint}>Переход к инвентаризации…</p>
      <p className={styles.explain}>
        QR на документе кодирует ссылку на эту страницу. После перехода открывается список документа инвентаризации с
        подсветкой позиции: введите <strong>фактическое количество</strong> (на складе) рядом с <strong>учётным</strong> и
        сохраните строку; затем «Провести документ» выровняет остатки и при расхождениях запишет движения в реестр.
      </p>
    </div>
  );
}

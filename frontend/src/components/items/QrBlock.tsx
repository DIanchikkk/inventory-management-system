import { QRCodeSVG } from "qrcode.react";
import { MutedText } from "../ui/MutedText";
import styles from "./QrBlock.module.css";

type QrBlockProps = {
  title?: string;
  url: string;
  size?: number;
  /** Пояснение под кодом (для записки и пользователей). */
  hint?: string;
};

export function QrBlock({ title = "QR-код", url, size = 160, hint }: QrBlockProps) {
  return (
    <div className={styles["qr-block"]}>
      <p className={styles["qr-block__caption"]}>
        <MutedText>{title}</MutedText>
      </p>
      <QRCodeSVG className={styles["qr-block__canvas"]} value={url} size={size} level="M" />
      {hint ? (
        <p className={styles["qr-block__hint"]}>
          <MutedText>{hint}</MutedText>
        </p>
      ) : null}
    </div>
  );
}

import { QRCodeSVG } from "qrcode.react";
import { MutedText } from "../ui/MutedText";
import styles from "./QrBlock.module.css";

type QrBlockProps = {
  url: string;
  /** SVG size in px; scales down via CSS on narrow screens */
  size?: number;
};

export function QrBlock({ url, size = 160 }: QrBlockProps) {
  return (
    <div className={styles["qr-block"]}>
      <p className={styles["qr-block__caption"]}>
        <MutedText>QR — быстрый переход к карточке (URL)</MutedText>
      </p>
      <QRCodeSVG className={styles["qr-block__canvas"]} value={url} size={size} level="M" />
    </div>
  );
}

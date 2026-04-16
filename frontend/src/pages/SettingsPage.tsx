import { Card } from "../components/ui/Card";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Настройки</h1>
        <p className={styles.subtitle}>Параметры учётной записи и приложения (MVP — заглушка).</p>
      </header>
      <Card>
        <p className={styles.note}>
          Здесь позже появятся настройки профиля, уведомлений и экспорта. Сейчас управление пользователями выполняется на
          стороне сервера.
        </p>
      </Card>
    </div>
  );
}

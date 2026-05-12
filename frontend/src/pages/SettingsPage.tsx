import { useEffect, useRef, useState } from "react";
import { createCategory, fetchCategories } from "../api/categories.api";
import { downloadInventorySnapshotJson, importItemsCsv } from "../api/items.api";
import type { Category } from "../types";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/useAuth";
import { getErrorMessage } from "../utils/errors";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  const { isAdmin } = useAuth();
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [catErr, setCatErr] = useState<string | null>(null);
  const [catSaving, setCatSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchCategories().then(setCategories).catch(() => setCategories([]));
  }, [isAdmin]);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Настройки"
        subtitle="Параметры учётной записи и сервисные действия администратора."
      />

      {isAdmin ? (
        <Card narrow className={styles.adminCard}>
          <h2 className={styles.sectionTitle}>Категории объектов учёта</h2>
          <p className={styles.sectionLead}>
            Отдельная таблица в базе (справочник). Используется в форме объекта и при создании документа инвентаризации.
            Название категории уникально.
          </p>
          <details className={styles.catDetails} open>
            <summary className={styles.catSummary}>Справочник категорий (таблица)</summary>
            {categories.length === 0 ? (
              <p className={styles.catEmpty}>Список пуст или не загрузился.</p>
            ) : (
              <div className={styles.catTableWrap}>
                <table className={styles.catTable}>
                  <thead>
                    <tr>
                      <th scope="col">№</th>
                      <th scope="col">Идентификатор (UUID)</th>
                      <th scope="col">Наименование</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c, i) => (
                      <tr key={c.id}>
                        <td>{i + 1}</td>
                        <td className={styles.catMono}>{c.id}</td>
                        <td>{c.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>
          <div className={styles.catAdd}>
            <input
              className={styles.catInput}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Новая категория"
              aria-label="Название новой категории"
            />
            <Button
              type="button"
              variant="outline"
              disabled={catSaving || !newCatName.trim()}
              onClick={() => {
                void (async () => {
                  setCatErr(null);
                  setCatSaving(true);
                  try {
                    await createCategory(newCatName.trim());
                    setNewCatName("");
                    setCategories(await fetchCategories());
                  } catch (err) {
                    setCatErr(getErrorMessage(err));
                  } finally {
                    setCatSaving(false);
                  }
                })();
              }}
            >
              {catSaving ? "…" : "Добавить"}
            </Button>
          </div>
          {catErr ? <Alert>{catErr}</Alert> : null}

          <h2 className={styles.sectionTitle}>Данные каталога</h2>
          <p className={styles.sectionLead}>
            CSV — тот же формат, что при «Экспорт CSV» на странице объектов. JSON — выгрузка для архива (ограничения на сервере,
            не полная копия PostgreSQL).
          </p>
          <div className={styles.toolGrid}>
            <div className={styles.toolBlock}>
              <span className={styles.toolLabel}>CSV</span>
              <p className={styles.toolHint}>Загрузить таблицу из файла: обновление по SKU или колонке id.</p>
              <Button
                type="button"
                variant="outline"
                responsiveFull
                onClick={() => {
                  setFileErr(null);
                  csvInputRef.current?.click();
                }}
              >
                Выбрать файл…
              </Button>
            </div>
            <div className={styles.toolBlock}>
              <span className={styles.toolLabel}>JSON</span>
              <p className={styles.toolHint}>Скачать снимок объектов и последних сессий одним файлом.</p>
              <Button
                type="button"
                variant="outline"
                responsiveFull
                onClick={async () => {
                  setFileErr(null);
                  try {
                    await downloadInventorySnapshotJson();
                  } catch (err) {
                    setFileErr(getErrorMessage(err));
                  }
                }}
              >
                Скачать JSON
              </Button>
            </div>
          </div>
          <input
            ref={csvInputRef}
            className={styles.hiddenFile}
            type="file"
            accept=".csv,text/csv"
            aria-hidden
            tabIndex={-1}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setFileErr(null);
              setImportNotice(null);
              try {
                const r = await importItemsCsv(file);
                const errTail =
                  r.errors.length > 0 ? ` Ошибки: ${r.errors.slice(0, 6).join("; ")}${r.errors.length > 6 ? "…" : ""}` : "";
                setImportNotice(`Готово: создано ${r.created}, обновлено ${r.updated}.${errTail}`);
              } catch (err) {
                setFileErr(getErrorMessage(err));
              }
            }}
          />
          {importNotice ? <Alert variant="success">{importNotice}</Alert> : null}
          {fileErr ? <Alert>{fileErr}</Alert> : null}
        </Card>
      ) : null}

      <Card narrow>
        <p className={styles.note}>
          Управление пользователями и ролями выполняется на стороне сервера. Дополнительные настройки профиля можно добавить
          позже.
        </p>
      </Card>
    </div>
  );
}

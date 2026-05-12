import { type FormEvent, useEffect, useState } from "react";
import { fetchCategories } from "../../api/categories.api";
import { createItem, updateItem } from "../../api/items.api";
import type { Category, Item, ItemPayload } from "../../types";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { getErrorMessage } from "../../utils/errors";
import styles from "./ItemFormModal.module.css";

function toDateInput(iso: string): string {
  if (!iso) return "";
  const d = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

type ItemFormModalProps = {
  open: boolean;
  item: Item | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ItemFormModal({ open, item, onClose, onSaved }: ItemFormModalProps) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesErr, setCategoriesErr] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState("шт");
  const [location, setLocation] = useState("");
  const [minQuantity, setMinQuantity] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [serviceLifeYears, setServiceLifeYears] = useState(4);
  const [retired, setRetired] = useState(false);
  const [replacedBy, setReplacedBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCategoriesErr(null);
    void fetchCategories()
      .then(setCategories)
      .catch(() => setCategoriesErr("Не удалось загрузить категории"));
    if (item) {
      setSku(item.sku);
      setName(item.name);
      setCategoryId(item.category_id ?? "");
      setDescription(item.description);
      setQuantity(item.quantity);
      setUnit(item.unit?.trim() ? item.unit : "шт");
      setLocation(item.location || "");
      setMinQuantity(item.min_quantity ?? 0);
      setPurchaseDate(toDateInput(item.purchase_date));
      setImageUrl(item.image_url ?? "");
      setServiceLifeYears(item.service_life_years ?? 4);
      setRetired(Boolean(item.retired_at));
      setReplacedBy(item.replaced_by_item_id ?? "");
    } else {
      setSku("");
      setName("");
      setCategoryId("");
      setDescription("");
      setQuantity(0);
      setUnit("шт");
      setLocation("");
      setMinQuantity(0);
      setPurchaseDate(toDateInput(new Date().toISOString()));
      setImageUrl("");
      setServiceLifeYears(4);
      setRetired(false);
      setReplacedBy("");
    }
  }, [open, item]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const life = Math.min(40, Math.max(1, Number(serviceLifeYears) || 4));
    const payload: ItemPayload = {
      sku: sku.trim(),
      name: name.trim(),
      category_id: categoryId.trim(),
      description: description.trim(),
      quantity: Number(quantity),
      unit: unit.trim() || "шт",
      location: location.trim(),
      min_quantity: Number(minQuantity),
      purchase_date: purchaseDate,
      image_url: imageUrl.trim(),
      service_life_years: life,
      retired,
      ...(retired ? { replaced_by_item_id: replacedBy.trim() } : {}),
    };
    try {
      if (item) await updateItem(item.id, payload);
      else await createItem(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? "Изменить объект" : "Новый объект"}
      titleId="item-form-title"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" form="item-form-modal" disabled={loading}>
            {loading ? "…" : "Сохранить"}
          </Button>
        </>
      }
    >
      {error && <Alert>{error}</Alert>}
      <form id="item-form-modal" onSubmit={onSubmit}>
        <Input
          id="item-sku"
          label="Код (SKU)"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          required
        />
        <Input
          id="item-name"
          label="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className={styles.field}>
          <label className={styles.label} htmlFor="item-category">
            Категория
          </label>
          {categoriesErr ? <p className={styles.hintErr}>{categoriesErr}</p> : null}
          <select
            id="item-category"
            className={styles.select}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">— выберите из справочника —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className={styles.fieldHint}>Справочник категорий ведётся отдельно (Настройки → категории).</p>
        </div>
        <Input
          id="item-desc"
          label="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Input
          id="item-image"
          label="Фото (URL или путь на сервере)"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="/uploads/item-images/… или https://…"
        />
        <Input
          id="item-life"
          label="Нормативный срок службы до замены (лет)"
          type="number"
          min={1}
          max={40}
          value={String(serviceLifeYears)}
          onChange={(e) => setServiceLifeYears(Number(e.target.value))}
        />
        <p className={styles.fieldHint}>
          По умолчанию для нового объекта — <strong>4 года</strong> до ориентировочной даты замены (можно изменить).
        </p>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={retired} onChange={(e) => setRetired(e.target.checked)} />
          <span>Списано / заменено (история инвентаризаций сохраняется)</span>
        </label>
        {retired && (
          <Input
            id="item-successor"
            label="Замена: UUID объекта, на который заменена эта единица (в карточке будет видно SKU и название)"
            value={replacedBy}
            onChange={(e) => setReplacedBy(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        )}
        <Input
          id="item-qty"
          label="Количество"
          type="number"
          min={0}
          value={String(quantity)}
          onChange={(e) => setQuantity(Number(e.target.value))}
          required
        />
        <Input
          id="item-unit"
          label="Единица измерения"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="шт, кг, м³…"
          required
        />
        <p className={styles.fieldHint}>Для материальных объектов учёта обычно указывают <strong>шт</strong> (штука).</p>
        <Input
          id="item-location"
          label="Локация (склад/зона)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
        />
        <Input
          id="item-min-qty"
          label="Минимальный остаток (порог для напоминания)"
          type="number"
          min={0}
          value={String(minQuantity)}
          onChange={(e) => setMinQuantity(Number(e.target.value))}
          required
        />
        <p className={styles.fieldHint}>
          Минимальный остаток — порог для напоминаний и отчёта «мало на складе»; на колонку «учётное количество» в документе
          инвентаризации <strong>не</strong> влияет.
        </p>
        <Input
          id="item-date"
          label="Дата покупки"
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          required
        />
      </form>
    </Modal>
  );
}

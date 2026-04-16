import { type FormEvent, useEffect, useState } from "react";
import { createItem, updateItem } from "../../api/items.api";
import type { Item, ItemPayload } from "../../types";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { getErrorMessage } from "../../utils/errors";

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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (item) {
      setName(item.name);
      setDescription(item.description);
      setQuantity(item.quantity);
      setPurchaseDate(toDateInput(item.purchase_date));
    } else {
      setName("");
      setDescription("");
      setQuantity(0);
      setPurchaseDate(toDateInput(new Date().toISOString()));
    }
  }, [open, item]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const payload: ItemPayload = {
      name: name.trim(),
      description: description.trim(),
      quantity: Number(quantity),
      purchase_date: purchaseDate,
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
          id="item-name"
          label="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          id="item-desc"
          label="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
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

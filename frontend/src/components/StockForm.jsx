import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import { formatNumber, stockLevel } from "../utils/format";
import FormField from "./FormField";
import Modal from "./Modal";

const MOVEMENTS = [
  { value: "in", label: "Stock in", icon: ArrowDownToLine },
  { value: "out", label: "Stock out", icon: ArrowUpFromLine },
  { value: "adjustment", label: "Adjustment", icon: SlidersHorizontal },
];

export default function StockForm({
  open,
  product,
  initialType = "in",
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
    type: initialType,
    quantity: "",
    reference: "",
    note: "",
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ type: initialType, quantity: "", reference: "", note: "" });
    setErrors({});
    setMessage("");
  }, [open, initialType, product?.id]);

  const current = product?.quantity_on_hand ?? 0;
  const parsedQuantity = form.quantity === "" ? null : Number(form.quantity);
  const preview =
    parsedQuantity === null
      ? null
      : form.type === "in"
        ? current + parsedQuantity
        : form.type === "out"
          ? current - parsedQuantity
          : parsedQuantity;
  const negativePreview = preview !== null && preview < 0;

  function update(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};

    if (form.quantity === "" || Number.isNaN(Number(form.quantity))) {
      nextErrors.quantity = "Enter a quantity.";
    } else if (form.type === "adjustment" && Number(form.quantity) < 0) {
      nextErrors.quantity = "Counted quantity cannot be negative.";
    } else if (form.type !== "adjustment" && Number(form.quantity) < 1) {
      nextErrors.quantity = "Quantity must be at least 1.";
    } else if (form.type === "out" && Number(form.quantity) > current) {
      nextErrors.quantity = `Only ${current} units are in stock.`;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await api.post(`/products/${product.id}/stock`, {
        type: form.type,
        quantity: Number(form.quantity),
        reference: form.reference.trim() || null,
        note: form.note.trim() || null,
      });
      onSaved();
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!open || !product) return null;

  return (
    <Modal
      title="Record stock movement"
      subtitle={`${product.name} · ${product.sku}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        {message ? <div className="alert alert--error">{message}</div> : null}

        <div className="current-stock">
          <span>Current stock</span>
          <strong>
            {formatNumber(current)} <small>units</small>
          </strong>
          <span className={`current-stock__dot current-stock__dot--${stockLevel(product)}`} />
        </div>

        <div className="movement-switch" role="group" aria-label="Movement type">
          {MOVEMENTS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={`movement-switch__button${form.type === value ? " is-active" : ""}`}
              onClick={() => update("type", value)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <FormField
            label={
              form.type === "adjustment"
                ? "Counted quantity"
                : form.type === "in"
                  ? "Quantity received"
                  : "Quantity removed"
            }
            htmlFor="quantity"
            required
            error={errors.quantity}
            className="span-2"
          >
            <input
              id="quantity"
              type="number"
              min="0"
              step="1"
              value={form.quantity}
              onChange={(event) => update("quantity", event.target.value)}
              placeholder="0"
              autoFocus
            />
          </FormField>

          <div className={`stock-preview${negativePreview ? " stock-preview--invalid" : ""}`}>
            <span>New stock level</span>
            <strong>
              {preview === null ? "—" : `${formatNumber(preview)} units`}
            </strong>
            {negativePreview ? <small>Not enough stock for this movement.</small> : null}
          </div>

          <FormField label="Reference" htmlFor="reference" error={errors.reference}>
            <input
              id="reference"
              value={form.reference}
              onChange={(event) => update("reference", event.target.value)}
              placeholder="GRN-1042 / SO-2291"
              maxLength={80}
            />
          </FormField>

          <FormField
            label="Note"
            htmlFor="stock_note"
            error={errors.note}
            className="span-2"
          >
            <textarea
              id="stock_note"
              rows={3}
              value={form.note}
              onChange={(event) => update("note", event.target.value)}
              placeholder="Delivery condition, reason for adjustment, or order details…"
              maxLength={500}
            />
          </FormField>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={saving || negativePreview}
          >
            {saving ? <Loader2 size={17} className="spin" /> : null}
            Save movement
          </button>
        </div>
      </form>
    </Modal>
  );
}

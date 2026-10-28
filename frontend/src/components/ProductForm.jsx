import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import FormField from "./FormField";
import Modal from "./Modal";

const EMPTY_FORM = {
  sku: "",
  name: "",
  category: "",
  unit_price: "",
  quantity_on_hand: "0",
  reorder_level: "0",
  supplier: "",
};

export default function ProductForm({ open, product, categories, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    setErrors({});
    setMessage("");

    if (product) {
      setForm({
        sku: product.sku || "",
        name: product.name || "",
        category: product.category || "",
        unit_price: product.unit_price ?? "",
        quantity_on_hand: String(product.quantity_on_hand ?? 0),
        reorder_level: String(product.reorder_level ?? 0),
        supplier: product.supplier || "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, product]);

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

    if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(form.sku)) {
      nextErrors.sku = "Use 3–40 uppercase letters, numbers, or dashes.";
    }
    if (!form.name.trim()) nextErrors.name = "Product name is required.";
    if (!form.category.trim()) nextErrors.category = "Category is required.";
    if (form.unit_price === "" || Number(form.unit_price) < 0) {
      nextErrors.unit_price = "Enter a valid unit price.";
    }
    if (Number(form.reorder_level) < 0) {
      nextErrors.reorder_level = "Reorder level cannot be negative.";
    }
    if (!product && Number(form.quantity_on_hand) < 0) {
      nextErrors.quantity_on_hand = "Opening stock cannot be negative.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      unit_price: Number(form.unit_price),
      reorder_level: Number(form.reorder_level || 0),
      supplier: form.supplier.trim() || null,
    };

    if (!product) {
      payload.quantity_on_hand = Number(form.quantity_on_hand || 0);
    }

    try {
      if (product) {
        await api.patch(`/products/${product.id}`, payload);
      } else {
        await api.post("/products", payload);
      }
      onSaved();
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <Modal
      title={product ? "Edit product" : "Add product"}
      subtitle={
        product
          ? "Update pricing or reorder settings. Stock changes are recorded separately."
          : "Create the product record, then add or remove stock as it moves."
      }
      onClose={onClose}
      wide
    >
      <form onSubmit={handleSubmit} noValidate>
        {message ? <div className="alert alert--error">{message}</div> : null}

        <div className="form-grid">
          <FormField label="SKU" htmlFor="sku" required error={errors.sku}>
            <input
              id="sku"
              value={form.sku}
              onChange={(event) => update("sku", event.target.value.toUpperCase())}
              placeholder="OFF-1001"
              maxLength={40}
              autoFocus
            />
          </FormField>

          <FormField label="Category" htmlFor="category" required error={errors.category}>
            <input
              id="category"
              list="category-options"
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
              placeholder="Office Supplies"
              maxLength={80}
            />
            <datalist id="category-options">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </FormField>

          <FormField
            label="Product name"
            htmlFor="name"
            required
            error={errors.name}
            className="span-2"
          >
            <input
              id="name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="A4 Copy Paper (500 sheets)"
              maxLength={150}
            />
          </FormField>

          <FormField label="Unit price (₹)" htmlFor="unit_price" required error={errors.unit_price}>
            <input
              id="unit_price"
              type="number"
              min="0"
              step="0.01"
              value={form.unit_price}
              onChange={(event) => update("unit_price", event.target.value)}
              placeholder="320"
            />
          </FormField>

          <FormField
            label="Reorder level"
            htmlFor="reorder_level"
            error={errors.reorder_level}
          >
            <input
              id="reorder_level"
              type="number"
              min="0"
              step="1"
              value={form.reorder_level}
              onChange={(event) => update("reorder_level", event.target.value)}
            />
          </FormField>

          {!product ? (
            <FormField
              label="Opening stock"
              htmlFor="quantity_on_hand"
              error={errors.quantity_on_hand}
            >
              <input
                id="quantity_on_hand"
                type="number"
                min="0"
                step="1"
                value={form.quantity_on_hand}
                onChange={(event) => update("quantity_on_hand", event.target.value)}
              />
            </FormField>
          ) : (
            <div className="form-note">
              <strong>{product.quantity_on_hand} units</strong> on hand now. Use
              <span> Record stock </span>
              to change the count.
            </div>
          )}

          <FormField
            label="Supplier"
            htmlFor="supplier"
            error={errors.supplier}
            className={product ? "span-2" : ""}
          >
            <input
              id="supplier"
              value={form.supplier}
              onChange={(event) => update("supplier", event.target.value)}
              placeholder="Sri Lakshmi Paper Co."
              maxLength={150}
            />
          </FormField>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? <Loader2 size={17} className="spin" /> : null}
            {product ? "Save changes" : "Create product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

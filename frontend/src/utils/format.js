export function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

export function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function stockLevel(product) {
  if (product.quantity_on_hand === 0) return "out";
  if (product.quantity_on_hand <= product.reorder_level) return "low";
  return "ok";
}

export function stockLabel(level) {
  return {
    out: "Out of stock",
    low: "Low stock",
    ok: "In stock",
  }[level];
}

export function movementLabel(type) {
  return {
    in: "Stock in",
    out: "Stock out",
    adjustment: "Adjustment",
  }[type] || type;
}

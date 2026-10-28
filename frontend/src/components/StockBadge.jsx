import { stockLabel, stockLevel } from "../utils/format";

export default function StockBadge({ product }) {
  const level = stockLevel(product);

  return (
    <span className={`stock-badge stock-badge--${level}`}>
      <span className="stock-badge__dot" />
      {stockLabel(level)}
    </span>
  );
}

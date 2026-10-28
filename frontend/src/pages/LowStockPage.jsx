import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine,
  CheckCircle2,
  CircleAlert,
  PackageX,
  RefreshCw,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import StockBadge from "../components/StockBadge";
import StockForm from "../components/StockForm";
import {
  formatCurrency,
  formatNumber,
  formatPrice,
  stockLevel,
} from "../utils/format";

const TABS = [
  { value: "all", label: "All" },
  { value: "out", label: "Out of stock" },
  { value: "low", label: "Low stock" },
];

function suggestedOrder(product) {
  const target = Math.max(product.reorder_level * 2, product.reorder_level + 1, 1);
  return Math.max(target - product.quantity_on_hand, 1);
}

export default function LowStockPage() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [stockProduct, setStockProduct] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [lowStockResponse, summaryResponse] = await Promise.all([
          api.get("/reports/low-stock"),
          api.get("/reports/summary"),
        ]);

        if (!ignore) {
          setItems(lowStockResponse.data.items);
          setSummary(summaryResponse.data);
        }
      } catch (requestError) {
        if (!ignore) setError(getErrorMessage(requestError));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const outOfStock = items.filter((product) => stockLevel(product) === "out");
  const lowStock = items.filter((product) => stockLevel(product) === "low");
  const visible = tab === "out" ? outOfStock : tab === "low" ? lowStock : items;
  const restockCost = items.reduce(
    (total, product) => total + suggestedOrder(product) * product.unit_price,
    0
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Replenishment"
        title="Restock queue"
        description="Products at or below their reorder level, prioritised by how urgently they need attention."
        actions={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setRefresh((value) => value + 1)}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <Link to="/" className="btn btn--primary">
              <ShoppingCart size={17} />
              Browse inventory
            </Link>
          </>
        }
      />

      <section className="stat-grid">
        <StatCard
          label="Needs attention"
          value={items.length}
          note="At or below reorder level"
          icon={TriangleAlert}
          tone="warning"
        />
        <StatCard
          label="Out of stock"
          value={outOfStock.length}
          note="Cannot be fulfilled today"
          icon={PackageX}
          tone="danger"
        />
        <StatCard
          label="Low stock"
          value={lowStock.length}
          note="Running down, still available"
          icon={CircleAlert}
        />
        <StatCard
          label="Estimated restock"
          value={formatCurrency(restockCost)}
          note="Refill to twice reorder level"
          icon={ArrowDownToLine}
          tone="accent"
        />
      </section>

      {notice ? (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      ) : null}

      <section className="panel panel--table">
        <div className="panel__header">
          <div>
            <h2>Open replenishments</h2>
            <p>
              Suggested quantities refill each product to twice its reorder level. Adjust
              them when you record the receipt.
            </p>
          </div>
          <div className="tab-bar" role="tablist" aria-label="Stock status">
            {TABS.map(({ value, label }) => {
              const count =
                value === "out"
                  ? outOfStock.length
                  : value === "low"
                    ? lowStock.length
                    : items.length;

              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  className={`tab${tab === value ? " is-active" : ""}`}
                  onClick={() => setTab(value)}
                >
                  {label}
                  <span className="tab__count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <div className="alert alert--error alert--inline">
            <span>{error}</span>
            <button
              type="button"
              className="text-btn"
              onClick={() => setRefresh((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="table-loading">
            <span className="spinner" />
            Checking stock levels…
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={
              items.length === 0
                ? "Every product is above its reorder level"
                : "Nothing in this view"
            }
            description={
              items.length === 0
                ? "The shelves are healthy. New alerts will appear here as stock is issued."
                : "Switch to another status to see the rest of the queue."
            }
            action={
              items.length > 0 ? (
                <button type="button" className="btn btn--ghost" onClick={() => setTab("all")}>
                  Show all
                </button>
              ) : (
                <Link to="/" className="btn btn--primary">
                  Back to inventory
                </Link>
              )
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Stock on hand</th>
                  <th className="num">Suggested order</th>
                  <th className="num hide-md">Est. cost</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => {
                  const quantity = suggestedOrder(product);

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="product-cell">
                          <strong>{product.name}</strong>
                          <span className="sku">
                            {product.sku}
                            {product.supplier ? ` · ${product.supplier}` : ""}
                          </span>
                        </div>
                      </td>
                      <td>
                        <StockBadge product={product} />
                      </td>
                      <td>
                        <div className="shortage-cell">
                          <strong>{formatNumber(product.quantity_on_hand)}</strong>
                          <span>reorder at {formatNumber(product.reorder_level)}</span>
                        </div>
                      </td>
                      <td className="num">
                        <span className="order-qty">
                          <strong>{formatNumber(quantity)}</strong> units
                        </span>
                      </td>
                      <td className="num hide-md">
                        {formatPrice(quantity * product.unit_price)}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn--sm btn--primary"
                            onClick={() => setStockProduct(product)}
                          >
                            <ArrowDownToLine size={14} />
                            Receive
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <StockForm
        open={Boolean(stockProduct)}
        product={stockProduct}
        initialType="in"
        onClose={() => setStockProduct(null)}
        onSaved={() => {
          setNotice(`Stock received for ${stockProduct.name}.`);
          setStockProduct(null);
          setRefresh((value) => value + 1);
        }}
      />
    </div>
  );
}

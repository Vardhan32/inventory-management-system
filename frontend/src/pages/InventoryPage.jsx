import { useEffect, useState } from "react";
import {
  Archive,
  ArrowDownUp,
  CheckCircle2,
  IndianRupee,
  Package,
  PackageX,
  Pencil,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import ProductForm from "../components/ProductForm";
import StatCard from "../components/StatCard";
import StockBadge from "../components/StockBadge";
import StockForm from "../components/StockForm";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPrice,
  stockLevel,
} from "../utils/format";

const DEFAULT_META = { page: 1, per_page: 8, total: 0, pages: 0 };

function StockMeter({ product }) {
  const level = stockLevel(product);
  const scale = Math.max(product.reorder_level * 2, product.quantity_on_hand, 1);
  const width = Math.min(100, (product.quantity_on_hand / scale) * 100);
  const marker = Math.min(100, (product.reorder_level / scale) * 100);

  return (
    <div className="stock-cell">
      <div className="stock-bar">
        <span
          className={`stock-bar__fill stock-bar__fill--${level}`}
          style={{ width: `${width}%` }}
        />
        {product.reorder_level > 0 ? (
          <span
            className="stock-bar__marker"
            style={{ left: `${marker}%` }}
            title={`Reorder at ${product.reorder_level}`}
          />
        ) : null}
      </div>
      <span className="stock-cell__text">
        <strong>{formatNumber(product.quantity_on_hand)}</strong> on hand
      </span>
    </div>
  );
}

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sort, setSort] = useState("updated");
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState(DEFAULT_META);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [stockProduct, setStockProduct] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");

      const params = { page, per_page: 8, sort };
      if (query) params.q = query;
      if (category) params.category = category;
      if (lowStockOnly) params.low_stock = true;

      try {
        const [listResponse, summaryResponse, categoryResponse] =
          await Promise.all([
            api.get("/products", { params }),
            api.get("/reports/summary"),
            api.get("/products/categories"),
          ]);

        if (!ignore) {
          setProducts(listResponse.data.items);
          setMeta(listResponse.data);
          setSummary(summaryResponse.data);
          setCategories(categoryResponse.data.categories);
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
  }, [query, category, lowStockOnly, sort, page, refresh]);

  function clearFilters() {
    setSearch("");
    setQuery("");
    setCategory("");
    setLowStockOnly(false);
    setSort("updated");
    setPage(1);
  }

  async function archiveProduct(product) {
    const confirmed = window.confirm(
      `Archive ${product.name}? It will be hidden from inventory, but its transaction history is kept.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/products/${product.id}`);
      setNotice(`${product.name} archived.`);
      if (products.length === 1 && page > 1) {
        setPage((value) => value - 1);
      } else {
        setRefresh((value) => value + 1);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  const filtersActive = Boolean(query || category || lowStockOnly);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Inventory"
        title="Products and stock"
        description="A live view of what is on the shelf, what needs reordering, and what just moved."
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={18} />
            Add product
          </button>
        }
      />

      <section className="stat-grid">
        <StatCard
          label="Inventory value"
          value={summary ? formatCurrency(summary.inventory_value) : "—"}
          note={
            summary ? `${formatNumber(summary.total_units)} units on hand` : "Active products"
          }
          icon={IndianRupee}
          tone="accent"
        />
        <StatCard
          label="Active products"
          value={summary?.total_products ?? "—"}
          note="Across all categories"
          icon={Package}
        />
        <StatCard
          label="Low stock"
          value={summary?.low_stock_count ?? "—"}
          note="At or below reorder level"
          icon={TriangleAlert}
          tone="warning"
        />
        <StatCard
          label="Out of stock"
          value={summary?.out_of_stock_count ?? "—"}
          note="Needs a restock"
          icon={PackageX}
          tone="danger"
        />
      </section>

      {notice ? (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      ) : null}

      <section className="panel panel--table">
        <div className="toolbar">
          <div className="search-box">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product, SKU, or supplier"
              aria-label="Search products"
            />
          </div>

          <select
            className="select"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`filter-toggle${lowStockOnly ? " is-on" : ""}`}
            onClick={() => {
              setLowStockOnly((value) => !value);
              setPage(1);
            }}
          >
            <TriangleAlert size={15} />
            Low stock only
          </button>

          <select
            className="select"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            aria-label="Sort products"
          >
            <option value="updated">Recently updated</option>
            <option value="name">Name A–Z</option>
            <option value="stock">Stock: low to high</option>
            <option value="price">Price: high to low</option>
          </select>
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
            Loading inventory…
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            title={filtersActive ? "No products match these filters" : "No products yet"}
            description={
              filtersActive
                ? "Try another category, clear the search, or turn off the low-stock filter."
                : "Add the first product to start tracking stock and transactions."
            }
            action={
              filtersActive ? (
                <button type="button" className="btn btn--ghost" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus size={17} />
                  Add product
                </button>
              )
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="hide-md">Category</th>
                  <th className="num hide-md">Unit price</th>
                  <th>Stock level</th>
                  <th>Status</th>
                  <th className="hide-md">Updated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="product-cell">
                        <strong>{product.name}</strong>
                        <span className="sku">{product.sku}</span>
                      </div>
                    </td>
                    <td className="hide-md">
                      <span className="category-chip">{product.category}</span>
                    </td>
                    <td className="num hide-md">{formatPrice(product.unit_price)}</td>
                    <td>
                      <StockMeter product={product} />
                    </td>
                    <td>
                      <StockBadge product={product} />
                    </td>
                    <td className="muted hide-md">{formatDate(product.updated_at)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          onClick={() => setStockProduct(product)}
                        >
                          <ArrowDownUp size={14} />
                          Stock
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => {
                            setEditing(product);
                            setFormOpen(true);
                          }}
                          title="Edit product"
                          aria-label={`Edit ${product.name}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--danger"
                          onClick={() => archiveProduct(product)}
                          title="Archive product"
                          aria-label={`Archive ${product.name}`}
                        >
                          <Archive size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && products.length > 0 ? (
          <Pagination meta={meta} onPageChange={setPage} />
        ) : null}
      </section>

      <ProductForm
        open={formOpen}
        product={editing}
        categories={categories}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setNotice(editing ? "Product updated." : "Product added.");
          setFormOpen(false);
          setEditing(null);
          setRefresh((value) => value + 1);
        }}
      />

      <StockForm
        open={Boolean(stockProduct)}
        product={stockProduct}
        onClose={() => setStockProduct(null)}
        onSaved={() => {
          setNotice(`Stock updated for ${stockProduct.name}.`);
          setStockProduct(null);
          setRefresh((value) => value + 1);
        }}
      />
    </div>
  );
}

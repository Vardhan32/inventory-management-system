import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarRange,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import { formatDate, formatNumber, movementLabel } from "../utils/format";

const DEFAULT_META = { page: 1, per_page: 10, total: 0, pages: 0 };

const TYPE_ICONS = {
  in: ArrowDownToLine,
  out: ArrowUpFromLine,
  adjustment: SlidersHorizontal,
};

function formatTime(value) {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function signedChange(transaction) {
  if (transaction.type === "in") {
    return { value: `+${formatNumber(transaction.quantity)}`, sign: "up" };
  }
  if (transaction.type === "out") {
    return { value: `−${formatNumber(transaction.quantity)}`, sign: "down" };
  }

  const delta = transaction.resulting_quantity - transaction.previous_quantity;
  if (delta === 0) return { value: "No change", sign: "flat" };

  return {
    value: `${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta))}`,
    sign: delta > 0 ? "up" : "down",
  };
}

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [transactions, setTransactions] = useState([]);
  const [meta, setMeta] = useState(DEFAULT_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");

      const params = { page, per_page: 10 };
      if (query) params.q = query;
      if (type) params.type = type;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      try {
        const response = await api.get("/transactions", { params });
        if (!ignore) {
          setTransactions(response.data.items);
          setMeta(response.data);
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
  }, [query, type, dateFrom, dateTo, page, refresh]);

  function clearFilters() {
    setSearch("");
    setQuery("");
    setType("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  const filtersActive = Boolean(query || type || dateFrom || dateTo);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Audit trail"
        title="Stock transactions"
        description="Every receipt, issue, and correction with the stock level it left behind."
        actions={
          <Link to="/" className="btn btn--ghost">
            Back to inventory
          </Link>
        }
      />

      <section className="panel panel--table">
        <div className="panel__header">
          <div>
            <h2>Movement ledger</h2>
            <p>
              {meta.total
                ? `${formatNumber(meta.total)} ${meta.total === 1 ? "entry" : "entries"} match this view`
                : "Stock movements appear here as soon as they are recorded"}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setRefresh((value) => value + 1)}
            title="Refresh ledger"
            aria-label="Refresh ledger"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="toolbar toolbar--wrap">
          <div className="search-box">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product or SKU"
              aria-label="Search transactions"
            />
          </div>

          <select
            className="select"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by movement type"
          >
            <option value="">All movements</option>
            <option value="in">Stock in</option>
            <option value="out">Stock out</option>
            <option value="adjustment">Adjustments</option>
          </select>

          <div className="date-filter">
            <CalendarRange size={16} aria-hidden="true" />
            <label>
              <span>From</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>

          {filtersActive ? (
            <button type="button" className="text-btn" onClick={clearFilters}>
              <X size={14} />
              Clear filters
            </button>
          ) : null}
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
            Loading transactions…
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            title={filtersActive ? "No movements match these filters" : "No stock movements yet"}
            description={
              filtersActive
                ? "Try a wider date range or clear the type filter."
                : "Record stock in, stock out, or an adjustment from the inventory page."
            }
            action={
              filtersActive ? (
                <button type="button" className="btn btn--ghost" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : (
                <Link to="/" className="btn btn--primary">
                  Go to inventory
                </Link>
              )
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table data-table--ledger">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Product</th>
                  <th>Movement</th>
                  <th className="num">Change</th>
                  <th className="num hide-sm">Stock after</th>
                  <th className="hide-md">Reference</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => {
                  const Icon = TYPE_ICONS[transaction.type] || SlidersHorizontal;
                  const change = signedChange(transaction);

                  return (
                    <tr key={transaction.id}>
                      <td>
                        <div className="txn-when">
                          <strong>{formatDate(transaction.created_at)}</strong>
                          <span>{formatTime(transaction.created_at)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="product-cell">
                          <strong>{transaction.product_name}</strong>
                          <span className="sku">{transaction.sku}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`movement movement--${transaction.type}`}>
                          <Icon size={14} />
                          {movementLabel(transaction.type)}
                        </span>
                      </td>
                      <td className={`num txn-change txn-change--${change.sign}`}>
                        {change.value}
                      </td>
                      <td className="num hide-sm">
                        <span className="stock-after">
                          {formatNumber(transaction.resulting_quantity)}
                          <small>from {formatNumber(transaction.previous_quantity)}</small>
                        </span>
                      </td>
                      <td className="hide-md">
                        {transaction.reference || transaction.note ? (
                          <div className="txn-note">
                            {transaction.reference ? (
                              <span className="ref-code">{transaction.reference}</span>
                            ) : null}
                            {transaction.note ? <span>{transaction.note}</span> : null}
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && transactions.length > 0 ? (
          <Pagination meta={meta} onPageChange={setPage} />
        ) : null}
      </section>
    </div>
  );
}

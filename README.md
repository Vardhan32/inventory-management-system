# Stockroom — Inventory Management System

[![CI](https://github.com/Vardhan32/inventory-management-system/actions/workflows/ci.yml/badge.svg)](https://github.com/Vardhan32/inventory-management-system/actions/workflows/ci.yml)

Stockroom is a full-stack inventory app for a small warehouse or operations team.
It keeps the product catalogue, live stock counts, and every stock movement in
one place, and turns reorder levels into a daily restock queue.

The API is built with FastAPI, SQLAlchemy 2.0, and Pydantic v2, with a MySQL 8
schema. The React client is a Vite single-page app. SQLite is the default for
local development and tests so the project runs without a database server.

![Inventory dashboard](docs/screenshots/dashboard.png)

## Features

- Product catalogue with SKU, category, supplier, unit price, reorder level, and opening stock
- Stock in, stock out, and cycle-count adjustments
- Every movement stores the previous and resulting quantity, reference, note, and timestamp
- Restock queue with out-of-stock and low-stock tabs, suggested order quantities, and estimated restock cost
- Dashboard totals for inventory value, units on hand, low stock, and out of stock
- Search by product, SKU, or supplier; filter by category or stock status; sort by recency, name, stock, or price
- Paginated inventory and ledger views
- Server-side validation with field-level error messages
- Archive products without deleting their movement history
- Seeded demo data with 15 products across six categories

| Stock ledger | Restock queue |
| --- | --- |
| ![Stock transactions](docs/screenshots/transactions.png) | ![Restock queue](docs/screenshots/low-stock.png) |

Stock changes are recorded from a focused modal that previews the resulting
quantity before saving:

![Record stock movement](docs/screenshots/stock-movement.png)

## Stack

| Layer | Tools |
| --- | --- |
| API | Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, Uvicorn |
| Database | MySQL 8 with PyMySQL; SQLite fallback for local development and tests |
| Frontend | React 18, Vite, React Router, Axios, plain CSS |
| Tests | pytest, FastAPI TestClient |
| CI | GitHub Actions (API tests and production frontend build) |

## Project layout

```text
backend/
  app/
    routers/          products, transactions, reports
    models.py         Product, StockTransaction
    schemas.py        request and response models
    services.py       stock movement and ledger logic
    errors.py         application error type
    seed.py           demo products and movement history
  tests/              17 API tests
  schema.sql          MySQL DDL
  .env.example        MySQL connection example
frontend/
  src/
    api/              Axios client
    components/       layout, table pieces, modals, forms
    pages/            inventory, transactions, restock queue, 404
    utils/            currency, date, and stock helpers
docs/screenshots/
.github/workflows/
```

## Running locally

### 1. Database

For MySQL 8:

```bash
mysql -u root -p < backend/schema.sql
```

Create an application user, or reuse an existing one:

```sql
CREATE USER 'inventory'@'localhost' IDENTIFIED BY 'inventory';
GRANT ALL PRIVILEGES ON inventory.* TO 'inventory'@'localhost';
FLUSH PRIVILEGES;
```

Copy `backend/.env.example` to `backend/.env` and adjust the credentials. The
sample URL is:

```text
mysql+pymysql://inventory:inventory@localhost:3306/inventory?charset=utf8mb4
```

If `DATABASE_URL` is unset, the API uses `backend/inventory.db` instead, so you
can skip MySQL entirely to try the app locally.

### 2. API

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

`python -m app.seed` creates the tables, 15 products, and their opening/movement
history. It is a no-op if products already exist. The API runs at
`http://localhost:8000`; interactive docs are at `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to the FastAPI server on port
8000, so no client-side base URL configuration is needed.

## Tests

```bash
cd backend
pytest -q
```

The suite uses an in-memory SQLite database and covers product CRUD and
validation, duplicate SKUs, stock in/out/adjustment rules, overselling, ledger
filters and pagination, summary and low-stock reports, archiving, and 404
handling. Current result: **17 passed**.

## API reference

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/products` | List products (`q`, `category`, `low_stock`, `sort`, `page`, `per_page`) |
| POST | `/api/products` | Create a product with optional opening stock |
| GET | `/api/products/:id` | Fetch one product |
| PATCH | `/api/products/:id` | Update product details |
| DELETE | `/api/products/:id` | Archive a product (keeps its history) |
| POST | `/api/products/:id/stock` | Record stock in, stock out, or an adjustment |
| GET | `/api/products/categories` | Distinct active categories |
| GET | `/api/transactions` | List movements (`product_id`, `type`, `q`, `date_from`, `date_to`, `page`, `per_page`) |
| GET | `/api/reports/summary` | Inventory value, units, low-stock and out-of-stock counts |
| GET | `/api/reports/low-stock` | Active products at or below their reorder level |

Stock movement payload:

```json
{
  "type": "in",
  "quantity": 24,
  "reference": "GRN-2451",
  "note": "Delivery from Anker India"
}
```

`type` is one of `in`, `out`, or `adjustment`. For an adjustment, `quantity` is
the counted quantity rather than a delta. The response returns the updated
product and the ledger entry it created.

Validation failures return `422` with a shape the UI can map back to fields:

```json
{
  "message": "Please check the submitted fields.",
  "errors": {
    "sku": "String should match pattern '^[A-Z0-9][A-Z0-9-]{2,39}$'"
  }
}
```

A duplicate SKU returns `409`, and missing products return `404`.

## Inventory rules

- Stock is never edited directly on the product record. The only way to change
  `quantity_on_hand` is through the stock movement endpoint, which writes a
  ledger row with the previous and resulting quantities in the same database
  transaction.
- Stock in and stock out require a quantity of at least 1. A stock out cannot
  remove more than is on hand.
- An adjustment sets stock to the counted quantity and is useful for cycle
  counts and shrinkage.
- Archiving hides a product from the inventory and reports but keeps its ledger
  history intact.
- A product is **low stock** when `0 < quantity_on_hand <= reorder_level` and
  **out of stock** when the quantity is zero. The restock queue includes both.
- The suggested order quantity in the UI refills a product to twice its reorder
  level. The estimate is calculated in the client and is not stored.

## Data model

```text
Product 1 ──── * StockTransaction
```

`Product` holds the catalogue fields, current stock, reorder level, and an
`is_active` flag used for archiving. `StockTransaction` is an append-only ledger
of quantity changes with a reference and note. The MySQL schema includes a
unique SKU index, category/status indexes, and a foreign key that prevents
deleting products that still have movements.

## Implementation notes

- SQLAlchemy 2.0 typed mappings keep the models close to the MySQL schema, and
  money is stored as `DECIMAL(10, 2)` rather than a float.
- Pydantic handles request validation; custom exception handlers normalize
  validation, not-found, and conflict responses into one JSON shape.
- Stock updates live in `services.apply_stock_movement`, so the business rules
  are shared by product creation (opening stock) and the stock endpoint.
- The React client debounces search, cancels stale render updates with an
  ignore flag, and refetches summary and category data alongside the table.
- Empty, loading, and error states are handled explicitly on each page; form
  errors appear inline next to the field that caused them.
- SQLite is used for tests and the local demo, but all queries and the schema
  target MySQL as well.

## Possible next steps

- Login and role-based permissions for warehouse staff and managers
- Purchase orders and supplier lead times
- CSV import/export and barcode scanning
- Scheduled low-stock email digest

## License

MIT

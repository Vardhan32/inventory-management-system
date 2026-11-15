# Inventory Management System — Technical Architecture & Interview Preparation Guide

This guide is designed for technical interviewers, hiring managers, and software engineers reviewing the **Inventory Management System** repository. It provides an architectural breakdown of the system, examines concurrency protection and ledger consistency, details data model constraints, and provides 40 comprehensive Q&As covering FastAPI, SQLAlchemy 2.0, Pydantic v2, and ACID transaction semantics.

---

## 1. System Architecture & Component Design

The Inventory Management System is an enterprise-style stock control and ledger application designed to track products, stock-in/stock-out movements, physical inventory adjustments, and real-time inventory valuations.

```
+-----------------------------------------------------------------------------------+
|                           Client Layer (React 18 + Vite)                          |
|  - Real-time stock movement modal (Stock In, Stock Out, Cycle Count Adjustment)   |
|  - Stock status visual pills (In Stock, Low Stock, Out of Stock, Inactive)       |
|  - Inventory valuation dashboard cards & real-time reorder-level alerts           |
|  - Paginated audit ledger with multi-attribute filtering (SKU, date range, type)  |
+-----------------------------------------------------------------------------------+
                                           |  JSON over HTTP (RESTful API)
                                           v
+-----------------------------------------------------------------------------------+
|                        Application Layer (FastAPI + Pydantic v2)                  |
|  - APIRouters: /api/products, /api/transactions, /api/reports                     |
|  - Pydantic v2 validation: strict type coercion, non-negative stock invariants    |
|  - Stock Service Layer: apply_stock_movement (unit-of-work state coordinator)     |
|  - Error Handlers: Custom InventoryError mapped to structured HTTP status codes   |
+-----------------------------------------------------------------------------------+
                                           |  SQLAlchemy 2.0 ORM (Mapped / mapped_column)
                                           v
+-----------------------------------------------------------------------------------+
|                        Data Tier (Relational Storage Engine)                      |
|  - Production: MySQL 8 (InnoDB engine, row-level locks, foreign key RESTRICT)     |
|  - Test / CI: In-Memory SQLite with pool_pre_ping enabled                         |
|  - Concurrency Guard: SELECT ... FOR UPDATE (pessimistic row locking)             |
|  - Tables: products (master catalog), stock_transactions (immutable append-only)  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Core Engineering Innovations & Concurrency Protection

### 1. The Inventory Concurrency Anomaly (Lost Updates & Negative Stock)
- **The Problem:** In high-concurrency environments (e.g. warehouse staff scanning items simultaneously), two concurrent stock-out requests for 5 units of an item with 8 units in stock could execute:
  1. Process A reads `quantity_on_hand = 8`.
  2. Process B reads `quantity_on_hand = 8`.
  3. Process A checks `5 <= 8` -> valid -> writes `resulting_quantity = 3`.
  4. Process B checks `5 <= 8` -> valid -> writes `resulting_quantity = 3`.
  - **Result:** 10 units are physically dispatched, but only 5 are deducted from the database, leaving the record at 3 instead of going negative or rejecting the second order.
- **The Solution (Pessimistic Row Locking):**
  - When modifying stock (`record_stock`, `update_product`, `archive_product`), the query utilizes:
    ```python
    product = db.execute(
        select(Product).where(Product.id == product_id).with_for_update()
    ).scalar_one_or_none()
    ```
  - On relational databases like MySQL 8, this executes `SELECT ... FOR UPDATE`, acquiring an exclusive row lock on the product record. Concurrent transactions are blocked until the first transaction commits or rolls back, guaranteeing strict serialization and eliminating race conditions.

### 2. Immutable Double-Entry Ledger Pattern
- Stock is never mutated directly without a corresponding transaction audit record.
- Every inventory modification (`in`, `out`, `adjustment`, or opening inventory) records:
  - `previous_quantity`
  - `quantity` (the delta or target)
  - `resulting_quantity`
  - `reference` (e.g., Purchase Order, Goods Received Note, or Cycle Count ID)
  - `created_at` UTC timestamp
- The chain of stock balances can be audited backward chronologically at any time to verify mathematical continuity:
  $$\text{Final Stock} = \text{Opening} + \sum \text{Stock In} - \sum \text{Stock Out} \pm \Delta \text{Adjustments}$$

### 3. Soft Deletes & Foreign Key Integrity
- Products cannot be hard-deleted if they have historical transactions. The foreign key constraint specifies `ondelete="RESTRICT"`.
- Archiving a product sets `is_active = False`. Inactive products are hidden from the primary catalog but remain intact in the historical transaction ledger and financial audits.

### 4. Monetary Arithmetic & Precision
- Unit prices are stored using `Numeric(10, 2)` mapped to Python's `Decimal` type. This completely avoids IEEE 754 floating-point rounding errors (e.g. `0.1 + 0.2 = 0.30000000000000004`), which can cause serious discrepancies in balance sheets.

---

## 3. 40 Technical Interview Questions & Answers

### Part 1: Core Fundamentals & Framework Design (1–15)

#### Q1: What problem does this application solve?
**Answer:** It provides wholesale and retail businesses with an auditable stock management platform to track product catalogs, record stock intake and dispatch, manage cycle-count adjustments, and calculate real-time inventory valuations.

#### Q2: What backend framework was used and why?
**Answer:** FastAPI with Python 3.11/3.12. FastAPI was chosen for its high performance (built on Starlette and Uvicorn), native async capabilities, automatic OpenAPI/Swagger documentation generation, and robust schema validation via Pydantic v2.

#### Q3: What is the difference between FastAPI and Flask?
**Answer:** Flask is a lightweight WSGI microframework where validation and documentation must be added via third-party extensions. FastAPI is an ASGI framework with built-in request validation, data serialization, dependency injection, and automatic API documentation based on standard Python type hints.

#### Q4: How is database access structured?
**Answer:** Using SQLAlchemy 2.0 with the modern `Mapped` and `mapped_column` type annotations. Database sessions are injected into route handlers using FastAPI's `Depends(get_db)` generator pattern.

#### Q5: What are the two primary database entities?
**Answer:** 
1. `Product`: Stores SKU, name, category, unit price, quantity on hand, reorder level, supplier, and active status.
2. `StockTransaction`: An immutable ledger of every stock movement linked to a product.

#### Q6: What are the three supported stock movement types?
**Answer:**
- `in`: Adds incoming inventory (e.g., from vendor shipments or returns).
- `out`: Deducts inventory (e.g., sales orders or internal requisitions).
- `adjustment`: Overwrites the balance to match a physical cycle count.

#### Q7: What happens when an opening stock is provided during product creation?
**Answer:** The product is created with initial `quantity_on_hand = 0`, flushed to obtain an ID, and an automatic `in` transaction with `reference="OPENING"` is recorded to establish an immutable audit trail from day one.

#### Q8: How is negative stock prevented?
**Answer:** In `services.apply_stock_movement`, if `movement_type == "out"` and `quantity > previous_quantity`, an `InventoryError(f"Cannot remove {quantity} units. Only {previous} in stock.", 400)` is raised, rolling back the database session.

#### Q9: What is a "reorder level"?
**Answer:** A threshold quantity. When `quantity_on_hand <= reorder_level` and `quantity_on_hand > 0`, the product is flagged as `low_stock`, signaling purchasing staff to reorder.

#### Q10: What is the difference between "low stock" and "out of stock"?
**Answer:** `low_stock` indicates `0 < quantity_on_hand <= reorder_level`. `out_of_stock` indicates `quantity_on_hand == 0`.

#### Q11: How is the total inventory valuation calculated?
**Answer:** In `routers/reports.py`, the database calculates:
`func.sum(Product.quantity_on_hand * Product.unit_price)` across all active products.

#### Q12: Why are SKUs required to be unique?
**Answer:** A Stock Keeping Unit (SKU) is the unique machine-readable identifier used in barcodes, warehouse bins, and billing systems. Enforcing uniqueness (`unique=True` and database indexes) prevents catalog duplication.

#### Q13: What HTTP status code is returned when a duplicate SKU is submitted?
**Answer:** HTTP `409 Conflict`.

#### Q14: How does search work on the products endpoint?
**Answer:** `GET /api/products?q=search_term` applies a case-insensitive pattern (`ilike %pattern%`) across `name`, `sku`, and `supplier`.

#### Q15: Why is `is_active` used instead of deleting products from the table?
**Answer:** Hard-deleting a product would either violate foreign key constraints on the `stock_transactions` table or delete historical transaction records, corrupting financial audit trails. Soft-deleting via `is_active = False` preserves complete historical accounting.

---

### Part 2: Intermediate Architecture & Database Mechanics (16–30)

#### Q16: How does `with_for_update()` work in SQLAlchemy?
**Answer:** It appends `FOR UPDATE` to the SQL query:
```sql
SELECT * FROM products WHERE id = ? FOR UPDATE;
```
This tells the RDBMS (e.g. MySQL InnoDB) to place an exclusive write lock on the selected row. Other transactions attempting to read or update that row with `FOR UPDATE` must wait until the holding transaction issues `COMMIT` or `ROLLBACK`.

#### Q17: Why is optimistic concurrency control sometimes used instead of pessimistic locking?
**Answer:** Optimistic locking adds a `version_id` column to the table. Updates check `WHERE id = ? AND version_id = ?`. If another transaction updated the row first, the update affects 0 rows, triggering a retry. It has lower overhead in read-heavy systems, but in write-heavy inventory checkouts, pessimistic locking (`FOR UPDATE`) avoids frequent user retry failures.

#### Q18: What is the unit-of-work pattern in SQLAlchemy?
**Answer:** The `Session` maintains an in-memory tracking list of all dirty, new, and deleted objects. It flushes changes to the database in a topological dependency order and commits everything in a single atomic database transaction.

#### Q19: Why use `lazy="joined"` or `joinedload` on transactions?
**Answer:** In `list_transactions`, joining the product table eagerly (`joinedload(StockTransaction.product)`) retrieves the transaction and its associated product in a single SQL query, eliminating the classic N+1 query problem.

#### Q20: How does Pydantic v2 improve performance over Pydantic v1?
**Answer:** Pydantic v2 rewrote its core validation and serialization logic in Rust (`pydantic-core`), resulting in a 5x to 20x speedup in JSON parsing and schema validation.

#### Q21: What is the purpose of `model_validator(mode="after")`?
**Answer:** It executes custom cross-field validation rules after individual field types have been parsed. For example, verifying that `quantity >= 1` when `movement_type in ("in", "out")`.

#### Q22: Why use `Numeric(10, 2)` instead of `Float` for currency?
**Answer:** Floats use binary representation, leading to base-2 rounding errors like `0.1 + 0.2 != 0.3`. `Numeric(10, 2)` stores exact fixed-point decimal representations, guaranteeing cent-accurate calculations.

#### Q23: What indexes were created on the `products` table?
**Answer:**
1. Unique index on `sku` for instantaneous lookups and uniqueness enforcement.
2. Index on `category` for fast category filtering.
3. Composite index `ix_products_active_category` on `(is_active, category)` to accelerate catalog queries.

#### Q24: What is `pool_pre_ping=True` and why is it essential for MySQL?
**Answer:** Cloud MySQL databases drop connections after inactivity timeouts. `pool_pre_ping=True` emits an automatic `SELECT 1` ping test when checking out a connection from the pool. If broken, it transparently reconnects, eliminating `OperationalError: 2006 (MySQL server has gone away)` errors.

#### Q25: How does pagination prevent server memory exhaustion?
**Answer:** Instead of loading 50,000 product rows into memory, `offset((page - 1) * per_page).limit(per_page)` ensures only 10–50 records are fetched per query.

#### Q26: What happens if a stock movement fails halfway through execution?
**Answer:** The router catches `InventoryError` and calls `db.rollback()`. Any changes staged in the session (e.g., partial product quantity adjustments) are immediately discarded, maintaining database consistency.

#### Q27: How does the `/reports/summary` endpoint optimize performance?
**Answer:** It aggregates product count, total units, and total monetary value in a single SQL query using `func.count()`, `func.sum()`, and `func.coalesce()` rather than pulling product records into Python and calculating sums in a loop.

#### Q28: How does the frontend communicate with the backend?
**Answer:** Using an Axios HTTP client configured with a base URL (`VITE_API_URL` or `http://127.0.0.1:8000`). Vite proxies `/api` requests to the FastAPI development server.

#### Q29: What is the purpose of the `schema.sql` file?
**Answer:** It defines the canonical MySQL DDL schema with InnoDB table definitions, primary keys, foreign keys, and indexes for production deployment without requiring ORM migrations for initial setups.

#### Q30: How are tests configured to run without external MySQL dependencies?
**Answer:** Pytest uses `conftest.py` to override the `get_db` dependency with an in-memory SQLite database (`sqlite://`), initializing the full schema via `Base.metadata.create_all(bind=engine)` for rapid, isolated testing.

---

### Part 3: Senior Architecture, Enterprise Patterns & Scaling (31–40)

#### Q31: How would you handle inventory allocation across multiple physical warehouses?
**Answer:**
1. Introduce a `Warehouse` entity and a `WarehouseStock` junction table with composite key `(warehouse_id, product_id)`.
2. Update `StockTransaction` to record `source_warehouse_id` and `destination_warehouse_id`.
3. Support inter-warehouse transfer workflows with "In-Transit" reserve statuses.

#### Q32: How would you prevent overselling during flash sale spikes?
**Answer:**
1. Use Redis as a high-speed distributed cache holding stock counters.
2. Execute atomic decrements via Redis Lua scripts: `if redis.call('get', key) >= qty then return redis.call('decrby', key, qty) else return -1 end`.
3. Asynchronously persist the confirmed transactions to MySQL via background worker queues (Celery/RabbitMQ).

#### Q33: How would you implement Barcode/RFID scanner support?
**Answer:**
1. Modern handheld scanners act as standard HID keyboard input devices sending keystrokes followed by an `Enter` key.
2. Implement a global key listener on the React client that captures continuous alphanumeric input strings ending with `\n` within a 50ms interval and triggers a direct `GET /api/products?sku=SCANNED_VALUE` lookup.

#### Q34: What is the difference between FIFO and LIFO inventory valuation?
**Answer:**
- **FIFO (First-In, First-Out):** Assumes the oldest inventory items purchased are sold first. During inflation, FIFO results in higher ending inventory valuation and lower cost of goods sold (COGS).
- **LIFO (Last-In, First-Out):** Assumes the newest inventory items are sold first.
- To implement FIFO, the `StockTransaction` table would track batch purchase costs and deplete batches in chronological order.

#### Q35: How would you implement automated low-stock reorder triggers?
**Answer:**
1. Configure an asynchronous background task (e.g. Celery beat running every hour).
2. Query `/api/reports/low-stock`.
3. Automatically generate draft Purchase Orders (POs) for designated suppliers and dispatch notification emails or webhooks to suppliers.

#### Q36: How does the system guarantee idempotency on stock operations?
**Answer:** By accepting an optional unique `idempotency_key` or `reference` in the request header/body. Before executing the movement, check if a transaction with that `reference` already exists; if so, return the existing result instead of duplicating the deduction.

#### Q37: How would you audit who performed a specific stock adjustment?
**Answer:** Add authentication (OAuth2 / JWT) and associate every `StockTransaction` with a `user_id` foreign key. For strict enterprise compliance, implement database change data capture (CDC) with tools like Debezium.

#### Q38: How do you handle schema migrations across staging and production?
**Answer:** Integrate **Alembic** with SQLAlchemy. Every schema change is generated as an auto-detected migration file (`alembic revision --autogenerate`), tested in CI against test databases, and applied to production using `alembic upgrade head`.

#### Q39: What metrics should be monitored on the database in production?
**Answer:**
1. InnoDB buffer pool hit ratio (should exceed 99%).
2. Row lock wait time and deadlock frequencies (`SHOW ENGINE INNODB STATUS`).
3. Slow queries (queries exceeding 500ms logged to MySQL slow query log).
4. Connection pool saturation (active vs idle connections).

#### Q40: What are the primary strengths of this inventory implementation?
**Answer:** 
1. Strict data integrity: zero possibility of negative stock or untracked manual edits.
2. Concurrency-safe design: pessimistic locking eliminates double-spend race conditions.
3. Clean architectural separation: modular FastAPI routers, dedicated service functions, and strict Pydantic validation boundaries.
4. Comprehensive test coverage: 18 passing unit tests ensuring end-to-end reliability.

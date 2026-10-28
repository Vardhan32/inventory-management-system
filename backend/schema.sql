-- MySQL 8 schema for Stockroom.
-- The seed command creates these tables through SQLAlchemy as well.

CREATE DATABASE IF NOT EXISTS inventory
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE inventory;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(80) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  quantity_on_hand INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 0,
  supplier VARCHAR(150) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku),
  KEY ix_products_category (category),
  KEY ix_products_active_category (is_active, category)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_transactions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  type VARCHAR(20) NOT NULL,
  quantity INT NOT NULL,
  previous_quantity INT NOT NULL,
  resulting_quantity INT NOT NULL,
  reference VARCHAR(80) NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_stock_transactions_product (product_id),
  KEY ix_stock_transactions_created (created_at),
  CONSTRAINT fk_stock_transactions_product
    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

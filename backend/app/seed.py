from datetime import datetime, timedelta

from sqlalchemy import func, select

from .database import Base, SessionLocal, engine
from .models import Product, StockTransaction

PRODUCTS = [
    {
        "sku": "OFF-1001",
        "name": "A4 Copy Paper (500 sheets)",
        "category": "Office Supplies",
        "unit_price": 320,
        "quantity_on_hand": 48,
        "reorder_level": 20,
        "supplier": "Sri Lakshmi Paper Co.",
    },
    {
        "sku": "OFF-1002",
        "name": "Whiteboard Marker Set (4)",
        "category": "Office Supplies",
        "unit_price": 450,
        "quantity_on_hand": 9,
        "reorder_level": 15,
        "supplier": "Camlin Distributors",
    },
    {
        "sku": "OFF-1003",
        "name": "Heavy Duty Stapler",
        "category": "Office Supplies",
        "unit_price": 210,
        "quantity_on_hand": 32,
        "reorder_level": 10,
        "supplier": "Staples India",
    },
    {
        "sku": "ELE-2001",
        "name": "Wireless Mouse",
        "category": "Electronics",
        "unit_price": 549,
        "quantity_on_hand": 12,
        "reorder_level": 10,
        "supplier": "Logitech India",
    },
    {
        "sku": "ELE-2002",
        "name": '24-inch LED Monitor',
        "category": "Electronics",
        "unit_price": 8999,
        "quantity_on_hand": 3,
        "reorder_level": 5,
        "supplier": "Dell Technologies",
    },
    {
        "sku": "ELE-2003",
        "name": "USB-C Dock",
        "category": "Electronics",
        "unit_price": 2199,
        "quantity_on_hand": 0,
        "reorder_level": 6,
        "supplier": "Anker India",
    },
    {
        "sku": "ELE-2004",
        "name": "1080p Webcam",
        "category": "Electronics",
        "unit_price": 2499,
        "quantity_on_hand": 1,
        "reorder_level": 4,
        "supplier": "Logitech India",
    },
    {
        "sku": "NET-3001",
        "name": "CAT6 Cable Box (305m)",
        "category": "Networking",
        "unit_price": 5499,
        "quantity_on_hand": 7,
        "reorder_level": 4,
        "supplier": "Finolex Cables",
    },
    {
        "sku": "NET-3002",
        "name": "8-Port Gigabit Switch",
        "category": "Networking",
        "unit_price": 1899,
        "quantity_on_hand": 15,
        "reorder_level": 6,
        "supplier": "TP-Link India",
    },
    {
        "sku": "FUR-4001",
        "name": "Ergonomic Office Chair",
        "category": "Furniture",
        "unit_price": 12499,
        "quantity_on_hand": 5,
        "reorder_level": 3,
        "supplier": "Godrej Interio",
    },
    {
        "sku": "FUR-4002",
        "name": "Height Adjustable Desk",
        "category": "Furniture",
        "unit_price": 21999,
        "quantity_on_hand": 2,
        "reorder_level": 2,
        "supplier": "Featherlite",
    },
    {
        "sku": "PKG-5001",
        "name": "Bubble Wrap Roll (100m)",
        "category": "Packaging",
        "unit_price": 850,
        "quantity_on_hand": 18,
        "reorder_level": 10,
        "supplier": "Packman",
    },
    {
        "sku": "PKG-5002",
        "name": "Corrugated Shipping Box (25 pack)",
        "category": "Packaging",
        "unit_price": 45,
        "quantity_on_hand": 120,
        "reorder_level": 40,
        "supplier": "Uline India",
    },
    {
        "sku": "ACC-6001",
        "name": "Laptop Sleeve 14-inch",
        "category": "Accessories",
        "unit_price": 899,
        "quantity_on_hand": 6,
        "reorder_level": 8,
        "supplier": "Targus",
    },
    {
        "sku": "STA-7001",
        "name": "Gel Pen Pack (10)",
        "category": "Stationery",
        "unit_price": 150,
        "quantity_on_hand": 3,
        "reorder_level": 12,
        "supplier": "Cello",
    },
]


def seed():
    Base.metadata.create_all(engine)

    with SessionLocal() as db:
        existing = db.scalar(select(func.count(Product.id))) or 0
        if existing:
            print(f"Database already has {existing} products, skipping seed.")
            return

        now = datetime.now()

        for index, item in enumerate(PRODUCTS):
            product = Product(**item)
            db.add(product)
            db.flush()

            current = item["quantity_on_hand"]
            adjusted = index % 4 == 0
            adjust_delta = 2 if index % 6 == 0 else -2
            sold = min(max(current // 3, 4), 28)
            before_adjustment = current - (adjust_delta if adjusted else 0)
            opening = before_adjustment + sold

            db.add(
                StockTransaction(
                    product_id=product.id,
                    type="in",
                    quantity=opening,
                    previous_quantity=0,
                    resulting_quantity=opening,
                    reference=f"GRN-{1010 + index}",
                    note="Opening stock received",
                    created_at=now - timedelta(days=25 + (index % 10), hours=9 + (index % 6)),
                )
            )

            db.add(
                StockTransaction(
                    product_id=product.id,
                    type="out",
                    quantity=sold,
                    previous_quantity=opening,
                    resulting_quantity=before_adjustment,
                    reference=f"SO-{2300 + index}",
                    note="Customer order",
                    created_at=now - timedelta(days=6 + (index % 8), hours=13 + (index % 5)),
                )
            )

            if adjusted:
                db.add(
                    StockTransaction(
                        product_id=product.id,
                        type="adjustment",
                        quantity=current,
                        previous_quantity=before_adjustment,
                        resulting_quantity=current,
                        reference=f"CC-{500 + index}",
                        note="Cycle count correction",
                        created_at=now - timedelta(days=2 + (index // 4), hours=9 + (index % 7)),
                    )
                )

        db.commit()
        print(f"Seeded {len(PRODUCTS)} products and their transaction history.")


if __name__ == "__main__":
    seed()

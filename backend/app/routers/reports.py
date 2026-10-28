from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Product
from ..schemas import LowStockResponse, SummaryOut

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/summary", response_model=SummaryOut)
def inventory_summary(db: Session = Depends(get_db)):
    totals = db.execute(
        select(
            func.count(Product.id),
            func.coalesce(func.sum(Product.quantity_on_hand), 0),
            func.coalesce(
                func.sum(Product.quantity_on_hand * Product.unit_price), 0
            ),
        ).where(Product.is_active.is_(True))
    ).one()

    low_stock_count = db.scalar(
        select(func.count(Product.id)).where(
            Product.is_active.is_(True),
            Product.quantity_on_hand > 0,
            Product.quantity_on_hand <= Product.reorder_level,
        )
    )
    out_of_stock_count = db.scalar(
        select(func.count(Product.id)).where(
            Product.is_active.is_(True), Product.quantity_on_hand == 0
        )
    )

    return SummaryOut(
        total_products=totals[0] or 0,
        total_units=int(totals[1] or 0),
        inventory_value=float(totals[2] or 0),
        low_stock_count=low_stock_count or 0,
        out_of_stock_count=out_of_stock_count or 0,
    )


@router.get("/low-stock", response_model=LowStockResponse)
def low_stock_products(db: Session = Depends(get_db)):
    items = db.scalars(
        select(Product)
        .where(
            Product.is_active.is_(True),
            Product.quantity_on_hand <= Product.reorder_level,
        )
        .order_by(Product.quantity_on_hand.asc(), Product.name.asc())
    ).all()

    return LowStockResponse(items=items, count=len(items))

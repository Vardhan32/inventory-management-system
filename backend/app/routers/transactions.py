from datetime import date, datetime, time, timedelta
from math import ceil
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Product, StockTransaction
from ..schemas import TransactionPage

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


@router.get("", response_model=TransactionPage)
def list_transactions(
    product_id: int | None = None,
    type: Literal["in", "out", "adjustment"] | None = None,
    q: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=100),
    db: Session = Depends(get_db),
):
    filters = []
    if product_id is not None:
        filters.append(StockTransaction.product_id == product_id)
    if type:
        filters.append(StockTransaction.type == type)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(Product.name.ilike(pattern), Product.sku.ilike(pattern))
        )
    if date_from:
        filters.append(
            StockTransaction.created_at >= datetime.combine(date_from, time.min)
        )
    if date_to:
        filters.append(
            StockTransaction.created_at
            < datetime.combine(date_to + timedelta(days=1), time.min)
        )

    base = (
        select(StockTransaction)
        .join(Product, StockTransaction.product_id == Product.id)
        .where(*filters)
    )
    total = (
        db.scalar(
            select(func.count())
            .select_from(StockTransaction)
            .join(Product, StockTransaction.product_id == Product.id)
            .where(*filters)
        )
        or 0
    )
    items = db.scalars(
        base.options(joinedload(StockTransaction.product))
        .order_by(StockTransaction.created_at.desc(), StockTransaction.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()

    return TransactionPage(
        items=items,
        page=page,
        per_page=per_page,
        total=total,
        pages=ceil(total / per_page) if total else 0,
    )

from math import ceil
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..errors import InventoryError
from ..models import Product
from ..schemas import (
    CategoryResponse,
    ProductCreate,
    ProductOut,
    ProductPage,
    ProductUpdate,
    StockMovement,
    StockResult,
)
from ..services import apply_stock_movement

router = APIRouter(prefix="/api/products", tags=["Products"])

SORTING = {
    "updated": (Product.updated_at.desc(),),
    "name": (Product.name.asc(),),
    "stock": (Product.quantity_on_hand.asc(), Product.name.asc()),
    "price": (Product.unit_price.desc(),),
}


def get_product_or_404(db: Session, product_id: int):
    product = db.get(Product, product_id)
    if product is None:
        raise InventoryError("Product not found.", 404)
    return product


def ensure_sku_available(db: Session, sku: str, exclude_id=None):
    statement = select(Product.id).where(Product.sku == sku)
    if exclude_id is not None:
        statement = statement.where(Product.id != exclude_id)
    if db.scalar(statement) is not None:
        raise InventoryError("A product with this SKU already exists.", 409)


@router.get("", response_model=ProductPage)
def list_products(
    q: str | None = None,
    category: str | None = None,
    low_stock: bool = False,
    include_inactive: bool = False,
    sort: Literal["updated", "name", "stock", "price"] = "updated",
    page: int = Query(1, ge=1),
    per_page: int = Query(8, ge=1, le=100),
    db: Session = Depends(get_db),
):
    filters = []
    if not include_inactive:
        filters.append(Product.is_active.is_(True))

    if q and q.strip():
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(
                Product.name.ilike(pattern),
                Product.sku.ilike(pattern),
                Product.supplier.ilike(pattern),
            )
        )
    if category:
        filters.append(func.lower(Product.category) == category.strip().lower())
    if low_stock:
        filters.append(Product.quantity_on_hand <= Product.reorder_level)

    total = (
        db.scalar(select(func.count()).select_from(Product).where(*filters)) or 0
    )
    items = db.scalars(
        select(Product)
        .where(*filters)
        .order_by(*SORTING[sort])
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()

    return ProductPage(
        items=items,
        page=page,
        per_page=per_page,
        total=total,
        pages=ceil(total / per_page) if total else 0,
    )


@router.get("/categories", response_model=CategoryResponse)
def list_categories(db: Session = Depends(get_db)):
    categories = db.scalars(
        select(Product.category)
        .where(Product.is_active.is_(True))
        .distinct()
        .order_by(Product.category.asc())
    ).all()
    return CategoryResponse(categories=categories)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    return get_product_or_404(db, product_id)


@router.post("", response_model=ProductOut, status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    ensure_sku_available(db, payload.sku)

    data = payload.model_dump()
    opening_stock = data.pop("quantity_on_hand")

    product = Product(**data, quantity_on_hand=0)
    db.add(product)
    try:
        db.flush()
        if opening_stock > 0:
            apply_stock_movement(
                db,
                product,
                "in",
                opening_stock,
                reference="OPENING",
                note="Opening stock",
            )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise InventoryError("A product with this SKU already exists.", 409)

    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
):
    product = get_product_or_404(db, product_id)
    updates = payload.model_dump(exclude_unset=True)

    if not updates:
        return product

    if "sku" in updates:
        ensure_sku_available(db, updates["sku"], exclude_id=product.id)

    for field, value in updates.items():
        setattr(product, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise InventoryError("A product with this SKU already exists.", 409)

    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=204)
def archive_product(product_id: int, db: Session = Depends(get_db)):
    product = get_product_or_404(db, product_id)
    product.is_active = False
    db.commit()
    return Response(status_code=204)


@router.post("/{product_id}/stock", response_model=StockResult, status_code=201)
def record_stock(
    product_id: int,
    payload: StockMovement,
    db: Session = Depends(get_db),
):
    product = get_product_or_404(db, product_id)

    try:
        transaction = apply_stock_movement(
            db,
            product,
            payload.type,
            payload.quantity,
            reference=payload.reference,
            note=payload.note,
        )
        db.commit()
    except InventoryError:
        db.rollback()
        raise

    db.refresh(product)
    db.refresh(transaction)
    return StockResult(product=product, transaction=transaction)

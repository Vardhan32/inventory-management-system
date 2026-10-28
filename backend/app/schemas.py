from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

SKU_PATTERN = r"^[A-Z0-9][A-Z0-9-]{2,39}$"
MovementType = Literal["in", "out", "adjustment"]


class ProductBase(BaseModel):
    sku: str = Field(..., min_length=3, max_length=40, pattern=SKU_PATTERN)
    name: str = Field(..., min_length=1, max_length=150)
    category: str = Field(..., min_length=1, max_length=80)
    unit_price: Decimal = Field(..., ge=0, max_digits=10, decimal_places=2)
    reorder_level: int = Field(0, ge=0)
    supplier: str | None = Field(None, max_length=150)

    model_config = ConfigDict(str_strip_whitespace=True)


class ProductCreate(ProductBase):
    quantity_on_hand: int = Field(0, ge=0)


class ProductUpdate(BaseModel):
    sku: str | None = Field(None, min_length=3, max_length=40, pattern=SKU_PATTERN)
    name: str | None = Field(None, min_length=1, max_length=150)
    category: str | None = Field(None, min_length=1, max_length=80)
    unit_price: Decimal | None = Field(None, ge=0, max_digits=10, decimal_places=2)
    reorder_level: int | None = Field(None, ge=0)
    supplier: str | None = Field(None, max_length=150)
    is_active: bool | None = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def reject_null_required_fields(self):
        required = ("sku", "name", "category", "unit_price", "reorder_level", "is_active")
        for field in required:
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class ProductOut(ProductBase):
    id: int
    quantity_on_hand: int
    unit_price: float
    is_active: bool
    low_stock: bool
    out_of_stock: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


class ProductPage(BaseModel):
    items: list[ProductOut]
    page: int
    per_page: int
    total: int
    pages: int


class StockMovement(BaseModel):
    type: MovementType
    quantity: int = Field(..., ge=0)
    reference: str | None = Field(None, max_length=80)
    note: str | None = Field(None, max_length=500)

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def quantity_must_be_positive(self):
        if self.type in ("in", "out") and self.quantity < 1:
            raise ValueError("Quantity must be at least 1 for stock in or stock out.")
        return self


class TransactionOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    type: str
    quantity: int
    previous_quantity: int
    resulting_quantity: int
    reference: str | None
    note: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    page: int
    per_page: int
    total: int
    pages: int


class StockResult(BaseModel):
    product: ProductOut
    transaction: TransactionOut


class SummaryOut(BaseModel):
    total_products: int
    total_units: int
    inventory_value: float
    low_stock_count: int
    out_of_stock_count: int


class LowStockResponse(BaseModel):
    items: list[ProductOut]
    count: int


class CategoryResponse(BaseModel):
    categories: list[str]

from .models import StockTransaction
from .errors import InventoryError


def apply_stock_movement(
    db,
    product,
    movement_type,
    quantity,
    reference=None,
    note=None,
):
    """Mutate a product's stock and queue the matching ledger entry.

    The caller commits the session, which keeps product and transaction writes
    in the same unit of work.
    """
    previous = product.quantity_on_hand

    if movement_type == "in":
        resulting = previous + quantity
    elif movement_type == "out":
        if quantity > previous:
            raise InventoryError(
                f"Cannot remove {quantity} units. Only {previous} in stock.", 400
            )
        resulting = previous - quantity
    elif movement_type == "adjustment":
        resulting = quantity
    else:
        raise InventoryError("Unknown stock movement type.", 400)

    transaction = StockTransaction(
        product_id=product.id,
        type=movement_type,
        quantity=quantity,
        previous_quantity=previous,
        resulting_quantity=resulting,
        reference=reference,
        note=note,
    )
    product.quantity_on_hand = resulting
    db.add(transaction)
    return transaction

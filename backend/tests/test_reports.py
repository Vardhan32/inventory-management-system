def test_summary_counts_and_value(client, create_product):
    create_product(sku="SKU-1001", quantity_on_hand=10, unit_price=300)
    create_product(sku="SKU-1002", quantity_on_hand=3, reorder_level=5, unit_price=200)
    create_product(sku="SKU-1003", quantity_on_hand=0, reorder_level=4, unit_price=100)

    summary = client.get("/api/reports/summary").json()

    assert summary == {
        "total_products": 3,
        "total_units": 13,
        "inventory_value": 3600.0,
        "low_stock_count": 1,
        "out_of_stock_count": 1,
    }


def test_low_stock_report(client, create_product):
    create_product(sku="SKU-1001", name="Healthy", quantity_on_hand=10, reorder_level=4)
    create_product(sku="SKU-1002", name="Low", quantity_on_hand=2, reorder_level=5)
    create_product(sku="SKU-1003", name="Empty", quantity_on_hand=0, reorder_level=3)

    response = client.get("/api/reports/low-stock")
    assert response.status_code == 200
    body = response.json()

    assert body["count"] == 2
    assert [item["name"] for item in body["items"]] == ["Empty", "Low"]


def test_archived_products_do_not_count(client, create_product):
    product = create_product(quantity_on_hand=5, unit_price=100)
    client.post(
        f"/api/products/{product['id']}/stock",
        json={"type": "out", "quantity": 4},
    )
    client.delete(f"/api/products/{product['id']}")

    summary = client.get("/api/reports/summary").json()
    low_stock = client.get("/api/reports/low-stock").json()

    assert summary["total_products"] == 0
    assert summary["total_units"] == 0
    assert summary["low_stock_count"] == 0
    assert low_stock["count"] == 0

def test_stock_in_out_and_adjustment(client, create_product):
    product = create_product(quantity_on_hand=10, reorder_level=4)

    stock_in = client.post(
        f"/api/products/{product['id']}/stock",
        json={"type": "in", "quantity": 6, "reference": "GRN-44", "note": "New delivery"},
    )
    assert stock_in.status_code == 201
    assert stock_in.json()["product"]["quantity_on_hand"] == 16
    assert stock_in.json()["transaction"]["previous_quantity"] == 10
    assert stock_in.json()["transaction"]["resulting_quantity"] == 16

    stock_out = client.post(
        f"/api/products/{product['id']}/stock",
        json={"type": "out", "quantity": 4, "reference": "SO-91"},
    )
    assert stock_out.status_code == 201
    assert stock_out.json()["product"]["quantity_on_hand"] == 12

    adjustment = client.post(
        f"/api/products/{product['id']}/stock",
        json={"type": "adjustment", "quantity": 3, "note": "Cycle count"},
    )
    assert adjustment.status_code == 201
    assert adjustment.json()["product"]["quantity_on_hand"] == 3
    assert adjustment.json()["transaction"]["quantity"] == 3

    ledger = client.get(f"/api/transactions?product_id={product['id']}").json()
    assert ledger["total"] == 4
    assert [entry["type"] for entry in ledger["items"]] == [
        "adjustment",
        "out",
        "in",
        "in",
    ]


def test_stock_out_cannot_go_negative(client, create_product):
    product = create_product(quantity_on_hand=2)

    response = client.post(
        f"/api/products/{product['id']}/stock",
        json={"type": "out", "quantity": 3},
    )

    assert response.status_code == 400
    assert "Only 2 in stock" in response.json()["message"]

    current = client.get(f"/api/products/{product['id']}").json()
    assert current["quantity_on_hand"] == 2


def test_stock_quantity_validation(client, create_product):
    product = create_product(quantity_on_hand=5)

    zero_in = client.post(
        f"/api/products/{product['id']}/stock",
        json={"type": "in", "quantity": 0},
    )
    assert zero_in.status_code == 422

    negative = client.post(
        f"/api/products/{product['id']}/stock",
        json={"type": "adjustment", "quantity": -2},
    )
    assert negative.status_code == 422


def test_adjustment_to_zero_marks_out_of_stock(client, create_product):
    product = create_product(quantity_on_hand=7)

    response = client.post(
        f"/api/products/{product['id']}/stock",
        json={"type": "adjustment", "quantity": 0},
    )

    assert response.status_code == 201
    assert response.json()["product"]["quantity_on_hand"] == 0
    assert response.json()["product"]["out_of_stock"] is True


def test_transaction_filters_and_pagination(client, create_product):
    first = create_product(sku="SKU-1001", name="A4 Paper")
    second = create_product(sku="SKU-1002", name="Mouse")

    client.post(
        f"/api/products/{first['id']}/stock",
        json={"type": "out", "quantity": 2},
    )
    client.post(
        f"/api/products/{second['id']}/stock",
        json={"type": "in", "quantity": 3},
    )

    stock_out = client.get("/api/transactions?type=out").json()
    assert stock_out["total"] == 1
    assert stock_out["items"][0]["product_name"] == "A4 Paper"

    search = client.get("/api/transactions?q=mouse").json()
    assert search["total"] == 2
    assert all(item["product_name"] == "Mouse" for item in search["items"])

    first_page = client.get("/api/transactions?per_page=2&page=1").json()
    assert len(first_page["items"]) == 2
    assert first_page["total"] == 4
    assert first_page["pages"] == 2


def test_sequential_ledger_balance_integrity(client, create_product):
    product = create_product(sku="SKU-BAL-01", name="Ledger Audit Item", quantity_on_hand=50)

    # 1. Stock In: 30
    client.post(
        f"/api/products/{product['id']}/stock",
        json={"type": "in", "quantity": 30, "reference": "REC-01"},
    )
    # 2. Stock Out: 20
    client.post(
        f"/api/products/{product['id']}/stock",
        json={"type": "out", "quantity": 20, "reference": "DISP-01"},
    )
    # 3. Stock Out: 15
    client.post(
        f"/api/products/{product['id']}/stock",
        json={"type": "out", "quantity": 15, "reference": "DISP-02"},
    )
    # 4. Adjustment to 40 (physical cycle count)
    client.post(
        f"/api/products/{product['id']}/stock",
        json={"type": "adjustment", "quantity": 40, "reference": "CYCLE-01"},
    )

    updated = client.get(f"/api/products/{product['id']}").json()
    assert updated["quantity_on_hand"] == 40

    txs = client.get(f"/api/transactions?product_id={product['id']}&per_page=10").json()["items"]
    # 5 transactions total (1 opening + 4 movements)
    assert len(txs) == 5

    # Check chain of continuity from newest to oldest
    # Newest: adjustment from 45 -> 40
    assert txs[0]["type"] == "adjustment"
    assert txs[0]["previous_quantity"] == 45
    assert txs[0]["resulting_quantity"] == 40

    # Next: out 15 (60 -> 45)
    assert txs[1]["type"] == "out"
    assert txs[1]["previous_quantity"] == 60
    assert txs[1]["resulting_quantity"] == 45

    # Next: out 20 (80 -> 60)
    assert txs[2]["type"] == "out"
    assert txs[2]["previous_quantity"] == 80
    assert txs[2]["resulting_quantity"] == 60

    # Next: in 30 (50 -> 80)
    assert txs[3]["type"] == "in"
    assert txs[3]["previous_quantity"] == 50
    assert txs[3]["resulting_quantity"] == 80

    # Oldest: opening in 50 (0 -> 50)
    assert txs[4]["type"] == "in"
    assert txs[4]["previous_quantity"] == 0
    assert txs[4]["resulting_quantity"] == 50

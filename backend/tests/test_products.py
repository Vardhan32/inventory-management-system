def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_product_with_opening_stock(client):
    response = client.post(
        "/api/products",
        json={
            "sku": "OFF-1001",
            "name": "A4 Copy Paper",
            "category": "Office Supplies",
            "unit_price": 320,
            "quantity_on_hand": 24,
            "reorder_level": 10,
            "supplier": "Sri Lakshmi Paper Co.",
        },
    )

    assert response.status_code == 201
    product = response.json()
    assert product["quantity_on_hand"] == 24
    assert product["low_stock"] is False
    assert product["out_of_stock"] is False

    ledger = client.get(
        f"/api/transactions?product_id={product['id']}"
    ).json()
    assert ledger["total"] == 1
    entry = ledger["items"][0]
    assert entry["type"] == "in"
    assert entry["reference"] == "OPENING"
    assert entry["previous_quantity"] == 0
    assert entry["resulting_quantity"] == 24


def test_create_rejects_duplicate_sku(client, create_product):
    create_product(sku="OFF-1001")

    response = client.post(
        "/api/products",
        json={
            "sku": "OFF-1001",
            "name": "Another item",
            "category": "Office Supplies",
            "unit_price": 10,
        },
    )

    assert response.status_code == 409
    assert "SKU already exists" in response.json()["message"]


def test_validation_errors_are_returned_by_field(client):
    response = client.post(
        "/api/products",
        json={
            "sku": "lower-1001",
            "name": "",
            "category": "Office Supplies",
            "unit_price": -5,
            "reorder_level": -1,
        },
    )

    assert response.status_code == 422
    body = response.json()
    assert body["message"] == "Please check the submitted fields."
    assert {"sku", "name", "unit_price", "reorder_level"} <= set(body["errors"])


def test_list_search_category_and_low_stock_filters(client, create_product):
    create_product(sku="OFF-1001", name="A4 Paper", category="Office Supplies", quantity_on_hand=20, reorder_level=5)
    create_product(sku="ELE-2001", name="Wireless Mouse", category="Electronics", quantity_on_hand=3, reorder_level=5)
    create_product(sku="NET-3001", name="CAT6 Cable", category="Networking", quantity_on_hand=0, reorder_level=4)

    search = client.get("/api/products?q=paper").json()
    assert search["total"] == 1
    assert search["items"][0]["sku"] == "OFF-1001"

    category = client.get("/api/products?category=electronics").json()
    assert category["total"] == 1
    assert category["items"][0]["name"] == "Wireless Mouse"

    low = client.get("/api/products?low_stock=true").json()
    assert low["total"] == 2
    assert {item["sku"] for item in low["items"]} == {"ELE-2001", "NET-3001"}


def test_pagination_and_sorting(client, create_product):
    for index in range(5):
        create_product(
            sku=f"SKU-{2000 + index}",
            name=f"Item {index}",
            unit_price=100 + index,
            quantity_on_hand=index,
        )

    page = client.get("/api/products?per_page=2&page=2").json()
    assert len(page["items"]) == 2
    assert page["total"] == 5
    assert page["pages"] == 3

    sorted_by_name = client.get("/api/products?sort=name&per_page=10").json()
    assert [item["name"] for item in sorted_by_name["items"]] == [
        "Item 0",
        "Item 1",
        "Item 2",
        "Item 3",
        "Item 4",
    ]


def test_update_product_and_archive(client, create_product):
    product = create_product()

    updated = client.patch(
        f"/api/products/{product['id']}",
        json={"name": "Updated Item", "unit_price": 149.5, "supplier": "New Supplier"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Item"
    assert updated.json()["unit_price"] == 149.5

    archived = client.delete(f"/api/products/{product['id']}")
    assert archived.status_code == 204

    assert client.get(f"/api/products/{product['id']}").status_code == 200
    assert client.get("/api/products").json()["total"] == 0
    assert client.get("/api/products?include_inactive=true").json()["total"] == 1


def test_update_rejects_duplicate_sku(client, create_product):
    first = create_product(sku="SKU-1001")
    second = create_product(sku="SKU-1002")

    response = client.patch(
        f"/api/products/{second['id']}", json={"sku": first["sku"]}
    )
    assert response.status_code == 409


def test_missing_product_returns_404(client):
    assert client.get("/api/products/999").status_code == 404
    assert client.patch("/api/products/999", json={"name": "Nope"}).status_code == 404
    assert client.post("/api/products/999/stock", json={"type": "in", "quantity": 1}).status_code == 404

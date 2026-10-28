import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    bind=engine, autoflush=False, expire_on_commit=False
)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def create_product(client):
    def _create(**overrides):
        payload = {
            "sku": "SKU-1001",
            "name": "Test Item",
            "category": "Office Supplies",
            "unit_price": 100,
            "quantity_on_hand": 10,
            "reorder_level": 5,
            "supplier": "Test Supplier",
        }
        payload.update(overrides)
        response = client.post("/api/products", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _create

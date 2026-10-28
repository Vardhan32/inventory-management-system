from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .errors import InventoryError
from .routers import products, reports, transactions

app = FastAPI(
    title="Stockroom API",
    version="1.0.0",
    description="Product, stock, and transaction APIs for a small inventory team.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(transactions.router)
app.include_router(reports.router)


@app.get("/api/health", tags=["Meta"])
def health_check():
    return {"status": "ok"}


@app.exception_handler(InventoryError)
async def handle_inventory_error(request: Request, error: InventoryError):
    return JSONResponse(
        status_code=error.status_code,
        content={"message": error.message},
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, error: RequestValidationError):
    errors = {}
    for item in error.errors():
        location = [
            str(part)
            for part in item["loc"]
            if part not in ("body", "query", "path")
        ]
        field = ".".join(location) or "body"
        message = item["msg"].removeprefix("Value error, ")
        errors[field] = message

    return JSONResponse(
        status_code=422,
        content={
            "message": "Please check the submitted fields.",
            "errors": errors,
        },
    )

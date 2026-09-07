from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import async_session_factory, engine, Base
from app.models import TaxFiling, IncomeEntry, TaxAdjustment, SelfAssessmentPayment, ExemptionSelection, FiscalYear  # noqa: F401 — register with Base
from app.routers import adjustments, calculation, export, filings, fiscal_years, income, payments, tax_config, user_dashboard, users
from app.seed.seed_fiscal_years import seed_fiscal_years
from app.seed.seed_sample_data import seed_sample_data
from app.seed.seed_tax_config import seed_tax_config


@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup: create tables if needed and seed data
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        # Always seed tax config (idempotent), then seed users based on SEED_MODE
        await seed_fiscal_years(session)
        await seed_tax_config(session)
        await seed_sample_data(session)
        await session.commit()

    yield

    await engine.dispose()


app = FastAPI(
    title="SL Tax Calculator API",
    description="Sri Lankan Income Tax Calculator",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(fiscal_years.router)
app.include_router(filings.router)
app.include_router(income.router)
app.include_router(tax_config.router)
app.include_router(calculation.router)
app.include_router(payments.router)
app.include_router(adjustments.router)
app.include_router(user_dashboard.router)
app.include_router(export.router)


@app.get("/")
async def root():
    return {"message": "SL Tax Calculator API", "docs": "/docs"}

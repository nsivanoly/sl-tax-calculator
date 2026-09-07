# 🇱🇰 Sri Lanka Tax Calculator

A full-stack web application for calculating Sri Lankan personal income tax. Supports multi-year filings, tax optimization, PDF/Excel exports, and side-by-side strategy comparison.

Built with FastAPI + React + PostgreSQL, fully Dockerized for one-command setup.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## ✨ Features

- **Multi-user, multi-year filings** — manage tax filings across fiscal years for multiple taxpayers
- **Income management** — add/edit/delete income entries (salary, interest, foreign employment, other)
- **Bulk CSV upload** — import income data from spreadsheets
- **Step-by-step tax calculation** — progressive slab breakdown from gross income to net payable
- **Tax optimizer** — automatically finds the best exemption allocation to minimize tax
- **Side-by-side comparison** — compare domestic vs. foreign relief strategies
- **Configurable tax rules** — edit slabs, thresholds, and exemption limits per fiscal year
- **PDF exports** — visual filing summary with charts, text-based RAMIS export
- **Excel export** — RAMIS-ready `.xlsx` for official filing
- **Multi-year tax history** — dashboard with year-over-year charts and trends
- **Payment tracking** — record quarterly self-assessment payments
- **Pre-loaded sample data** — demo users with realistic fictional data included

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### Run

```bash
git clone https://github.com/<your-username>/sl-tax-calculator.git
cd sl-tax-calculator
docker compose up --build
```

Or use the helper script:

```bash
./start.sh
```

### Access

| Service | URL |
|---------|-----|
| 🌐 Frontend | http://localhost:3100 |
| 🔌 Backend API | http://localhost:8100 |
| 📚 Swagger Docs | http://localhost:8100/docs |
| 🐘 PostgreSQL | `localhost:5433` (user: `taxuser`, pass: `taxpass123`) |

### Stop

```bash
docker compose down        # preserves data
docker compose down -v     # wipes database (fresh on next start)
```

Or use `./stop.sh` for an interactive menu.

---

## 📊 Tax Rules (FY 2025/26 Defaults)

Sri Lanka uses a progressive tax slab system:

| Slab | Rate |
|------|------|
| First LKR 1,800,000 | 0% (Tax-free) |
| Next LKR 1,000,000 | 6% |
| Next LKR 500,000 | 18% |
| Next LKR 500,000 | 24% |
| Next LKR 500,000 | 30% |
| Balance | 36% |

**Key rules:**
- **Interest income exemption**: first LKR 1,500,000 exempt for resident individuals
- **WHT on interest**: 5% (FY 2023/24–2024/25) → 10% (FY 2025/26+), credited against final tax liability
- **Foreign employment income**: taxed separately at 15% flat rate (FY 2025/26+)
- **PAYE**: credited against final tax

> Tax configurations for FY 2023/24 through 2026/27 are pre-loaded. Rules are fully editable via the UI.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11, FastAPI, SQLAlchemy 2.0 (async), Alembic |
| **Frontend** | React 18, TypeScript, Vite, Ant Design, Recharts |
| **Database** | PostgreSQL 16 |
| **PDF** | ReportLab (charts + tables) |
| **Excel** | openpyxl |
| **Container** | Docker Compose (3 services) |

---

## 📁 Project Structure

```
sl-tax-calculator/
├── docker-compose.yml              # 3-service orchestration
├── start.sh / stop.sh              # Helper scripts
├── .env.example                    # Environment template
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/                    # Database migrations
│   ├── seed_data/                  # Sample CSV data (fictional)
│   ├── app/
│   │   ├── main.py                 # FastAPI app + lifespan
│   │   ├── config.py               # Settings (env-based)
│   │   ├── database.py             # Async engine + session
│   │   ├── models/                 # SQLAlchemy models
│   │   ├── schemas/                # Pydantic schemas
│   │   ├── routers/                # API endpoints
│   │   │   ├── income.py           # Income CRUD
│   │   │   ├── calculation.py      # Tax calculation + optimizer
│   │   │   ├── export.py           # PDF/Excel/CSV exports
│   │   │   ├── tax_config.py       # Tax rules management
│   │   │   ├── filings.py          # Filing lifecycle
│   │   │   ├── users.py            # User management
│   │   │   ├── user_dashboard.py   # Multi-year dashboard
│   │   │   ├── adjustments.py      # Tax adjustments
│   │   │   ├── payments.py         # Self-assessment payments
│   │   │   └── fiscal_years.py     # Fiscal year management
│   │   ├── services/
│   │   │   ├── tax_calculator.py   # Core 6-step tax engine
│   │   │   ├── tax_optimizer.py    # Greedy exemption optimizer
│   │   │   ├── pdf_generator.py    # RAMIS text PDF
│   │   │   ├── filing_visual_pdf.py # Visual PDF with charts
│   │   │   ├── tax_history_pdf.py  # Multi-year history PDF
│   │   │   ├── excel_generator.py  # RAMIS-ready Excel
│   │   │   └── csv_parser.py       # Bulk CSV import
│   │   └── seed/                   # Default data seeding
│   └── tests/
│
├── frontend/
│   ├── Dockerfile                  # Multi-stage (Node → nginx)
│   ├── nginx.conf                  # Serves React + proxies /api
│   └── src/
│       ├── pages/                  # Dashboard, Income, Calculator, etc.
│       ├── components/             # Reusable UI components
│       ├── api/client.ts           # API client
│       └── types/index.ts          # TypeScript types
│
└── sample_data/                    # Sample CSV for testing bulk upload
```

---

## 🔌 API Endpoints

### Income (scoped to filing)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/filings/{id}/income/` | List / create income entries |
| PUT/DELETE | `/api/filings/{id}/income/{id}` | Update / delete entry |
| POST | `/api/filings/{id}/income/bulk-csv` | Bulk CSV upload |
| GET | `/api/filings/{id}/income/summary` | Totals by category |

### Tax Calculation
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/filings/{id}/calculate/` | Full tax breakdown |
| POST | `/api/filings/{id}/calculate/optimize` | Find optimal exemptions |
| POST | `/api/filings/{id}/calculate/compare` | Compare relief strategies |

### Exports
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/filings/{id}/export/filing-visual-pdf` | Visual PDF with charts |
| GET | `/api/filings/{id}/export/tax-summary-pdf` | Text PDF for RAMIS |
| GET | `/api/filings/{id}/export/tax-summary-xlsx` | Excel for RAMIS |
| GET | `/api/filings/{id}/export/income-csv` | Income data CSV |

### Configuration & Management
| Method | Path | Description |
|--------|------|-------------|
| GET/PUT | `/api/tax-config/` | View / edit tax rules |
| PUT | `/api/tax-config/slabs` | Update slab rates |
| CRUD | `/api/filings/` | Filing lifecycle |
| CRUD | `/api/users/` | User management |
| GET | `/api/users/{id}/dashboard/` | Multi-year overview |

---

## 🧮 Tax Calculation Algorithm

The engine follows a 6-step process:

1. **Aggregate** — sum income by category (salary, interest, foreign, other)
2. **Apply exemptions** — exempt selected interest entries up to the cap (WHT credits are preserved even on exempt income)
3. **Subtract tax-free allowance** → assessable income
4. **Apply progressive slabs** — walk through rate bands (rates vary by FY; e.g. 2025/26: 6% → 18% → 24% → 30% → 36%)
5. **Sum credits** — WHT on interest + PAYE + self-assessment payments + manual adjustments
6. **Net payable** = gross tax − total credits (negative = refund)

### Optimizer Strategy

**Key insight**: exempting interest removes it from taxable income but does **not** remove WHT credits — so every rupee exempted saves tax at the marginal slab rate for free.

**Algorithm**: greedy knapsack — sort interest entries by amount descending, greedily exempt until the cap is filled. This maximizes cap utilization.

---

## 🧪 Sample Data

The app seeds two demo users on first startup:

- **Alice** — 3 fiscal years (2023/24, 2024/25, 2025/26) with salary, interest from multiple banks, and foreign employment income
- **Bob** — 1 fiscal year (2025/26) with foreign employment income and interest

All data is **entirely fictional** — bank names, account numbers, and amounts are made up for demonstration purposes.

A sample CSV file for testing bulk upload is available at [`sample_data/sample_income.csv`](sample_data/sample_income.csv).

---

## 🔧 Development

### Backend (without Docker)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Set DATABASE_URL to a running PostgreSQL instance
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend (without Docker)

```bash
cd frontend
npm install
npm run dev    # Starts on port 5173, proxies /api to backend
```

### Running Tests

```bash
cd backend
pytest -v
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙏 Acknowledgements

- Sri Lanka Inland Revenue Department for the published tax rules
- Built with [FastAPI](https://fastapi.tiangolo.com/), [React](https://react.dev/), [Ant Design](https://ant.design/), and [ReportLab](https://www.reportlab.com/)

# User Data Directory

Place your personal tax CSV files here. This directory is **gitignored** — nothing here will be committed.

## Quick Setup (auto-generate)

1. Name your CSV files using the convention: `<name>_<yyyy>_<yy>_income.csv` and `<name>_<yyyy>_<yy>_adjustments.csv`
   - e.g. `siva_2025_26_income.csv`, `siva_2025_26_adjustments.csv`
2. Run: `cd user_data && bash setup.sh`
   - This scans your CSVs and generates `users.json` automatically
   - Or just run `./start.sh` — it detects CSVs and offers to generate the manifest for you
3. Start the app and choose "My data" or "Both"

## Manual Setup

1. Create a `users.json` manifest (see example below)
2. Add your income and adjustment CSV files alongside it
3. Start the app with `./start.sh` and choose "My data" or "Both"

## users.json Format

```json
{
  "users": [
    {
      "name": "Your Name",
      "email": "you@example.com",
      "filings": [
        {
          "fiscal_year": "2025/26",
          "income": "my_2025_26_income.csv",
          "adjustments": "my_2025_26_adjustments.csv"
        },
        {
          "fiscal_year": "2024/25",
          "income": "my_2024_25_income.csv"
        }
      ]
    }
  ]
}
```

- `name` and `email` are required per user
- Each filing needs a `fiscal_year`; `income` and `adjustments` are optional filenames
- Filenames are relative to this directory
- If `adjustments` is omitted, no self-assessment payments are loaded for that year

## CSV Formats

### Income CSV

```csv
category,source_name,account_number,amount_lkr,amount_foreign,foreign_currency,exchange_rate,received_date,wht_deducted,paye_deducted,description
salary,My Employer,,5000000.00,,,,,,720000.00,Annual salary
interest,My Bank,FD-001,85000.00,,,,2026-03-31,8500.00,,Fixed deposit interest
foreign_employment,Client Co,,350000.00,1200.00,USD,291.67,2025-06-15,,,USD consulting
```

**Categories**: `salary`, `interest`, `foreign_employment`, `other`

### Adjustments CSV

```csv
label,adjustment_type,quarter,amount,description
Q1 Self-Assessment,self_assessment,Q1,15000.00,Quarterly payment – Q1
Q2 Self-Assessment,self_assessment,Q2,18000.00,Quarterly payment – Q2
```

## Tips

- You can also upload CSVs anytime through the app's UI (Income → Upload CSV)
- To reload data fresh: run `./start.sh`, choose "Clean start" then your seed option
- The app won't duplicate data — if a user with the same email already exists, seeding is skipped

#!/usr/bin/env bash
set -euo pipefail
#
# Auto-generate users.json from CSV files in this directory.
#
# Naming convention:
#   <name>_<fy>_income.csv        → income data
#   <name>_<fy>_adjustments.csv   → self-assessment payments (optional)
#
# Examples:
#   john_2025_26_income.csv       → user "john", FY "2025/26"
#   jane_2024_25_income.csv       → user "jane", FY "2024/25"
#
# Run:  cd user_data && bash setup.sh
# Or:   ./start.sh auto-detects CSVs and offers to run this for you.
#

cd "$(dirname "$0")"

if [ -f users.json ]; then
  read -rp "⚠  users.json already exists. Overwrite? [y/N]: " CONFIRM
  if [[ ! "${CONFIRM:-n}" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

# Use Python (available everywhere Docker runs) for clean JSON generation
python3 - <<'PYEOF'
import json, os, re, sys

print("🔍 Scanning for CSV files…\n")

users = {}  # name -> list of (fy, income_file, adj_file_or_None)

for f in sorted(os.listdir(".")):
    if not f.endswith("_income.csv"):
        continue
    basename = f[: -len("_income.csv")]
    m = re.match(r"^(.+)_(\d{4})_(\d{2})$", basename)
    if not m:
        print(f"  ⚠  Skipping {f} (doesn't match <name>_<yyyy>_<yy>_income.csv)")
        continue

    name = m.group(1)
    fy = f"{m.group(2)}/{m.group(3)}"
    fy_slug = f"{m.group(2)}_{m.group(3)}"
    adj_file = f"{name}_{fy_slug}_adjustments.csv"
    has_adj = os.path.isfile(adj_file)

    print(f"  📄 {f} → user: {name}, FY: {fy}" + (f" (+adjustments)" if has_adj else ""))

    if name not in users:
        users[name] = []
    users[name].append((fy, f, adj_file if has_adj else None))

if not users:
    print("\n❌ No income CSVs found matching the naming convention.")
    print("   Expected: <name>_<yyyy>_<yy>_income.csv")
    print("   Example:  siva_2025_26_income.csv")
    sys.exit(1)

# Build manifest
manifest = {"users": []}
for name in sorted(users.keys()):
    display_name = name.title()
    filings = []
    for fy, income_file, adj_file in sorted(users[name]):
        entry = {"fiscal_year": fy, "income": income_file}
        if adj_file:
            entry["adjustments"] = adj_file
        filings.append(entry)

    manifest["users"].append({
        "name": display_name,
        "email": f"{name}@example.com",
        "filings": filings,
    })

with open("users.json", "w") as f:
    json.dump(manifest, f, indent=2)
    f.write("\n")

print(f"\n📝 Generated users.json with {len(users)} user(s):\n")
print(json.dumps(manifest, indent=2))
print()
print("💡 You can edit names/emails in users.json, or rename users later in the app UI.")
print("   To load this data: ./start.sh → clean start → choose 'My data' or 'Both'")
PYEOF

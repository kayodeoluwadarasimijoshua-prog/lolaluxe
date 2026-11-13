# Lola’s Luxe

A mobile-first Nigerian boutique for Oluwadamilola. Flask serves a small, dependency-light JavaScript application; SQLite stores products, orders, reservations, owner authentication and the payment audit trail. Photos are resized to WebP. Vercel deployments use hosted PostgreSQL (Neon recommended) and Cloudinary photos; plain local previews use SQLite and a local photo directory. See [VERCEL.md](VERCEL.md) for the current deployment instructions for **shopwithlolaluxe.com.ng**. There is no payment gateway: verified payments and agreements happen in WhatsApp.

## Run locally

```bash
cd /workspace/lolaluxe
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python app.py seed
.venv/bin/python app.py owner --username oluwadamilola
.venv/bin/python app.py
```

Open http://localhost:3000 and `/admin`. The owner command securely prompts for a password of at least 12 characters. There are no built-in credentials. Running the command again resets the owner password. No email is needed or assumed. Confirm the exact spelling before adding any email-based service later.

The default is a **local preview**, with sample seeding available. Production must explicitly use `PREVIEW=0` and a **fresh production database**. Sample products are suppressed from public browsing and checkout in production. Do not reuse the preview database for live sales: its order history is test data. Tests use separate temporary databases.

## Vercel deployment

See [VERCEL.md](VERCEL.md) for GitHub import, Neon database and Cloudinary photos, WhoGoHost DNS, HTTPS, costs and private owner setup. `.env.example` lists the hosted settings. Vercel refuses to run without persistent database/storage configuration.

## Configuration

| Variable | Default | Production |
| --- | --- | --- |
| `DATA_DIR` | `./data` | Absolute path on persistent storage, e.g. `/var/lib/lolaluxe` |
| `PREVIEW` | `1` | **`0`** |
| `COOKIE_SECURE` | `0` | **`1`** behind HTTPS |
| `PORT` | `3000` | For local Python runner |
| `SECRET_KEY` | Generated in `DATA_DIR/session.key` | Optional secret override; keep stable and private |

Database tables are created automatically on startup with `CREATE TABLE IF NOT EXISTS`. `data/store.db` is the database; `data/uploads/` contains the photos. The generated session key must be persisted. Source contains no passwords. For the alternative SQLite/VPS deployment, the app needs one instance with one local persistent volume; do not put its database on NFS, an ephemeral filesystem or a static-only host. A few hundred products fit easily. Uploads are owner-only, decoded, re-encoded, stripped of EXIF metadata, limited to 12 MB per request and resized to 1600px. Photos are publicly served because customers need to see them.

## Commerce and accounting

- Cart persists in the customer's browser. The server checks current price, publication and exact variant availability before saving checkout. A stable checkout key deduplicates double taps and retries; mismatched reuse is rejected. An order does not reserve stock automatically.
- The saved reference and item snapshot generate the WhatsApp message for **+234 707 118 1050**. The customer must tap **Send**. A successful handoff does not prove that a message was sent or a transfer was made.
- Owner can reserve an exact combination against an open order. The hold blocks new checkout and can be released. Reservations are released on dismissal or full product payment. Full payment reduces stock; a correction reopening the balance restores the stock. An actual verified transfer remains recordable even if another request has since depleted stock: owner must resolve any shortage personally.
- Integer kobo are used for all stored money. Product and delivery amounts remain separate. Money paid directly to a rider is an arrangement, not an owner receipt. Product sales exclude delivery money and overpayments.
- Payment submission keys deduplicate retries, while each deliberate new entry has a new key. Each payment and resulting order status/inventory update is one database transaction. Payment corrections append a replacement with the original ID, actor, timestamp and mandatory reason. Original entries are preserved and excluded from effective totals after replacement.
- Product balance zero marks a sale Paid. A third underpayment stays Part-paid and is flagged. Payment exceptions and excesses require an explanatory note. The stated ₦2,000 / two-week terms are displayed without inventing how the minimum or start date applies; the owner records the actual agreement and due date.
- Completing an order dates the sale in Africa/Lagos. Reopening clears the completion date; paying the reopened balance establishes a new completion date. Bestsellers rank by units on fully paid website orders. Dashboard date filters apply to completed-sales figures. Published products and open-payment balances are current snapshots.
- Closing an order with payment history requires typing its reference and giving a review reason. Money and history remain visible. Receipts on dismissed orders are disclosed separately from active open-order product payments. This is an operational sales book, not a refund or bank reconciliation system.

## Verification

To run the full accounting suite against both real PostgreSQL and SQLite, install `requirements-postgres-test.txt`. Without the optional `pgserver` package the PostgreSQL integration tests are skipped.


```bash
.venv/bin/python -m pytest -q
.venv/bin/python tests/browser_flow.py
```

The browser test uses `/usr/bin/chromium`, starts an isolated local server and creates generated test credentials. Set the executable path in that test for another development OS. Screenshots go to ignored `artifacts/`. It never sends a WhatsApp message or real payment. See [BUILD_REPORT.md](BUILD_REPORT.md) for tested scenarios and launch needs.

## Handover and deployment

- [Phone-friendly owner guide](HANDOVER.md)
- [Deployment, budget, DNS, HTTPS and backups](DEPLOYMENT.md)
- [Build report](BUILD_REPORT.md)

The visual direction follows the attached Stitch reference: rose, ivory, plum, gold, Playfair Display and Plus Jakarta Sans. Fonts are self-hosted with OFL licenses in `static/fonts`. Preview imagery is extracted from the user's supplied design screenshots because the original external image host was unavailable. Replace with original, rights-cleared product photography before launch. No third-party scripts, analytics or tracking are installed.

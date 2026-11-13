# Build report

## Neon and Cloudinary update

The recommended deployment now uses **Vercel + Neon PostgreSQL + Cloudinary photos**. Cloudinary uses authenticated server-side signed uploads, validates returned image URLs against the configured cloud/folder, keeps credentials out of browser responses and uses the same existing photo optimization path. Supabase remains an optional alternative. Neon works through the existing PostgreSQL adapter; no database logic rewrite is needed.

**30 tests pass**, and the phone acceptance flow passes after this change. The provider transport tests use SDK/HTTP stubs; no live Neon/Cloudinary account was available for remote verification. Account setup, real deployment and DNS remain blocked on access. A practical setup guide is in [VERCEL.md](VERCEL.md).

## Previous Vercel update

Source was pushed to `kayodeoluwadarasimijoshua-prog/lolaluxe` on GitHub. The domain is now **shopwithlolaluxe.com.ng**. Vercel configuration, PostgreSQL transactions, private-schema protections and Supabase photo storage are implemented. Local SQLite preview remains supported. Hosted deployment and DNS remain pending account/network access. See [VERCEL.md](VERCEL.md) for setup.

The expanded suite passes **27 tests** against both real local PostgreSQL and SQLite, concurrent duplicate checkout/payment requests, external storage transport, stable owner sessions across cold starts, and zero reliance on local writable files in the serverless configuration. The phone browser acceptance flow also passes after the Vercel adaptations. Supabase HTTP upload transport was tested with a stub; a live Supabase account and Vercel build/deployment have not yet been available to verify.

## Original delivery

Working source in `/workspace/lolaluxe`. A local preview runs at http://localhost:3000. No production deployment or DNS change has been made.

- Responsive storefront following the supplied Stitch visual direction, self-hosted fonts, a swipeable controlled carousel, category pages, sticky filters, search, sort, two-column phone product grid, product galleries and exact combination availability.
- Persistent cart, server revalidation with explicit review of changed items, pickup / delivery choice, saved order snapshots, unique references, retry-safe checkout, WhatsApp handoff, copy and reopen controls.
- Server-protected owner sign-in, product publishing, uploads, categories, variants, exact item reservations, searchable/filterable orders, agreements, due dates, verified split payments, payment corrections and reviewed request dismissal.
- Persistent SQLite database and local optimized image storage. Integer-kobo accounting, atomic payment/status changes, retry deduplication and append-only correction history.
- Real-record sales dashboard with Africa/Lagos completion dates and date filtering, unit-ranked bestsellers, active open-order product payments and separately disclosed receipts on dismissed requests.
- Owner guide, pinned dependencies, production environment example, systemd service, Caddy configuration and SQLite-aware backup script.

## Verified

`python -m pytest -q`: **11 tests passed**, covering:

| Scenario | Result |
| --- | --- |
| ₦12,000 order; 3 deliberate ₦4,000 payments | ₦8,000 → ₦4,000 → ₦0; 1 paid order, 1 item, ₦12,000 product sales |
| Single full payment | Paid immediately |
| Underpaid third instalment | Part-paid; balance and follow-up flag retained |
| Correction reopening a paid balance | Original retained; product balance and inventory restored; completed sales recalculated |
| Two deliberate equal payments | Separate entries preserved |
| Accidental duplicate payment submission | One entry for one submission key |
| Checkout double tap / retry | Same reference; only one order |
| Rider-direct delivery | Arrangement recorded; rider money excluded from owner receipts |
| Combined transfer | Product and delivery portions separately recorded; rider fees excluded from sales |
| Abandoned request | Dismissible without payments |
| Closing with payment history | Requires reference review and closing reason; history retained |
| Sold-out size/colour; reserved stock | Checkout rejected for unavailable exact combination; releasing hold restores availability |
| Price change / unpublish | Checkout rejects stale cart for review |
| Signed-out orders, dashboard, product writes, upload, payment and reservation actions | Denied on server |
| Missing CSRF / non-integer currency | Rejected |
| Photo upload and restart persistence | Photo resized and stored; fresh app reads same database |
| Preview-only catalogue in production | Sample products hidden |
| Overdue date, excess payment and completed date filtering | Correct flags, required exception notes and totals |

`python tests/browser_flow.py`: **passed** on Chromium at **390 × 844**, using an isolated temporary database and generated test-only owner credentials:

1. Signed in and published a labelled ₦12,000 verification bag with an uploaded photo.
2. Found it with the Bags filter, opened the product and added it to the cart.
3. Refreshed the cart and verified persistence.
4. Checked the saved reference, product message, Pickup choice, ₦12,000 subtotal and WhatsApp recipient `2347071181050`.
5. Checked the reopen link and handoff copy. Actual WhatsApp sending was intentionally not performed by the automated test.
6. Recorded 3 × ₦4,000 via the owner UI; verified each balance and the paid dashboard figures.
7. Confirmed anonymous order access is denied; no browser errors or horizontal overflow.

Additional storefront checks ran at 320px, 390px, 768px and 1440px without horizontal overflow. The backup script was run and its archive restored to a temporary directory; SQLite integrity check passed and all seven preview products were recovered. Test screenshots are in `artifacts/` (excluded from source control).

## Still needed for launch

- Provision production hosting and backups, create a fresh production data directory, set `PREVIEW=0` / `COOKIE_SECURE=1`, and create Oluwadamilola’s private owner password using the documented command.
- Connect domain DNS and verify HTTPS, redirects, secure cookies and backup restoration on the chosen host. Deploy instructions and planning cost estimates are in DEPLOYMENT.md.
- Replace low-resolution screenshot-derived preview imagery with original product photography and publish the real catalogue. Preview samples never appear publicly when production mode is configured correctly.
- Confirm how the ₦2,000 minimum applies and when the two-week instalment period starts. Until then, enter the specific agreement, due date and exceptions on each order.
- Confirm exact email spelling only if adding an email service; this release uses username/password and does not need email.
- Perform a real-phone, real-WhatsApp handoff to the owner. Automated tests checked the destination/message without sending or collecting money. No transfer verification, delivery dispatch, refund processing or WhatsApp send confirmation is automated.

The attached ZIP was used as a visual reference. The pasted request supplied the functional requirements.

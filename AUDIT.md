# GPT-6 Astra audit and corrective update

The requested GPT-6 Astra review inspected the source and reproduced failures in isolated databases and Chromium. No live customer records were used. The root agent implemented the fixes below and verified them locally.

## Fixed

| Finding | Result |
| --- | --- |
| Public owner links in the storefront | Removed from header, footer and mobile navigation. Server-side owner authentication remains. Oluwadamilola uses the bookmarked `/admin` URL. |
| Blurry model banner | Used the requested image-generation edit to reconstruct a clear 1146 × 1372 editorial image, saved as optimized `hero-editorial.webp`. Adjusted the crop to keep her face visible. The original small source is retained. |
| Size/colour edit silently changed an existing cart selection | Changing a combination's labels now creates a new combination identity. Old carts must review the unavailable selection. Active reservations block removing/renaming held combinations. |
| Delivery overpayments had no warning | Added delivery excess totals, exception-note validation and a visible order warning. Product sales still exclude delivery receipts. Rider-direct arrangements continue to exclude rider money from owner receipts. |
| Valid payment correction wrongly required an extra exception | Validation now subtracts the corrected original before computing projected receipts. A correction does not count as another instalment. Its mandatory reason and original history are preserved. |
| Reserving a removed variant caused a server error | Returns a clear unavailable-selection response instead of crashing. Releasing a hold does not require the old option to exist. |
| Search ignored price sorting and showed stale result counts | Shared filtering/sorting path and live result count, including zero-result searches. |
| Payment retry identity lost on refresh | Unconfirmed payment data and its submission reference persist in the tab. A committed payment discovered in history clears the pending draft. Changed payloads cannot silently reuse a recorded submission key. |
| Late receipts could hide stock conflicts | Verified money remains recordable, but affected orders now show inventory/reservation conflicts requiring review before fulfilment. |
| Corrupt stored cart could break app startup | Stored JSON is read defensively and invalid cart rows are discarded. |

## Verification

- **40 server tests passed**, running the accounting suite against SQLite and real local PostgreSQL.
- Phone acceptance flow passed: upload/publish a product → category filter → product → persistent cart → WhatsApp message → three payments → correct paid dashboard.
- Simulated the first payment being committed while its HTTP response was lost. Refresh recovered the recorded payment without creating a duplicate, and the remaining payments completed normally.
- Browser verified zero public `/admin` links, the high-resolution banner, search sorting and zero-result count, and malformed-cart recovery.
- No horizontal overflow at 320, 390, 768 and 1440 pixels.

## Remaining work and limits

- The other **sample product photographs are still low-resolution preview images**. Replace them with original product photography before publishing the real catalogue. The edited hero reconstructs details with AI and serves as editorial imagery; it does not establish the exact appearance or availability of inventory.
- Stock conflicts need owner resolution before fulfilment. Recording verified money does not promise stock allocation. This release does not track shipping, returns or refunds; payment corrections can restore available stock and the owner must reconcile physical inventory with fulfilment history.
- Production Vercel environment values, live provider connectivity, owner-account initialization, real-phone WhatsApp sending, the purchased domain and HTTPS still need live verification. Local tests are not evidence that those account settings are complete.
- No source database migration is required for this update. Existing hosted credentials and records remain in place.


## Storefront refresh — 13 November 2026

Replaced all seven remaining low-resolution preview photos with generated high-resolution WebP artwork (1024 px or wider); the previously regenerated editorial hero remains. Images remain illustrative preview samples, not real inventory. Accessories use contain sizing in the banner to avoid cropping bags or shoes. Versioned static URLs refresh cached artwork and frontend files.

Homepage collections advance every five seconds with pause/play, manual arrows, touch swipes, hover/focus protection and reduced-motion default. Route changes clear the timer. Added Basic Tops, Two-Piece Sets, Gowns, Skirts, Bottoms (joggers, capri pants and trousers), Slippers, Adire, Jerseys, Scarves and Jeans alongside Shoes and Bags; legacy categories remain for existing merchandise. Only sample trousers, dress and denim are recategorized automatically.

Validation: 40 backend tests passed on SQLite/PostgreSQL and storage fixtures. Mobile browser flow passed carousel rotation/pause/manual controls, category availability, upload, checkout, payment retry recovery, dashboard totals and signed-out access checks. No browser errors or horizontal overflow. Live Vercel deployment status must be checked separately.


## Invitation-only team access — 13 November 2026

The owner is now Super Admin. Product Admins receive private, single-use, 24-hour invitation links, set their own passwords and can upload images, add categories, and save/edit drafts. Server-side checks deny publication, live-product edits, orders, finances, staff management and activity logs. The owner reviews and publishes drafts. There is no public registration endpoint. Invitation tokens are stored hashed, shared manually, and removed from the browser address after opening; account responses never expose hashes or passwords. Staff resets and revocation invalidate existing sessions. Owner password reset also invalidates owner sessions. Product saves record actor, action and time.

Automated coverage includes unauthenticated account creation denial, fabricated/expired/reused/replaced invitations, role escalation attempts, financial-route denial, draft approval, immediate revocation, reinvitation and owner-session invalidation on SQLite and PostgreSQL. Mobile browser acceptance covers invitation creation, activation, restricted navigation, image upload, draft creation, Super Admin publication and revocation. Existing checkout/payment flow also remains covered. Live Vercel verification is separate.

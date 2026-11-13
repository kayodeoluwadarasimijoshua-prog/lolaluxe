> **Current deployment target: Vercel.** Follow [VERCEL.md](VERCEL.md) for shopwithlolaluxe.com.ng. This document retains the alternative VPS/SQLite procedure; it is not the Vercel setup.

# Deployment and operating budget

## Suggested low-maintenance setup

One small Linux VPS with persistent SSD storage, a systemd service running Gunicorn, Caddy for automatic HTTPS, and encrypted off-host backups. SQLite and photo files share a persistent data directory. This avoids separate paid database and object-storage services. Automatic application deployment to ephemeral/serverless storage is **not compatible** with this setup.

Planning estimates, not live provider quotes:

| Item | Expected budget |
| --- | --- |
| 1 GB RAM Linux VPS, ~20–25 GB SSD | US$5–8/month; verify provider pricing and Nigerian payment availability |
| SQLite | US$0 additional, uses VPS disk |
| Image storage | US$0 additional within VPS disk; 500 × 200 KB images ≈ 100 MB |
| Encrypted external backups | US$1–3/month at small scale; verify provider minimums and egress |
| Caddy TLS certificates | US$0 |
| `shopwithlolaluxe.com.ng` registration/renewal | Registrar-specific yearly NGN price; confirm ownership, VAT and renewal quote |

Budget approximately **US$6–11/month plus domain**, before tax and currency conversion. A managed host with a persistent disk is an alternative, typically budget US$10–20+/month; check its volume and backup costs. This is not a multi-region deployment. Backups are necessary to protect local database and photos.

## First production deployment

1. Choose the host, region and backup provider. Point a deployment user at the source. Install Python 3.12+, a venv package, and Caddy using the OS's supported package process.
2. Place source at `/opt/lolaluxe`. Create a virtual environment there and run `pip install -r requirements.txt`. Use a dedicated unprivileged `lolaluxe` service user. Give it write access only to `/var/lib/lolaluxe` and read access to source. Set data directory mode 700.
3. Start with an empty `/var/lib/lolaluxe`. Create a private environment file, based on `deploy/environment.example`, at `/etc/lolaluxe.env` with mode 600. Set `PREVIEW=0`, `COOKIE_SECURE=1`, and `DATA_DIR=/var/lib/lolaluxe`. Never run the seed command against this directory. Do not copy the local preview database.
4. In the production environment, run `app.py owner --username oluwadamilola` as the service user. Enter a unique password privately when prompted. This is also the password reset procedure. Do not put the password in shell history or source control. Owner email is intentionally unused pending confirmation of spelling.
5. Install `deploy/lolaluxe.service`, adapting paths/users if needed. Enable and start the service. Install the Caddyfile from `deploy/Caddyfile`. Configure the firewall to accept 80/443, and your restricted SSH access. Gunicorn binds loopback only.
6. Publish real products and original photos using the owner portal. Test the production flow with a clearly labelled verification item and verified test bookkeeping; clear the verification database before accepting real orders, or use a separate staging host/database for acceptance testing.

No hosting account, domain access, DNS changes or public deployment has been performed in this workspace.

## DNS and HTTPS checklist for shopwithlolaluxe.com.ng

- In the authoritative DNS provider, point apex `A` to the VPS IPv4. Add `AAAA` only if IPv6 actually works on the host.
- Add `www` as a CNAME to `shopwithlolaluxe.com.ng` (or an A record to the host). Preserve existing mail/MX/TXT records.
- Confirm `dig +short shopwithlolaluxe.com.ng A` and `dig +short www.shopwithlolaluxe.com.ng` resolve correctly from external networks.
- Keep TCP 80 and 443 reachable for certificate issuance. Caddy obtains and renews TLS automatically once DNS points here.
- Check `curl -I http://shopwithlolaluxe.com.ng` redirects to HTTPS. Check `curl -I https://shopwithlolaluxe.com.ng` succeeds with a valid certificate, and `www` redirects to the canonical apex.
- On a real phone, confirm no mixed content, images load, `/admin` sign-in works, and an anonymous `/api/orders` returns 401. Check the auth cookie is Secure, HttpOnly and SameSite=Lax.
- Verify WhatsApp opens **+234 707 118 1050**, the saved reference, item options, quantities and subtotal. The customer must tap Send. No web callback confirms sending.
- Confirm Caddy renewal status/logs, host disk alerts, restart behavior and successful restore of a backup before launch.

## Backups and updates

Use SQLite's backup API for a consistent live database copy (do not blindly copy only a WAL-active `.db`). See `deploy/backup.py`. Copy the upload directory and session key in the same backup window. To get a fully aligned database/photo snapshot, briefly stop the service or pause owner writes while backing up. Encrypt archives, store them off the VPS, restrict access, and retain daily + weekly versions. Database and backups include private order and payment information.

A restore should bring back `store.db`, `uploads/`, and `session.key` with service-user ownership. Stop the service during restore, remove stale WAL/SHM files, then restart and confirm order balances, payment history and photos. Test restores periodically. Keep backup keys separate from the server.

For upgrades: take a restorable backup; install pinned dependencies in the venv; run tests against temporary/staging data; restart systemd; smoke-test sign-in and checkout. The current release initializes its schema automatically. Future schema changes need a versioned migration and tested rollback. Do not switch to multiple hosts sharing this SQLite file; migrate to PostgreSQL/object storage if that becomes necessary.

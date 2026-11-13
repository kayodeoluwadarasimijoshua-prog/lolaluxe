# Deploy shopwithlolaluxe.com.ng on Vercel

The GitHub repository is **kayodeoluwadarasimijoshua-prog/lolaluxe**. The purchased domain is **shopwithlolaluxe.com.ng**, registered at WhoGoHost. You can keep the registration there and host the application on Vercel.

## What is ready

`vercel.json` packages the Flask app, templates, static assets and self-hosted fonts as a Python function. On Vercel it uses hosted PostgreSQL and Supabase image storage. It refuses to start with an ephemeral database or a missing stable signing key. Locally, it still works with SQLite and local photos without signing up for another service.

PostgreSQL tables live in the non-public `lola_private` schema. They are fully qualified in queries, so transaction pooling works without relying on a persistent `search_path`. The schema is not intended for Supabase's public Data API, public/anonymous schema access is revoked, and row-level security is enabled. Do not expose this schema or add public policies. The service key stays server-side. Commerce transactions use a PostgreSQL advisory lock to preserve the original SQLite transaction semantics across Vercel instances.

## 1. Create persistent storage in Supabase

1. Create a project at https://supabase.com/dashboard. Select an appropriate region and save its database password privately.
2. Under **Connect**, copy the **transaction pooler** PostgreSQL connection string (usually port 6543). Replace its password placeholder with the URL-encoded database password, and retain `sslmode=require`. Use that as `DATABASE_URL`.
3. Under **Project Settings → API**, find the HTTPS project URL and the server-side **service_role** key. These become `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Do not use the anonymous key for uploads. Do not put the service key in GitHub, chat, browser JavaScript, or a public environment variable.
4. Under **Storage**, create a **public** bucket called `product-images`, with an image/webp MIME restriction and a suitable small file-size limit (e.g. 4 MB). Public reading is intentional: these are product catalogue photos. Do not grant anonymous upload/update/delete access. The app uploads with the server-side key only after owner authentication.
5. The app creates its private database schema/tables on first start. The pooler role must be able to create/own that schema. A dedicated least-privilege database role can be configured later; do not enable public Data API access to the private schema.

## 2. Import the existing GitHub repository into Vercel

1. Open https://vercel.com/new and sign in.
2. Install/authorize the Vercel GitHub integration for **only the lolaluxe repository** if possible.
3. Import `kayodeoluwadarasimijoshua-prog/lolaluxe` with `main` as the production branch.
4. Keep the root directory at the repository root. The included configuration supplies the Python build; no Node build command or static output directory is needed.
5. Before deploying, add these **server-side environment variables** for Production:

| Name | Value |
| --- | --- |
| `PREVIEW` | `0` |
| `COOKIE_SECURE` | `1` |
| `DATABASE_URL` | Supabase transaction pooler connection string with TLS |
| `SUPABASE_URL` | HTTPS project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Private service-role API key |
| `SUPABASE_STORAGE_BUCKET` | `product-images` |
| `SECRET_KEY` | One strong stable random value, at least 32 characters |

Generate `SECRET_KEY` locally with `python -c 'import secrets; print(secrets.token_urlsafe(48))'` and enter it privately in Vercel. Do not rotate it between requests/deployments: it signs owner sessions. A full environment example is in `.env.example`.

6. Deploy. Open the resulting `.vercel.app` URL and check function logs. Empty catalogue is expected before products are published.
7. Initialize the owner securely using the command below, then sign in at `/admin` and publish original products.

### Owner setup from your computer

The owner password is stored as a hash in the hosted database. No public setup page or default password exists. Set up the repository locally, and in a private terminal export the same database URL, Supabase settings and signing key, or put them in an ignored shell-compatible `.env.local` file:

```bash
# In the project directory; .env.local must contain only trusted KEY="value" lines.
set -a
. ./.env.local
set +a
.venv/bin/python app.py owner --username oluwadamilola
```

Enter the password at the hidden prompt. The command initializes the same hosted database as Vercel. It can also reset the password later. Do not run `seed` against production. Do not commit `.env.local`.

### Preview deployments

Use a **separate Supabase project/database and bucket for Vercel Preview**, with its own `SECRET_KEY`. Set `PREVIEW=1` there only if you intentionally want the sample catalogue; seed via the CLI against that staging database. Keep preview deployments protected with Vercel's deployment protection. Do not share the production database with branches that run test orders or unreviewed code. Environment variables are not magically copied between Preview and Production.

## 3. Connect the WhoGoHost domain

1. In the Vercel project's **Settings → Domains**, add `shopwithlolaluxe.com.ng` and optionally `www.shopwithlolaluxe.com.ng`.
2. Vercel will show the **exact DNS records for this project**. Copy those values, including any ownership-verification TXT record. Use those current values rather than a generic IP from an old guide.
3. In WhoGoHost's domain DNS/Zone Editor, edit the records at the authoritative DNS provider. If WhoGoHost says DNS is managed elsewhere, use the provider listed in the domain's nameservers.
4. Set the apex record (`@`) as instructed by Vercel, and the `www` CNAME if you added it. Remove only conflicting web-hosting A/AAAA/CNAME records for those names. Preserve MX, mail, SPF, DKIM and other TXT records.
5. Keep WhoGoHost nameservers unless you deliberately choose Vercel-managed DNS. Changing the domain's nameservers is unnecessary for these record changes.
6. Wait for propagation, then use Vercel's domain verification and certificate status. HTTPS certificates are handled by Vercel. Set the apex as the primary domain and redirect `www` consistently.
7. Verify `https://shopwithlolaluxe.com.ng`, image loads, sign-in, signed-out `/api/orders` → 401 and a real-phone WhatsApp handoff to **+234 707 118 1050**.

## 4. Preview on your own computer

```bash
git clone https://github.com/kayodeoluwadarasimijoshua-prog/lolaluxe.git
cd lolaluxe
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell instead:
# .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python app.py seed
python app.py owner --username oluwadamilola
python app.py
```

Open http://localhost:3000. The seed command only adds clearly labelled local sample products. No Supabase or Vercel account is required for this mode. If you have exported hosted environment variables in your shell, unset them before running a plain local preview. The source checkout's database and images are not uploaded to GitHub.

## Budget and backups

Planning estimates, not live quotes: Vercel Pro is commonly around **US$20/user/month**; check current commercial-use terms (Hobby is intended for personal/non-commercial use). Supabase Free may be enough for staging but has quotas and inactivity limits; Pro commonly starts around **US$25/month**. Budget roughly **US$45/month** for the paid production combination before taxes, extra usage and WhoGoHost's domain renewal. Check the displayed plans before purchase. No paid plan has been purchased by the assistant.

Use Supabase's PostgreSQL backup/export facilities and separately back up the photo bucket: a database backup alone does not preserve the image objects. Verify available backup retention on the chosen plan and test restoration. Keep a copy of the signing key in a secret manager. The old `deploy/backup.py` script applies only to the alternative local SQLite/VPS deployment.

## Access needed to finish remotely

The initial source is uploaded to GitHub. Live Vercel/Supabase provisioning, environment entry, domain verification and HTTPS remain pending until account/tool access is available. Never paste account passwords, service keys or database passwords in chat.

For the shared cloud browser: open the right-hand panel, choose **+ → Desktop**, then **Take over** to sign in and **Return control** afterward. It is a separate browser from your personal computer; personal browser cookies are not shared. Browser control tools must also be enabled for the assistant. If Vercel was attached but no tools are available, reconnect it under Apps and tag Vercel again. This environment additionally needs allowed HTTPS access to Vercel/Supabase and TCP access to the selected PostgreSQL pooler to run live remote setup.

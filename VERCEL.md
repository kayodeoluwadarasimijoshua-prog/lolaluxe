# Finish deployment: Vercel + Neon + Cloudinary

Domain: **shopwithlolaluxe.com.ng** at WhoGoHost.
Repository: https://github.com/kayodeoluwadarasimijoshua-prog/lolaluxe

The current recommendation uses **Neon PostgreSQL** for products/orders/payments and **Cloudinary** for product photos. Supabase is optional and no longer required. Your existing PostgreSQL accounting code is retained. The previous Supabase setup is documented in [the alternative guide](deploy/SUPABASE_ALTERNATIVE.md).

## Account access

For remote setup, the assistant needs an enabled browser-control tool or connected account tools. The cloud environment supports a shared desktop, but its control tool was not exposed when last checked. To show the shared browser, open the right-hand panel → **+ → Desktop**. Choose **Take over**, sign in yourself, then choose **Return control**. Do not send passwords, API keys or database URLs in chat. This shared browser is separate from the browser on your own computer. Opening the viewer does not itself guarantee that assistant control tools become available.

If Desktop is missing, report that before spending time creating new connections. The assistant cannot enable browser tools from inside this chat. Reconnect Vercel under Apps if its tool connection is missing. Remote setup also needs network access to Vercel, Neon PostgreSQL and Cloudinary.

## 1. Neon: persistent database

1. Create/sign in to a Neon account at https://console.neon.tech and create a project for Lola's Luxe.
2. Copy the **pooled PostgreSQL connection string**, retaining `sslmode=require`. Store it privately as `DATABASE_URL` in Vercel.
3. The database user must own/create the app's schema. The app creates its tables in `lola_private`, with row-level security and no public policies. The owner/database role performs server-side writes. No browser database key is used.
4. Use a separate staging database/branch for test deployments. Do not reuse a database with real orders for test checkout.

## 2. Cloudinary: product photos

1. Create/sign in at https://console.cloudinary.com.
2. Find the **cloud name**, **API key** and **API secret** in the product environment's API settings.
3. Enter them privately in Vercel as `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
4. No unsigned upload preset is needed. The app signs uploads on the server after owner authentication. Photos are re-encoded as WebP, uploaded into `lolaluxe/products`, and served over HTTPS. Secrets are never sent to the storefront.

## 3. Vercel: import and deploy

1. Open https://vercel.com/new and import the existing GitHub repo **kayodeoluwadarasimijoshua-prog/lolaluxe**.
2. Keep repository root as the root directory and `main` as the production branch. The included `vercel.json` builds the Flask app; no Node build command or static output directory is needed.
3. Enter these server-side environment variables before deploying:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon's pooled PostgreSQL URI with TLS |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `SECRET_KEY` | Strong, stable random value of at least 32 characters |
| `PREVIEW` | `0` |
| `COOKIE_SECURE` | `1` |

Generate a signing key privately with `python -c 'import secrets; print(secrets.token_urlsafe(48))'`. Keep it stable across deploys. An example is in `.env.example`; never commit actual values.

4. Deploy and open the `.vercel.app` URL. An empty catalogue is expected before the owner publishes products.
5. Create the private owner account against the same Neon database using the CLI below. Then sign in at `/admin`, publish real products, and test an order request.

### Set up the private owner account

Use the source checkout and a private terminal. Set the hosted environment values privately, or put them in an ignored, trusted shell-compatible `.env.local` file. On macOS/Linux:

```bash
set -a
. ./.env.local
set +a
.venv/bin/python app.py owner --username oluwadamilola
```

Enter a unique password at the hidden prompt. No default password or public setup endpoint exists. This command also resets the password later. No email is assumed. Do not seed sample data into the live database.

## 4. Preview on your own computer

```bash
git clone https://github.com/kayodeoluwadarasimijoshua-prog/lolaluxe.git
cd lolaluxe
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell instead: .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python app.py seed
python app.py owner --username oluwadamilola
python app.py
```

Open **http://localhost:3000**. This mode uses SQLite and local photos and requires no hosted service. If hosted credentials were exported in this shell, unset them before starting a plain local preview. Sample products are labelled and are hidden from production checkout.

## 5. WhoGoHost: connect your domain

1. Vercel → Project → **Settings → Domains** → add `shopwithlolaluxe.com.ng` and, optionally, `www.shopwithlolaluxe.com.ng`.
2. Copy **the exact DNS records Vercel displays for this project**, including any ownership-verification TXT record.
3. In WhoGoHost's DNS/Zone Editor, update the apex (`@`) and `www` records accordingly. If its nameservers point elsewhere, edit records at that DNS provider instead.
4. Remove only conflicting web-hosting A/AAAA/CNAME records for these names. Preserve MX, mail, SPF, DKIM and other TXT records. There is no need to change nameservers merely to point the website to Vercel.
5. Wait for Vercel's domain validation and HTTPS certificate. Choose the apex as the primary domain and redirect `www` consistently.
6. Check `https://shopwithlolaluxe.com.ng`, photos, owner sign-in, signed-out `/api/orders` → 401, and a real-phone WhatsApp handoff to **+234 707 118 1050**.

## Plans, backups and timing

Neon and Cloudinary offer free allowances, but exact quotas, billing requirements and inactivity behavior must be checked in the chosen accounts. Do not rely on the unverified comparison table. Vercel's Hobby plan is intended for personal/non-commercial use; confirm its current commercial-use terms and displayed pricing before putting the live shop on it. No paid plan has been purchased by the assistant.

Keep database and photo backups separately. A Neon database export does not include Cloudinary images. Keep the signing key in a secret manager. Use isolated credentials/database branches for preview deployments and protect staging access.

Working estimate: **45–90 minutes after account access and credentials are available**, assuming no billing, verification, connectivity or unexpected deployment errors. DNS can take longer to propagate. This is not a guaranteed launch time.

Code is on GitHub and local tests cover PostgreSQL transactions, signed upload configuration, cold-start persistence, credential isolation and checkout/payment behavior. Live Vercel/Neon/Cloudinary provisioning, actual provider API calls and WhoGoHost DNS still require account access and verification.

<details>
<summary>Browser-access diagnostic for support</summary>

Environment: `ccarenv_b64_Y2NhcmVudl84MzQ0Nzg5N2UzNGM4MTkxODI3YmJlNzgzMzdhMWY5MA`. The desktop capability reports enabled with state unknown. No desktop JavaScript/browser-control tool or `open_in_codex` viewer-opening tool is exposed to this chat. Only the capability/status could be verified. The personal browser is not connected.

</details>

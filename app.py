import os, json, sqlite3, secrets, hashlib, io
from pathlib import Path
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from functools import wraps
from flask import (
    Flask,
    request,
    jsonify,
    session,
    send_from_directory,
    render_template,
    g,
)
from werkzeug.security import generate_password_hash, check_password_hash
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).parent


def now():
    return datetime.now(timezone.utc).isoformat()


def money(n):
    return "₦" + format(n / 100, ",.2f")


def fail(message, status=400, **extra):
    return jsonify(error=message, **extra), status


def integer(v, minimum=0, maximum=10**12):
    if type(v) is not int or not minimum <= v <= maximum:
        raise ValueError("Enter a valid whole number in the allowed range.")
    return v


def create_app(config=None):
    app = Flask(__name__)
    app.config.update(
        DATA_DIR=os.getenv("DATA_DIR", str(ROOT / "data")),
        PREVIEW=os.getenv("PREVIEW", "1") == "1",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "0") == "1",
        MAX_CONTENT_LENGTH=12 * 1024 * 1024,
        PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
    )
    if config:
        app.config.update(config)
    data = Path(app.config["DATA_DIR"])
    data.mkdir(parents=True, exist_ok=True)
    (data / "uploads").mkdir(exist_ok=True)
    key = data / "session.key"
    if not key.exists():
        key.write_text(secrets.token_hex(32))
        key.chmod(0o600)
    app.secret_key = os.getenv("SECRET_KEY") or key.read_text()

    def db():
        if "db" not in g:
            g.db = sqlite3.connect(data / "store.db", timeout=15)
            g.db.row_factory = sqlite3.Row
            g.db.execute("PRAGMA foreign_keys=ON")
            g.db.execute("PRAGMA journal_mode=WAL")
        return g.db

    app.db = db

    @app.teardown_appcontext
    def close(_):
        if "db" in g:
            g.db.close()

    with app.app_context():
        db().executescript(
            """
        CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY CHECK(id=1),username TEXT UNIQUE,password TEXT);
        CREATE TABLE IF NOT EXISTS categories(name TEXT PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>=0),description TEXT,images TEXT,variants TEXT,published INTEGER NOT NULL,sample INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,checkout_key TEXT UNIQUE NOT NULL,fingerprint TEXT NOT NULL,items TEXT NOT NULL,total INTEGER NOT NULL,fulfilment TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL,completed TEXT,due TEXT,note TEXT DEFAULT '',delivery_fee INTEGER DEFAULT 0,rider_direct INTEGER DEFAULT 0,stock_applied INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,order_id TEXT REFERENCES orders(id),submission_key TEXT UNIQUE,products INTEGER NOT NULL,delivery INTEGER NOT NULL,received TEXT NOT NULL,note TEXT,actor TEXT,created TEXT NOT NULL,corrects TEXT UNIQUE REFERENCES payments(id),reason TEXT);
        CREATE TABLE IF NOT EXISTS reservations(order_id TEXT REFERENCES orders(id),product_id TEXT REFERENCES products(id),variant TEXT,qty INTEGER NOT NULL,PRIMARY KEY(order_id,product_id,variant));
        CREATE TABLE IF NOT EXISTS login_attempts(ip TEXT,created TEXT);
        """
        )
        for c in ["Bags", "Shoes", "Clothes", "Trousers"]:
            db().execute("INSERT OR IGNORE INTO categories VALUES(?)", (c,))
        db().commit()

    def owner(fn):
        @wraps(fn)
        def inner(*a, **kw):
            if not session.get("owner"):
                return fail("Owner sign-in required.", 401)
            return fn(*a, **kw)

        return inner

    @app.before_request
    def security():
        if request.path.startswith("/api/") and request.method not in [
            "GET",
            "HEAD",
            "OPTIONS",
        ]:
            if not secrets.compare_digest(
                request.headers.get("X-CSRF-Token", ""), session.get("csrf", "!")
            ):
                return fail("Refresh the page and try again.", 403)
            if request.path != "/api/upload" and not isinstance(
                request.get_json(silent=True), dict
            ):
                return fail("Send a valid request object.")

    @app.after_request
    def headers(res):
        res.headers["X-Content-Type-Options"] = "nosniff"
        res.headers["X-Frame-Options"] = "DENY"
        res.headers["Referrer-Policy"] = "same-origin"
        res.headers["Content-Security-Policy"] = (
            "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        )
        if request.path.startswith("/api/"):
            res.headers["Cache-Control"] = "no-store"
        return res

    @app.errorhandler(ValueError)
    def invalid(e):
        return fail(str(e))

    @app.errorhandler(413)
    def large(e):
        return fail("Photo must be smaller than 12 MB.", 413)

    def product(row):
        p = dict(row)
        p["images"] = json.loads(p["images"])
        p["variants"] = json.loads(p["variants"])
        p["published"] = bool(p["published"])
        for v in p["variants"]:
            held = (
                db()
                .execute(
                    "SELECT COALESCE(SUM(qty),0) FROM reservations WHERE product_id=? AND variant=?",
                    (p["id"], v["id"]),
                )
                .fetchone()[0]
            )
            v["available"] = max(0, v["stock"] - held)
            v["reserved"] = held
        return p

    def getorder(ref):
        r = db().execute("SELECT * FROM orders WHERE id=?", (ref,)).fetchone()
        if not r:
            raise ValueError("Order not found.")
        o = dict(r)
        o["items"] = json.loads(o["items"])
        o["payments"] = [
            dict(x)
            for x in db().execute(
                "SELECT * FROM payments WHERE order_id=? ORDER BY created,id", (ref,)
            )
        ]
        replaced = {x["corrects"] for x in o["payments"] if x["corrects"]}
        effective = [x for x in o["payments"] if x["id"] not in replaced]
        o["paid_products"] = sum(x["products"] for x in effective)
        o["paid_delivery"] = sum(x["delivery"] for x in effective)
        o["balance"] = max(0, o["total"] - o["paid_products"])
        o["excess"] = max(0, o["paid_products"] - o["total"])
        o["delivery_balance"] = (
            0 if o["rider_direct"] else max(0, o["delivery_fee"] - o["paid_delivery"])
        )
        o["overdue"] = bool(
            o["due"]
            and o["balance"]
            and o["due"] < datetime.now(ZoneInfo("Africa/Lagos")).date().isoformat()
        )
        o["follow_up"] = len(effective) >= 3 and o["balance"] > 0
        o["payment_count"] = len(effective)
        o["reservations"] = [
            dict(x)
            for x in db().execute("SELECT * FROM reservations WHERE order_id=?", (ref,))
        ]
        return o

    def recalc(ref):
        o = getorder(ref)
        status = (
            "Paid"
            if o["paid_products"] >= o["total"]
            else "Part-paid" if o["paid_products"] else "Awaiting payment"
        )
        paid = status == "Paid"
        applied = bool(o["stock_applied"])
        if paid != applied:
            for item in o["items"]:
                row = (
                    db()
                    .execute(
                        "SELECT variants FROM products WHERE id=?",
                        (item["product_id"],),
                    )
                    .fetchone()
                )
                if not row:
                    continue
                variants = json.loads(row[0])
                for v in variants:
                    if v["id"] == item["variant_id"]:
                        v["stock"] = (
                            v["stock"] - item["qty"]
                            if paid
                            else v["stock"] + item["qty"]
                        )
                db().execute(
                    "UPDATE products SET variants=? WHERE id=?",
                    (json.dumps(variants), item["product_id"]),
                )
            if paid:
                db().execute("DELETE FROM reservations WHERE order_id=?", (ref,))
        db().execute(
            "UPDATE orders SET status=?,completed=?,stock_applied=? WHERE id=?",
            (status, (o["completed"] or now()) if paid else None, int(paid), ref),
        )

    @app.get("/api/session")
    def current():
        if "csrf" not in session:
            session["csrf"] = secrets.token_hex(24)
        return jsonify(
            csrf=session["csrf"],
            owner=session.get("owner"),
            preview=app.config["PREVIEW"],
        )

    @app.post("/api/login")
    def login():
        body = request.get_json()
        ip = request.remote_addr
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
        if (
            db()
            .execute(
                "SELECT COUNT(*) FROM login_attempts WHERE ip=? AND created>?",
                (ip, cutoff),
            )
            .fetchone()[0]
            >= 8
        ):
            return fail("Too many attempts. Try again in 15 minutes.", 429)
        row = db().execute("SELECT * FROM owner WHERE id=1").fetchone()
        if (
            not row
            or body.get("username") != row["username"]
            or not check_password_hash(row["password"], str(body.get("password", "")))
        ):
            db().execute("INSERT INTO login_attempts VALUES(?,?)", (ip, now()))
            db().commit()
            return fail("Sign-in details are incorrect.", 401)
        session.clear()
        session["owner"] = row["username"]
        session["csrf"] = secrets.token_hex(24)
        session.permanent = True
        return jsonify(ok=True, csrf=session["csrf"])

    @app.post("/api/logout")
    def logout():
        session.clear()
        return jsonify(ok=True)

    @app.get("/api/products")
    def products():
        admin = request.args.get("admin") == "1" and session.get("owner")
        rows = db().execute(
            "SELECT * FROM products"
            + (
                ""
                if admin
                else " WHERE published=1"
                + ("" if app.config["PREVIEW"] else " AND sample=0")
            )
            + " ORDER BY rowid DESC"
        )
        return jsonify([product(r) for r in rows])

    @app.get("/api/categories")
    def categories():
        return jsonify(
            [r[0] for r in db().execute("SELECT name FROM categories ORDER BY rowid")]
        )

    @app.post("/api/categories")
    @owner
    def category():
        name = str(request.get_json().get("name", "")).strip()
        if not 1 <= len(name) <= 40:
            raise ValueError("Category must have 1–40 characters.")
        db().execute("INSERT OR IGNORE INTO categories VALUES(?)", (name,))
        db().commit()
        return jsonify(ok=True)

    @app.post("/api/products")
    @owner
    def save_product():
        b = request.get_json()
        pid = b.get("id") or secrets.token_hex(8)
        name = str(b.get("name", "")).strip()
        price = integer(b.get("price"), 1)
        variants = b.get("variants")
        images = b.get("images", [])
        if (
            not name
            or len(name) > 150
            or not db()
            .execute("SELECT 1 FROM categories WHERE name=?", (b.get("category"),))
            .fetchone()
        ):
            raise ValueError("Name and a valid category are required.")
        if not isinstance(variants, list) or not 1 <= len(variants) <= 100:
            raise ValueError("Add 1–100 variant combinations.")
        ids = set()
        combos = set()
        for v in variants:
            if not isinstance(v, dict):
                raise ValueError("Each combination must be an object.")
            v["id"] = str(v.get("id") or secrets.token_hex(6))
            v["size"] = str(v.get("size", ""))[:40]
            v["colour"] = str(v.get("colour", ""))[:40]
            integer(v.get("stock"), 0, 100000)
            if v["id"] in ids or (v["size"], v["colour"]) in combos:
                raise ValueError("Each size and colour combination must be unique.")
            ids.add(v["id"])
            combos.add((v["size"], v["colour"]))
        if (
            not isinstance(images, list)
            or not 1 <= len(images) <= 8
            or any(
                not isinstance(i, str)
                or not (i.startswith("/uploads/") or i.startswith("/static/images/"))
                or ".." in i
                for i in images
            )
        ):
            raise ValueError("Upload 1–8 product photos.")
        with db():
            db().execute("BEGIN IMMEDIATE")
            for r in db().execute(
                "SELECT variant,SUM(qty) qty FROM reservations WHERE product_id=? GROUP BY variant",
                (pid,),
            ):
                if (
                    r["variant"] not in ids
                    or next(v["stock"] for v in variants if v["id"] == r["variant"])
                    < r["qty"]
                ):
                    raise ValueError(
                        "Release reservations before removing or reducing this combination."
                    )
            db().execute(
                "INSERT INTO products VALUES(?,?,?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,price=excluded.price,description=excluded.description,images=excluded.images,variants=excluded.variants,published=excluded.published",
                (
                    pid,
                    name,
                    b["category"],
                    price,
                    str(b.get("description", ""))[:5000],
                    json.dumps(images),
                    json.dumps(variants),
                    int(bool(b.get("published"))),
                ),
            )
        return jsonify(id=pid)

    @app.post("/api/upload")
    @owner
    def upload():
        f = request.files.get("photo")
        if not f:
            raise ValueError("Choose a photo.")
        try:
            im = Image.open(f.stream)
            if im.width * im.height > 24000000:
                raise ValueError(
                    "Photo is too large. Choose a photo under 24 megapixels."
                )
            im.load()
            im = ImageOps.exif_transpose(im).convert("RGB")
            im.thumbnail((1600, 1600))
            name = secrets.token_hex(16) + ".webp"
            im.save(data / "uploads" / name, "WEBP", quality=84)
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
            raise ValueError("Choose a valid JPG, PNG or WebP photo.")
        return jsonify(url="/uploads/" + name)

    @app.get("/uploads/<path:name>")
    def uploaded(name):
        return send_from_directory(data / "uploads", name)

    @app.post("/api/checkout")
    def checkout():
        b = request.get_json()
        key = str(b.get("key", ""))
        items = b.get("items")
        fulfilment = b.get("fulfilment")
        fingerprint = hashlib.sha256(
            json.dumps(
                {"items": items, "fulfilment": fulfilment}, sort_keys=True
            ).encode()
        ).hexdigest()
        if (
            not 16 <= len(key) <= 100
            or not isinstance(items, list)
            or not 1 <= len(items) <= 100
            or fulfilment not in ["Pickup", "Request delivery"]
        ):
            raise ValueError("Please check your cart and fulfilment choice.")
        with db():
            db().execute("BEGIN IMMEDIATE")
            existing = (
                db()
                .execute("SELECT * FROM orders WHERE checkout_key=?", (key,))
                .fetchone()
            )
            if existing:
                if existing["fingerprint"] != fingerprint:
                    return fail(
                        "This checkout has already been saved. Start a new cart.", 409
                    )
                return jsonify(handoff(dict(existing)))
            snapshots = []
            issues = []
            seen = set()
            for item in items:
                if not isinstance(item, dict):
                    raise ValueError("Each cart line must be an object.")
                qty = integer(item.get("qty"), 1, 99)
                pid = item.get("product_id")
                vid = item.get("variant_id")
                row = (
                    db()
                    .execute(
                        "SELECT * FROM products WHERE id=? AND published=1", (pid,)
                    )
                    .fetchone()
                )
                p = product(row) if row else None
                v = (
                    next((v for v in p["variants"] if v["id"] == vid), None)
                    if p
                    else None
                )
                if (pid, vid) in seen:
                    raise ValueError("Duplicate cart line.")
                seen.add((pid, vid))
                if (
                    not p
                    or (p["sample"] and not app.config["PREVIEW"])
                    or not v
                    or v["available"] < qty
                    or p["price"] != item.get("price")
                ):
                    issues.append(
                        {
                            "product_id": pid,
                            "variant_id": vid,
                            "name": p["name"] if p else "Removed product",
                            "price": p["price"] if p else None,
                            "available": v["available"] if v and p["published"] else 0,
                        }
                    )
                    continue
                snapshots.append(
                    {
                        "product_id": pid,
                        "variant_id": vid,
                        "name": p["name"],
                        "size": v["size"],
                        "colour": v["colour"],
                        "qty": qty,
                        "price": p["price"],
                        "image": p["images"][0],
                    }
                )
            if issues:
                return fail(
                    "Some items changed. Review your cart before continuing.",
                    409,
                    issues=issues,
                )
            ref = "LL-" + secrets.token_hex(4).upper()
            total = sum(i["qty"] * i["price"] for i in snapshots)
            db().execute(
                "INSERT INTO orders(id,checkout_key,fingerprint,items,total,fulfilment,status,created) VALUES(?,?,?,?,?,?,?,?)",
                (
                    ref,
                    key,
                    fingerprint,
                    json.dumps(snapshots),
                    total,
                    fulfilment,
                    "Awaiting payment",
                    now(),
                ),
            )
            return jsonify(
                handoff(
                    dict(
                        db()
                        .execute("SELECT * FROM orders WHERE id=?", (ref,))
                        .fetchone()
                    )
                )
            )

    def handoff(o):
        items = json.loads(o["items"])
        message = (
            f"Hello Lola’s Luxe! I’d like to place an order.\nReference: {o['id']}\n"
            + "\n".join(
                f"• {i['name']} ({i['size'] or 'One size'}, {i['colour']}) × {i['qty']} — {money(i['price']*i['qty'])}"
                for i in items
            )
            + f"\nProduct subtotal: {money(o['total'])}\nFulfilment: {o['fulfilment']}\nAny delivery fee is agreed separately. Please confirm availability and payment details."
        )
        from urllib.parse import quote

        return {
            "reference": o["id"],
            "message": message,
            "url": "https://wa.me/2347071181050?text=" + quote(message),
        }

    @app.get("/api/orders")
    @owner
    def orders():
        return jsonify(
            [
                getorder(r[0])
                for r in db().execute("SELECT id FROM orders ORDER BY created DESC")
            ]
        )

    @app.post("/api/orders/<ref>/agreement")
    @owner
    def agreement(ref):
        getorder(ref)
        b = request.get_json()
        due = b.get("due") or None
        if due:
            datetime.strptime(due, "%Y-%m-%d")
        db().execute(
            "UPDATE orders SET due=?,note=?,delivery_fee=?,rider_direct=? WHERE id=?",
            (
                due,
                str(b.get("note", ""))[:2000],
                integer(b.get("delivery_fee", 0)),
                int(bool(b.get("rider_direct"))),
                ref,
            ),
        )
        db().commit()
        return jsonify(getorder(ref))

    @app.post("/api/orders/<ref>/payments")
    @owner
    def payment(ref):
        b = request.get_json()
        key = str(b.get("key", ""))
        p = integer(b.get("products"))
        d = integer(b.get("delivery"))
        reason = str(b.get("reason", "")).strip()
        corrects = b.get("corrects")
        note = str(b.get("note", "")).strip()
        received = b.get("received")
        if not 16 <= len(key) <= 100:
            raise ValueError("Refresh and retry the payment.")
        datetime.strptime(received, "%Y-%m-%d")
        if not corrects and p + d == 0:
            raise ValueError("Enter the amount received.")
        with db():
            db().execute("BEGIN IMMEDIATE")
            o = getorder(ref)
            if (
                db()
                .execute("SELECT 1 FROM payments WHERE submission_key=?", (key,))
                .fetchone()
            ):
                return jsonify(getorder(ref))
            if o["status"] == "Dismissed":
                raise ValueError("Dismissed orders cannot receive payments.")
            if corrects:
                original = (
                    db()
                    .execute(
                        "SELECT * FROM payments WHERE id=? AND order_id=?",
                        (corrects, ref),
                    )
                    .fetchone()
                )
                if (
                    not original
                    or not reason
                    or db()
                    .execute("SELECT 1 FROM payments WHERE corrects=?", (corrects,))
                    .fetchone()
                ):
                    raise ValueError(
                        "Select an uncorrected payment and enter the correction reason."
                    )
            if (
                o["payment_count"] >= 3
                or (o["due"] and received > o["due"])
                or p > o["balance"]
            ) and not note:
                raise ValueError(
                    "Add an exception note for a payment outside the agreement or an excess."
                )
            db().execute(
                "INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                (
                    secrets.token_hex(12),
                    ref,
                    key,
                    p,
                    d,
                    received,
                    note,
                    session["owner"],
                    now(),
                    corrects,
                    reason,
                ),
            )
            recalc(ref)
        return jsonify(getorder(ref))

    @app.post("/api/orders/<ref>/dismiss")
    @owner
    def dismiss(ref):
        b = request.get_json()
        with db():
            db().execute("BEGIN IMMEDIATE")
            o = getorder(ref)
            if o["payments"] and (b.get("review") != ref or not b.get("reason")):
                return fail(
                    "Review the payment history, type the reference and give a closing reason.",
                    409,
                )
            if o["status"] == "Paid":
                raise ValueError(
                    "Paid sales remain accounted for. Correct payments first if needed."
                )
            db().execute(
                "UPDATE orders SET status=?,note=? WHERE id=?",
                (
                    "Dismissed",
                    o["note"]
                    + "\nClosing review: "
                    + str(b.get("reason", "Abandoned request")),
                    ref,
                ),
            )
            db().execute("DELETE FROM reservations WHERE order_id=?", (ref,))
        return jsonify(ok=True)

    @app.post("/api/orders/<ref>/reserve")
    @owner
    def reserve(ref):
        b = request.get_json()
        pid = b.get("product_id")
        vid = b.get("variant_id")
        qty = integer(b.get("qty"), 0, 99)
        with db():
            db().execute("BEGIN IMMEDIATE")
            o = getorder(ref)
            if o["status"] in ["Paid", "Dismissed"]:
                raise ValueError("Only open orders can hold items.")
            item = next(
                (
                    i
                    for i in o["items"]
                    if i["product_id"] == pid and i["variant_id"] == vid
                ),
                None,
            )
            if not item or qty > item["qty"]:
                raise ValueError("Reserve only items in this order.")
            db().execute(
                "DELETE FROM reservations WHERE order_id=? AND product_id=? AND variant=?",
                (ref, pid, vid),
            )
            row = db().execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
            p = product(row)
            v = next(v for v in p["variants"] if v["id"] == vid)
            if qty > v["available"]:
                raise ValueError("Not enough unreserved stock.")
            if qty:
                db().execute(
                    "INSERT INTO reservations VALUES(?,?,?,?)", (ref, pid, vid, qty)
                )
        return jsonify(getorder(ref))

    @app.get("/api/dashboard")
    @owner
    def dashboard():
        start = request.args.get("start")
        end = request.args.get("end")
        orders = [getorder(r[0]) for r in db().execute("SELECT id FROM orders")]
        paid = []
        for o in orders:
            if o["status"] != "Paid":
                continue
            date = (
                datetime.fromisoformat(o["completed"])
                .astimezone(ZoneInfo("Africa/Lagos"))
                .date()
                .isoformat()
            )
            if (not start or date >= start) and (not end or date <= end):
                paid.append(o)
        best = {}
        for o in paid:
            for i in o["items"]:
                entry = best.setdefault(
                    i["product_id"], {"name": i["name"], "units": 0}
                )
                entry["units"] += i["qty"]
        return jsonify(
            paid_orders=len(paid),
            product_sales=sum(o["total"] for o in paid),
            items_sold=sum(i["qty"] for o in paid for i in o["items"]),
            bestseller=max(best.values(), key=lambda x: x["units"]) if best else None,
            published=db()
            .execute(
                "SELECT COUNT(*) FROM products WHERE published=1"
                + ("" if app.config["PREVIEW"] else " AND sample=0")
            )
            .fetchone()[0],
            open_payments=sum(
                o["paid_products"]
                for o in orders
                if o["status"] not in ["Paid", "Dismissed"]
            ),
            closed_receipts=sum(
                o["paid_products"] + o["paid_delivery"]
                for o in orders
                if o["status"] == "Dismissed"
            ),
            open_delivery=sum(
                o["paid_delivery"] for o in orders if o["status"] != "Paid"
            ),
        )

    @app.get("/")
    @app.get("/<path:path>")
    def index(path=""):
        return render_template("index.html")

    return app


app = create_app()
if __name__ == "__main__":
    import argparse, getpass

    parser = argparse.ArgumentParser()
    parser.add_argument("command", nargs="?", default="run")
    parser.add_argument("--username", default="oluwadamilola")
    args = parser.parse_args()
    if args.command == "owner":
        password = getpass.getpass("New owner password (at least 12 characters): ")
        if len(password) < 12:
            raise SystemExit("Use at least 12 characters.")
        with app.app_context():
            app.db().execute(
                "INSERT OR REPLACE INTO owner VALUES(1,?,?)",
                (args.username, generate_password_hash(password)),
            )
            app.db().commit()
    elif args.command == "seed":
        if not app.config["PREVIEW"]:
            raise SystemExit("Preview seeding is disabled in production.")
        specs = [
            (
                "sample-bag",
                "The Everyday Mini Bag",
                "Bags",
                12000,
                "bag",
                "One size",
                "Cocoa",
            ),
            (
                "sample-corset",
                "Zikora Silk Corset",
                "Clothes",
                36000,
                "corset",
                "M",
                "Rose",
            ),
            (
                "sample-trousers",
                "Lekki Pleated Trousers",
                "Trousers",
                31500,
                "trousers",
                "UK 8",
                "Emerald",
            ),
            (
                "sample-shoes",
                "Amina Strappy Mules",
                "Shoes",
                42000,
                "shoes",
                "38",
                "Gold",
            ),
            (
                "sample-blazer",
                "Tiwa Linen Blazer",
                "Clothes",
                48000,
                "blazer",
                "M",
                "Ivory",
            ),
            (
                "sample-dress",
                "Eniola Satin Slip",
                "Clothes",
                38500,
                "dress",
                "UK 10",
                "Copper",
            ),
            (
                "sample-denim",
                "Eko Flared Denims",
                "Trousers",
                29000,
                "denim",
                "28",
                "Indigo",
            ),
        ]
        with app.app_context():
            for pid, name, cat, price, img, size, col in specs:
                variants = [{"id": pid + "-1", "size": size, "colour": col, "stock": 8}]
                if cat == "Shoes":
                    variants += [
                        {"id": pid + "-2", "size": "38", "colour": "Black", "stock": 0},
                        {"id": pid + "-3", "size": "38", "colour": "Brown", "stock": 5},
                    ]
                app.db().execute(
                    "INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,?,?,?,1)",
                    (
                        pid,
                        name,
                        cat,
                        price * 100,
                        "A thoughtfully chosen piece for your everyday, and every special moment. Ask Oluwadamilola about fit, fabric and care on WhatsApp.",
                        json.dumps(["/static/images/" + img + ".webp"]),
                        json.dumps(variants),
                        1,
                    ),
                )
            app.db().commit()
    else:
        app.run(host="0.0.0.0", port=int(os.getenv("PORT", "3000")), debug=False)

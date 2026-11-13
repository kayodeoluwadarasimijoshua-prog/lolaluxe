import io, json, uuid
import pytest
from PIL import Image
from werkzeug.security import generate_password_hash
from app import create_app


@pytest.fixture(params=["sqlite", "postgres"])
def store(tmp_path, request):
    url = request.getfixturevalue("postgres_url") if request.param == "postgres" else ""
    app = create_app(
        {
            "TESTING": True,
            "DATA_DIR": str(tmp_path),
            "PREVIEW": True,
            "DATABASE_URL": url,
        }
    )
    with app.app_context():
        app.db().execute(
            "INSERT INTO owner VALUES(1,?,?)",
            ("owner", generate_password_hash("test-only-password")),
        )
        app.db().commit()
    client = app.test_client()
    csrf = client.get("/api/session").json["csrf"]

    def post(url, body):
        return client.post(
            "/api/" + url,
            json=body,
            headers={"X-CSRF-Token": client.get("/api/session").json["csrf"]},
        )

    assert (
        post(
            "login", {"username": "owner", "password": "test-only-password"}
        ).status_code
        == 200
    )
    product = {
        "name": "Verification Bag",
        "category": "Bags",
        "price": 1200000,
        "description": "Test sample",
        "images": ["/static/images/bag.webp"],
        "variants": [
            {"id": "brown38", "size": "38", "colour": "Brown", "stock": 50},
            {"id": "black38", "size": "38", "colour": "Black", "stock": 0},
        ],
        "published": True,
    }
    product["id"] = post("products", product).json["id"]

    def checkout(key=None, variant="brown38", price=1200000):
        return post(
            "checkout",
            {
                "key": key or str(uuid.uuid4()),
                "items": [
                    {
                        "product_id": product["id"],
                        "variant_id": variant,
                        "qty": 1,
                        "price": price,
                    }
                ],
                "fulfilment": "Pickup",
            },
        )

    def payment(ref, amount=400000, delivery=0, **kw):
        return post(
            "orders/" + ref + "/payments",
            {
                "key": str(uuid.uuid4()),
                "products": amount,
                "delivery": delivery,
                "received": "2026-11-13",
                "note": "Verified transfer; exception if needed",
                **kw,
            },
        )

    return app, client, post, product, checkout, payment


def test_three_instalments_and_dashboard(store):
    app, c, post, p, checkout, payment = store
    handoff = checkout().json
    ref = handoff["reference"]
    assert "https://wa.me/2347071181050?text=" in handoff["url"]
    assert ref in handoff["message"]
    assert "12,000" in handoff["message"]
    assert "Pickup" in handoff["message"]
    for expected in [800000, 400000, 0]:
        assert payment(ref).json["balance"] == expected
    o = c.get("/api/orders").json[0]
    assert o["status"] == "Paid"
    assert len(o["payments"]) == 3
    d = c.get("/api/dashboard").json
    assert (
        d["paid_orders"],
        d["product_sales"],
        d["items_sold"],
        d["bestseller"]["units"],
    ) == (1, 1200000, 1, 1)
    assert d["open_payments"] == 0


def test_full_payment_and_reopening_correction(store):
    app, c, post, p, checkout, payment = store
    ref = checkout().json["reference"]
    o = payment(ref, 1200000).json
    completed = o["completed"]
    pid = o["payments"][0]["id"]
    assert o["status"] == "Paid"
    o = payment(
        ref, 800000, corrects=pid, reason="Original amount transcribed incorrectly"
    ).json
    assert (
        o["status"] == "Part-paid" and o["balance"] == 400000 and o["completed"] is None
    )
    assert len(o["payments"]) == 2 and o["payments"][0]["products"] == 1200000
    assert c.get("/api/dashboard").json["product_sales"] == 0
    assert c.get("/api/products").json[0]["variants"][0]["stock"] == 50
    assert payment(ref).json["status"] == "Paid"


def test_underpaid_third_equal_intentional_and_duplicate_payment(store):
    app, c, post, p, checkout, payment = store
    ref = checkout().json["reference"]
    key = str(uuid.uuid4())
    first = payment(ref, 300000, key=key).json
    duplicate = payment(ref, 300000, key=key).json
    assert len(duplicate["payments"]) == 1 and duplicate["paid_products"] == 300000
    payment(ref, 300000)
    o = payment(ref, 300000).json
    assert (
        len(o["payments"]) == 3
        and o["balance"] == 300000
        and o["follow_up"]
        and o["status"] == "Part-paid"
    )
    assert payment(ref, 300000, note="").status_code == 400
    assert (
        payment(ref, 300000, note="Fourth verified transfer, outside agreement").json[
            "status"
        ]
        == "Paid"
    )


def test_checkout_double_tap_and_changed_key_payload(store):
    app, c, post, p, checkout, payment = store
    key = str(uuid.uuid4())
    a = checkout(key).json
    b = checkout(key).json
    assert a["reference"] == b["reference"]
    assert len(c.get("/api/orders").json) == 1
    assert checkout(key, price=100).status_code == 409


def test_delivery_rider_and_combined_transfer(store):
    app, c, post, p, checkout, payment = store
    ref = checkout().json["reference"]
    assert (
        post(
            f"orders/{ref}/agreement", {"delivery_fee": 250000, "rider_direct": True}
        ).status_code
        == 200
    )
    o = payment(ref, 1200000).json
    assert o["paid_delivery"] == 0 and o["delivery_balance"] == 0
    ref2 = checkout().json["reference"]
    post(f"orders/{ref2}/agreement", {"delivery_fee": 250000, "rider_direct": False})
    o = payment(ref2, 1200000, 250000).json
    assert (
        o["paid_delivery"] == 250000
        and o["paid_products"] == 1200000
        and o["delivery_balance"] == 0
    )
    assert c.get("/api/dashboard").json["product_sales"] == 2400000


def test_abandoned_and_paid_history_closing_review(store):
    app, c, post, p, checkout, payment = store
    ref = checkout().json["reference"]
    assert post(f"orders/{ref}/dismiss", {}).status_code == 200
    ref = checkout().json["reference"]
    payment(ref)
    assert post(f"orders/{ref}/dismiss", {}).status_code == 409
    assert (
        post(
            f"orders/{ref}/dismiss",
            {
                "review": ref,
                "reason": "Customer cancelled; transfer remains recorded for refund follow-up",
            },
        ).status_code
        == 200
    )
    o = c.get("/api/orders").json[0]
    assert o["status"] == "Dismissed" and len(o["payments"]) == 1
    assert payment(ref).status_code == 400


def test_sold_out_reserved_and_release_exact_combination(store):
    app, c, post, p, checkout, payment = store
    assert checkout(variant="black38").status_code == 409
    ref = checkout().json["reference"]
    assert (
        post(
            f"orders/{ref}/reserve",
            {"product_id": p["id"], "variant_id": "brown38", "qty": 1},
        ).status_code
        == 200
    )
    assert c.get("/api/products").json[0]["variants"][0]["available"] == 49
    assert c.get("/api/products").json[0]["variants"][1]["available"] == 0
    assert (
        post(
            f"orders/{ref}/reserve",
            {"product_id": p["id"], "variant_id": "brown38", "qty": 0},
        ).status_code
        == 200
    )
    assert c.get("/api/products").json[0]["variants"][0]["available"] == 50
    with app.app_context():
        variants = [
            {"id": "brown38", "size": "38", "colour": "Brown", "stock": 1},
            {"id": "black38", "size": "38", "colour": "Black", "stock": 0},
        ]
        app.db().execute("UPDATE products SET variants=?", (json.dumps(variants),))
        app.db().commit()
    post(
        f"orders/{ref}/reserve",
        {"product_id": p["id"], "variant_id": "brown38", "qty": 1},
    )
    assert checkout().status_code == 409
    post(
        f"orders/{ref}/reserve",
        {"product_id": p["id"], "variant_id": "brown38", "qty": 0},
    )
    assert checkout().status_code == 200


def test_prices_publishing_and_validation(store):
    app, c, post, p, checkout, payment = store
    assert checkout(price=1).status_code == 409
    p["published"] = False
    assert post("products", p).status_code == 200
    assert c.get("/api/products").json == []
    assert checkout().status_code == 409
    p["price"] = 1.5
    assert post("products", p).status_code == 400
    assert post("orders/not-real/payments", {}).status_code == 400


def test_signed_out_authorization_and_csrf(store):
    app, c, post, p, checkout, payment = store
    post("logout", {})
    for url in ["orders", "dashboard"]:
        assert c.get("/api/" + url).status_code == 401
    for url, body in [
        ("products", p),
        ("categories", {"name": "Test"}),
        ("orders/guess/payments", {}),
        ("orders/guess/reserve", {}),
        ("orders/guess/agreement", {}),
        ("orders/guess/dismiss", {}),
    ]:
        assert post(url, body).status_code == 401
    assert c.post("/api/products", json=p).status_code == 403
    assert c.get("/api/products?admin=1").status_code == 200
    assert (
        c.post(
            "/api/upload", headers={"X-CSRF-Token": c.get("/api/session").json["csrf"]}
        ).status_code
        == 401
    )


def test_image_upload_persistence_and_production_samples(store):
    app, c, post, p, checkout, payment = store
    im = Image.new("RGB", (2000, 1000), "pink")
    buff = io.BytesIO()
    im.save(buff, "JPEG")
    buff.seek(0)
    response = c.post(
        "/api/upload",
        data={"photo": (buff, "phone.jpg")},
        headers={"X-CSRF-Token": c.get("/api/session").json["csrf"]},
    )
    assert response.status_code == 200
    image = c.get(response.json["url"])
    assert image.status_code == 200
    assert Image.open(io.BytesIO(image.data)).width == 1600
    other = create_app(
        {
            "TESTING": True,
            "DATA_DIR": app.config["DATA_DIR"],
            "PREVIEW": False,
            "DATABASE_URL": app.config["DATABASE_URL"],
        }
    )
    assert other.test_client().get("/api/products").json[0]["price"] == 1200000
    with app.app_context():
        app.db().execute("UPDATE products SET sample=1")
        app.db().commit()
    assert other.test_client().get("/api/products").json == []


def test_overdue_excess_and_date_filters(store):
    app, c, post, p, checkout, payment = store
    ref = checkout().json["reference"]
    post(
        f"orders/{ref}/agreement",
        {"due": "2026-01-01", "note": "Agreed timeline", "delivery_fee": 0},
    )
    o = payment(ref, 100000).json
    assert o["overdue"]
    assert payment(ref, 1300000, note="").status_code == 400
    o = payment(ref, 1300000).json
    assert o["excess"] == 200000 and o["status"] == "Paid"
    assert c.get("/api/dashboard?start=2099-01-01").json["paid_orders"] == 0
    assert c.get("/api/dashboard?end=2000-01-01").json["paid_orders"] == 0


def test_simultaneous_checkout_and_payment_retries(store):
    from concurrent.futures import ThreadPoolExecutor

    app, c, post, p, checkout, payment = store
    checkout_key = str(uuid.uuid4())
    payload = {
        "key": checkout_key,
        "items": [
            {"product_id": p["id"], "variant_id": "brown38", "qty": 1, "price": 1200000}
        ],
        "fulfilment": "Pickup",
    }

    def submit(url, body):
        client = app.test_client()
        csrf = client.get("/api/session").json["csrf"]
        assert (
            client.post(
                "/api/login",
                json={"username": "owner", "password": "test-only-password"},
                headers={"X-CSRF-Token": csrf},
            ).status_code
            == 200
        )
        csrf = client.get("/api/session").json["csrf"]
        response = client.post("/api/" + url, json=body, headers={"X-CSRF-Token": csrf})
        assert response.status_code == 200, response.get_data(as_text=True)
        return response.json

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(lambda _: submit("checkout", payload), range(2)))
    assert results[0]["reference"] == results[1]["reference"]
    ref = results[0]["reference"]
    key = str(uuid.uuid4())
    transfer = {
        "key": key,
        "products": 1200000,
        "delivery": 0,
        "received": "2026-11-13",
        "note": "Verified full transfer",
    }
    with ThreadPoolExecutor(2) as pool:
        results = list(
            pool.map(lambda _: submit(f"orders/{ref}/payments", transfer), range(2))
        )
    assert len(results[0]["payments"]) == len(results[1]["payments"]) == 1
    assert c.get("/api/dashboard").json["product_sales"] == 1200000

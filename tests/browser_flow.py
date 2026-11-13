"""Phone acceptance test. Isolated database and generated test-only credentials."""

import sys, tempfile, threading, secrets, re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app
from werkzeug.security import generate_password_hash
from werkzeug.serving import make_server
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
artifacts = root / "artifacts"
artifacts.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as data:
    app = create_app({"DATA_DIR": data, "TESTING": True, "PREVIEW": True})
    password = secrets.token_urlsafe(20)
    with app.app_context():
        app.db().execute(
            "INSERT INTO owner VALUES(1,?,?)",
            ("owner-test", generate_password_hash(password)),
        )
        app.db().commit()
    server = make_server("127.0.0.1", 3001, app, threaded=True)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/chromium", args=["--no-sandbox"], headless=True
        )
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=1,
            is_mobile=True,
            has_touch=True,
        )
        context.grant_permissions(["clipboard-read", "clipboard-write"])
        page = context.new_page()
        page.clock.install()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto("http://127.0.0.1:3001/admin")
        page.get_by_label("Username", exact=True).fill("owner-test")
        page.get_by_label("Password", exact=True).fill(password)
        page.get_by_role("button", name="Sign in securely").click()
        expect(page.get_by_text("Sales overview", exact=True)).to_be_visible()
        page.get_by_role("link", name="Publish something lovely").click()
        page.get_by_label("Product name").fill("Verification sample bag")
        page.get_by_label("Category", exact=True).select_option("Bags")
        page.get_by_label("Price (₦)", exact=True).fill("12000")
        page.get_by_label("Description").fill(
            "A labelled sample bag for checkout verification."
        )
        page.locator("#upload").set_input_files(root / "static/images/bag.webp")
        expect(page.locator("#photos img")).to_have_count(1)
        page.get_by_label("Colour", exact=True).fill("Cocoa")
        page.get_by_label("Publish in the boutique").check()
        page.get_by_role("button", name="Save product", exact=True).click()
        expect(page.get_by_role("heading", name="Your collection")).to_be_visible()
        page.locator(".wordmark").first.click()
        expect(page.locator('a[href^="/admin"]')).to_have_count(0)
        expect(page.locator(".hero-photo")).to_have_attribute(
            "src", "/static/images/hero-editorial.webp?v=2"
        )
        page.clock.fast_forward(5100)
        expect(page.locator(".hero-photo")).to_have_attribute(
            "src", "/static/images/shoes.webp?v=2"
        )
        page.get_by_role("button", name="Pause automatic slideshow").click()
        page.clock.fast_forward(11000)
        expect(page.locator(".hero-photo")).to_have_attribute(
            "src", "/static/images/shoes.webp?v=2"
        )
        page.get_by_role("button", name="Next collection").click()
        expect(page.locator(".hero-photo")).to_have_attribute(
            "src", "/static/images/bag.webp?v=2"
        )
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        for category in [
            "Basic Tops",
            "Two-Piece Sets",
            "Gowns",
            "Skirts",
            "Bottoms",
            "Slippers",
            "Shoes",
            "Bags",
            "Adire",
            "Jerseys",
            "Scarves",
            "Jeans",
        ]:
            expect(page.locator(f'[data-category="{category}"]')).to_have_count(1)
        page.screenshot(
            path=str(artifacts / "refreshed-home-mobile.png"), full_page=True
        )
        page.get_by_role("button", name="Bags", exact=True).click()
        expect(page.locator(".product")).to_have_count(1)
        page.get_by_role("link", name="Verification sample bag", exact=True).click()
        page.get_by_role("button", name="Add to bag").click()
        page.get_by_role("link", name="Your bag, 1 items").click()
        page.reload()
        expect(
            page.get_by_role("heading", name="Verification sample bag")
        ).to_be_visible()
        page.screenshot(path=str(artifacts / "phone-cart.png"), full_page=True)
        # Capture popup locally: check generated URL without sending a real WhatsApp message.
        page.evaluate("window.open=(url)=>{window.openedWhatsApp=url; return null}")
        page.get_by_role("button", name="Checkout on WhatsApp").click()
        expect(
            page.get_by_role("heading", name="A little closer to lovely.")
        ).to_be_visible()
        h = page.evaluate("JSON.parse(sessionStorage.getItem('lola-handoff'))")
        assert (
            h["reference"] in h["message"]
            and "12,000" in h["message"]
            and "Pickup" in h["message"]
        )
        assert h["url"].startswith("https://wa.me/2347071181050?text=")
        assert "Verification sample bag" in h["message"]
        assert (
            page.get_by_role("link", name="Open WhatsApp again").get_attribute("href")
            == h["url"]
        )
        page.get_by_role("button", name="Copy order message").click()
        assert page.evaluate("navigator.clipboard.readText()") == h["message"]
        page.screenshot(path=str(artifacts / "phone-handoff.png"), full_page=True)
        page.goto("http://127.0.0.1:3001/admin/orders")
        page.get_by_label("Find order by reference").fill(h["reference"])
        page.locator("#order-list a").click()

        # A committed payment with a lost HTTP response must not become a second receipt on refresh.
        def lose_payment_response(route):
            response = route.fetch()
            assert response.status == 200
            route.abort("failed")

        page.route("**/api/orders/*/payments", lose_payment_response, times=1)
        page.locator("#payment-form [name=products]").fill("4000")
        page.get_by_role("button", name="Record payment", exact=True).click()
        expect(page.locator("#order-error")).to_contain_text("Failed to fetch")
        page.reload()
        expect(page.locator(".row.total strong")).to_have_text("₦8,000")
        expect(page.locator(".payment-entry")).to_have_count(1)
        for expected in ["₦4,000", "₦0"]:
            page.locator("#payment-form [name=products]").fill("4000")
            page.get_by_role("button", name="Record payment", exact=True).click()
            expect(page.locator(".row.total strong")).to_have_text(expected)
        expect(page.locator(".payment-entry")).to_have_count(3)
        expect(page.locator(".section-heading .pill")).to_have_text("Paid")
        page.screenshot(path=str(artifacts / "phone-paid-order.png"), full_page=True)
        page.get_by_role("link", name="Overview", exact=True).click()
        expect(page.locator(".metric").nth(0).locator("strong")).to_have_text("1")
        expect(page.locator(".metric").nth(1).locator("strong")).to_have_text("₦12,000")
        expect(page.locator(".metric").nth(2).locator("strong")).to_have_text("1")
        expect(page.locator(".metric").nth(3).locator("strong")).to_have_text(
            "Verification sample bag"
        )
        page.screenshot(path=str(artifacts / "phone-dashboard.png"), full_page=True)
        assert not page.evaluate("document.documentElement.scrollWidth>innerWidth")
        anonymous = browser.new_context()
        assert anonymous.request.get("http://127.0.0.1:3001/api/orders").status == 401
        anonymous.close()
        assert not errors, errors
        print(
            "PASS: phone publish → filter → product → cart refresh → WhatsApp handoff → 3 × ₦4,000 → paid dashboard; signed-out orders denied; no browser errors / overflow"
        )
        browser.close()
    server.shutdown()

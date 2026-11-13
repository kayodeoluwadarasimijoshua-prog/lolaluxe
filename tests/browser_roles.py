"""Invitation, draft review and revocation through the actual mobile UI."""

import sys, tempfile, threading, secrets
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app
from werkzeug.security import generate_password_hash
from werkzeug.serving import make_server
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as data:
    app = create_app({"DATA_DIR": data, "TESTING": True})
    password = secrets.token_urlsafe(20)
    with app.app_context():
        app.db().execute(
            "INSERT INTO owner VALUES(1,?,?)",
            ("owner", generate_password_hash(password)),
        )
        app.db().commit()
    server = make_server("127.0.0.1", 3002, app, threaded=True)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/chromium", args=["--no-sandbox"]
        )
        owner = browser.new_page(viewport={"width": 390, "height": 844})
        errors = []
        owner.on("pageerror", lambda e: errors.append(str(e)))
        owner.goto("http://127.0.0.1:3002/admin")
        owner.get_by_label("Username", exact=True).fill("owner")
        owner.get_by_label("Password", exact=True).fill(password)
        owner.get_by_role("button", name="Sign in securely").click()
        owner.get_by_role("link", name="Team", exact=True).click()
        owner.get_by_label("Product Admin username").fill("helper")
        owner.get_by_role("button", name="Create invitation").click()
        expect(owner.get_by_label("Invitation link")).to_be_visible()
        url = owner.get_by_label("Invitation link").input_value()
        helper = browser.new_page(viewport={"width": 390, "height": 844})
        helper.on("pageerror", lambda e: errors.append(str(e)))
        helper.goto(url)
        helper.get_by_label("New password", exact=True).fill(password)
        helper.get_by_label("Confirm password").fill(password)
        helper.get_by_role("button", name="Activate account").click()
        helper.get_by_label("Username", exact=True).fill("helper")
        helper.get_by_label("Password", exact=True).fill(password)
        helper.get_by_role("button", name="Sign in securely").click()
        expect(helper.get_by_role("heading", name="Your collection")).to_be_visible()
        expect(
            helper.locator(".admin-tabs").get_by_role("link", name="Team", exact=True)
        ).to_have_count(0)
        expect(
            helper.locator(".admin-tabs").get_by_role("link", name="Orders", exact=True)
        ).to_have_count(0)
        helper.get_by_role("link", name="Add product", exact=True).click()
        helper.get_by_label("Product name").fill("Helper draft bag")
        helper.get_by_label("Category", exact=True).select_option("Bags")
        helper.get_by_label("Price (₦)", exact=True).fill("12000")
        helper.locator("#upload").set_input_files(root / "static/images/bag.webp")
        expect(helper.locator("#photos img")).to_have_count(1)
        expect(helper.get_by_label("Publish in the boutique")).to_have_count(0)
        helper.get_by_role("button", name="Save product", exact=True).click()
        expect(helper.get_by_role("heading", name="Your collection")).to_be_visible()
        owner.get_by_role("link", name="Products", exact=True).click()
        owner.get_by_role("link", name="Helper draft bag").click()
        owner.get_by_label("Publish in the boutique").check()
        owner.get_by_role("button", name="Save product", exact=True).click()
        expect(owner.get_by_role("heading", name="Your collection")).to_be_visible()
        owner.get_by_role("link", name="Team", exact=True).click()
        expect(
            owner.get_by_role("heading", name="Recent product activity")
        ).to_be_visible()
        owner.screenshot(path=str(root / "artifacts/team-mobile.png"), full_page=True)
        assert owner.evaluate("document.documentElement.scrollWidth <= innerWidth")
        owner.get_by_role("button", name="Revoke access", exact=True).click()
        expect(owner.get_by_text("Access revoked", exact=True)).to_be_visible()
        helper.reload()
        expect(helper.get_by_role("button", name="Sign in securely")).to_be_visible()
        assert not errors, errors
        browser.close()
    server.shutdown()
print(
    "PASS: invite → activate → restricted staff dashboard → draft → Super Admin publication → immediate revocation; no browser errors or mobile overflow"
)

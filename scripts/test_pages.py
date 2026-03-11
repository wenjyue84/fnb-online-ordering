"""
Browser test for Makan Moments Cafe - US-145
Tests all key pages for JS errors, 404s, and basic functionality.
"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3031"
SCREENSHOTS_DIR = "scripts/screenshots"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

PAGES_TO_TEST = [
    ("home", "/en"),
    ("menu", "/en/menu"),
    ("about", "/en/about"),
    ("contact", "/en/contact"),
    ("admin_login", "/admin/login"),
]

ADMIN_PAGES = [
    ("admin_dashboard", "/admin"),
    ("admin_ai_waiter", "/admin/ai-waiter"),
]

def check_page(page, name, url):
    errors = []
    warnings = []
    not_found = []

    # Collect console messages
    page.on("console", lambda msg: (
        errors.append(f"[{msg.type.upper()}] {msg.text}") if msg.type == "error"
        else warnings.append(f"[{msg.type.upper()}] {msg.text}") if msg.type == "warning"
        else None
    ))

    # Collect network failures / 404s
    def on_response(response):
        if response.status == 404:
            not_found.append(f"404: {response.url}")

    page.on("response", on_response)

    print(f"\n{'='*60}")
    print(f"Testing: {name} -> {BASE_URL}{url}")
    print('='*60)

    try:
        page.goto(BASE_URL + url, wait_until="networkidle", timeout=20000)
    except Exception as e:
        print(f"  ⚠ Navigation timeout/error: {e}")

    # Screenshot
    screenshot_path = f"{SCREENSHOTS_DIR}/{name}.png"
    page.screenshot(path=screenshot_path, full_page=True)
    print(f"  📸 Screenshot saved: {screenshot_path}")

    # Report
    if errors:
        print(f"  ❌ JS ERRORS ({len(errors)}):")
        for e in errors:
            print(f"     {e}")
    else:
        print("  ✅ No JS errors")

    if not_found:
        print(f"  ❌ 404s ({len(not_found)}):")
        for nf in not_found:
            print(f"     {nf}")
    else:
        print("  ✅ No 404s")

    if warnings:
        print(f"  ⚠ Warnings ({len(warnings)}):")
        for w in warnings[:5]:  # limit to 5
            print(f"     {w}")

    return {"name": name, "url": url, "errors": errors, "warnings": warnings, "not_found": not_found}


def test_chat_widget(page):
    print(f"\n{'='*60}")
    print("Testing: Chat widget on /en/menu")
    print('='*60)
    page.goto(BASE_URL + "/en/menu", wait_until="networkidle", timeout=20000)

    # Look for chat button
    chat_button = page.locator('[aria-label*="chat" i], button:has-text("Chat"), [data-testid*="chat"], .chat-button, button[class*="chat"]').first

    # Try by role or text
    opened = False
    try:
        # Try finding the chat widget button (floating button)
        btn = page.locator('button').filter(has_text="").all()
        # Look for the floating chat bubble button specifically
        chat_btn = page.locator('button[aria-label*="chat" i], button[class*="chat"], [class*="chat-widget"] button, [class*="ChatWidget"] button').first
        if chat_btn.is_visible(timeout=3000):
            chat_btn.click()
            page.wait_for_timeout(1000)
            opened = True
            print("  ✅ Chat widget opened via aria/class selector")
        else:
            # Try clicking the fixed-position chat button at bottom right
            result = page.evaluate("""
                () => {
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        const style = window.getComputedStyle(btn);
                        const rect = btn.getBoundingClientRect();
                        if (rect.bottom > window.innerHeight - 100 && rect.right > window.innerWidth - 100) {
                            btn.click();
                            return { found: true, text: btn.textContent, className: btn.className };
                        }
                    }
                    return { found: false };
                }
            """)
            if result.get("found"):
                page.wait_for_timeout(1000)
                opened = True
                print(f"  ✅ Chat widget opened via bottom-right button: {result}")
            else:
                print("  ⚠ Could not find chat widget button")
    except Exception as e:
        print(f"  ⚠ Chat widget test error: {e}")

    page.screenshot(path=f"{SCREENSHOTS_DIR}/menu_chat_open.png", full_page=False)
    print(f"  📸 Screenshot: {SCREENSHOTS_DIR}/menu_chat_open.png")
    return opened


def test_ai_waiter_page(page):
    print(f"\n{'='*60}")
    print("Testing: /admin/ai-waiter - checking for iframe or offline card")
    print('='*60)

    iframe = page.locator('iframe').count()
    offline_card = page.locator('text=offline, text=unavailable, text=Rainbow AI, [data-testid*="offline"]').count()

    if iframe > 0:
        print(f"  ✅ iframe found ({iframe} iframes on page)")
    elif offline_card > 0:
        print(f"  ✅ Offline/status card found")
    else:
        # Print page text for diagnosis
        text = page.inner_text('body')[:500]
        print(f"  ⚠ No iframe or offline card found. Page text snippet:\n{text}")

    return iframe > 0 or offline_card > 0


def main():
    all_results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # Test public pages
        for name, url in PAGES_TO_TEST:
            result = check_page(page, name, url)
            all_results.append(result)

        # Test chat widget on menu
        test_chat_widget(page)

        # Log in as admin
        print(f"\n{'='*60}")
        print("Logging in as admin...")
        print('='*60)
        page.goto(BASE_URL + "/admin/login", wait_until="networkidle", timeout=15000)

        # Fill login form
        try:
            username_field = page.locator('input[name="username"], input[type="text"], input[placeholder*="username" i]').first
            password_field = page.locator('input[name="password"], input[type="password"]').first
            username_field.fill("admin")
            password_field.fill("admin123")

            submit_btn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first
            submit_btn.click()
            page.wait_for_url(f"{BASE_URL}/admin", timeout=10000)
            print("  ✅ Logged in successfully")
        except Exception as e:
            print(f"  ❌ Login failed: {e}")
            page.screenshot(path=f"{SCREENSHOTS_DIR}/login_failed.png")

        # Test admin pages (after login)
        for name, url in ADMIN_PAGES:
            result = check_page(page, name, url)
            all_results.append(result)

        # Check AI waiter specifically
        test_ai_waiter_page(page)

        browser.close()

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print('='*60)
    total_errors = sum(len(r["errors"]) for r in all_results)
    total_404s = sum(len(r["not_found"]) for r in all_results)
    print(f"Total JS errors: {total_errors}")
    print(f"Total 404s: {total_404s}")

    if total_errors == 0 and total_404s == 0:
        print("\n✅ ALL PAGES CLEAN - No errors or 404s found!")
    else:
        print("\n❌ Issues found — see details above")

    # Save results as JSON
    with open("scripts/test_results.json", "w") as f:
        json.dump(all_results, f, indent=2)
    print("\nResults saved to scripts/test_results.json")

    return 0 if (total_errors == 0 and total_404s == 0) else 1


if __name__ == "__main__":
    sys.exit(main())

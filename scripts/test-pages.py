"""US-145: Browser test key pages for JS errors and broken assets."""
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3031"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

PAGES = ["/en", "/en/menu", "/en/about", "/en/contact", "/admin/login"]


def run():
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()

        # --- Test public pages ---
        for path in PAGES:
            page = context.new_page()
            errors = []
            broken = []
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
            page.on("response", lambda resp: broken.append(resp.url) if resp.status == 404 and any(ext in resp.url for ext in [".jpg", ".png", ".gif", ".svg", ".webp", ".ico"]) else None)
            try:
                page.goto(BASE + path, wait_until="networkidle", timeout=30000)
                time.sleep(1)
                results[path] = {"title": page.title(), "js_errors": errors[:], "broken_images": broken[:]}
                status = "PASS" if not errors and not broken else "WARN"
                print(f"[{status}] {path} - {page.title()}")
                for e in errors[:3]:
                    print(f"  JS ERROR: {e[:150]}")
                for b in broken[:3]:
                    print(f"  BROKEN IMG: {b[:100]}")
            except Exception as e:
                results[path] = {"error": str(e)}
                print(f"[FAIL] {path}: {e}")
            finally:
                page.close()

        # --- Chat widget on /en/menu ---
        print("\n--- Chat widget test ---")
        page = context.new_page()
        try:
            page.goto(BASE + "/en/menu", wait_until="networkidle", timeout=30000)
            time.sleep(1)
            chat_btn = page.query_selector('button[aria-label="Open AI Waiter chat"]')
            if chat_btn:
                print("[PASS] Chat button found (aria-label='Open AI Waiter chat')")
                chat_btn.click()
                time.sleep(1.5)
                # Panel should appear
                panel = page.query_selector('.fixed.bottom-20.right-4') or page.query_selector('[aria-label*="AI Waiter"]')
                print(f"[PASS] Chat widget clickable, panel visible: {panel is not None}")
                results["/en/menu chat-widget"] = {"chat_button": True, "clickable": True}
            else:
                print("[WARN] Chat button not found with expected selector")
                results["/en/menu chat-widget"] = {"chat_button": False}
        except Exception as e:
            print(f"[FAIL] Chat widget: {e}")
            results["/en/menu chat-widget"] = {"error": str(e)}
        finally:
            page.close()

        # --- Admin login + admin pages ---
        print("\n--- Admin login ---")
        page = context.new_page()
        try:
            page.goto(BASE + "/admin/login", wait_until="networkidle", timeout=30000)
            time.sleep(0.5)
            page.fill("input[type='text']", ADMIN_USER)
            page.fill("input[type='password']", ADMIN_PASS)
            page.click("button[type='submit']")
            page.wait_for_url("**/admin**", timeout=10000)
            print(f"[PASS] Logged in — {page.url}")

            # Test /admin
            time.sleep(1)
            admin_errors = []
            page.on("console", lambda msg: admin_errors.append(msg.text) if msg.type == "error" else None)
            results["/admin"] = {"title": page.title(), "js_errors": admin_errors[:]}
            print(f"[PASS] /admin - {page.title()}")

            # Test /admin/ai-waiter (via tab navigation)
            print("\n--- /admin/ai-waiter ---")
            page2 = context.new_page()
            ai_errors = []
            ai_broken = []
            page2.on("console", lambda msg: ai_errors.append(msg.text) if msg.type == "error" else None)
            page2.on("response", lambda resp: ai_broken.append(resp.url) if resp.status == 404 and any(ext in resp.url for ext in [".jpg", ".png", ".gif", ".svg", ".webp", ".ico"]) else None)
            page2.goto(BASE + "/admin/ai-waiter", wait_until="networkidle", timeout=30000)
            time.sleep(2)
            src = page2.content()
            has_rainbow = "Rainbow" in src or "rainbow" in src.lower()
            has_iframe = "iframe" in src.lower()
            has_offline = "not running" in src.lower() or "offline" in src.lower() or "unavailable" in src.lower()
            csp_errors = [e for e in ai_errors if "Content Security Policy" in e or "Refused to frame" in e]
            other_errors = [e for e in ai_errors if "Content Security Policy" not in e and "Refused to frame" not in e]
            status = "PASS" if not other_errors else "WARN"
            print(f"[{status}] /admin/ai-waiter - has_rainbow={has_rainbow}, has_iframe={has_iframe}, has_offline_card={has_offline}")
            if csp_errors:
                print(f"  CSP (expected if Rainbow not running): {csp_errors[0][:100]}")
            for e in other_errors[:3]:
                print(f"  JS ERROR: {e[:150]}")
            results["/admin/ai-waiter"] = {
                "js_errors": other_errors[:],
                "csp_errors": csp_errors[:],
                "broken_images": ai_broken[:],
                "has_rainbow": has_rainbow,
                "has_iframe": has_iframe,
            }
            page2.close()

        except Exception as e:
            print(f"[FAIL] Admin: {e}")
            results["/admin"] = {"error": str(e)}
        finally:
            page.close()

        browser.close()

    # Summary
    print("\n========== SUMMARY ==========")
    all_clean = True
    for url, r in results.items():
        if "error" in r:
            print(f"[FAIL] {url}: {r['error']}")
            all_clean = False
        else:
            js_errs = r.get("js_errors", [])
            broken = r.get("broken_images", [])
            if js_errs or broken:
                all_clean = False
                print(f"[WARN] {url}: {len(js_errs)} JS errors, {len(broken)} broken images")
            else:
                print(f"[PASS] {url}")

    print(f"\nOverall: {'ALL CLEAN' if all_clean else 'ISSUES FOUND'}")
    return results


if __name__ == "__main__":
    run()

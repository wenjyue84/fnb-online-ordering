"""Find the white rectangle - simulate user conditions (splash dismissed, chat open)."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    # Set localStorage to dismiss splash (user has seen it before)
    page.goto("http://localhost:3031/en")
    page.evaluate("localStorage.setItem('mm_splash_seen', '1')")
    page.reload()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    # Take screenshot BEFORE opening chat
    page.screenshot(path="/tmp/makan-before-chat.png", full_page=False)

    # Scroll to trigger chat widget loading
    page.mouse.wheel(0, 100)
    page.wait_for_timeout(1000)

    # Click the chat button to open AI Waiter
    chat_btn = page.locator('button[aria-label="Open AI Waiter chat"]')
    if chat_btn.count() > 0:
        chat_btn.click()
        page.wait_for_timeout(2000)

    # Take screenshot WITH chat open
    page.screenshot(path="/tmp/makan-with-chat.png", full_page=False)

    # Now find ALL fixed/absolute elements
    suspects = page.evaluate("""() => {
        const suspects = [];
        document.querySelectorAll('*').forEach(el => {
            const style = window.getComputedStyle(el);
            const pos = style.position;
            if (pos === 'fixed') {
                const rect = el.getBoundingClientRect();
                if (rect.width > 50 && rect.height > 50) {
                    const display = style.display;
                    const visibility = style.visibility;
                    const opacity = parseFloat(style.opacity);
                    if (display !== 'none' && visibility !== 'hidden' && opacity > 0) {
                        suspects.push({
                            tag: el.tagName.toLowerCase(),
                            id: el.id,
                            className: (el.className?.toString?.() || '').slice(0, 200),
                            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                            bg: style.backgroundColor,
                            backdropFilter: style.backdropFilter || style.webkitBackdropFilter || 'none',
                            zIndex: style.zIndex,
                            childCount: el.children.length,
                            textLen: (el.textContent || '').trim().length,
                        });
                    }
                }
            }
        });

        // Also check shadow DOMs
        const shadowElements = [];
        document.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
                el.shadowRoot.querySelectorAll('*').forEach(shadowEl => {
                    const style = window.getComputedStyle(shadowEl);
                    if (style.position === 'fixed') {
                        const rect = shadowEl.getBoundingClientRect();
                        if (rect.width > 50 && rect.height > 50) {
                            shadowElements.push({
                                hostTag: el.tagName.toLowerCase(),
                                tag: shadowEl.tagName.toLowerCase(),
                                className: (shadowEl.className?.toString?.() || '').slice(0, 200),
                                rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                                bg: style.backgroundColor,
                                zIndex: style.zIndex,
                                display: style.display,
                            });
                        }
                    }
                });
            }
        });

        return { fixed: suspects, shadow: shadowElements };
    }""")

    print("=== FIXED position elements ===")
    for s in suspects['fixed']:
        print(f"  <{s['tag']}> z={s['zIndex']} rect=({s['rect']['x']},{s['rect']['y']},{s['rect']['w']}x{s['rect']['h']}) bg={s['bg']} backdrop={s['backdropFilter']} text={s['textLen']}chars")
        print(f"    class: {s['className']}")

    print(f"\n=== Shadow DOM fixed elements: {len(suspects['shadow'])} ===")
    for s in suspects['shadow']:
        print(f"  host=<{s['hostTag']}> <{s['tag']}> rect=({s['rect']['x']},{s['rect']['y']},{s['rect']['w']}x{s['rect']['h']}) bg={s['bg']} z={s['zIndex']} display={s['display']}")
        print(f"    class: {s['className']}")

    browser.close()

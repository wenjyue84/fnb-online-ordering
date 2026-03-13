"""Check if clicking the Next.js DevTools button creates the white rectangle."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    page.goto("http://localhost:3031/en")
    page.evaluate("localStorage.setItem('mm_splash_seen', '1')")
    page.reload()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    # Check the nextjs-portal shadow DOM contents
    devtools_detail = page.evaluate("""() => {
        const portal = document.querySelector('nextjs-portal');
        if (!portal || !portal.shadowRoot) return { found: false };

        const root = portal.shadowRoot;
        const allEls = root.querySelectorAll('*');
        const details = [];
        for (const el of allEls) {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 || rect.height > 0) {
                details.push({
                    tag: el.tagName.toLowerCase(),
                    id: el.id,
                    className: (el.className?.toString?.() || '').slice(0, 120),
                    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                    bg: style.backgroundColor,
                    position: style.position,
                    display: style.display,
                    visibility: style.visibility,
                    zIndex: style.zIndex,
                    textLen: (el.textContent || '').trim().length,
                    attrs: Array.from(el.attributes).map(a => a.name).join(','),
                });
            }
        }

        return {
            found: true,
            childCount: root.children.length,
            totalElements: allEls.length,
            visibleElements: details
        };
    }""")

    print(f"NextJS Portal found: {devtools_detail.get('found', False)}")
    if devtools_detail.get('found'):
        print(f"  Total shadow DOM elements: {devtools_detail['totalElements']}")
        print(f"  Visible elements ({len(devtools_detail['visibleElements'])}):")
        for el in devtools_detail['visibleElements']:
            print(f"    <{el['tag']}> pos={el['position']} display={el['display']} "
                  f"rect=({el['rect']['x']},{el['rect']['y']},{el['rect']['w']}x{el['rect']['h']}) "
                  f"bg={el['bg']} z={el['zIndex']} vis={el['visibility']}")
            if el['className']:
                print(f"      class: {el['className']}")

    # Try to find and click the Next.js devtools button
    nextjs_btn = page.evaluate("""() => {
        const portal = document.querySelector('nextjs-portal');
        if (!portal?.shadowRoot) return { found: false };
        // Look for buttons or clickable elements in shadow DOM
        const buttons = portal.shadowRoot.querySelectorAll('button, [role="button"], a');
        return {
            found: true,
            buttons: Array.from(buttons).map(b => ({
                tag: b.tagName.toLowerCase(),
                text: b.textContent?.trim()?.slice(0, 50),
                rect: (() => { const r = b.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
                ariaLabel: b.getAttribute('aria-label'),
                title: b.getAttribute('title'),
                className: (b.className?.toString?.() || '').slice(0, 100),
            }))
        };
    }""")

    if nextjs_btn.get('buttons'):
        print(f"\nNext.js DevTools buttons ({len(nextjs_btn['buttons'])}):")
        for btn in nextjs_btn['buttons']:
            print(f"  <{btn['tag']}> '{btn['text']}' rect=({btn['rect']['x']},{btn['rect']['y']},{btn['rect']['w']}x{btn['rect']['h']}) aria='{btn['ariaLabel']}' title='{btn['title']}'")

    # Click the N button if found
    clicked = page.evaluate("""() => {
        const portal = document.querySelector('nextjs-portal');
        if (!portal?.shadowRoot) return false;
        const buttons = portal.shadowRoot.querySelectorAll('button');
        for (const btn of buttons) {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                btn.click();
                return true;
            }
        }
        return false;
    }""")
    print(f"\nClicked devtools button: {clicked}")

    if clicked:
        page.wait_for_timeout(1000)
        page.screenshot(path="/tmp/makan-devtools-open.png", full_page=False)

        # Check for new fixed elements after clicking
        after_click = page.evaluate("""() => {
            const portal = document.querySelector('nextjs-portal');
            if (!portal?.shadowRoot) return [];
            const allEls = portal.shadowRoot.querySelectorAll('*');
            const details = [];
            for (const el of allEls) {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                if (rect.width > 200 && rect.height > 100) {
                    details.push({
                        tag: el.tagName.toLowerCase(),
                        className: (el.className?.toString?.() || '').slice(0, 120),
                        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                        bg: style.backgroundColor,
                        position: style.position,
                        zIndex: style.zIndex,
                    });
                }
            }
            return details;
        }""")

        if after_click:
            print(f"\nLarge elements after clicking devtools ({len(after_click)}):")
            for el in after_click:
                print(f"  <{el['tag']}> pos={el['position']} rect=({el['rect']['x']},{el['rect']['y']},{el['rect']['w']}x{el['rect']['h']}) bg={el['bg']} z={el['zIndex']}")
                print(f"    class: {el['className']}")

    browser.close()

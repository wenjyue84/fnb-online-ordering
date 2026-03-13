"""Find the white rectangle overlay on the Makan Moments homepage."""
from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto("http://localhost:3031/en")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)  # Wait for animations and lazy components

    # Take a screenshot first
    page.screenshot(path="/tmp/makan-homepage.png", full_page=False)

    # Find all fixed/absolute positioned elements with white-ish background
    suspects = page.evaluate("""() => {
        const allElements = document.querySelectorAll('*');
        const suspects = [];
        for (const el of allElements) {
            const style = window.getComputedStyle(el);
            const pos = style.position;
            if (pos === 'fixed' || pos === 'absolute') {
                const rect = el.getBoundingClientRect();
                if (rect.width > 50 && rect.height > 50 && rect.width < 1400 && rect.height < 1000) {
                    const bg = style.backgroundColor;
                    const opacity = parseFloat(style.opacity);
                    const display = style.display;
                    const visibility = style.visibility;
                    const zIndex = style.zIndex;
                    if (display !== 'none' && visibility !== 'hidden' && opacity > 0) {
                        suspects.push({
                            tag: el.tagName.toLowerCase(),
                            id: el.id || '',
                            className: (el.className?.toString?.() || '').slice(0, 150),
                            position: pos,
                            rect: {
                                x: Math.round(rect.x),
                                y: Math.round(rect.y),
                                w: Math.round(rect.width),
                                h: Math.round(rect.height)
                            },
                            bg: bg,
                            zIndex: zIndex,
                            childCount: el.children.length,
                            textLen: (el.textContent || '').trim().length,
                            innerHTML_preview: el.innerHTML.slice(0, 100),
                            parentTag: el.parentElement?.tagName?.toLowerCase() || '',
                            parentId: el.parentElement?.id || '',
                            parentClass: (el.parentElement?.className?.toString?.() || '').slice(0, 80),
                        });
                    }
                }
            }
        }
        return suspects;
    }""")

    print(f"Found {len(suspects)} fixed/absolute elements:")
    for s in suspects:
        bg_is_white = 'rgb(255, 255, 255)' in s['bg'] or 'rgba(0, 0, 0, 0)' in s['bg'] or s['bg'] == 'white'
        marker = " *** WHITE ***" if bg_is_white else ""
        no_text = " [EMPTY]" if s['textLen'] == 0 else f" [{s['textLen']} chars]"
        print(f"  <{s['tag']}> id='{s['id']}' pos={s['position']} "
              f"rect=({s['rect']['x']},{s['rect']['y']},{s['rect']['w']}x{s['rect']['h']}) "
              f"z={s['zIndex']} bg={s['bg']}{marker}{no_text}")
        if bg_is_white and s['rect']['w'] > 100 and s['rect']['h'] > 100:
            print(f"    class: {s['className']}")
            print(f"    parent: <{s['parentTag']}> id='{s['parentId']}' class='{s['parentClass']}'")
            print(f"    innerHTML: {s['innerHTML_preview']}")

    # Also check for shadow DOM elements (Next.js devtools uses them)
    shadow_info = page.evaluate("""() => {
        const withShadow = [];
        document.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
                const rect = el.getBoundingClientRect();
                withShadow.push({
                    tag: el.tagName.toLowerCase(),
                    id: el.id,
                    className: (el.className?.toString?.() || '').slice(0, 100),
                    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                    shadowChildCount: el.shadowRoot.children.length,
                    shadowHTML: el.shadowRoot.innerHTML.slice(0, 200)
                });
            }
        });
        return withShadow;
    }""")

    if shadow_info:
        print(f"\nShadow DOM elements: {len(shadow_info)}")
        for s in shadow_info:
            print(f"  <{s['tag']}> id='{s['id']}' rect=({s['rect']['x']},{s['rect']['y']},{s['rect']['w']}x{s['rect']['h']})")
            print(f"    class: {s['className']}")
            print(f"    shadow children: {s['shadowChildCount']}")
            print(f"    shadow HTML: {s['shadowHTML']}")

    # Check for next-devtools specific elements
    devtools_info = page.evaluate("""() => {
        const results = [];
        // Check for nextjs-portal
        const portals = document.querySelectorAll('nextjs-portal, [data-nextjs-dialog], [data-nextjs-toast], [data-nextjs-scroll-focus-boundary]');
        portals.forEach(el => {
            const rect = el.getBoundingClientRect();
            results.push({
                tag: el.tagName.toLowerCase(),
                attrs: Array.from(el.attributes).map(a => `${a.name}=${a.value}`).join(', '),
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                display: window.getComputedStyle(el).display,
                childCount: el.children.length,
                innerHTML: el.innerHTML.slice(0, 200)
            });
        });
        return results;
    }""")

    if devtools_info:
        print(f"\nNext.js portal/dialog elements: {len(devtools_info)}")
        for d in devtools_info:
            print(f"  <{d['tag']}> attrs=[{d['attrs']}] display={d['display']}")
            print(f"    rect=({d['rect']['x']},{d['rect']['y']},{d['rect']['w']}x{d['rect']['h']})")
            print(f"    innerHTML: {d['innerHTML']}")

    browser.close()

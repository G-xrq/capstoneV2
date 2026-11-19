from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='msedge')
    page = browser.new_page(viewport={'width': 1366, 'height': 920})
    page.goto('http://localhost:5173/?onboarding=true')
    page.wait_for_selector('.onboarding-card')
    page.click('text=Begin Personalization')
    page.wait_for_selector('.onboarding-side-by-side')
    page.wait_for_timeout(500)
    
    breakdown = page.evaluate('''() => {
        const card = document.querySelector('.onboarding-card');
        const children = Array.from(card.children).map(c => {
            const r = c.getBoundingClientRect();
            const cs = window.getComputedStyle(c);
            return {
                tag: c.tagName,
                className: c.className,
                offsetHeight: c.offsetHeight,
                rectHeight: r.height,
                marginTop: cs.marginTop,
                marginBottom: cs.marginBottom
            };
        });
        return {
            cardHeight: card.offsetHeight,
            cardClientHeight: card.clientHeight,
            cardScrollHeight: card.scrollHeight,
            children: children
        };
    }''')
    
    import json
    print(json.dumps(breakdown, indent=2))
    browser.close()

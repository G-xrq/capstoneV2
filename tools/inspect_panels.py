import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel="msedge")
    page = browser.new_page(viewport={"width": 1366, "height": 920})
    page.goto("http://localhost:5173/?onboarding=true")
    page.wait_for_selector(".onboarding-card")
    page.click("text=Begin Personalization")
    page.wait_for_selector(".onboarding-side-by-side")
    time.sleep(0.3)
    
    for s in range(1, 7):
        panel_info = page.evaluate('''() => {
            const panel = document.querySelector(".onboarding-left-panel");
            const children = Array.from(panel.children).map(c => ({
                cls: c.className,
                h: c.getBoundingClientRect().height
            }));
            return {
                totalH: panel.getBoundingClientRect().height,
                scrollH: panel.scrollHeight,
                children
            };
        }''')
        print(f"Step {s} panel:", panel_info)
        if s < 6:
            page.click("button:has-text('Continue')")
            time.sleep(0.3)
    browser.close()

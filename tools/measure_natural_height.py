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
    
    # Temporarily remove min-height in DOM
    page.evaluate('''() => {
        const card = document.querySelector(".onboarding-card");
        card.style.minHeight = "auto";
    }''')
    
    for s in range(1, 7):
        h = page.evaluate('''() => {
            const card = document.querySelector(".onboarding-card");
            card.style.minHeight = "auto";
            const header = document.querySelector(".onboarding-header").getBoundingClientRect().height;
            const track = document.querySelector(".onboarding-segmented-track") ? document.querySelector(".onboarding-segmented-track").getBoundingClientRect().height : 0;
            const body = document.querySelector(".onboarding-body").getBoundingClientRect().height;
            const bodyScroll = document.querySelector(".onboarding-body").scrollHeight;
            const footer = document.querySelector(".onboarding-footer") ? document.querySelector(".onboarding-footer").getBoundingClientRect().height : 0;
            const cardH = card.getBoundingClientRect().height;
            const leftH = document.querySelector(".onboarding-left-panel").getBoundingClientRect().height;
            const rightH = document.querySelector(".onboarding-right-panel").getBoundingClientRect().height;
            return {
                cardH,
                header,
                track,
                body,
                bodyScroll,
                footer,
                leftH,
                rightH,
                totalSum: header + track + Math.max(leftH, rightH) + footer + 40 // padding
            };
        }''')
        print(f"Step {s} natural height:", h)
        if s < 6:
            page.click("button:has-text('Continue')")
            time.sleep(0.3)
    browser.close()

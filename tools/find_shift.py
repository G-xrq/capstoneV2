import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel="msedge")
    page = browser.new_page(viewport={"width": 1366, "height": 920})
    page.goto("http://localhost:5173/?onboarding=true")
    page.wait_for_selector(".onboarding-card")
    page.click("text=Begin Personalization")
    page.wait_for_selector(".onboarding-side-by-side")
    time.sleep(0.4)
    
    t1 = page.evaluate('''() => {
        const card = document.querySelector(".onboarding-card");
        const body = document.querySelector(".onboarding-body");
        const meta = document.querySelector(".onboarding-section-meta");
        const grid = document.querySelector(".onboarding-side-by-side");
        const win = document.querySelector(".onboarding-preview-window");
        return {
            cardTop: card.getBoundingClientRect().top,
            cardHeight: card.getBoundingClientRect().height,
            bodyTop: body.getBoundingClientRect().top,
            metaTop: meta.getBoundingClientRect().top,
            gridTop: grid.getBoundingClientRect().top,
            winTop: win.getBoundingClientRect().top
        };
    }''')
    print("Step 1 tops:", t1)
    
    page.click("text=Continue")
    time.sleep(0.4)
    
    t2 = page.evaluate('''() => {
        const card = document.querySelector(".onboarding-card");
        const body = document.querySelector(".onboarding-body");
        const meta = document.querySelector(".onboarding-section-meta");
        const grid = document.querySelector(".onboarding-side-by-side");
        const win = document.querySelector(".onboarding-preview-window");
        return {
            cardTop: card.getBoundingClientRect().top,
            cardHeight: card.getBoundingClientRect().height,
            bodyTop: body.getBoundingClientRect().top,
            metaTop: meta.getBoundingClientRect().top,
            gridTop: grid.getBoundingClientRect().top,
            winTop: win.getBoundingClientRect().top
        };
    }''')
    print("Step 2 tops:", t2)
    browser.close()

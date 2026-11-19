from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='msedge')
    page = browser.new_page(viewport={'width': 1366, 'height': 920})
    page.goto('http://localhost:5173/?onboarding=true')
    page.wait_for_selector('.onboarding-card')
    page.click('text=Begin Personalization')
    print('Step 1 class:', page.evaluate('document.querySelector(".onboarding-card").className'))
    print('Step 1 maxWidth:', page.evaluate('window.getComputedStyle(document.querySelector(".onboarding-card")).maxWidth'))
    
    page.click('text=Continue')
    print('Step 2 class:', page.evaluate('document.querySelector(".onboarding-card").className'))
    print('Step 2 maxWidth:', page.evaluate('window.getComputedStyle(document.querySelector(".onboarding-card")).maxWidth'))
    browser.close()

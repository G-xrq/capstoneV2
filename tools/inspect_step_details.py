import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='msedge')
    page = browser.new_page(viewport={'width': 1366, 'height': 920})
    page.goto('http://localhost:5173/?onboarding=true')
    page.wait_for_selector('.onboarding-card')
    page.click('text=Begin Personalization')
    page.wait_for_selector('.onboarding-side-by-side')
    
    # Check step 1 details
    step1_info = page.evaluate('''() => {
        const meta = document.querySelector('.onboarding-section-meta');
        const sbs = document.querySelector('.onboarding-side-by-side');
        const win = document.querySelector('.onboarding-preview-window');
        const header = document.querySelector('.onboarding-header');
        const track = document.querySelector('.onboarding-segmented-track');
        const body = document.querySelector('.onboarding-body');
        const card = document.querySelector('.onboarding-card');
        return {
            card: card.getBoundingClientRect(),
            header: header.getBoundingClientRect(),
            track: track.getBoundingClientRect(),
            body: body.getBoundingClientRect(),
            meta: meta.getBoundingClientRect(),
            sbs: sbs.getBoundingClientRect(),
            win: win.getBoundingClientRect(),
            metaStyle: window.getComputedStyle(meta).marginBottom,
            bodyPadding: window.getComputedStyle(body).padding
        };
    }''')
    print('STEP 1 INITIAL:', json.dumps(step1_info, indent=2))
    
    page.click("button:has-text('Continue')")
    page.wait_for_timeout(400)
    
    step2_info = page.evaluate('''() => {
        const meta = document.querySelector('.onboarding-section-meta');
        const sbs = document.querySelector('.onboarding-side-by-side');
        const win = document.querySelector('.onboarding-preview-window');
        const header = document.querySelector('.onboarding-header');
        const track = document.querySelector('.onboarding-segmented-track');
        const body = document.querySelector('.onboarding-body');
        const card = document.querySelector('.onboarding-card');
        return {
            card: card.getBoundingClientRect(),
            header: header.getBoundingClientRect(),
            track: track.getBoundingClientRect(),
            body: body.getBoundingClientRect(),
            meta: meta.getBoundingClientRect(),
            sbs: sbs.getBoundingClientRect(),
            win: win.getBoundingClientRect(),
            metaStyle: window.getComputedStyle(meta).marginBottom,
            bodyPadding: window.getComputedStyle(body).padding
        };
    }''')
    print('STEP 2:', json.dumps(step2_info, indent=2))
    
    page.click("button:has-text('Back')")
    page.wait_for_timeout(400)
    
    step1_back = page.evaluate('''() => {
        const meta = document.querySelector('.onboarding-section-meta');
        const sbs = document.querySelector('.onboarding-side-by-side');
        const win = document.querySelector('.onboarding-preview-window');
        const card = document.querySelector('.onboarding-card');
        return {
            card: card.getBoundingClientRect(),
            meta: meta.getBoundingClientRect(),
            sbs: sbs.getBoundingClientRect(),
            win: win.getBoundingClientRect()
        };
    }''')
    print('STEP 1 BACK:', json.dumps(step1_back, indent=2))
    
    browser.close()

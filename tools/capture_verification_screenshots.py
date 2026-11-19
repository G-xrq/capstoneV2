from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='msedge')
    page = browser.new_page(viewport={'width': 1366, 'height': 920})
    page.goto('http://localhost:5173/?onboarding=true')
    page.wait_for_selector('.onboarding-card')
    
    # 1. Step 0 Welcome Screenshot
    page.screenshot(path='C:/Users/Gester/.gemini/antigravity/brain/331c98ba-81fa-4258-8ed7-eae682e42bbd/verify_step0_welcome.png')
    print("Saved verify_step0_welcome.png")
    
    page.click('text=Begin Personalization')
    page.wait_for_selector('.onboarding-side-by-side')
    page.wait_for_timeout(300)
    
    for s in range(1, 7):
        page.screenshot(path=f'C:/Users/Gester/.gemini/antigravity/brain/331c98ba-81fa-4258-8ed7-eae682e42bbd/verify_step{s}.png')
        print(f"Saved verify_step{s}.png")
        if s < 6:
            page.click("button:has-text('Continue')")
            page.wait_for_timeout(350)
            
    # Go back to step 1 and screenshot
    for s in range(6, 1, -1):
        page.click("button:has-text('Back')")
        page.wait_for_timeout(200)
    page.screenshot(path='C:/Users/Gester/.gemini/antigravity/brain/331c98ba-81fa-4258-8ed7-eae682e42bbd/verify_step1_after_back.png')
    print("Saved verify_step1_after_back.png")
    
    browser.close()

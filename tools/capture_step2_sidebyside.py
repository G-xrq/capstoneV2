import os
import time
from playwright.sync_api import sync_playwright

artifact_dir = r"C:\Users\Gester\.gemini\antigravity\brain\331c98ba-81fa-4258-8ed7-eae682e42bbd"

def capture():
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(headless=True, channel="msedge")
        except Exception:
            browser = p.chromium.launch(headless=True, channel="chrome")
        context = browser.new_context(viewport={"width": 1366, "height": 900})
        page = context.new_page()

        print("Navigating to http://localhost:5173/?onboarding=true ...")
        page.goto("http://localhost:5173/?onboarding=true", wait_until="domcontentloaded")
        page.wait_for_selector(".onboarding-card", timeout=15000)
        time.sleep(1)

        # Advance to Step 2
        page.click("text=Begin Personalization")
        time.sleep(0.4)
        page.click("text=Continue")
        time.sleep(0.5)

        # 1. Capture Step 2: Standard Mode (Dark)
        page.screenshot(path=os.path.join(artifact_dir, "step2_standard_mode_dark.png"))
        print("Captured Step 2: Standard Mode (Dark)")

        # 2. Select Simplified Mode
        page.click("text=Simplified Mode")
        time.sleep(0.5)
        page.screenshot(path=os.path.join(artifact_dir, "step2_simplified_mode_dark.png"))
        print("Captured Step 2: Simplified Mode (Dark)")

        # 3. Toggle Light Mode using explicit modal pill button
        page.click(".onboarding-left-panel button:has-text('Light')")
        time.sleep(0.5)
        page.evaluate("() => { const b = document.querySelector('.onboarding-body'); if (b) b.scrollTop = 0; window.scrollTo(0, 0); }")
        page.screenshot(path=os.path.join(artifact_dir, "step2_simplified_mode_light.png"))
        print("Captured Step 2: Simplified Mode (Light)")

        # 4. Switch back to Standard Mode in Light
        page.click("text=Standard Mode")
        time.sleep(0.5)
        page.evaluate("() => { const b = document.querySelector('.onboarding-body'); if (b) b.scrollTop = 0; window.scrollTo(0, 0); }")
        page.screenshot(path=os.path.join(artifact_dir, "step2_standard_mode_light.png"))
        print("Captured Step 2: Standard Mode (Light)")

        browser.close()
        print("Side-by-side screenshots captured successfully!")

if __name__ == "__main__":
    capture()

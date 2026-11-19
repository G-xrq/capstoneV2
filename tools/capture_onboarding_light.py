import os
import time
from playwright.sync_api import sync_playwright

artifact_dir = r"C:\Users\Gester\.gemini\antigravity\brain\331c98ba-81fa-4258-8ed7-eae682e42bbd"

def capture_light():
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(headless=True, channel="msedge")
        except Exception:
            browser = p.chromium.launch(headless=True, channel="chrome")
        context = browser.new_context(viewport={"width": 1280, "height": 880})
        page = context.new_page()

        page.goto("http://localhost:5173/?onboarding=true", wait_until="networkidle")
        time.sleep(1)

        # Set theme to light
        page.evaluate("""() => {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('bbdrts_theme', 'light');
        }""")
        time.sleep(0.5)

        # Step 0 Light
        page.screenshot(path=os.path.join(artifact_dir, "onboarding_step0_light.png"))

        # Click Begin Personalization
        page.click("text=Begin Personalization")
        time.sleep(0.5)

        # Step 1 Light
        page.screenshot(path=os.path.join(artifact_dir, "onboarding_step1_light.png"))

        # Click Continue
        page.click("text=Continue")
        time.sleep(0.5)

        # Step 2 Light
        page.screenshot(path=os.path.join(artifact_dir, "onboarding_step2_light.png"))

        browser.close()
        print("Light mode screenshots captured successfully!")

if __name__ == "__main__":
    capture_light()

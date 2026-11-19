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
        context = browser.new_context(viewport={"width": 1280, "height": 880})
        page = context.new_page()

        print("Navigating to http://localhost:5173/?onboarding=true ...")
        page.goto("http://localhost:5173/?onboarding=true", wait_until="networkidle")
        time.sleep(1.5)

        # 1. Screen 0: Welcome Screen
        page.screenshot(path=os.path.join(artifact_dir, "onboarding_step0_welcome.png"))
        print("Captured Step 0: Welcome")

        # Click Begin Personalization
        page.click("text=Begin Personalization")
        time.sleep(0.5)

        # 2. Step 1: About You
        page.screenshot(path=os.path.join(artifact_dir, "onboarding_step1_about.png"))
        print("Captured Step 1: About You")

        # Select Tagalog & 25-34
        page.click("text=Filipino / Tagalog")
        page.click("button:has-text('25–34')")
        time.sleep(0.3)

        # Click Continue
        page.click("text=Continue")
        time.sleep(0.5)

        # 3. Step 2: Experience & Layout
        page.screenshot(path=os.path.join(artifact_dir, "onboarding_step2_experience.png"))
        print("Captured Step 2: Experience")

        # Select Simplified Experience
        page.click("text=Simplified Experience")
        time.sleep(0.3)

        # Click Continue
        page.click("text=Continue")
        time.sleep(0.5)

        # 4. Step 3: Accessibility & Comfort
        page.screenshot(path=os.path.join(artifact_dir, "onboarding_step3_accessibility.png"))
        print("Captured Step 3: Accessibility")

        # Toggle Reduced Motion & High Contrast
        page.click("text=Enhanced High-Contrast Borders")
        time.sleep(0.3)

        # Click Continue
        page.click("text=Continue")
        time.sleep(0.5)

        # 5. Step 4: Review & Live Prototype Preview
        page.screenshot(path=os.path.join(artifact_dir, "onboarding_step4_review.png"))
        print("Captured Step 4: Review & Live Preview")

        # Click Confirm & Finalize
        page.click("text=Confirm & Finalize")
        time.sleep(0.5)

        # 6. Step 5: Completion Screen
        page.screenshot(path=os.path.join(artifact_dir, "onboarding_step5_complete.png"))
        print("Captured Step 5: Complete")

        browser.close()
        print("All onboarding screens captured successfully!")

if __name__ == "__main__":
    capture()

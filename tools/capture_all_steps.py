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
        context = browser.new_context(viewport={"width": 1366, "height": 920})
        page = context.new_page()

        print("Navigating to http://localhost:5173/?onboarding=true ...")
        page.goto("http://localhost:5173/?onboarding=true", wait_until="domcontentloaded")
        page.wait_for_selector(".onboarding-card", timeout=15000)
        time.sleep(1)

        # Screen 0: Welcome Screen
        page.screenshot(path=os.path.join(artifact_dir, "step0_welcome.png"))
        print("Captured Step 0: Welcome")

        # Step 1: Interface Mode Selection (Step 1 of 5)
        page.click("text=Begin Personalization")
        time.sleep(0.4)
        page.screenshot(path=os.path.join(artifact_dir, "step1_interface_mode_standard.png"))
        print("Captured Step 1: Interface Mode (Standard)")

        page.click("text=Simplified Mode")
        time.sleep(0.3)
        page.screenshot(path=os.path.join(artifact_dir, "step1_interface_mode_simplified.png"))
        print("Captured Step 1: Interface Mode (Simplified)")

        # Switch back to standard
        page.click("text=Standard Mode")
        time.sleep(0.2)

        # Step 2: Display Theme & Contrast (Step 2 of 5)
        page.click("text=Continue")
        time.sleep(0.4)
        page.screenshot(path=os.path.join(artifact_dir, "step2_theme_dark.png"))
        print("Captured Step 2: Preview Theme (Dark)")

        page.click("text=Light Theme")
        time.sleep(0.3)
        page.screenshot(path=os.path.join(artifact_dir, "step2_theme_light.png"))
        print("Captured Step 2: Preview Theme (Light)")

        page.click("text=Dark Theme")
        time.sleep(0.2)

        # Step 3: Preferred Platform Language (Step 3 of 5)
        page.click("text=Continue")
        time.sleep(0.4)
        page.screenshot(path=os.path.join(artifact_dir, "step3_language_en.png"))
        print("Captured Step 3: Language (English)")

        # Step 4: Interface Text Size & Typography (Step 4 of 5)
        page.click("text=Continue")
        time.sleep(0.4)
        page.screenshot(path=os.path.join(artifact_dir, "step4_textsize_comfortable.png"))
        print("Captured Step 4: Text Size (Comfortable)")

        # Step 5: Visual & Cognitive Controls (Step 5 of 5)
        page.click("text=Continue")
        time.sleep(0.4)
        page.screenshot(path=os.path.join(artifact_dir, "step5_accessibility_default.png"))
        print("Captured Step 5: Visual Controls (Default)")

        # Step 6: Review & Finalize
        page.click("text=Continue")
        time.sleep(0.4)
        page.screenshot(path=os.path.join(artifact_dir, "step6_review.png"))
        print("Captured Step 6: Review")

        # Step 7: Completion Screen
        page.click("button:has-text('Confirm & Finalize')")
        time.sleep(0.4)
        page.screenshot(path=os.path.join(artifact_dir, "step7_complete.png"))
        print("Captured Step 7: Complete")

        browser.close()
        print("All steps captured successfully!")

if __name__ == "__main__":
    capture()

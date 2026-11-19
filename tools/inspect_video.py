import os
import time
from playwright.sync_api import sync_playwright

artifact_dir = r"C:\Users\Gester\.gemini\antigravity\brain\331c98ba-81fa-4258-8ed7-eae682e42bbd"
video_path = r"C:/Users/Gester/.gemini/antigravity/brain/331c98ba-81fa-4258-8ed7-eae682e42bbd/.user_uploaded/media_1794899965490_1e48ff36.mp4"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel="msedge")
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto("file:///" + video_path)
    page.wait_for_selector("video")
    duration = page.evaluate("() => document.querySelector('video').duration")
    print("Video duration:", duration)
    
    for t in [0.2, 0.8, 1.5, 2.5, 3.5, 4.5, 6.0]:
        if t <= duration:
            page.evaluate(f"() => {{ document.querySelector('video').currentTime = {t}; }}")
            time.sleep(0.4)
            page.screenshot(path=os.path.join(artifact_dir, f"v_frame_{int(t*10)}.png"))
            print(f"Captured at {t}s")
    browser.close()

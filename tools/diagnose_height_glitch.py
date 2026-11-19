import time
import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='msedge')
    page = browser.new_page(viewport={'width': 1366, 'height': 920})
    page.goto('http://localhost:5173/?onboarding=true')
    page.wait_for_selector('.onboarding-card')
    
    # Check step 0 desc
    desc0 = page.evaluate('''() => {
        const el = document.querySelector('.onboarding-welcome-desc') || document.querySelector('.onboarding-section-desc');
        const card = document.querySelector('.onboarding-card');
        const r = el.getBoundingClientRect();
        const rc = card.getBoundingClientRect();
        return { 
            tag: el.className, 
            text: el.innerText, 
            w: r.width, 
            h: r.height, 
            left: r.left, 
            right: r.right,
            cardW: rc.width,
            cardH: rc.height,
            cardRight: rc.right
        };
    }''')
    print('STEP 0 METRICS:', json.dumps(desc0, indent=2))
    
    page.click('text=Begin Personalization')
    page.wait_for_selector('.onboarding-side-by-side')
    time.sleep(0.1)
    
    def get_metrics():
        return page.evaluate('''() => {
            const card = document.querySelector('.onboarding-card');
            const body = document.querySelector('.onboarding-body');
            const meta = document.querySelector('.onboarding-section-meta');
            const metaInner = document.querySelector('.onboarding-meta-inner');
            const sbs = document.querySelector('.onboarding-side-by-side');
            const left = document.querySelector('.onboarding-left-panel');
            const leftInner = document.querySelector('.onboarding-panel-inner');
            const right = document.querySelector('.onboarding-right-panel');
            const win = document.querySelector('.onboarding-preview-window');
            const footer = document.querySelector('.onboarding-footer');
            
            return {
                card: card ? { h: card.getBoundingClientRect().height, top: card.getBoundingClientRect().top } : null,
                body: body ? { h: body.getBoundingClientRect().height } : null,
                meta: meta ? { h: meta.getBoundingClientRect().height } : null,
                metaInner: metaInner ? { h: metaInner.getBoundingClientRect().height } : null,
                sbs: sbs ? { h: sbs.getBoundingClientRect().height } : null,
                left: left ? { h: left.getBoundingClientRect().height } : null,
                leftInner: leftInner ? { h: leftInner.getBoundingClientRect().height } : null,
                right: right ? { h: right.getBoundingClientRect().height } : null,
                win: win ? { h: win.getBoundingClientRect().height, top: win.getBoundingClientRect().top } : null,
                footer: footer ? { h: footer.getBoundingClientRect().height } : null,
            };
        }''')
        
    for s in range(1, 7):
        m = get_metrics()
        print(f"=== STEP {s} ===")
        print(f"  Card: h={m['card']['h']}, top={m['card']['top']}")
        print(f"  Meta: h={m['meta']['h']}, metaInner: h={m['metaInner']['h']}")
        print(f"  Left: h={m['left']['h']}, leftInner: h={m['leftInner']['h']}")
        print(f"  Right: h={m['right']['h']}, win: h={m['win']['h']}, winTop={m['win']['top']}")
        if s < 6:
            page.click("button:has-text('Continue')")
            time.sleep(0.35)
            
    print("\n--- GOING BACKWARDS ---")
    for s in range(6, 1, -1):
        page.click("button:has-text('Back')")
        time.sleep(0.35)
        m = get_metrics()
        print(f"=== BACK TO STEP {s-1} ===")
        print(f"  Card: h={m['card']['h']}, top={m['card']['top']}")
        print(f"  Meta: h={m['meta']['h']}, metaInner: h={m['metaInner']['h']}")
        print(f"  Left: h={m['left']['h']}, leftInner: h={m['leftInner']['h']}")
        print(f"  Right: h={m['right']['h']}, win: h={m['win']['h']}, winTop={m['win']['top']}")
            
    browser.close()

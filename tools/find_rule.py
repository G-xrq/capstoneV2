from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='msedge')
    page = browser.new_page(viewport={'width': 1366, 'height': 920})
    page.goto('http://localhost:5173/?onboarding=true')
    page.wait_for_selector('.onboarding-card')
    page.click('text=Begin Personalization')
    
    rules = page.evaluate('''() => {
        const el = document.querySelector(".onboarding-card");
        const sheets = Array.from(document.styleSheets);
        const matchingRules = [];
        for (const sheet of sheets) {
            try {
                for (const rule of sheet.cssRules) {
                    if (rule.selectorText && el.matches(rule.selectorText)) {
                        if (rule.style.maxWidth) {
                            matchingRules.push({
                                selector: rule.selectorText,
                                maxWidth: rule.style.maxWidth
                            });
                        }
                    }
                }
            } catch(e) {}
        }
        return matchingRules;
    }''')
    print('Matching rules in Step 1:', rules)
    browser.close()

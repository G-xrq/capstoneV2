import re

file_path = r"frontend\src\components\PersonalizationOnboarding.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

step_headers = [
    '{/* ════ STEP 1: INTERFACE MODE SELECTION ════ */}',
    '{/* ════ STEP 2: PREVIEW THEME ════ */}',
    '{/* ════ STEP 3: PREFERRED PLATFORM LANGUAGE ════ */}',
    '{/* ════ STEP 4: INTERFACE TEXT SIZE ════ */}',
    '{/* ════ STEP 5: VISUAL & COGNITIVE CONTROLS ════ */}',
    '{/* ════ STEP 6: REVIEW PREFERENCES ════ */}',
    '{/* ════ SCREEN 7: COMPLETION SCREEN ════ */}'
]

inners = []
for i in range(6):
    s = text.find(step_headers[i])
    e = text.find(step_headers[i+1])
    assert s != -1, f"header {i} not found"
    assert e != -1, f"header {i+1} not found"
    chunk = text[s:e]
    marker_start = '<div className="onboarding-left-panel">'
    marker_end = '<div className="onboarding-right-panel">'
    p1 = chunk.find(marker_start) + len(marker_start)
    p2 = chunk.find(marker_end)
    assert p1 != -1 and p2 != -1, f"markers not found in step {i+1}"
    inner = chunk[p1:p2].strip()
    if inner.endswith('</div>'):
        inner = inner[:-6].strip()
    inners.append(inner)
    print(f"Step {i+1}: extracted {len(inner)} chars")

new_steps_block = f"""{{/* ════ STEPS 1 TO 6: SHARED PERSISTENT LAYOUT WITH ANIMATED CHOICES ════ */}}
          {{step >= 1 && step <= 6 && (
            <div className="onboarding-step-view">
              {{/* Dynamic Header Meta for Active Step with Key & Slide Animation */}}
              <div key={{`meta-${{step}}`}} className={{`onboarding-section-meta anim-${{slideDirection}}`}} style={{{{ marginBottom: '18px' }}}}>
                {{step === 1 && (
                  <>
                    <span className="onboarding-section-tag">
                      <VercelIcon name="tune" size={{14}} color="#10b981" />
                      Step 1 of 5 · Interface Presentation Mode
                    </span>
                    <h2 className="onboarding-section-title" id="onboarding-title">
                      Choose your interface presentation mode
                    </h2>
                    <p className="onboarding-section-desc">
                      Both modes belong to the same BBDRTS application. Select how information, telemetry, and actions are structured.
                    </p>
                  </>
                )}}

                {{step === 2 && (
                  <>
                    <span className="onboarding-section-tag">
                      <VercelIcon name="visibility" size={{14}} color="#10b981" />
                      Step 2 of 5 · Display Theme
                    </span>
                    <h2 className="onboarding-section-title" id="onboarding-title">
                      Select your display theme
                    </h2>
                    <p className="onboarding-section-desc">
                      Choose how the BBDRTS workspace appears across daytime relief operations and low-light field conditions.
                    </p>
                  </>
                )}}

                {{step === 3 && (
                  <>
                    <span className="onboarding-section-tag">
                      <VercelIcon name="translate" size={{14}} color="#10b981" />
                      Step 3 of 5 · Preferred Platform Language
                    </span>
                    <h2 className="onboarding-section-title" id="onboarding-title">
                      Choose your platform language
                    </h2>
                    <p className="onboarding-section-desc">
                      Calibrates campaign dossiers, receipt terminology, and field disaster alerts to your native dialect.
                    </p>
                  </>
                )}}

                {{step === 4 && (
                  <>
                    <span className="onboarding-section-tag">
                      <VercelIcon name="text_fields" size={{14}} color="#10b981" />
                      Step 4 of 5 · Interface Text Size &amp; Typography
                    </span>
                    <h2 className="onboarding-section-title" id="onboarding-title">
                      Adjust interface text size
                    </h2>
                    <p className="onboarding-section-desc">
                      Set your baseline typography scale for optimal reading comfort across campaign feeds and blockchain ledgers.
                    </p>
                  </>
                )}}

                {{step === 5 && (
                  <>
                    <span className="onboarding-section-tag">
                      <VercelIcon name="shield" size={{14}} color="#10b981" />
                      Step 5 of 5 · Visual &amp; Cognitive Controls
                    </span>
                    <h2 className="onboarding-section-title" id="onboarding-title">
                      Fine-tune visual &amp; cognitive controls
                    </h2>
                    <p className="onboarding-section-desc">
                      Individual comfort switches for motion sensitivity, high-contrast clarity, and contextual definitions.
                    </p>
                  </>
                )}}

                {{step === 6 && (
                  <>
                    <span className="onboarding-section-tag">
                      <VercelIcon name="fact_check" size={{14}} color="#10b981" />
                      Review &amp; Finalize Personalization
                    </span>
                    <h2 className="onboarding-section-title" id="onboarding-title">
                      Review your personalized workspace
                    </h2>
                    <p className="onboarding-section-desc">
                      Here is how BBDRTS will adapt to your preferences. You can jump back to edit any setting or proceed to launch.
                    </p>
                  </>
                )}}
              </div>

              <div className="onboarding-side-by-side">
                <div key={{`panel-${{step}}`}} className={{`onboarding-left-panel anim-${{slideDirection}}`}}>
                  {{step === 1 && (
                    <>
                      {inners[0]}
                    </>
                  )}}

                  {{step === 2 && (
                    <>
                      {inners[1]}
                    </>
                  )}}

                  {{step === 3 && (
                    <>
                      {inners[2]}
                    </>
                  )}}

                  {{step === 4 && (
                    <>
                      {inners[3]}
                    </>
                  )}}

                  {{step === 5 && (
                    <>
                      {inners[4]}
                    </>
                  )}}

                  {{step === 6 && (
                    <>
                      {inners[5]}
                    </>
                  )}}
                </div>

                {{/* Right Panel: Mounted ONCE, completely static, zero animation */}}
                <div className="onboarding-right-panel">
                  {{renderLivePreview()}}
                </div>
              </div>
            </div>
          )}}"""

start_idx = text.find(step_headers[0])
end_idx = text.find(step_headers[6])

new_text = text[:start_idx] + new_steps_block + "\n\n          " + text[end_idx:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_text)

print("Refactored PersonalizationOnboarding.jsx successfully!")

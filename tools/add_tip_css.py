with open('frontend/src/components/PersonalizationOnboarding.css', 'r', encoding='utf-8') as f:
    css = f.read()

tip_css = """
/* ── Contextual Blockchain Micro-Tip Tags ────────────────── */
.preview-micro-tip-tag {
  display: inline-flex;
  align-items: center;
  gap: 3.5px;
  font-size: 0.62rem;
  padding: 1.5px 5.5px;
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #10b981;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  animation: onboardingFadeIn 0.2s ease forwards;
  vertical-align: middle;
}

[data-theme="light"] .preview-micro-tip-tag,
.onboarding-preview-window.light .preview-micro-tip-tag {
  background: rgba(5, 150, 105, 0.1);
  border-color: rgba(5, 150, 105, 0.35);
  color: #059669;
}
"""

if '.preview-micro-tip-tag' not in css:
    css += tip_css
    with open('frontend/src/components/PersonalizationOnboarding.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print('Added .preview-micro-tip-tag to PersonalizationOnboarding.css')
else:
    print('.preview-micro-tip-tag already in CSS')

# Design QA — claim heading alignment

## Evidence

- Source visual truth: `/Users/yann/outbid-verticals/03-city-weekend-spot/artifacts/design-qa/claim-line-source.png`
- Density-normalized source: `/Users/yann/outbid-verticals/03-city-weekend-spot/artifacts/design-qa/claim-line-source-normalized-1200x745.png`
- Browser-rendered implementation: `/Users/yann/outbid-verticals/03-city-weekend-spot/artifacts/design-qa/claim-line-after-desktop-1200x745.png`
- Mobile implementation: `/Users/yann/outbid-verticals/03-city-weekend-spot/artifacts/design-qa/claim-line-after-mobile-390x844.png`
- Full comparison, source left and implementation right: `/Users/yann/outbid-verticals/03-city-weekend-spot/artifacts/design-qa/claim-line-comparison-full.png`
- Focused claim comparison, source left and implementation right: `/Users/yann/outbid-verticals/03-city-weekend-spot/artifacts/design-qa/claim-line-comparison-focused.png`
- State: honest empty NYC poster, bid window closed, disabled Outbid action.
- Desktop viewport: `1200 x 745` CSS px at density `1`. The `2400 x 1664` source included `174px` of browser chrome; its `2400 x 1490` page region was cropped and downsampled to `1200 x 745` before comparison.
- Mobile viewport: `390 x 844` CSS px at density `1`; implementation screenshot is `390 x 844` pixels.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Fonts and typography: the existing serif hierarchy, weights, line heights, and amount treatment are unchanged; only flex alignment changed.
- Spacing and layout rhythm: `Claim #1 for` to the minus button is now `4px` instead of `285.015625px`. Their measured center-line delta is `0.00390625px` instead of `6.01953125px`.
- Colors and visual tokens: unchanged; paper, ink, accent red, rules, and disabled-action tokens remain the existing City Weekend skin.
- Image quality and assets: no image, logo, illustration, icon, or generated asset was added or replaced.
- Copy and content: unchanged; the existing empty-poster and bid-window copy remains truthful.
- Responsiveness: at `390 x 844`, the label and stepper remain on one line with the same `4px` gap, `0.00390625px` center delta, contained glyphs, and `0px` horizontal overflow.
- Interaction: increase and decrease were exercised from `$5 → $6 → $5`; state restored correctly. Browser console errors: none.

## Comparison History

1. Initial P2 — `justify-content: space-between` created a `285.015625px` gap between the label and minus control, while baseline alignment left their centers `6.01953125px` apart.
2. Fix — changed the claim heading to a compact start-aligned flex row, used `align-items: center`, and set the inter-item gap to `0.25rem`; the responsive rule now preserves the same row when it fits and wraps safely when it does not.
3. Post-fix evidence — focused and full comparison images show the gap removed without changing the poster skin or form hierarchy; desktop and mobile measurements are both within `0.004px` of a shared center line.

## Open Questions

- None for this scoped alignment correction.

## Verification

- `npm run typecheck`: passed.
- `npm test`: 164 passed, 0 failed.
- `GET /healthz`: passed.
- `git diff --check`: passed.
- Desktop/mobile Chrome captures, stepper interaction, glyph containment, overflow, and console checks: passed.

## Implementation Checklist

- [x] Remove the oversized label-to-minus gap.
- [x] Align the label and button boxes to one center line.
- [x] Preserve the City Weekend skin and form layout.
- [x] Verify desktop and mobile behavior.

## Follow-up Polish

- None required for this scoped correction.

final result: passed

## Maker contact footer · 2026-09-01

- Source visual truth: `/var/folders/wr/2073jwr96_q68h23sfdqtvf00000gn/T/codex-clipboard-856d0520-4293-4865-a587-ff7cf0f23936.png` (`2400 x 1664`, browser chrome included).
- Browser-rendered implementation: `/Users/yann/chat2/artifacts/design-qa/2026-09-01-maker-footer/03-desktop.jpg` (`1200 x 689`) and `/Users/yann/chat2/artifacts/design-qa/2026-09-01-maker-footer/03-mobile.jpg` (`390 x 844`); focused crops were normalized in the shared desktop/mobile comparison sheets.
- State: NYC weekend board, bottom details region, maker-email link keyboard-focused.
- Full-view evidence: the author line occupies the poster's closing rule and stays inside the warm paper frame at both widths.
- Focused evidence: one visible marker; exact copy/href; `2px` red focus outline; `0px` horizontal overflow desktop and mobile.
- Required surfaces: serif poster typography, centered spacing, red/ink/paper tokens, and clean copy remain native; no image or icon assets were introduced.
- Findings: P0 `0`, P1 `0`, P2 `0`; adapting the source contact pattern to the city-poster skin is intentional.
- Comparison history: pass 1 found no actionable P0/P1/P2 difference; no visual fix iteration was needed.
- Regression: `166/166` tests passed; payment/provider logic stayed unchanged.

final result: passed

---

# Design QA — header brand and period centering (2026-09-01)

## Evidence

- Source visual truth: `/var/folders/wr/2073jwr96_q68h23sfdqtvf00000gn/T/codex-clipboard-5a660f10-98c1-4b82-935a-520f6b8ea783.png`
- Density-normalized source: `/Users/yann/outbid-verticals/03-city-weekend-spot/artifacts/design-qa/source-normalized.png`
- Browser-rendered desktop implementation: `/Users/yann/outbid-verticals/03-city-weekend-spot/artifacts/design-qa/city-weekend-desktop.png`
- Browser-rendered mobile implementation: `/Users/yann/outbid-verticals/03-city-weekend-spot/artifacts/design-qa/city-weekend-mobile.png`
- Full-view comparison, source left and implementation right: `/Users/yann/outbid-verticals/03-city-weekend-spot/artifacts/design-qa/comparison-desktop.png`
- Focused header comparison, source left and implementation right: `/Users/yann/outbid-verticals/03-city-weekend-spot/artifacts/design-qa/comparison-header-focus.png`
- State: light theme, empty NYC Weekend board, bid window closed.
- Desktop viewport: `1200 x 745` CSS px at device density `2`; Chrome produced a `1200 x 745` CSS-pixel capture. The `2400 x 1664` source was downsampled to `1200 x 832`, then its `87px` normalized browser-chrome region was removed to produce the same `1200 x 745` page region.
- Mobile viewport: `390 x 844` CSS px at device density `1`; implementation capture is `390 x 844` pixels.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Fonts and typography: the existing City Weekend serif and small-caps treatments, weights, letter spacing, and control labels are unchanged.
- Spacing and layout rhythm: the brand and period control now form one centered group in the available left header track. Their measured vertical-center delta is `0px`; the group-content horizontal-center delta is `-0.00390625px`.
- Colors and visual tokens: paper, ink, accent, rules, and active-tab colors are unchanged.
- Image quality and assets: no image, logo, icon, illustration, or generated asset was added or replaced.
- Copy and content: unchanged.
- Responsiveness: at `390 x 844`, the period control is centered exactly (`0px` center delta), remains in normal header flow, has `0px` overlap with the poster, and the document has `0px` horizontal overflow.
- Interaction: both `Weekend → Rolling 7 days` and `Rolling 7 days → Weekend` were exercised in Chrome; the URL and `aria-selected` state updated correctly. Browser console warnings/errors: none.

## Comparison History

1. Initial P2 — a legacy `20px` top margin and `align-self: start` placed the period control below the brand centerline. The desktop elements differed by `10px` vertically.
2. Fix — grouped the brand and period selector, centered the group in the left header track, and reset the period control to `align-self: center` with no top margin.
3. Responsive P2 found during QA — inherited absolute mobile positioning placed the period control over the masthead.
4. Fix — restored normal grid flow on narrow screens, centered the period control in its row, and removed the inherited offset and transform.
5. Post-fix evidence — desktop center deltas are effectively zero; mobile has zero poster overlap and zero document overflow.

## Open Questions

- None for this scoped alignment correction.

## Verification

- `npm run typecheck`: passed.
- `npm test`: 164 passed, 0 failed.
- Chrome desktop and `390 x 844` responsive captures: passed.
- Period-tab interaction and console checks: passed.

## Implementation Checklist

- [x] Center the brand and period selector as one desktop group.
- [x] Put both controls on the same visual centerline.
- [x] Preserve the existing navigation and poster skin.
- [x] Keep the period selector centered and non-overlapping on mobile.

## Follow-up Polish

- None required for this scoped correction.

final result: passed

## Prelaunch public-copy cleanup — 2026-08-31

- Chrome routes checked: home, About, and Rules at the normal desktop viewport and `390 x 844`.
- Public copy contains no clone, development, test-fixture, internal field-name, or payment-provider implementation language.
- Claim controls share one visual centerline; amount decoration is clean and the step buttons stay inside their boxes.
- Responsive result: no horizontal document overflow on any checked route.
- Regression result: `npm test` passed `164/164`; `git diff --check` passed.
- Payment behavior remains unchanged; customer-facing wording is provider-neutral while Waffo stays internal.

---

# Design QA — dollar underline removal (2026-08-31)

## Evidence

- Source visual truth: `/var/folders/wr/2073jwr96_q68h23sfdqtvf00000gn/T/codex-clipboard-c7a079c8-3b1a-4024-ae1e-ae43d1ab390b.png`
- Single source-versus-render comparison: `/Users/yann/chat2/artifacts/design-qa/2026-08-31-dollar-underline/comparison-source-vs-ten-sites.png`
- City weekend desktop render: `/Users/yann/chat2/artifacts/design-qa/2026-08-31-dollar-underline/4203-desktop-full.png`
- City weekend mobile render: `/Users/yann/chat2/artifacts/design-qa/2026-08-31-dollar-underline/4203-mobile-full.png`
- Focused desktop amount crop: `/Users/yann/chat2/artifacts/design-qa/2026-08-31-dollar-underline/4203-desktop-amount.png`
- Focused mobile amount crop: `/Users/yann/chat2/artifacts/design-qa/2026-08-31-dollar-underline/4203-mobile-amount.png`

## Findings

- No actionable P0, P1, or P2 findings remain for this scoped correction.
- The dollar sign and numeric value render with `text-decoration-line: none`; the amount wrapper and input both have `border-bottom-style: none` and `border-bottom-width: 0px`.
- Existing typography, spacing, buttons, project skin, and Waffo payment behavior are unchanged.
- Existing keyboard focus selectors remain in place; only the persistent dashed amount decoration was removed.
- At `390 x 844`, the amount control remains inside the viewport with no horizontal overflow.
- Increase/decrease interaction passed: `$5 → $6 → $5`.
- Chrome console errors: `0`.

## Comparison History

1. Source defect — a dashed line appeared directly below the dollar amount.
2. Fix — removed the amount wrapper/input underline or dashed bottom border without changing form geometry.
3. Post-fix evidence — desktop and mobile crops show the amount cleanly, while controls stay aligned and interactive.

## Verification

- `npm test`: passed, 0 failed.
- `git diff --check`: passed.
- Chrome desktop computed-style check: passed.
- Chrome `390 x 844` responsive computed-style and containment check: passed.
- Chrome amount stepper interaction and console checks: passed.

## Follow-up Polish

- None required for this scoped correction.

final result: passed

## 1. Responsive Structure

- [ ] 1.1 Add a reusable media-query hook and verify it updates safely when the 720px breakpoint changes.
- [ ] 1.2 Build the mobile compact month selector and selected-day agenda, and verify date selection does not open event creation.
- [ ] 1.3 Build the mobile seven-day strip backed by the single-day timeline, and verify week navigation and time-slot creation preserve the selected date.
- [ ] 1.4 Select desktop or mobile calendar structures in App without duplicating schedule state, and verify resize preserves selected date and open details.

## 2. Mobile Navigation and Forms

- [ ] 2.1 Add safe-area-aware bottom navigation and floating event-add action, and verify controls do not cover content at 320px and 390px.
- [ ] 2.2 Convert narrow-screen dialogs to scrollable full-screen/sheet layouts with reachable actions and 44px targets, and verify software-keyboard viewport behavior manually.
- [ ] 2.3 Reflow preparation reminders and route source notices for narrow screens, and verify no page-level horizontal overflow.

## 3. Authentication and Desktop Preservation

- [ ] 3.1 Use redirect auth for mobile/standalone and popup auth for desktop, and verify AuthProvider tests cover both selection paths and redirect results.
- [ ] 3.2 Preserve desktop month/week/day/sidebar behavior and verify 768px and 1440px screenshot or browser checks.

## 4. Automated Verification

- [ ] 4.1 Add Vitest/React Testing Library configuration and focused tests for responsive component selection and interactions, and verify the unit-test command passes.
- [ ] 4.2 Add Playwright smoke flows for 320px, 390px, 768px and 1440px, and verify navigation, add, detail and route-result flows without horizontal page overflow.
- [ ] 4.3 Run frontend tests, lint/build and backend tests, and update current specs/docs for the verified responsive behavior.

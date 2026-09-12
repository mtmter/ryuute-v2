## Context

The current CSS has one breakpoint at 720px, but calendar internals keep minimum widths of 840px and 980px. `App.jsx` renders the same calendar structures at every width, and the mobile header wraps into several rows. Desktop calendar height behavior is already tuned and should remain stable.

## Goals / Non-Goals

**Goals:**

- Provide purpose-built mobile calendar navigation without reducing desktop information density.
- Reuse event calculations and detail/add flows across layouts.
- Prevent page-level horizontal overflow at 320px and above.

**Non-Goals:**

- Drag-and-drop, swipe gestures or a new visual brand system.
- Duplicating data/state logic into separate desktop and mobile applications.

## Decisions

1. Use a `matchMedia('(max-width: 720px)')` hook to choose structural mobile components; CSS alone remains responsible for cosmetic breakpoints. This avoids keeping inaccessible off-screen desktop grids in the mobile DOM.
2. Keep desktop Month/Week/Day components. Add mobile month as a compact date-selector plus selected-day agenda; add mobile week as a seven-day selector feeding the existing one-day timeline behavior.
3. Change mobile month date selection from immediate event creation to selecting a day. Event creation uses the floating action button, removing accidental creates on touch.
4. Render mobile bottom navigation and floating add action only below the breakpoint. Include `env(safe-area-inset-bottom)` and reserve content padding so controls do not cover events.
5. Use full-height modal sheets on narrow screens with scrolling inside the sheet, sticky actions where needed, and minimum 44px interactive controls.
6. Detect standalone display and narrow/touch mobile conditions for Firebase redirect auth; keep popup on desktop. Consume redirect results during AuthProvider initialization.
7. Introduce automated component tests for viewport-selected structures and Playwright smoke flows at 320, 390, 768 and 1440 widths.

## Risks / Trade-offs

- [Structural breakpoint changes while a dialog is open] -> Preserve selected date/event in App state and let only the calendar shell swap.
- [Mobile agenda changes month date-click semantics] -> Specify and test the separate desktop and mobile interactions.
- [Redirect auth differs across hosting domains] -> Document Firebase authorized-domain requirements and retain desktop popup flow.
- [Large CSS remains hard to maintain] -> Group responsive shell rules and remove obsolete task styles before adding new selectors.

## Migration Plan

1. Add viewport hook and mobile calendar components behind the existing breakpoint.
2. Add bottom navigation, floating action and modal sheets.
3. Switch mobile rendering after browser tests pass; desktop component path remains rollback-safe.

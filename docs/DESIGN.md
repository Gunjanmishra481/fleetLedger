# FleetLedger design brief

Goal: log a trip in about 15 seconds on any screen: phone, tablet or PC, using touch, mouse or
keyboard. Nothing should look like a spreadsheet. Trailers, routes and trips are objects you tap
or click, not rows you type into. Keyboard shortcuts are a PC extra, never required.

## Layout (responsive, one design for every screen)
Fluid "auto layout": CSS grid with repeat(auto-fill, minmax(...)) for tile and card grids,
container queries (@container) so cards adapt to the space they get, clamp() for type and
spacing, flex-wrap for chip rows. No fixed pixel widths except max-widths. Content max width
1200px on large screens, centred. Never hide a feature at any size.

| Width            | Navigation                               | New trip                                                         | Trips                                                     | Summaries                       |
| <640px phone     | bottom tab bar, raised centre "+ Trip"   | 4 steps with progress bar, sticky receipt at bottom              | 1-column cards                                            | stacked KPI cards, swipeable    |
| 640–1023 tablet  | bottom bar portrait, icon rail landscape | one scrolling page, steps as sections, receipt docked at bottom  | 2-column card grid                                        | 2–3 KPI grid, charts full width |
| >=1024 laptop/PC | left rail with labels                    | two panes: form left, sticky live receipt + route preview right  | 3+ column cards or Table view toggle; filters side panel  | KPI row of 4–6, charts and lists side by side |
| >=1440 wide      | same                                     | same, centred                                                    | list + detail pane side by side                           | 12-column dashboard grid        |

Tabs: Home, Trips, + Trip, Fleet, More.
Inputs: tiles, chips, steppers and car icons work for touch and mouse (targets >= 44px, 8–12px
apart, visible hover and focus states). On PC the same pickers also accept typing to filter,
Enter confirms, shortcuts N (new trip) and / (search). Numbers use steppers or the numeric
keypad (inputmode="decimal"/"numeric"). Bottom sheets on phone become centred dialogs or side
panels at >=1024px. No hover-only actions.

## Visual language
- Warm off-white background, white cards with 16px radius and soft shadow, generous spacing.
- One brand colour: deep teal for actions. Green = profit, amber = warning, red = loss only.
- Tabular numerals for money. System font. Dark mode via Tailwind/shadcn tokens.
- Trailer numbers render as an Indian commercial number plate component: yellow background,
  black bold text, last 4 digits large (e.g. NL01AL 1658). Use it everywhere a trailer appears.
- Dates: "Today", "Yesterday", then "01 Sep". Money ₹1,23,456 and ₹63.20 L.
- Subtle motion only (150–200ms); respect prefers-reduced-motion.

## Screens
1. Home ("Today"): greeting + date; strip of plates showing on-trip vs idle today (tap/click
   an idle one -> new trip for that trailer); month KPI cards with sparklines (trips, cars,
   revenue, profit, margin, diesel); alerts card with one-tap fixes.
2. New trip (hero flow). Live receipt always visible: Freight − Cost = Profit, updating live.
   a) Trailer: grid of plate tiles with usual driver initials and "1 trip today". Picking a
      trailer also picks its driver (shown as a chip; tap to change).
   b) Route: "Recent routes" cards first (e.g. "OCPL Detroj → Ahmedabad · ₹15,871") for
      one-tap repeat; then loading-point chips and destination chips. Multiple destinations
      draw as a route line with numbered stops. Date chips: Today / Yesterday / Pick.
   c) Load: tap car icons 1–8 for count; LR pre-filled with an edit pencil; optional dealer chip.
   d) Check: pre-filled cost card (diesel stepper with a small gauge vs route standard, POD,
      allowance, maintenance) and one big "Looks right — Save" button.
   After save: sheet/dialog with "Same trailer again", "Same route, another trailer", "Done".
3. Trips: trip cards grouped by day; sticky day headers show trip count and profit. Card:
   plate, driver, route line, car icons, freight, profit pill, amber dot if flagged. Filter
   chips (trailer, driver, route, dealer, billing, flagged). Edit/Duplicate via a ⋯ button
   (swipe optional on touch). Table view toggle reusing the existing TanStack table, plus
   Excel export.
4. Trip detail: ticket-style card, big route line, cost receipt, billing status as a segmented
   control, audit history.
5. Fleet → Trailer page: plate hero, KPI cards, month calendar with trip days filled,
   destinations as a ranked bar list, drivers who ran it, trip feed.
6. Fleet → Driver page: initials avatar, call button, allowance earned and balance due as big
   numbers, trip-day calendar, trailers and routes driven.
7. Routes: cards per route sorted by profit (trips, freight, avg diesel vs standard, margin).
8. More: Masters and Import.
Installable: web app manifest + icons so it can be added to a phone/tablet home screen.

# Sous × NOVA

A local hackathon MVP for Maple Street Kitchen, a fictional restaurant. Built with Next.js App Router, TypeScript, Tailwind CSS, and an independent deterministic simulation engine. No account, database, or API key required.

## Run

Requires Node.js 20.9+ and npm.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. For production: `npm run build` then `npm start`.

This checkout uses Webpack with `next/babel` to avoid Windows sandbox path-canonicalization failures in the native SWC/Turbopack compiler. Builds use one worker and retain the local build cache for compatibility with this environment.

```sh
npm test
npm run typecheck
npm run build
```

## Three-minute demo

1. Click **New simulation**. The import screen says **Pulling from DoorDash** and uses the DoorDash symbol. This remains a local demonstration; no live DoorDash account is connected.
2. Enter only your kitchen station count and number of seats in the required **Tell us about your space** section. These are manual details, not DoorDash fields, and start blank. Zero seats means takeout only. Dining seats accept any whole number; tables are derived automatically. Then fill inventory, food cost, staff names/roles/shifts/pay and vendor/fixed costs, manually or by document upload. **Use demo assumptions** explicitly fills an editable example, including the manual layout.
3. **Ready to start?** separates DoorDash-provided volume/hours/menu from the layout and operating details **Entered by you**. Click **Looks good, continue** for day/time selection, or **Go back & correct something** to edit setup. The collapsed DoorDash-correction section contains only volume, hours and menu.
4. Watch My restaurant; cards show full-day outcomes while the floor replays minute-by-minute activity.
5. Open **Sous insights**, replay staffing experiments, and compare labor savings against fulfilled orders and profit. Inventory and roster choices can change which experiments are beneficial.
6. Use the **Staff**, **Hours**, **Menu**, and **Other** tabs in **Scenario lab** to edit role coverage, store/dining hours, individual prices and promotions, or event demand. Pay rates stay fixed from setup. **Run scenario** applies manual changes; **Ask Sous** tests staffing and menu prices, then applies the most profitable tested option automatically. Equally profitable options (to the cent) are ranked by shorter average wait. A separate shortest-wait alternative is available when it differs.
7. Export the order ledger as CSV or assumptions as configuration JSON in **Business data**. **New simulation / plan another day** returns to the start screen; browser reload also starts fresh.

## Model

All data is synthetic. Defaults are demo assumptions, not verified industry statistics or DoorDash data.

Seat count determines the layout and synthetic channel mix. Zero seats: 35% pickup / 65% DoorDash. Up to 80 seats: 60% dine-in / 15% pickup / 25% DoorDash. Above 80 seats: 75% dine-in / 10% pickup / 15% DoorDash. These are editable-demo assumptions, not industry benchmarks. There is no restaurant-type selector.

Drive-through proportionally reduces the other channels; its single handoff lane shares the kitchen and FOH pool. Actual sampled channel counts vary around the configured probabilities.

Seeded draws produce peaked arrivals, preparation complexity, channel, basket value, and patience. Most dining tables have four chairs; remaining seats form one smaller table. Parties of one to four arrive together and occupy separate tables, leaving unused chairs empty. Seat counts must be 0–2,000 as any whole number; 320 seats creates 80 tables and 2,000 creates 500. Legacy table-count overrides do not affect the derived layout.

Dining-room hours are separate from store hours. New dine-in arrivals stop outside the dining window and are redistributed among pickup, DoorDash and enabled drive-through. Already seated guests can finish their meals. New tables cannot be seated after dining closes. Tables remain reserved for cooking, service, a 28-minute meal, and bussing. A dedicated busser clears tables faster; flexible front staff and waiters can bus when needed. Walking distance affects service time on large floors.

**Staff** controls cooking, front-room and backroom totals, with multiple shift rows per group. Roles include cooking, general front service, waiting tables, bussing, cashier/pickup handoff, drive-through, prep, and dishwashing. General front staff can wait, bus and hand off orders; dedicated roles restrict task eligibility. Prep workers shorten cooking work, while dishwashers reduce the kitchen cleanup burden. Staff, stations and tables use resource calendars that prevent overlapping assignments, including future table-clearing jobs. Tasks must fit their assigned staff shifts. With no cooks or no eligible service staff, orders remain lost or unfinished rather than receiving phantom service.

**Hours** sets store opening and total hours (1–12, within a single calendar day), plus a separate dining window. Clock-time shifts are preserved and clipped when the store window changes; review staffing afterward. In new simulations, expected orders scale with store duration relative to imported hours. Legacy configurations without referenceHours keep their original fixed-order behavior.

**Menu** supports individual base-price overrides, a global percentage adjustment, item BOGO, and percentage discounts for orders above a minimum. Individual prices are adjusted by the global percentage. New runs generate one-, two- and three-portion same-item baskets (60% / 30% / 10%); an active BOGO creates two portions of its item. The largest eligible discount applies without stacking. Threshold eligibility uses the basket after price adjustment and before promotions. Free portions consume inventory, food cost and additional prep time. Ingredient vendor lines use prepared portions; packaging uses fulfilled takeaway orders.

Expected demand is orders × weekday/general modifier × holiday/event modifier × hours/referenceHours × max(0.2, 1 − 0.7 × effectivePriceChange/100). Effective price change is weighted by menu popularity and basket size, including eligible deals. Weekday defaults: Monday −20%, Tuesday −15%, Wednesday −10%, Thursday 0%, Friday +20%, Saturday +30%, Sunday +5%. **Other** adds holiday/event demand presets and sliders, and drive-through controls.

Only fulfilled orders earn revenue. Prepared food incurs cost even on lost/unfinished orders. Inventory is measured in portions. Staff pay rates remain fixed from setup, and payroll uses the overlap between each role shift and store hours. Additional hires use the fixed hiring rate. Daily costs are charged once, including when skipping ahead. Average and p90 times cover fulfilled orders; inspect losses and unfinished orders too.

## Ask Sous and customer happiness

**Ask Sous** searches cooks 1–12, front-of-house staff 1–12 and menu-price adjustments −20% to +30% in 5-point steps, including the exact current price change. A typical search evaluates 1,584 combinations. It preserves role proportions and shift windows while resizing cooking/front-room groups. Backroom assignments, store/dining hours, deals, individual base prices, external demand and capacity stay fixed. The current headcounts and price adjustment are included even when outside the default grid. Recorded pay rates are restored from baseline before either a manual or automatic scenario is run; additional hires use the existing fixed hiring rate. The solver runs in a Web Worker so the restaurant replay stays responsive. It skips expensive replay snapshots during search, then the winning configuration is applied and replayed normally.

Profit is the primary objective. Profit ties to the cent prefer lower fulfilled-order waiting time, then higher happiness and lower labor cost. **Prefer the shortest-wait alternative** selects the lowest-wait tested option that fulfills at least as many orders as the starting draft. It may earn less profit; the results card and comparison table show that tradeoff. Results are the best within this finite tested grid, not a claim of a global business optimum.

**Customer happiness** is a synthetic 1–5 rating for every arriving order, including lost and unfinished orders. For fulfilled orders, the uncapped score is `4.8 − 0.065 × max(0, waitMinutes − 8) − 0.025 × priceChangePercent`. Lost orders use `1.8 − 0.02 × delay − 0.01 × priceChangePercent`; unfinished orders use `2.5 − 0.025 × delay − 0.015 × priceChangePercent`. Each score is clamped to 1–5, and the headline rating averages all orders. These game assumptions are not imported review scores or calibrated research findings. Higher prices reduce perceived value and demand; discounts improve perceived value but may increase queues. The combined rating can therefore move differently from the direct price effect when service conditions change.

The happiness KPI and comparison table update after running or applying a scenario. The editor previews price-sensitive demand before running it. `src/lib/scenario-optimizer.ts` contains the pure search and pay-preservation logic; `src/lib/scenario-worker.ts` runs it off the main UI thread; `src/app/scenario-editor.tsx` owns progress, automatic application and alternative selection.

Recommendations rank four independently simulated experiments. No external LLM is integrated. The SVG floor renders every physical table, up to 500 tables / 2,000 seats; the room grows rows and columns around the input, including an 80-table, 320-seat room. **Fit** shows the whole width; **100%** enables detailed scrolling. Table IDs link occupancy to the actual seating queue. Staff, waiting guests and bags use bounded visual representations; chairs are schematic, with exact seat counts in table tooltips. Takeout shows pickup shelves and order collection, with no dining tables. All state resets on reload; export JSON to retain assumptions.

## Operations replay

The floor now uses persistent actor identities and deterministic journeys derived from order events. Chefs walk to their assigned stations, chop, plate and carry orders to the pass. Servers collect food, navigate dining aisles and hand off pickup orders. Dashers and pickup customers enter from the street, wait in individual collection spots, receive their bags and walk out. Dining parties enter together, wait without overlapping, walk to actual chairs, eat and leave. Overflow parties wait outside. A party of three at a four-seat table displays three guests; spare chairs remain empty for smaller groups.

The replay uses a fractional clock updated through requestAnimationFrame (about 30 visual updates per second), with one simulation minute per second at 1×. Pause freezes both travel and hand/leg actions; scrubbing reconstructs the same scene from the chosen timestamp. Click a character to see their name, task and order, and follow real simulation events in the **On the floor** feed. Furniture is memoized separately from moving actors so large rooms avoid rebuilding every table each frame.

`src/lib/operations-replay.ts` builds movement tracks with continuous endpoints, aisle routes, staff work phases and party-specific seat assignments. `floor-furniture.tsx`, `floor-actor.tsx` and `restaurant-floor.tsx` draw the environment, characters and activity overlay. The animated preview is rendered directly from those same components and timelines, not a separate animation mockup.

## Document extraction

Operating notes support text-based PDF (up to 30 pages), DOCX, TXT, Markdown, CSV and JSON, up to 8 MB per file. Text is extracted in the local Next.js server, not sent to a third-party AI or stored on disk. Image-only PDFs require OCR and prompt manual entry or another file instead. The demo uses deterministic labeled-field extraction, not general invoice understanding. Review all extracted values before continuing.

Drag one document into the upload area or use **Upload a document**. The area highlights while dragging. Add supplemental documents one at a time; matching supplier/item records are updated rather than duplicated.

## Suppliers and split costs

Vendors/costs supports simple daily totals or itemized suppliers. Each supplier line records a name, item/service, category, quantity, charging unit and a single unit price. There are no previous-price fields or historical comparisons. Business data shows actual costs for the simulated day. Fixed expenses such as rent and utilities can be split into named daily lines. Maple Paper Co. and US Foods examples use fictional prices.

Ingredient lines are charged per prepared portion and replace the food-cost percentage. Takeaway packaging is charged per fulfilled non-dine-in order. Daily services are added once to overhead; variable services are separate from food and overhead.

Uploaded text can include `Maple Paper Co. | Paper bag | packaging | takeawayOrder | 1 | 0.24` or `US Foods | Ingredient portion | ingredients | preparedOrder | 1 | 6.20`. The six columns are supplier, item, category, charging unit, quantity and unit price. Legacy seven-column documents are accepted with the extra column ignored. Fixed costs use `Fixed cost | Utilities | 22`. JSON supports optional `vendorItems` and `fixedCosts` arrays matching `src/lib/costs.ts`.

The imported menu's item prices and popularity determine generated baskets, rather than serving only as display values. The DoorDash symbol is taken from the header of the [official DoorDash company site](https://about.doordash.com/en-us/company).

Supported text labels are `Inventory: 240 portions`, `Food cost: 31%`, `Vendor costs per day: $85`, and `Other costs per day: $75`. Staff rows use `Alex, cook, 11:00, 21:00, $22` (commas, semicolons or pipes). Roles can be cook/chef, front/server/FOH, or back/backroom/dishwasher/prep. At least one cook and one front-of-house staff member are required. JSON uses `inventory`, `foodCost` (0–1), `vendorCost`, `otherCost`, and `staff: [{ name, role: "cook" | "front" | "back", start: 11, end: 21, pay: 22 }]`. Overnight shifts and item-by-item inventory are outside this demo.

## Structure

- `src/lib/simulation.ts`: typed configuration, presets, validation, seeded generator, queue scheduling, snapshots, experiments, CSV export.
- `src/lib/simulation.test.ts`: deterministic and accounting invariants, capacity bottlenecks, import validation, and happy/sad demo outcomes.
- `src/app/page.tsx`: four connected views and SVG operations replay.
- `src/app/onboarding.tsx`: start screen, demo import, operating questions and day planning.
- `src/lib/onboarding.ts`: document field extraction, validation, and day configuration.
- `src/app/api/scan/route.ts`: real local text extraction from uploaded files.
- `src/app/globals.css`: responsive interface, Tailwind import, animation, reduced-motion support.

This local app has not been published or connected to any live restaurant service.

## Verification

The automated suite covers deterministic replay, financial reconciliation, zero-seat takeout, four-chair layouts, parties of one to four, role eligibility, staff/station/table non-overlap, staggered shifts and payroll, dining-hour routing, store-hour changes, prep/dishwashing/bussing animation, individual/global prices, BOGO inventory, threshold discounts and non-stacking, event demand, and Ask Sous with detailed assignments. Run npm test, npm run typecheck and npm run build.

The detailed scheduler is in src/lib/advanced-operations.ts; staffing helpers in src/lib/staffing.ts; basket/deal pricing in src/lib/menu-pricing.ts; tabbed controls in src/app/scenario-tabs.tsx. Old JSON configurations without staffPlan retain the legacy queue scheduler until staffing or hours are edited.

## Drive-through and service quality

Drive-through vehicles use deterministic sedan, pickup-truck and SUV bodies in varied paint colors. They arrive, queue, collect orders and leave along the drive lane. Turning on the lane automatically adds a dedicated drive-through shift when backroom coverage is missing. Role-based scenarios require continuous backroom or drive-through coverage throughout store hours. Backroom workers share the same task calendar across prep, washing and drive service, so one person cannot perform overlapping jobs.

For completed orders, an active dishwasher adds 0.15 to modeled happiness; missing dishwashing subtracts 0.12. Dine-in customers gain 0.20 with a dedicated busser. Flexible front staff or waiters avoid a dedicated-bussing penalty, while missing all table-clearing support subtracts 0.20. The final rating stays within 1–5. Sales and price discounts affect perceived value through effective basket prices; extra demand can also increase waits and reduce happiness. These are explicit game assumptions, not measured customer ratings.

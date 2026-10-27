# NYALES Studio UI · 2026-10-19

Reference: user-supplied screenshots from the Modern CRM & Analytics Platform Behance project. Adapt the neutral composition, typography and surfaces to the NYALES teal identity. Do not introduce illustrated assets or decorative mockup content as product functions.

## Tokens and typography

Inter is bundled locally via @fontsource/inter, Latin weights 400/500/600. No Google Fonts request. Heading 34px desktop / 28px mobile, regular weight, tight tracking; card titles 18px; body 14px; secondary labels 10–12px. Financial figures retain tabular digits, compact units and exact-value disclosure.

| Token | Value | Use |
| --- | --- | --- |
| Canvas | #E7E9E8 | Workspace background |
| Surface | #F8F9F8 | Data cards |
| Ink | #242625 | Primary text, active navigation, primary actions |
| Muted | #626A67 | Secondary text |
| Teal | #0D9488 | Primary data and brand accent |
| Mint | #A7E8DC | Teal gradient and highlights |
| Line | #DFE3E1 | Neutral divisions |

Cards use 25px desktop / 22px mobile corners, 18px grid gaps, minimal shadows. Pills use full rounding. Warning/error statuses retain semantic differentiation. Channel series use teal–mint for field sales and slate–sage for telesales; labels retain channel names and percentages so color is not the sole distinction.

## Navigation

The left rail groups capability-filtered pages. The top pill navigation exposes pages in the selected group. Overview remains the initial page. Groups and pages with no capability are omitted using the existing capability checks. Backend authorization is unchanged.

- Analitik: Overview, Monitoring, Insentif.
- Pelanggan: Pelanggan, Distribusi sales, Peta customer.
- Penjualan: Target & pencapaian, Invoice & actual, Pipeline & order, Produk & harga, Status & tier.
- Aktivitas: Aktivitas lapangan, Telesales.
- Kelola: User & Hirarki, Pengaturan, Sesi perangkat, Import & duplikat, Kesehatan sistem.

The group buttons are 44px circles when inactive and expand into 124px pills with text when selected (40px / 112px on mobile). Width and label transition over 550ms; reduced-motion removes transitions. A reserved desktop gutter prevents expansion from shifting page content. Inactive groups expose accessible names and hover/keyboard-focus tooltips.

On mobile the group rail becomes a horizontally scrollable strip; page pills also scroll within their own container. Group icons retain visible labels. Page buttons expose aria-current. Demo disclosure remains available as an expandable summary; all existing detail text is retained.

## Selective glass

Use the user-supplied glass recipe on page pills, subpage tabs, the channel-contribution card, map controls, dialogs and the login card: white at 34% opacity, 9px backdrop blur, a 30% white border, external shadow plus top/bottom highlights and an inset white glow. Shared glass-card has thin top/left highlight gradients with pointer-events disabled. Keep each component responsive; do not inherit the example fixed 240px by 360px size or clip chart tooltips. The workspace background uses a fixed mint-to-gray radial gradient matching the login direction. Dialog backdrops blur the workspace. Main tables, financial values and form fields use solid surfaces. Browsers without backdrop-filter receive opaque neutral fallback surfaces. Reduced motion disables the new button transitions. The existing reduced-motion loader/map behavior remains intact.

## Implementation and validation

Base component geometry remains in src/client/styles.css. src/client/theme.css owns the new design tokens and shared surface/layout layer. SVG chart gradients and brand SVGs use the updated palette. No API, database migration, financial formula, quota rule or business permission was changed.

Local verification: npm run build; test-results/studio-ui.cjs navigates every capability-visible demo page, checks desktop/mobile overflow, verifies Inter, opens/closes an existing modal, captures Overview and Monitoring, and checks browser runtime errors. This validates the local UI; it is not production deployment or full business UAT.

## Sliding page indicator

Top page navigation uses the sliding motion supplied by the user (Uiverse.io / gleydson_9898): 550ms cubic-bezier(0.22,0.9,0.25,1), color feedback and a 0.97 pressed scale. Existing NYALES glass, charcoal selection and geometry stay in place. LiquidNav measures the selected button and animates one pointer-transparent indicator; ResizeObserver and local font readiness keep variable-width labels aligned after resizing. Group changes mount a fresh indicator. Buttons retain page navigation semantics and aria-current; reduced-motion removes movement and press scale.

The same shared indicator now wraps all 11 existing settings-tabs groups: Assignments, Catalog, Commercial, Customers, DataTools, Incentives, Monitoring, People, Settings, Transactions and Work. Existing tablist/group roles, selected/pressed states and callbacks are preserved. The indicator measures both x and y, so it follows wrapped mobile rows as well as horizontal tabs.

## Global pill motion contract

Every selectable pill group uses the same 550ms moving indicator: horizontal circle-to-pill expansion for sidebar groups, LiquidNav for workspace pages, LiquidTabs for all in-page groups and map 2D/3D. The sidebar retains its circle-to-label expansion. Primary/secondary action pills and icon actions share the 0.97 press feedback; disabled actions do not animate. Non-interactive status/scope badges remain static. Native select filters retain their native control behavior. All motion is disabled under prefers-reduced-motion. Map controls retain absolute positioning and fullscreen membership.

## Page entrance motion

The keyed page-scene groups visual-unit entrances on every page navigation. The shell and navigation remain stable. Titles, toolbars/filters, notices, cards in KPI/content/work grids, tables and map cards rise 18px (12px mobile) and fade in over 550ms using cubic-bezier(0.22,0.9,0.25,1). Stagger is bounded at 240ms. CSS mount animations also cover asynchronously loaded new cards; local tooltip rerenders do not replay them. Grids and individual table rows are not additionally animated, avoiding nested motion and large stagger queues. Backwards fill applies only before playback and leaves no permanent transform after completion. Fetching and interactions are not delayed. Reduced-motion removes page entrance animations entirely.

Sidebar correction: each group owns its own surface. On selection, the previous pill contracts horizontally to its icon circle and the destination expands horizontally to show its label. No shared slider moves vertically between groups. Both width transitions use the 550ms liquid easing. Desktop gutter stays fixed; mobile retains the same horizontal opening/closing behavior.

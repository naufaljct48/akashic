---
name: Akashic Dex
description: A weekly anthology periodical — tinted pulp under a halftone screen, one spot ink per view, hairline rules instead of card shells.
colors:
  paper: "#e4ddcd"
  paper-sheet: "#efe9dc"
  paper-deep: "#d3cab6"
  paper-plate: "#cfc6b2"
  ink: "#16130f"
  ink-soft: "#4c443a"
  ink-faint: "#665c4d"
  rule: "#b0a691"
  rule-strong: "#6f6555"
  ink-magenta: "#c1005c"
  ink-vermilion: "#c33800"
  ink-cyan: "#00688f"
  ink-green: "#0b6b45"
  ink-gold: "#7d5100"
  ink-blue: "#2f3f96"
  paper-night: "#14120e"
  paper-sheet-night: "#1d1a15"
  paper-deep-night: "#0c0a08"
  paper-plate-night: "#262119"
  ink-night: "#ece5d5"
  ink-soft-night: "#b0a793"
  ink-faint-night: "#8a8171"
  rule-night: "#3a352b"
  rule-strong-night: "#5c5344"
  ink-magenta-night: "#e04a86"
  ink-vermilion-night: "#d55a2a"
  ink-cyan-night: "#2b87ab"
  ink-green-night: "#2a8d61"
  ink-gold-night: "#a67a1f"
  ink-blue-night: "#6b79cf"
typography:
  masthead:
    fontFamily: "Anton, Plus Jakarta Sans, sans-serif"
    fontSize: "clamp(2.6rem, 10vw, 5.5rem)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "0.005em"
  headline:
    fontFamily: "Anton, Plus Jakarta Sans, sans-serif"
    fontSize: "clamp(1.15rem, 4.5vw, 1.55rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "0.005em"
  title:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  caption:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.375
  stamp:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "9px"
    fontWeight: 700
    letterSpacing: "0.11em"
    fontFeature: "'tnum' 1"
  # The closed set of steps. A literal size not on this list is drift, and the
  # detector says so — which is the point of enumerating it rather than
  # silencing the check.
  scale:
    stampSm: "9px"
    stampMd: "10px"
    stampLg: "11px"
    caption: "12px"
    entryTitle: "13px"
    bodySm: "14px"
    body: "15px"
    runningHead: "20px"
    runningHeadLg: "24px"
rounded:
  none: "0px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  gutter: "24px"
  column-gap: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    typography: "{typography.stamp}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.ink-soft}"
  button-spot:
    backgroundColor: "{colors.ink-magenta}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  button-secondary:
    backgroundColor: "{colors.paper-sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  badge:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.none}"
    typography: "{typography.stamp}"
    padding: "3px 6px"
  field-ruled:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 0"
  issue-strip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.stamp}"
    height: "26px"
  masthead-band:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    height: "52px"
---

# Design System: Akashic Dex

## Overview

**Creative North Star: "This Week's Issue"**

The product is printed, not rendered. Every decision derives from a cheap weekly anthology run off a fast press: tinted pulp stock that is never white, dense process ink, one spot color per section, and hairline rules doing the work that borders and card shells used to do. The reader lands mid-issue — masthead, issue line, editorial desk, then the running order — and leaves with a title.

The world is materially honest about its press. A halftone dot screen rides over the entire app on `body::after` (3px grid, 0.6px dots) so the ground never reads as a flat CSS colour field. The wordmark overprints itself: one ghost of the same word 1.5px off in the spot ink, sitting behind the black, the way plates land out of register. The press mark carries registration ticks. These are the material's own devices, used natively, not decoration bolted onto a dashboard.

Two editions, not a theme toggle. The day run is ink on pulp; the night run is the reverse press run — the paper becomes the ink and the six process colours are re-mixed to full strength for dark stock, each holding 4.5:1 or better against it. What this world refuses, explicitly and by name: the near-black grid of identical cover cards with one neon accent, the metric tile, the monospace "technical" costume, and the spinner. Where an old build had a magenta `#ff334b` accent hardcoded on every surface, nothing hardcodes an accent now.

**Key Characteristics:**
- Tinted pulp ground under a permanent halftone screen; no white, no pure black
- One spot ink per view, inherited and re-derived per element
- Zero radius everywhere; hierarchy from scale and rules, never from shells
- Anton for display at size, Plus Jakarta Sans for everything else, no monospace
- Tabular figures app-wide (`font-feature-settings: 'tnum' 1` on `body`)
- One authored entrance gesture: plates striking the sheet, staggered

## Colors

Two ground tones and six process inks, held identically in both editions; the frontmatter carries the day run as the primitive set and the night run under `-night` keys.

### Primary
- **Editorial Magenta** — the house spot. The default `--spot`, the discovery section's ink, and the finder's ink. It is what a rank numeral, a live rule, a caret and a selection are printed in when nothing else is specified.

### Secondary
The other five process inks. A view claims exactly one and never mixes: **Press Blue** (catalog), **Foil Gold** (bookmarks and every star rating), **Vermilion** (trending feed), **Cyan** (recent updates), **Green** (new releases, and the "still publishing" tag). Format badges also read as origin colour before they read as words: manhwa blue, manga vermilion, manhua gold.

### Neutral
- **Pulp Stock** (`--paper`): the canvas. Tinted, never white; the night run inverts it to near-black pulp.
- **Laid Sheet** (`--paper-sheet`): a sheet placed on the canvas — the inspector spread, the finder panel, small chrome buttons.
- **Gutter** (`--paper-deep`): recessed bands, scrollbar tracks, hover on a list row.
- **Bare Plate** (`--paper-plate`): what sits behind an image before it loads; also the shimmer ground.
- **Ink / Soft Ink / Faint Ink**: body copy, secondary copy, and credits. Faint ink is set to clear 4.9:1 on the pulp ground — it is the floor, not a decorative grey.
- **Hairline Rule / Heavy Rule** (`--rule`, `--rule-strong`): the printed rules that replace every card border.

### Derived
Three values are re-declared on `*` rather than on `:root`, so each element derives from the spot it actually inherited: `--spot-text` (spot mixed 76% toward ink — the reading-weight sibling, used for any spot-coloured text below display size), `--spot-wash` (12% — the only tint fill in the system), `--spot-rule` (55%). `--on-spot` is the paper value used for type sitting on a solid spot fill.

### Named Rules
**The One Spot Rule.** A section sets `--spot` once on its own container; every rule, mark, tab, badge and numeral inside it reads from that value. Nothing below the section container hardcodes an accent, and no view shows two spots at once.

**The Derived-Not-Declared Rule.** Never write a spot-tinted colour literally. Use `--spot-text` for small type, `--spot-wash` for a fill, `--spot-rule` for a tinted rule. A custom property resolves against the element that declares it, which is why these are declared on `*`.

**The No Palette Rule.** Components write `bg-[var(--paper)]`-style values only. A Tailwind palette colour breaks one of the two editions on contact.

## Typography

**Display Font:** Anton (self-hosted, latin + latin-ext, `font-display: swap`), falling back to Plus Jakarta Sans
**Body Font:** Plus Jakarta Sans (variable 200–800, upright and italic, self-hosted)
**Label Font:** Plus Jakarta Sans at 700 in tracked caps — this world's "small caps" credit voice

**Character:** Heavy condensed gothic used at size or not at all, against a neutral grotesque that carries every sentence. There is no third face and deliberately no monospace: monospace here would be a costume for "technical", and a periodical sets its labels in tiny tracked caps instead.

### Hierarchy

The ramp is a closed set of steps, not a range. A size not on this list is drift,
not a decision.

- **Masthead** (Anton 400, `clamp(2.6rem, 10vw, 5.5rem)`, 0.86): page one only, uppercase, overprinted with its own ghost.
- **Running head** (Anton 400, **20px** rising to **24px** at `sm`): the wordmark in the fixed bar on inner sections only. Page one drops it, because the masthead below already sets the name at issue scale.
- **Headline** (Anton 400, `clamp(1.15rem, 4.5vw, 1.55rem)`, 1.05): the entry spread's title. The empty-state line and the drawer head use the same voice at `text-2xl` / `text-lg`.
- **Title** (Plus Jakarta Sans 600, 1.25): entry titles in the contents list, clamped to two lines. Steps: **13px** (plate entries), **15px**, **16px** (`sm`).
- **Body** (Plus Jakarta Sans 400, ~1.6): standfirsts, synopses, and the spread's match rationale. Steps: **13px**, **14px**, **15px**. Measure capped at 62–68ch.
- **Caption** (Plus Jakarta Sans 400, **12px**, 1.375): the entry's blurb — the editor's one-line reason — clamped to two lines at max 27rem.
- **Stamp** (Plus Jakarta Sans 700, 0.11em, uppercase): section names, issue line, quota, credits, kbd hints, format tags. The whole label layer. Steps: **9px**, **10px**, **11px**. Nothing in the label layer goes below 9px.

### Named Rules
**The Three Voices Rule.** Anton, Plus Jakarta Sans, and Plus Jakarta Sans-as-stamp. No fourth face, no monospace anywhere in the product.

**The Anton-At-Size Rule.** The display face appears at masthead, numeral, or spread-title scale and nowhere else. Anton below ~18px is a label pretending to be display; use a stamp.

**The Named-Thing Rule.** A stamp label names something the issue actually publishes — a section, an issue number, a quota, a format, a source credit. It is not a category invented to sit above a title.

**The Tabular Rule.** Anything that lines up in a column — counts, scores, chapters, the rank — carries tabular figures. `body` sets `'tnum' 1` globally; `.figures` restates it where the element sets its own font.

## Layout

One centred measure of 1600px maximum, gutters of 14px rising to 24px at `sm`. The fixed head is 78px total, published as `--masthead-h`: a 52px masthead band over a 26px reversed issue strip printed white-on-ink. Every view sizes itself against `--view-h` (`calc(100dvh - var(--masthead-h))`, in dvh so mobile browser chrome cannot push a panel off screen) and scrolls its own main column, so the head and the issue line never leave.

The three views share one shape: a scrolling main column plus a side apparatus — the entry spread on the right at `lg`, the catalog's filter column on the left. Below `lg` the spread becomes a bottom sheet at 88vh and the filter column collapses behind a control strip.

The contents list is governed by a container query, not a viewport breakpoint: the `@container/toc` list runs one column and splits to two at `58rem` of available width, with a 40px column gap and the lead entry spanning both. This is what lets the same list sit correctly beside an open spread and full-bleed without one.

Vertical rhythm is small and print-tight: 12px between an entry's rows, 20px between page blocks, 32px before the folio. A running foot closes every view — publication, issue, section, extent — so a short view ends at the bottom of a page rather than in blank stock.

## Elevation & Depth

The system is flat. Depth is paper depth: a sheet tone shift (`--paper-sheet` over `--paper`), a rule, or a reversed band of solid ink. Nothing at rest carries a shadow, and no surface is lifted to signal interactivity.

Two shadow tokens exist and are used only where a surface genuinely floats above the sheet — the mobile bottom-sheet spread and the finder panel. Both are wide, soft and low-opacity, reading as a sheet lying on top of the stack rather than as a UI card.

### Shadow Vocabulary
- **Plate** (`--plate-shadow`, `0 10px 22px -14px rgba(22,19,15,0.55)` / `0 10px 24px -14px rgba(0,0,0,0.8)` at night): a plate resting on the sheet.
- **Lift** (`--lift-shadow`, `0 22px 48px -18px rgba(22,19,15,0.5)` / `0 24px 54px -18px rgba(0,0,0,0.85)` at night): an overlay sitting above the whole issue.

### Named Rules
**The Overlay-Only Shadow Rule.** A shadow is permitted on exactly one class of thing: a surface that overlaps the page (modal, bottom sheet). At `lg` the inspector docks and drops its shadow (`lg:shadow-none`). In-flow content never carries one.

**The Screen Rides On Top Rule.** The halftone lives on `body::after` at `z-index: 9999`, fixed and `pointer-events: none`. Painted under the app shell it is covered by the shell's own opaque ground and the material disappears; it must stay above everything.

## Shapes

Radius is zero. Not "near zero" — the built world contains no rounded corner anywhere; `rounded` has one step, `none`. Form comes from rules and reversals:

- **Hairline** (1px `--rule`): separates entries, list rows, and label heads from their content.
- **Ink rule** (2px `--ink`): closes a section head, underlines a ruled field, bounds the head band and the finder panel.
- **Marker rule** (3px): an active nav tab's underline in the spot; a section's opening rule.
- **Spot bar** (5px solid spot): the head of the editorial desk — the mark that says this field answers in sentences.
- **Reversal**: a selected numeral, a badge count, a submit button and the issue strip all knock type out of solid ink or solid spot instead of gaining a container.
- **Plates**: every cover is a hard 3/4 rectangle over `--paper-plate`, no crop softening, no border except a 1px inset outline in the spread.
- **Registration mark**: a 1px cross (`.reg-mark`) available where a press would align plates.

**The No Shell Rule.** If something must feel separate it gets a rule or a paper shift. Never a rounded box with a border and a shadow. A card shell is the topology this world was built to refuse; retinting one would not have changed it.

## Components

### Buttons
- **Shape:** square (0px), 1px border on every variant, `active:translate-y-px` — the ink setting under pressure.
- **Primary:** solid ink on paper; hover softens the fill to `--ink-soft`. Padding 8px 14px at md (`sm` 6px 10px, `lg` 10px 20px).
- **Spot:** solid `--spot` with `--on-spot` type. Used where an action belongs to the section's own ink (save, submit).
- **Secondary:** laid-sheet ground, hairline border that darkens to full ink on hover.
- **Ghost:** transparent, soft ink, gains a hairline border on hover.
- **Type:** every button is a stamp — 10–12px, 700, 0.11em, uppercase. Disabled drops to 25–40% opacity, no colour change.

### Badges
- **Style:** hairline border, square corners, tracked caps, transparent ground. 9px/3px 6px at sm.
- **Variants:** format tags print in their origin ink (manhwa blue, manga vermilion, manhua gold); status in green; `spot` in `--spot-text`; trope tags are neutral until hover, when border and type go to full ink.

### Containers
There are none. Content sits directly on the paper, separated by rules. The two exceptions are the finder panel and the docked spread, both `--paper-sheet` with a 2px ink or 1px hairline edge.

### Inputs
- **Style:** ruled, not boxed (`.field-ruled`) — a 2px ink rule under the field, transparent ground, no border on the other three sides.
- **Focus:** the rule takes the spot colour over 150ms. Caret is the spot. Global `:focus-visible` is a 2px spot outline at 2px offset.
- **Small fields** (chapter progress, reading status select) keep a hairline box because they are data cells in a spec table, not places a reader writes prose; focus moves the border to the spot. Native select chrome is stripped and redrawn as a 5px CSS chevron.
- **Range input:** `accent-color: var(--spot)`.

### Navigation
Section names, not icons, on desktop: stamp labels with a 3px bottom rule in that section's own ink when active, faint ink and transparent rule otherwise. Each tab sets its own `--spot` so the marker colour comes from the section rather than from a nav-level variable. On mobile the sections become a bottom rail with the same 3px rule flipped to the top edge, plus a right-side drawer that reads as the issue's contents page. Bookmark counts print as a reversed spot chip.

### The Plate Gallery (signature)
Covers are the catalog's real content, so the page is made of them: a keylined
cover grid on bare paper — 2 columns rising to 5, chosen by container width
rather than viewport so the catalog's narrower column reflows on its own.
Each entry is plate, title, the one-line reason it is here, then a credit line
sitting on the hairline that closes it. No card shell, no panel behind the
artwork, no numeral in the margin. Selection is a 2px spot keyline on the plate
plus the title in `--spot-text`; hover darkens the keyline to `--ink`.

### The Editorial Desk (signature)
One ruled field under a 5px solid spot bar, a stamp submit, and a printed control strip: format tabs as underlined stamps, a quota printed as a ration of 3px ink ticks rather than a metric tile, and standing prompts as a row of underlined links. While a query is out, the desk prints three press stations — retrieving, ranking, printing — cycling at 1.1s with 0.18s offsets between them. There is no spinner in this product; an indeterminate wait elsewhere uses the 2px press bar sweeping under the field.

### The Finder
The global quick search (⌘K) is an incumbent whose anatomy, behaviour and keyboard grammar are pinned by the user and out of scope for this system. Only its materials belong to this world: laid-sheet panel, 2px ink edge, hairline-ruled rows, `--spot-wash` on the active row with a solid spot tick at its left edge, a reversed ink footer for the key legend, and the press bar in place of a loading spinner. It pins its own `--spot` to magenta because it floats above all three sections.

### Motion
One authored entrance gesture and three working indicators, all disabled under `prefers-reduced-motion`.
- **Ink strike** (420ms `cubic-bezier(0.16, 1, 0.3, 1)`): an arriving row lands from a 3px/5px registration offset with 1.5px of blur clearing. Staggered 28ms per row, capped at the 14th, so the list prints rather than cascades.
- **Press stations** (1.1s, 0.18s offsets), **press bar** (1.1s sweep), **shimmer** (1.8s, over `--paper-plate`), **ink pulse** (2s) for a live marker.

**The One Gesture Rule.** Only arriving content animates on entrance. Nothing else on the page moves in, so the strike reads as the page's single gesture instead of decor.

## Do's and Don'ts

### Do:
- **Do** set `--spot` once, on a view's own container, and let everything inside inherit it.
- **Do** use `--spot-text` for any spot-coloured type below display size; full-strength spot on small text fails contrast on pulp.
- **Do** separate things with a rule (1px hairline, 2px ink) or a paper shift, and let scale carry hierarchy.
- **Do** write `bg-[var(--paper)]`-style values; both editions depend on it.
- **Do** keep authored classes inside `@layer components` — unlayered they outrank every Tailwind utility placed on the same element, silently.
- **Do** close every view with a folio, and let the issue number come from the ISO week rather than a typed constant.
- **Do** set counts, scores and ranks in tabular figures.
- **Do** replace any spinner with the press bar or the three stations.

### Don't:
- **Don't** add corner radius. The system has one radius step and it is 0.
- **Don't** wrap content in a bordered, shadowed box; that shell is the exact topology this world refuses.
- **Don't** put two spot colours in one view, or hardcode an accent below the view container.
- **Don't** introduce a fourth type face, and never monospace.
- **Don't** use pure white or pure black; the ground is tinted stock in both editions.
- **Don't** apply a shadow to in-flow content — shadows belong to overlapping surfaces only.
- **Don't** paint the halftone screen below the app shell; it must ride above at `z-index: 9999`.
- **Don't** print rank numerals on an unordered list; a numeral with no ranking behind it is decoration.

## Known Divergence

None outstanding. The rank numeral this section previously recorded — contracted
to read at plate height and shipping at ~0.73x — no longer exists: the user
chose the plate gallery over the ranked contents list, so the numeral, its
column and its lead-entry step were all removed rather than tuned. The direction
contract in `index.html` was revised in the same pass, because a contract that
refused a cover grid while the build shipped one would have been describing a
page nobody has.

---
name: PlanLife
description: A personal life plan drawn as an athlete's periodization sheet, with frosted sheets over a track-paper ground, navy ink, one band hue per focus cycle, and a floating navigation island.
colors:
  track-paper: "#EEF1F5"
  sheet: "#FFFFFF"
  sheet-shade: "rgb(17 26 37 / .045)"
  glass: "rgb(255 255 255 / .58)"
  glass-strong: "rgb(255 255 255 / .72)"
  glass-border: "rgb(255 255 255 / .75)"
  glass-edge: "rgb(17 26 37 / .09)"
  navy-ink: "#111A25"
  slate-ink: "#364352"
  graphite-muted: "#5F6B79"
  rule-line: "#DAE0E7"
  rule-line-strong: "#BFC8D2"
  mode-default: "#2563EB"
  band-vermilion: "#E0452B"
  band-blue: "#2563EB"
  band-violet: "#7445D8"
  band-green: "#0E9F6E"
  now-red: "#D92D20"
  ok-green: "#0B8A60"
  warn-amber: "#B26A00"
  danger-red: "#C8281C"
typography:
  headline:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0.005em"
  title:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.01em"
  numeral:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  body:
    fontFamily: "Barlow, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "Barlow, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.3
  scale-mark:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.02em"
rounded:
  band: "4px"
  s: "6px"
  m: "10px"
  float: "12px"
  panel: "14px"
  sheet: "18px"
  island: "20px"
  pill: "99px"
spacing:
  hair: "4px"
  xs: "8px"
  sm: "14px"
  md: "18px"
  lg: "24px"
  xl: "32px"
components:
  button-default:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.s}"
    padding: "0 14px"
    height: "36px"
  button-primary:
    backgroundColor: "{colors.navy-ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.s}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.slate-ink}"
    textColor: "{colors.sheet}"
  button-mode:
    backgroundColor: "{colors.mode-default}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.s}"
    padding: "0 14px"
    height: "36px"
  button-ghost:
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.s}"
    padding: "0 14px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.sheet-shade}"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.s}"
    padding: "0 12px"
    height: "38px"
  chip:
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "26px"
  panel:
    backgroundColor: "{colors.glass}"
    rounded: "{rounded.panel}"
    padding: "18px"
  strip-cell:
    backgroundColor: "{colors.sheet-shade}"
    height: "22px"
  nav-island:
    backgroundColor: "{colors.glass-strong}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.island}"
    padding: "6px"
  nav-island-item:
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.panel}"
    padding: "0 12px"
    height: "44px"
  nav-island-item-active:
    backgroundColor: "{colors.mode-default}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.panel}"
    padding: "0 16px 0 14px"
    height: "44px"
  drawer:
    backgroundColor: "{colors.glass-strong}"
    rounded: "{rounded.sheet}"
    width: "480px"
---

# Design System: PlanLife

## Overview

**Creative North Star: "The Periodization Sheet"**

PlanLife is drawn as a coach's training plan for one person's season. The ground is cool track paper, the ink is navy, and every focus cycle (Saúde, Inglês, Estudos, Finanças) owns one saturated band hue that paints its run of days. A day is a column of real time: a block's height is its exact duration, free time still ahead is hatched, and the current moment is a red line. The look is an operations sheet built for a desk at daytime, so it is dense, ruled and quiet. Color shows up as data and never as decoration.

The world comes from training charts, not SaaS dashboards. Panels are frosted sheets with hairline rules, laid over the paper ground. The glass is moderate: a soft blur over an ambient light, enough to give the sheets depth without hiding the ruling. Headings and numbers are set in a condensed face with tabular figures, the way a printed schedule would be. The shell takes on the season in two places. A faint light behind the glass is tinted by the active cycle's hue, and a floating glass island at the bottom center of the screen carries the navigation, with the current page shown as a pill in that hue.

Light is the default theme. Dark is opt-in from the island's theme toggle and swaps the neutrals and glass tints while keeping the band hues and the structure.

**Key Characteristics:**
- Cool track-paper ground under an ambient light tinted by `--mode`, frosted ruled sheets, navy ink.
- One saturated band hue per focus mode; the active one (`--mode`) colors the ambient light, the active island pill, the cycle ring, primary-mode actions, selection and focus.
- Navigation is a single floating glass island at bottom center; nothing sits in a side column.
- State is shown by line form, not hue: dashed means pending, solid means done, struck through means skipped.
- Duration-proportional geometry: block length equals real time, on both the day timeline and the six-week strip.
- Barlow for UI text, Barlow Condensed for headings, numerals and scale marks, with tabular figures everywhere.
- Moderate glass on containers and chrome only; controls, inputs and data bands stay opaque.

## Colors

A cool, low-chroma paper-and-ink neutral set and a translucent glass layer carry everything, and the saturated band hues are reserved for focus cycles and the data they color.

### Primary
- **Active Mode Band** (`mode-default`, runtime `--mode`): the hue of today's active focus cycle, set on the root at runtime from the cycle's mode color (neutral slate `#475569` when no cycle is active). It drives the ambient background light, the active island pill, the island cycle ring, the `btn--mode` action, chip defaults, free-time hatching, selection and the focus ring. Derived shades come from `color-mix` in oklab: mode-ink (78% with black, used for links and hover), mode-tint (10% over sheet, used for the selected list row), focus (70% into `#1D4ED8`).

### Secondary
- **Focus Band Hues** (`band-vermilion`, `band-blue`, `band-violet`, `band-green`): the seeded modes Saúde Física, Inglês, Estudos and Organização Financeira. They come from an 11-swatch picker palette (vermilion, orange, mustard, green, teal, blue, indigo, violet, magenta, rose, slate). A band hue fills strip cells, month bands, cycle runs, mode swatches and finance account runs, and tints timeline blocks that belong to that mode.

### Tertiary
- **Now Red** (`now-red`): only for the present moment. It marks the timeline now-line and dot, the strip now-marker, the today outline in the focus row, today's date number and today's column header. It never carries an error or a count.

### Neutral
- **Track Paper** (`track-paper`): the app ground. A fixed layer over it carries three soft radial lights (two tinted by `--mode` at 22% and 14%, one cool blue at 16%) so the glass has something to blur; it re-tints over .8s when the cycle changes. The topbar is a 55% translucent wash of the ground with a blur.
- **Glass / Glass Strong** (`glass`, `glass-strong`): the frosted fills. Glass (58% white) is for panels and the strip; Glass Strong (72% white) is for the island, the drawer and sticky week heads. In dark they become `rgb(22 31 42 / .55)` and `rgb(24 33 45 / .72)`.
- **Glass Border / Glass Edge** (`glass-border`, `glass-edge`): the light 1px rim around every frosted container, and the faint navy hairline used for panel-head dividers, the topbar bottom rule and island separators. In dark the rim drops to 9% white and the edge to 8% white.
- **Sheet** (`sheet`): opaque surface for inputs, default buttons, pressed segments and the QR tile.
- **Sheet Shade** (`sheet-shade`): a 4.5% navy veil (5% white in dark), so it reads correctly on glass. Empty strip cells, table headers, hover rows, ghost-button hover and track backgrounds.
- **Navy Ink** (`navy-ink`): body text, primary buttons, pressed day toggles, toasts, island tooltips, the lock icon tile.
- **Slate Ink** (`slate-ink`): secondary text, labels, idle island items, primary-button hover, routine segments in the time budget.
- **Graphite Muted** (`graphite-muted`): metadata, hour marks, week labels, the cycle-day line in the island, placeholders (at 85%).
- **Rule Line / Rule Line Strong** (`rule-line`, `rule-line-strong`): hairline dividers inside sheets (rows, tables, timeline, drawer head and foot); the strong rule marks control borders, week starts in the strip, and dashed pending blocks.

### Status
- **OK / Warn / Danger** (`ok-green`, `warn-amber`, `danger-red`): goal pace, accepted suggestions, the read-only banner (warn at 12% over glass), password strength, destructive actions and error toasts. In dark theme they lift to `#34C38F`, `#E6A23C`, `#F2645A`.

### Named Rules
**The Band Is the Data Rule.** A saturated hue appears only where it encodes a focus mode, an account type or a status. Chrome stays glass, paper and ink; the active cycle reaches the chrome only through the ambient light and the active island pill.

**The Island Carries the Season Rule.** The island is glass, never filled with a band hue. The active cycle shows in it as the solid `--mode` pill on the current page and as the cycle ring, so the island reads as frosted chrome holding one colored mark.

**The Now Is Red Rule.** Now Red marks the present moment and nothing else; errors use Danger.

## Typography

**Display Font:** Barlow Condensed (with Barlow, ui-sans-serif), weights 500/600/700
**Body Font:** Barlow (with ui-sans-serif, system-ui, Segoe UI), weights 400/500/600/700
**Label/Mono Font:** ui-monospace, Cascadia Mono, Consolas, used only for secrets and key inputs

**Character:** A grotesque and its condensed cut, as on a printed training schedule. Condensed type carries every heading and every number, and regular Barlow carries reading and controls. `font-variant-numeric: tabular-nums` is set on the body so figures line up in every column.

### Hierarchy
- **Headline** (600, 26px, 1.1, condensed): the topbar page title; vault detail and lock headings run 26 to 28px.
- **Section** (600, 20px to 22px, 1.2, condensed): section titles and the drawer head.
- **Title** (600, 17px to 18px, 1.2, condensed): panel heads, strip head, empty-state, goal and mode headings.
- **Numeral** (600, 15px to 22px, 1 to 1.2, condensed, tabular): money in tables (16px), budget totals (22px), run labels, goal numbers, month day numbers, the island cycle name (15px), TOTP codes (28px, tracked .12em).
- **Body** (400, 15px, 1.5): running text; suggestion detail caps at 68ch and empty-state copy at 52ch.
- **Label** (600, 13px): field labels, table headers at 12.5px, button and island item text at 14px, island tooltips at 12.5px.
- **Scale Mark** (500 to 600, 12px to 12.5px, condensed, tracked .02em): strip week and day labels, timeline hour marks, block times, status pills, chart text, the island's "dia N de M" line.

### Named Rules
**The Condensed Figures Rule.** Every number a user reads as a quantity, whether a date, time, duration, amount or count, is set in Barlow Condensed with tabular figures.

**The Guide Line Rule.** A page title is followed by a muted 13.5px guide line that names the span in view (date, ISO week, cycle, day N of M), never by a label above the title.

## Layout

A single centered column with navigation floating over it. The main column has a sticky 72px translucent topbar whose side padding aligns its content to the 1480px view column (minimum 32px), and a view capped at 1480px, padded 24px 32px 128px; the deep bottom padding keeps content clear of the island. Sections stack with a 24px gap. Inside the view, layout uses `split` grids: 1.25fr / min 340px by default, 2fr / min 320px for wide, and even halves. Forms use 14px gaps in 2- or 3-column grids. Panels use 14px 18px heads and 18px bodies, and lists inside panels separate rows with hairline top rules instead of gaps.

The island is fixed 18px above the bottom edge, horizontally centered, and never wider than the viewport minus 24px. Toasts stack at the bottom right, 96px up, so they clear the island's height. The drawer floats inset 10px from the top, right and bottom edges.

The rhythm is roughly 4 / 8 / 14 / 18 / 24 / 32px: 4px between strip rows and band segments, 8px between controls, 14px in form stacks, 18px inside panels, 24px between sections, 32px of page gutter.

Responsive behavior: at 1180px or less, splits and the settings grid collapse to one column. At 860px or less, the island drops to 10px from the bottom and shows icons only (brand, cycle chip, separators, status dot, labels and tooltips hidden; the active item keeps its mode fill without a label), the topbar becomes static, view padding drops to 16px with 96px at the bottom, and the strip and week grid scroll sideways at a 760px minimum width.

**The Real Duration Rule.** Wherever time is drawn, length is proportional to time: timeline blocks run at about 1.05px per minute with a 26px floor, strip days are equal fractions of six weeks, and finance account runs flex-grow by their share of the total.

## Elevation & Depth

Depth is moderate glass over ambient light. Panels and the strip are frosted sheets: Glass fill, a 1px light rim, `saturate(1.5) blur(18px)`, and a soft glass shadow with a 1px inner highlight on the top edge. Chrome floats one level higher with stronger blur: the topbar (blur 16px), the island (`saturate(1.8) blur(24px)`), the drawer (`saturate(1.6) blur(28px)`), banners (blur 14px), toasts (blur 16px) and sticky week heads (blur 12px). Inside a sheet the system stays flat and ruled; tone (sheet shade) and hairlines separate content, not further shadows.

### Shadow Vocabulary
- **Glass** (`box-shadow: 0 1px 0 rgb(255 255 255 / .6) inset, 0 1px 2px rgb(17 26 37 / .04), 0 12px 32px -18px rgb(17 26 37 / .22)`): panels and the strip at rest. Dark: `0 1px 0 rgb(255 255 255 / .05) inset, 0 12px 32px -16px rgb(0 0 0 / .55)`.
- **Island** (`box-shadow: 0 1px 0 rgb(255 255 255 / .5) inset, 0 2px 6px rgb(17 26 37 / .08), 0 18px 44px -14px rgb(17 26 37 / .38)`): the floating navigation only.
- **Active pill** (`box-shadow: 0 1px 0 rgb(255 255 255 / .28) inset, 0 4px 10px -4px rgb(17 26 37 / .35)`): the current page's mode pill in the island.
- **Lift** (`box-shadow: 0 1px 2px rgb(17 26 37 / .06), 0 8px 24px -12px rgb(17 26 37 / .18)`): a timeline block on hover.
- **Overlay** (`box-shadow: 0 2px 6px rgb(17 26 37 / .08), 0 24px 60px -20px rgb(17 26 37 / .35)`): the drawer and toasts.
- **Pressed tab** (`box-shadow: 0 1px 2px rgb(0 0 0 / .1)`): the selected segment in a segmented control.

### Named Rules
**The Frosted Sheet Rule.** At rest a container is a frosted sheet: glass fill, 1px light rim, 18px blur and the glass shadow, nothing more. Extra shadows respond to hover or overlay and never decorate.

**The Moderate Glass Rule.** Blur belongs to containers and chrome (panels, strip, topbar, island, drawer, banners, toasts, sticky heads). Buttons, inputs, toggles and data bands stay opaque, so text and runs never sit directly on a moving blur.

## Shapes

Corners are soft but practical, and they grow with the layer. Controls, timeline blocks and small tiles use 6px. Banners and toasts use 12px; tooltips use 8px. Panels, the strip, island items and the brand tile use 14px. The drawer sheet uses 18px and the island itself 20px (18px and 12px items on mobile). Data bands use 4px (strip run ends, finance runs, goal tracks, the today date tile) or 3px (month bands, cycle runs, mode swatches). Counts, chips, status pills and idea pills are fully rounded (99px). Legend dots and chip markers are near-square 2px marks, which echoes the strip cells. The recurring silhouette is the horizontal run: a band that starts and ends rounded and is square wherever it continues.

**The Run Rule.** A span of time or a share of a whole is drawn as a horizontal run. Its ends are rounded only where the span really starts or ends, and labels inside are clipped to the run's width with an ellipsis.

## Components

### Buttons
Solid, compact and unadorned.
- **Shape:** gently squared (6px), 36px tall, 14px side padding, Barlow 600 at 14px, 8px icon gap.
- **Default:** opaque sheet with a strong rule border and navy text; the border darkens to slate on hover.
- **Primary:** navy ink fill with white text; slate on hover. Use it for the page's main create action.
- **Mode:** the active band hue with white text; mode-ink on hover. Use it for actions tied to the current cycle.
- **Ghost:** transparent; sheet shade with a rule border on hover. Used for row actions.
- **Danger:** default button with danger text; danger border on hover; pushed to the left in the drawer foot.
- **States:** press nudges down 1px; disabled is 50% opacity; busy spins the icon. Small variant is 30px / 13px. Icon buttons are 32px square, muted, and gain a sheet-shade fill on hover.

### Chips
- **Style:** 26px pill, 13px 600 text, background is the band hue at 12% over sheet, text is the hue at 75% into ink, with a leading 8px near-square swatch of the full hue.
- **Status pills:** condensed 12.5px pills; accepted is ok at 14%, done is a solid ok fill, rejected is struck through.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** Glass over the ambient ground, with an 18px blur.
- **Shadow Strategy:** the glass shadow at rest (see Elevation).
- **Border:** 1px light glass rim; heads are separated by a glass-edge hairline, rows inside by rule lines.
- **Internal Padding:** 14px 18px head, 18px body; flush bodies hold tables and row lists.

### Inputs / Fields
- **Style:** 38px tall, 6px radius, strong rule border, opaque sheet fill; the label above is 13px 600 slate, the hint below is 12.5px muted.
- **Focus:** the border turns focus blue (mode mixed into `#1D4ED8`) and gets a 3px focus halo at 22%. Global focus-visible is a 2px focus outline offset 2px.
- **Toggles:** weekday toggles and segmented controls fill navy (days) or lift to an opaque sheet (segments) when pressed. Color swatches are 28px circles with a ring.

### Navigation (the island)
- **Shell:** one floating glass island, fixed at bottom center: Glass Strong fill, light rim, `saturate(1.8) blur(24px)`, 20px radius, 6px padding, 4px gaps, island shadow. It rises 16px and fades in over .6s on the expo-out ease on load.
- **Order:** brand mark (40px tile, a bar-chart glyph in ink), the current-cycle chip, a separator, eight nav items, a separator, the theme toggle, then the save-mode status dot. Separators are 1px glass-edge lines inset 8px.
- **Cycle chip:** 44px tall, 14px radius, mode at 10% over the glass (16% on hover). A 26px progress ring (3.5px stroke, track at 22% of the hue, round cap) shows day N of M, beside the condensed 15px cycle name and a 12px muted "dia N de M" line. It links to Ciclos. With no active cycle it reads "Sem ciclo hoje" with an empty slate ring.
- **Items:** icon-only, 44px tall, 14px radius, 20px icons, slate ink, 600 14px. Hover adds a 7% ink wash. The current page expands into a solid `--mode` pill with white text and its label revealed (width eases over .4s), with the active-pill shadow. Idle items show their name in a navy tooltip (12.5px, 8px radius) 10px above on hover or keyboard focus. A pending count sits as a small condensed badge on the item's corner and moves inline at 25% white when the item is active.
- **Tools:** the theme toggle is a 44px icon button with the same hover wash. The status dot is 8px, green when saving and amber when read-only.
- **Mobile (860px or less):** 10px from the bottom, 5px padding, 18px radius; only the eight items and the theme toggle remain, at 40px with 12px radius; no labels and no tooltips.

### Periodization Strip (signature)
Six weeks of days in a grid on a frosted sheet: a 64px label column plus 42 equal day columns. It has three band rows (Mês, Semana, Dias) and a clickable Foco summary row. Cells are 22px, sheet shade when empty, and filled with the band hue when a cycle covers the day. Runs round 4px at their true start and end and break at each week. A white condensed tag with a faint text shadow names the run and is clipped to its width. Week starts carry a strong rule. Today shows a 2px now-red outline in the summary row plus a now-red vertical marker placed at the exact time of day. On first render the bands paint left to right (a clip-path wipe, 12ms stagger), only when motion is allowed.

### Day Timeline
A 56px hour gutter and a ruled track (solid hour lines, dotted half hours). Blocks are positioned by their real start and end. Pending blocks are an 82% sheet with a dashed strong rule; mode blocks tint 6% with a 55% hue border; done blocks turn solid with a 16% tint and a check disc; skipped blocks drop to 55% opacity and are struck through; calendar events use Google blue; past-due pending blocks take a warn border. Free time still ahead is a 135-degree hatch in mode at 7% with a condensed "livre" duration label. The now-line is a 2px now-red rule with a 10px dot.

### Drawer
The edit surface for every entity: a floating sheet inset 10px from the top, right and bottom, up to 480px wide, 18px radius, Glass Strong with `saturate(1.6) blur(28px)`, overlay shadow, over a 22% near-black backdrop with a 3px blur. It slides in 24px and fades over .35s on the expo-out ease. It has a condensed 22px head with a close icon button, a 22px padded body, and a foot with danger on the left and actions on the right, both divided by rule lines.

### Banners and Toasts
Banners are 12px-radius glass strips (blur 14px) tinted by their status at 12% with a 30% status rim; the read-only banner uses warn. Toasts are 12px-radius navy at 88% with a 16px blur and the overlay shadow; ok toasts are solid navy and error toasts solid danger.

## Do's and Don'ts

### Do:
- **Do** color a surface with a band hue only when it represents a focus mode, account type or status (The Band Is the Data Rule).
- **Do** draw time and shares as horizontal runs whose length is proportional to the real quantity, with labels clipped to the run.
- **Do** show block state by line form: dashed for pending, solid for done, struck for skipped.
- **Do** set dates, times, durations and money in Barlow Condensed 600 with tabular figures.
- **Do** keep light as the default theme and make dark a token swap under `[data-theme="dark"]`, including the glass tokens.
- **Do** reserve Now Red (`#D92D20`) for the present moment.
- **Do** put any new entity editor in the floating drawer.
- **Do** build new containers from the glass tokens (`--glass`, `--glass-border`, `--glass-shadow`, `--blur`) at 14px radius, and keep controls inside them opaque.
- **Do** add new top-level destinations as icon-only island items with a tooltip label; keep the bottom padding of the view clear of the island.

### Don't:
- **Don't** add hero metrics or big-number cards; a total belongs in a panel-head sentence followed by its runs.
- **Don't** mark list items with colored side stripes; use a horizontal run or a near-square swatch.
- **Don't** stack extra shadows on sheets at rest beyond the glass shadow.
- **Don't** fill the island with a band hue; only the active item's pill is solid mode.
- **Don't** reintroduce a side rail or a second navigation bar; navigation lives in the island.
- **Don't** put blur behind buttons, inputs or data bands.
- **Don't** hatch free time that is already past.
- **Don't** put a small label above page or panel titles; context goes in the guide line below the title.

## 2.0 — Layout em blocos

- **Grade bento** (`.bento`, 12 colunas, gap 16px): telas montadas com blocos (`.tile`, raio 18px, vidro) de larguras `span-3/4/5/7/8/12`. Abaixo de 1180px os blocos pequenos dobram para meia largura; abaixo de 860px tudo vira uma coluna.
- **Hierarquia do bloco:** título pequeno (Barlow 600, 15px, cor ink-2, com ícone) e o conteúdo principal grande (Barlow Condensed 24–40px). O número ou estado mais importante de cada bloco é o maior elemento dele.
- **Hoje:** Agora (bloco atual com barra de tempo restante e "Marcar como feito"), Ritmo do dia (anel de blocos feitos + tempo livre), Ciclo de foco (microciclo em segmentos, um por dia do ciclo), Temporada (faixa de periodização de 5 semanas), O dia (linha do tempo com altura fixa) e Sugestões (no máximo 3, com link para o Assistente).
- **Abas** (`.tabs`): telas longas foram divididas. Rotina: Semana | Todos os blocos. Ciclos: Calendário | Ciclos | Modos de foco. A aba escolhida é lembrada na sessão.
- **Ilha:** ampliação por proximidade (ícone sob o ponteiro 1.24×, vizinhos 1.10× e 1.04×), mecânica adaptada do componente Dock Nav da 21st.dev.
- **Movimento:** os blocos entram escalonados a cada troca de tela (45ms entre blocos); anéis e barras se preenchem ao aparecer. Tudo desligado com `prefers-reduced-motion`.
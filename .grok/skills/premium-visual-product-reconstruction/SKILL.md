---
name: premium-visual-product-reconstruction
description: >
  Reconstruct product UI from approved mockups, screenshots, or Figma to visual-match
  quality while preserving live data and domain logic. Use when the user provides
  reference images, asks for Fletcher/showroom reconstruction, screenshot-diff loops,
  visual-match PASS/BLOCK, or runs /premium-visual-product-reconstruction.
---

# Premium Visual Product Reconstruction

## Purpose

Use this skill when implementing or redesigning an application from one or more visual references such as:

- product mockups
- screenshots
- Figma exports
- generated UI concepts
- competitor references
- design boards
- cinematic product concepts

The objective is to reproduce the **visual experience, composition, hierarchy, dimensionality, density, and interaction quality** of the approved reference while preserving the application's real data, functionality, security, and domain invariants.

This is not generic frontend development.

This is **visual reconstruction of a product interface**.

---

## Core Principle

When a visual reference has been explicitly approved, treat it as the visual authority.

The implementation should answer two separate questions:

```text
WHAT SHOULD IT LOOK LIKE?
→ approved reference

WHAT SHOULD IT ACTUALLY DO / DISPLAY?
→ production application
```

Therefore:

```text
REFERENCE
controls:
layout
composition
visual hierarchy
scale
spacing
color
depth
lighting
motion
component proportions
information density

APPLICATION
controls:
real values
real assets
state
permissions
security
transactions
API behavior
availability
business rules
error behavior
```

Never sacrifice application truth to match fabricated mockup content.

Never sacrifice visual fidelity merely because existing code is functional.

---

# 1. Classify the Task First

Before changing code, determine which task is being requested:

### A. Visual refinement

Existing architecture and composition are correct.

Examples:

```text
spacing
typography
colors
hover states
shadows
border radius
```

### B. Composition redesign

Underlying functionality is correct but page structure is wrong.

Examples:

```text
current:
title
table
cards

target:
cinematic hero
metrics
filters
market table
right rail
```

Requires structural JSX changes.

### C. Full presentation-layer reconstruction

Approved reference substantially differs from the existing application.

Requires:

```text
new shell
new page composition
new reusable presentation components
new responsive layout
new design tokens
new visual depth system
new interaction system
```

while preserving domain logic.

Do not treat B or C as A.

This is one of the most common implementation failures.

---

# 2. Establish Source-of-Truth Hierarchy

Before coding, explicitly establish:

```text
1. SECURITY / CORRECTNESS INVARIANTS
2. PRODUCTION DOMAIN LOGIC
3. LIVE DATA
4. APPROVED VISUAL REFERENCE
5. EXISTING PRESENTATION CODE
```

Existing UI code has the **lowest authority** during a redesign.

A common failure is preserving poor existing layout simply because replacing it requires more work.

Do not do that.

---

# 3. Perform a Visual Decomposition

Do not start coding immediately.

Analyze the reference into layers.

For every approved page determine:

### Macro composition

```text
header
hero
metrics
navigation/filter layer
primary content
secondary rail
footer
```

### Spatial proportions

Estimate:

```text
page width
hero height
column ratios
card width
rail width
vertical rhythm
section spacing
```

### Typography

Identify:

```text
hero scale
page title scale
section heading scale
body
labels
numerals
tracking
line height
weight
```

### Depth

Determine visual Z layers:

```text
background atmosphere
environmental photography
foreground objects
glass panels
cards
controls
floating effects
```

### Surface grammar

Identify:

```text
background colors
surface opacity
borders
blur
shadow
glow
radius
highlight
hover depth
```

### Density

Ask:

```text
Is this sparse?
Is it dashboard dense?
How many items appear per row?
How much data exists within one card?
```

### Motion

Identify likely motion behavior even if screenshot is static:

```text
hover lift
parallax
scroll reveal
metric transitions
button micro-motion
drawer motion
tab transitions
image zoom
```

Write this decomposition before implementation.

---

# 4. Visual Difference Analysis

If redesigning an existing interface, compare:

```text
CURRENT UI
vs
TARGET UI
```

Do not merely describe both.

Create a difference list:

```text
Current hero: 360px
Target hero: ~560px

Current cards: flat dark surfaces
Target cards: translucent layered panels with internal lighting

Current grid: 6 narrow cards
Target grid: 4–5 larger collectible cards

Current typography: conventional SaaS sizing
Target typography: extreme display/body contrast

Current atmosphere: flat #050908
Target: photographic world + vignette + green volumetric illumination
```

This becomes the actual implementation backlog.

---

# 5. Do Not Confuse Color with Design

A UI does not match a reference merely because both use:

```text
black
green
rounded corners
```

Visual fidelity requires matching:

```text
composition
scale
density
depth
hierarchy
proportion
lighting
motion
material treatment
```

Reject implementations that achieve only color similarity.

---

# 6. Build Depth Systems

Premium interfaces usually contain multiple layers.

At minimum consider:

```text
Z0 base background
Z1 atmospheric/background imagery
Z2 environmental objects
Z3 content glass
Z4 cards
Z5 controls
Z6 transient UI
```

Example:

```text
forest / mineral environment
        ↓
large collectible photography
        ↓
dark translucent interface
        ↓
live NFT cards
        ↓
green interactive states
```

If every component sits directly on one black background, the design will feel flat regardless of polish.

---

# 7. Cinematic Hero System

For premium hero sections, prefer layered composition rather than one darkened image.

A useful architecture:

```tsx
<HeroScene>
  <HeroBackground />
  <AtmosphericLight />
  <HeroObjects />
  <HeroForeground />
  <HeroContent />
  <HeroMetrics />
</HeroScene>
```

Avoid:

```css
background:
  linear-gradient(rgba(0,0,0,.8),rgba(0,0,0,.8)),
  url(...);
```

when it destroys the underlying art.

Instead darken selectively where readability requires it.

Use:

```text
radial gradients
directional gradients
masks
vignettes
localized blur
fog layers
edge illumination
```

The image should remain visually alive.

---

# 8. Use Real UI, Not Screenshot Backgrounds

Never implement a mockup by placing the full screenshot behind transparent click targets.

Every functional element must be real:

```text
buttons
inputs
filters
tables
cards
charts
wallet controls
navigation
tabs
```

Brand/environmental artwork may be used as image layers.

Product functionality must remain responsive DOM UI.

---

# 9. Canonical Media vs Brand Media

Separate:

```text
CANONICAL PRODUCT MEDIA

from

BRAND / ENVIRONMENTAL MEDIA
```

For an NFT marketplace:

```text
canonical NFT image
→ tokenURI / authoritative asset source

cinematic environment
→ approved brand artwork
```

Brand imagery may surround or frame the NFT.

Never silently replace owned/product media with promotional imagery.

---

# 10. Build a Material System

Create reusable surface types rather than manually styling each route.

Example:

```text
Surface 0
base environment

Surface 1
transparent floating shell

Surface 2
glass panel

Surface 3
interactive card

Surface 4
selected / active card
```

Possible variables:

```css
--surface-base
--surface-glass
--surface-glass-strong

--border-subtle
--border-active

--glow-soft
--glow-active

--shadow-elevation-1
--shadow-elevation-2
--shadow-elevation-3
```

Create utility classes/components such as:

```text
GlassPanel
MetricTile
GlowCard
HeroSurface
InsetPanel
```

Avoid route-specific styling duplication.

---

# 11. Premium Glass Requirements

Glass should not simply mean:

```css
background: rgba(...);
backdrop-filter: blur(...);
```

Good glass generally combines:

```text
semi-transparent background
inner highlight
edge border
background blur
subtle saturation
external shadow
localized illumination
```

Example characteristics:

```text
dark green-black tint
1px semi-transparent border
subtle top inner highlight
strong black depth shadow
very subtle green illumination
```

Glow should communicate:

```text
brand
focus
selection
live state
interaction
```

not decorate everything.

---

# 12. Typography as Composition

Typography should contribute to visual architecture.

Premium interfaces often rely on scale contrast:

```text
tiny tracked eyebrow
↓
massive display heading
↓
medium descriptive copy
↓
small dense financial labels
```

Do not be afraid of large display sizes.

Example desktop:

```text
hero      56–80px
page      42–60px
section   24–32px
metric    22–38px
body      14–18px
eyebrow   10–12px
```

For display headlines:

```text
line-height: ~0.95–1.05
```

Financial numerals should use consistent tabular/numeral formatting.

---

# 13. Information Density

A premium market interface should not necessarily maximize items per viewport.

Determine whether the visual reference prioritizes:

```text
information density
or
object presence
```

For collectible marketplaces, larger cards can often outperform ultra-dense grids.

Never assume:

```text
more cards above fold = better
```

Use reference proportions.

---

# 14. Motion System

Motion should create perceived quality without compromising performance.

Support:

### Hover

```text
lift
image scale
border illumination
action reveal
icon translation
```

### Enter

```text
staggered cards
section fade/slide
metric reveal
```

### Navigation

```text
shared underline
tab layout animation
drawer movement
```

### Ambient

```text
slow hero parallax
fog drift
light drift
```

Respect:

```text
prefers-reduced-motion
```

Do not animate financial state changes in ways that obscure truth.

---

# 15. Package Guidance

Use packages to solve real problems, not as substitutes for art direction.

Typical stack:

```text
Motion
Radix UI
class-variance-authority
Embla
lightweight-charts
Sonner
react-use-measure
```

Optional cinematic use:

```text
three
@react-three/fiber
@react-three/drei
```

Use WebGL only when it materially improves a key hero/product experience.

Do not make ordinary cards WebGL.

---

# 16. Design Tokens Before Page Hacks

Before implementing several routes, create:

```text
color tokens
spacing scale
radius scale
shadow scale
glass scale
glow scale
typography scale
animation timings
content widths
```

The goal is for later pages to become composition work rather than reinvention.

---

# 17. Component System Before Multiple Routes

After one canonical page is visually correct, extract its grammar.

Example:

```text
AppHeader
CinematicHero
HeroMetric
GlassPanel
AssetCard
FilterBar
SegmentedControl
MarketTable
PaymentAssetIcon
StatusBadge
RightRail
```

Then reuse these across pages.

Do not abstract prematurely before the visual grammar is proven.

---

# 18. One Canonical Screen First

For major redesigns:

> Do not redesign ten pages simultaneously.

Pick the most representative page.

Examples:

```text
marketplace → market page
finance app → dashboard
commerce → product detail
```

Make that page excellent.

Then extract the system.

Only then expand.

This prevents the same wrong design assumptions from multiplying across the product.

---

# 19. Live Data Replacement Rule

Mockups may contain fictional data.

Preserve:

```text
location
hierarchy
component type
format
density
```

Replace:

```text
price
count
asset
owner
date
volume
supply
status
```

with real data.

If real data does not exist:

```text
hide
show unavailable
show partial
show skeleton
```

Never fabricate.

---

# 20. Unsupported Functionality

Visual references may include features that are not implemented.

Examples:

```text
charts
sweeps
native listing
bulk listing
advanced payment methods
profile verification
```

Do not make fake interactive controls.

Choose:

```text
A. implement if in task scope

B. show truthful disabled/coming state

C. omit
```

---

# 21. Responsive Reconstruction

Do not simply shrink the desktop reference.

For each route identify:

```text
primary user task
essential state
primary CTA
critical warning/status
```

Then reconstruct for:

```text
390
768
1024
1440
1728
```

Desktop right rails commonly become stacked sections.

Wide metric bars may become horizontally scrollable or reorganized grids.

The hierarchy must survive.

---

# 22. Visual QA Is Mandatory

Implementation is incomplete without screenshot review.

For every major route:

1. render at target viewport;
2. capture screenshot;
3. place beside approved reference;
4. compare visually;
5. identify the largest five differences;
6. correct;
7. repeat.

Never rely solely on source-code review.

---

# 23. Visual Match Rubric

Score 0–100.

### Composition: 25

```text
section placement
proportions
hero structure
rails
grid
```

### Depth / atmosphere: 20

```text
photography
layering
glass
light
shadow
```

### Typography: 15

```text
scale
hierarchy
weight
line height
```

### Components: 15

```text
buttons
cards
metrics
filters
tables
```

### Spacing / density: 10

### Iconography: 5

### Motion: 5

### Responsive fidelity: 5

Passing target:

```text
85 minimum
90 target
```

If below threshold, do not continue to the next major route.

---

# 24. Failure Patterns

Reject these outcomes.

### “Same colors”

```text
black + green != visual match
```

### “Same rough layout”

The reference has:

```text
cinematic hero
metrics
dense filters
large cards
```

while implementation has:

```text
heading
small hero
pills
grid
```

This is not acceptable.

### Flat UI

Everything on one depth layer.

### Over-darkened imagery

Photography becomes unrecognizable.

### Tiny typography

Premium display reference becomes SaaS dashboard typography.

### Excessive empty black space

Reference uses environmental and informational density.

### Too many tiny cards

Visual weight differs significantly.

### Fake data to match screenshot

Never acceptable.

### Screenshot as background

Never acceptable.

### New business logic inside visual components

Never acceptable.

---

# 25. Correctness Regression

After redesign, verify that UI visual changes did not alter:

```text
identities
amounts
prices
order IDs
wallet permissions
network requirements
API mutations
transaction preparation
receipts
errors
```

For financial/commerce apps, screenshot fidelity never outranks transaction correctness.

---

# 26. Delivery Format

For each route return:

```text
ROUTE
/reference

REFERENCE
<image filename>

IMPLEMENTED
yes/no

SCREENSHOTS
390
768
1440
1728

VISUAL SCORE
xx/100

TOP DIFFERENCES REMAINING
1.
2.
3.

FUNCTIONAL REGRESSION
PASS/BLOCK

VISUAL MATCH
PASS/BLOCK
```

---

# 27. Completion Definition

The redesign is complete only when:

```text
visual target is recognizable immediately
data remains real
all controls are functional/truthful
responsive behavior is deliberate
domain behavior is unchanged
accessibility remains acceptable
performance remains acceptable
visual-match gate passes
```

A user should not have to be told:

> “It's based on the reference.”

They should see it.

---

# Agent Quick Instruction

When this skill is invoked, begin with:

> I will treat the approved reference as the visual target and the existing application as the behavioral/data authority. I will first decompose the visual system, compare it to the current implementation, rebuild one canonical screen to visual-match quality, validate it with screenshots, and only then propagate the proven visual grammar across remaining routes.

---

## Recommended Invocation Pattern

Provide three inputs whenever you invoke this skill:

```text
REFERENCE IMAGES
the approved final visual target

CURRENT SCREENSHOT
what the app looks like now

REPO / ROUTE
the implementation to modify
```

Example:

```text
Use the Premium Visual Product Reconstruction skill.

Reference:
/references/netvision-market-v2.png

Current:
/evidence/market-current.png

Route:
/market

Reproduce the reference to visual-match quality while preserving live application data and commerce invariants.

Do not proceed to another route until MARKET VISUAL MATCH PASS.
```

The critical procedural improvement is forcing the agent into a loop of:

```text
reference
→ implementation
→ screenshot
→ difference analysis
→ correction
```

That loop is mandatory.

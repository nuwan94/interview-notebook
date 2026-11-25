---
name: refactor-lesson
description: Rewrite an Interview Notebook lesson (content/lessons/*.md) and its demo so a human understands it on one read. Use when asked to review, simplify, refactor or "make readable" a lesson, or to improve a lesson's demo or diagram.
---

# Refactor a lesson into plain language

The notebook is an interview guidebook. Every lesson must be simple and explainable after one read.
"Maybe AI can understand it but humans cannot" is the failure to fix.

## Writing rules

- One idea per sentence. Every sentence ends properly: no half sentences and no "X: a, b; c" shorthand.
- Use complete sentences in table cells and bullet points too.
- Explain a term where it first appears. Examples: interning, surrogate pair, charset, defensive copy, O(n²).
- Prefer short, common words. Cut filler and stacked clauses.
- Interview answers follow the same order every time:
  1. A direct answer first ("Yes.", "No.", "One or two.").
  2. Then the reason, as numbered or bulleted points when there are several.
  3. Then a short example.
- **"One sentence to remember" is ONE short, simple sentence.** Never two or three, and never a list.
  Example: *A `String` never changes, so compare it with `equals` and build long text with `StringBuilder`.*
- Banking and general examples only.

## Keep these intact

- Every fact and every code sample (fix a code sample only when it is wrong).
- Every section anchor `## Title {#id}` and every question id `### [level] text {#id}`, so links, search and quizzes keep working.
  After the rewrite, compare the anchors with `git show HEAD:<file>` and make sure the list is identical.
- Front matter fields. Set `updated:` to today's date.
- Links in the forms `[text](lesson:slug#anchor)` and `[text](lab:slug)`, and the ```` ```demo name: X``` ```` blocks.

## Demo and diagram rules

Demos live in `src/components/demos/`. Scene data is in `*Scenes.js`, the player is `DesignWalk.jsx`.

- Draw the real mechanism, not one labelled circle. Example: the string pool scene uses `stage: 'pool'` (`PoolStage.jsx`).
  It shows the stack variables, the heap, the pool as a region holding several literals, `new` objects outside it, and arrows.
- Show the current code line and the result (true or false, with a short reason) on each step.
- Highlight the items a step talks about and dim the rest.
- Arrows must not cross other cards. Reorder items or route the arrow around them, for example entering a card from below.
- Arrowheads are a fixed size (`markerUnits="userSpaceOnUse"`), so they do not grow with the line width.
  The line stops one head-length before the card, so the tip just touches the card edge.
- Keep every arrow inside its panel. Make the picture taller if a route needs the room.
- Step notes follow the writing rules above.
- Keep the icon graph (`GraphStage`) where boxes and arrows between parts is the real mechanism (services calling each other,
  a pipeline). Build a custom stage where the idea is about structure, memory, data or time (stack and heap, a token's
  parts, a table before and after, a timeline of requests).

### How to add a custom stage

- A scene sets `stage: MyStage` (a component imported into the `*Scenes.js` file) and its own frame shape.
  `Walk` in `DesignWalk.jsx` renders it with props `{ frames, index, label, reduced }`. Do not edit `DesignWalk.jsx` for this.
- Put the component in `src/components/demos/<Name>Stage.jsx` and its CSS in `src/components/demos/<Name>Stage.css`,
  imported from the component. Use the colour tokens (`var(--color-ok)`, `--color-bad`, `--color-warn`, `--color-pen` and
  their `-soft` variants). Prefix every class with the stage name so nothing clashes.
- Reuse the existing animation classes: `g-pop` for a new item and `g-edge is-new` with `g-edge-line` and `pathLength="1"`
  for a new arrow.
- Use an SVG `viewBox` so it scales. Keep text at least 11 units high and inside its box.
- `PoolStage.jsx` is the reference example.

## Shared files

Several people (or agents) may refactor lessons at the same time. Keep to your own lesson files, scene files and new stage files.
Do not edit `DesignWalk.jsx`, `GraphStage.jsx`, `graphLayout.js`, `icons.jsx`, `src/styles.css`, quizzes, labs or
`content/glossary.json`. If one of them truly needs a change, describe it in the report instead.

## Workflow

1. Rewrite one lesson, or the batch the user chose, in the user's order. Ask when the scope is unclear.
2. Check it in the browser pane. Load the site root first, wait about 3 s, then set `location.hash` to `#/lessons/<slug>`.
   For a demo, pause it and step through every frame, then take a screenshot.
3. Run `pnpm build` (and `pnpm check:labs` if labs changed).
4. Show the result and wait for the user's review before starting the next lesson.
5. Commit only when the user asks, one lesson per commit, following CLAUDE.md.
   Examples: `refactor: rewrite strings lesson in plain language`, `feat: draw the string pool as variables, heap and pool in the strings demo`.

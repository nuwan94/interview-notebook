# Interview Notebook

A static, ruled-notebook-style site for interview prep notes: one lesson per topic, each with replayable
animations, a glossary tooltip on every non-obvious word, interview questions with sample answers, search,
resizable text and read-aloud with word-by-word highlighting.

Stack: React 19 · Vite · Tailwind CSS v4 · Markdown lessons · pnpm.

## Run it

```bash
pnpm install
```

```bash
pnpm dev
```

```bash
pnpm build
```

`pnpm build` writes the static site to `dist/`.

## Share links

Routing uses the URL hash, so every lesson, section and question has its own link and deep links keep working on
GitHub Pages (which cannot rewrite unknown paths):

| What | URL |
| --- | --- |
| Lesson | `https://<user>.github.io/<repo>/#/lessons/java-hashmap` |
| Section | `…/#/lessons/java-hashmap/resize` |
| One question | `…/#/lessons/java-hashmap/q-treeify-q` |
| Glossary term | `…/#/glossary/load-factor` |

Every section and question has a 🔗 button that copies its link.

## Deploy to GitHub Pages

1. Push this folder as the root of a GitHub repository (branch `main`).
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml` (pnpm install, build, publish `dist/`).

No base-path setting is needed: `vite.config.js` uses `base: './'`.

## Add a lesson

Create `content/lessons/<slug>.md`. It appears on the home page, in the sidebar and in search automatically.

````markdown
---
title: Java Streams — how they work
slug: java-streams
summary: One sentence shown on the contents page and in search.
tags: [Java, Streams]
order: 2
updated: 2026-11-20
---

Intro paragraph (before the first `##`).

## A section {#my-section}

Normal Markdown: tables, code fences (java, javascript, bash), blockquotes (shown as sticky notes).

```demo
name: bucket-index
```

## Interview questions {#questions}

### [basic] What is a stream? {#what-is-a-stream}

Answer in Markdown.

### [deep] A harder follow-up {#harder}

Levels: `basic`, `intermediate`, `deep`, `coding`.
````

- `{#id}` after a heading sets the anchor used in share links (otherwise it is derived from the title).
- The section whose id is `questions` becomes the filterable question list.
- Demo names live in `src/components/demos/index.jsx` (HashMap simulations in `DEMOS`, other components such as `java-timeline` in `CUSTOM`).
- `{#id}` also works on `###` sub-headings. Add `subnav: true` to the front matter to list them under their section in the sidebar; they are searchable and linkable on their own.

### Linking lessons together

Link to another lesson, or to an anchor inside it, with the `lesson:` scheme:

```markdown
See [treeification](lesson:java-hashmap#treeify) or [the G1 collector](lesson:garbage-collector#g1).
```

If the target lesson does not exist yet, the text renders as a muted dashed "coming soon" word (⏳) instead of a broken link. As soon as
`content/lessons/<slug>.md` exists it becomes a normal link, so a lesson can reference lessons that are still to be written.
Anchors used by the Java version-history lesson that a future garbage-collector lesson should provide: `#g1`, `#zgc`,
`#generational-zgc`, `#shenandoah`, `#cms`, `#metaspace`, `#epsilon`, `#compact-object-headers`.

### Glossary tooltips

Add an entry to `content/glossary.json`:

```json
{ "term": "load factor", "aliases": ["loadFactor"], "short": "One or two plain sentences.", "more": "Optional extra detail." }
```

Every occurrence in lesson prose (not in code blocks or links) gets a dotted underline and a tooltip. Plurals match
automatically. Only the first use of a term in each section is a keyboard tab stop, so keyboard users are not forced
through hundreds of words; hover and tap work on all of them, and **Term tips** in the header turns them off.

## Animations

`src/sim/hashmap.js` is a small simulation of `java.util.HashMap` (Java 8+): hashing, bucket index, chaining,
treeify thresholds, resize split. It records one frame per step, and `Playground.jsx` replays the frames with
Play / Pause / Replay / step / scrub / speed, plus "Jump to" any operation. With `prefers-reduced-motion` nothing
autoplays; step manually instead.

## Accessibility

- **A− / A+** in the header, or the **+** / **-** keys (and **0** to reset), scale all text (87.5% – 175%) and the ruled
  lines scale with it. Saved in the browser. Ctrl +/- still zooms the whole page as usual.
- **Read aloud** uses the browser's speech synthesis, highlights the current word (CSS Custom Highlight API) and
  scrolls along; scrolling by hand pauses the auto-scroll for a few seconds. Pause, skip, speed and voice controls
  appear at the bottom. Voices that do not report word positions fall back to a timed estimate.
- Keyboard: `/` or `Ctrl+K` opens search, all controls are real buttons, focus is always visible, there is a skip link.

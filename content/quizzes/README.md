# Lesson quizzes

One file per lesson: `content/quizzes/<lesson-slug>.json`. A lesson with a quiz file gets a **Take the quiz** button.

```json
{ "questions": [
  { "t": "Topic label", "v": [
    { "q": "Question text, `code` allowed", "o": ["CORRECT option", "wrong", "wrong", "wrong"], "w": "Why the first option is right.", "s": 30 },
    { "q": "Which is NOT true about the same idea?", "o": ["the false statement", "true", "true", "true"], "w": "..." }
  ] }
] }
```

- An entry is an **area**: one idea to test. `v` holds its **variants**: the same point as an IS and a NOT question, asked from another angle, or a different question on the same topic. An attempt shows **one variant per area** and prefers a different one from last time (remembered in the browser).
- Aim for 8 areas per lesson and 2 or more variants per area; a plain question object (`q` without `v`) still works as an area with one variant.
- `t`: short topic label for the area (not shown to readers yet).
- `o`: the **first** option is always the correct one. The UI shuffles the options on every attempt. For a NOT question the first option is the false statement.
- `w`: short explanation shown after answering and in the review.
- `s`: optional **number** of seconds for that variant (default 30; use 45 for scenario or code questions).
- 4 options each, testing understanding of the key points (not trivia). Variants of one area must not give away each other's answers.

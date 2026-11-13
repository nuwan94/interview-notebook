# Lesson quizzes

One file per lesson: `content/quizzes/<lesson-slug>.json`. A lesson with a quiz file gets a **Take the quiz** button.

```json
{ "questions": [
  { "q": "Question text, `code` allowed", "o": ["CORRECT option", "wrong", "wrong", "wrong"], "w": "Why the first option is right.", "s": 30 }
] }
```

- `o`: the **first** option is always the correct one. The UI shuffles the options on every attempt.
- `w`: short explanation shown after answering and in the review.
- `s`: optional seconds for that question (default 30; use 45 for scenario or code questions).
- 8 questions per lesson, 4 options each, testing understanding of the key points (not trivia).

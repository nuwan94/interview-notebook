# Interview Notebook: project rules

## Commit messages (strict)

Every commit message MUST follow Conventional Commits. No exceptions, including "add lesson" commits.

```
<type>: <description in lowercase, imperative, no trailing period>

<optional body: what and why, wrapped at about 80 columns>

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

- **type** is one of `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`, `build`, `ci`.
  - `feat`: new lesson, quiz, glossary terms, demo, feature.
  - `fix`: a bug or a wrong content fix.
  - `refactor`: restructuring or reordering with no new content.
  - `docs`: README, credits and other documentation only.
  - `chore`: tooling, dependencies, housekeeping.
- The subject is `type: description`, with a lowercase first word after the colon (acronyms such as AWS, CI/CD, Spring may stay capitalised), at most 72 characters.
- Examples: `feat: add AWS networking lesson (VPC, ALB, Route 53, CloudFront)`, `fix: route diagram arrows around other nodes`, `refactor: regroup lessons into subtopics`.
- Do NOT write `Add ...`, `Update ...`, `Fix ...` without the `type:` prefix.
- One logical change per commit (for example one lesson per commit, with its quiz, glossary terms and icon rules).
- Before committing, check the subject against the pattern `^(feat|fix|refactor|docs|style|test|chore|perf|build|ci): [a-z0-9].{0,70}$`.
- Never rewrite or force-push published history without the user's explicit instruction.

## Other standing rules

- pnpm only (no npm or yarn).
- Commit and push only when the user asks.
- Banking and general examples in lessons, official AWS icons unmodified with the not-affiliated note.

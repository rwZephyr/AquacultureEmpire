# Coding Guide for Codex

## General Rules
1. **Small, focused commits** – each commit should do one thing.
2. **Never change unrelated code** unless explicitly asked.
3. **Use existing style and patterns** in the codebase.
4. Always target the active feature branch (e.g., `v0.2` or a feature branch from it).
5. Keep functions pure when possible; avoid hidden side effects.

## Pull Request Workflow
- All work for a feature happens in **one branch + PR** until merged.
- Use **Draft PRs** for in-progress work.
- Write clear commit messages: `verb: short description` (e.g., `add: vessel capacity calc`).

## Testing
- Manual testing instructions must be in the PR description.
- No merge until manual tests pass.

## File Organization
- Group related helpers into `/core` for logic and `/ui` for display.
- Avoid adding to the main monolithic JS unless explicitly requested.

## Comments
- Briefly document complex logic with `// reason: explanation`.

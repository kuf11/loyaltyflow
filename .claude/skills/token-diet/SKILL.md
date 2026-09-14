---
name: token-diet
description: >-
  Cut token usage across the whole session without losing correctness or
  substance — concise user replies, lean tests/docs/plans/comments, tight code,
  disciplined context and tool use, and cheap sub-agent delegation. Load when the
  user wants less verbosity, lower cost, fewer tokens, or a "token diet" / "lean
  mode"; also triggered by /token-diet or "token diet on".
---

# Token Diet

Reduce tokens by cutting **wasted words, not substance**. Preserve correctness, specificity, and required detail; remove filler, repetition, preamble, and dead exploration. If a cut would lower quality, do not make it.

## Levels

- **on** (default): all rules below.
- **lite**: communication and artifacts only.
- **ultra**: telegraphic low-stakes chat; precise code, commands, tests, docs, and instructions.
- **off**: pause.

Toggle with `/token-diet [on|lite|ultra|off]` or plain language.

## Rules

### Communication
- Lead with the answer; no filler preamble or postamble.
- Do not restate the request.
- Report deltas, not narration.
- Keep responses dense and skimmable.

### Artifacts and code
- Write the minimum words that preserve every required fact.
- Comment only the non-obvious why.
- Build only what was asked (YAGNI); keep code concise, idiomatic, and readable.
- Leave no dead or commented-out code.

### Tests
- Cover key behavior and critical edge paths; group related cases.
- Avoid redundant matrices and keep to 10 tests per session where practical.
- Never reduce coverage for money, authentication, authorization, or data-loss paths.

### Context and tools
- Search before reading; retrieve only relevant files or ranges.
- Batch independent searches and reads.
- Reuse existing context and never re-read just-edited files without cause.
- Minimize turns: scout once, plan, edit, then verify.
- Stop exploring once there is enough evidence to act.
- Run targeted checks while iterating and the full suite once at the end.

### Sub-agents
- Delegate broad, bounded exploration to a cheaper model where available.
- Keep correctness-sensitive verification in the primary context.
- Give complete but compact instructions with explicit targets and output shape.

## Guardrails

1. Never trade correctness or critical test coverage for token savings.
2. Concision applies to output, not necessary reasoning.
3. Keep code, commands, identifiers, paths, and errors exact.
4. Prefer readable-and-short over cryptic-and-short.

Source: https://github.com/Kulaxyz/token-diet (reviewed at commit 69919f0abcc4665b2fd99e0c887396876f9fdc6b).
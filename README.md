# Agent Run Timeline Skill

Local-first skill for converting agent run events into audit timelines with gap detection.

## Quickstart

```bash
npm test
npm run smoke
node bin/agent-run-timeline.js validate fixtures/run.valid.json
node bin/agent-run-timeline.js render fixtures/run.valid.json --format json
```

## What it does

- Validates a local JSON fixture before an agent uses it in a handoff or approval flow.
- Renders a Markdown artifact that can be pasted into a PR, issue, Slack thread, or run report.
- Flags missing verification or approval context without calling external services.
- Redacts secret-looking values from Markdown and JSON render output while reporting their field locations as validation warnings.

## Library API

```js
import {
  buildTimeline,
  readRun,
  renderMarkdown,
  validateRun,
} from "agent-run-timeline-skill";

const markdown = renderMarkdown(input);
```

`buildTimeline(input, { idleMinutes })` and `renderMarkdown(input, { idleMinutes })`
use an idle threshold of 30 minutes by default. A threshold of `0` is accepted
and marks every adjacent pair as a gap. Other values must convert to a finite,
non-negative number; invalid values throw a `RangeError` with a deterministic
message.

## Input contract

`events` must be a non-empty array. Each event requires a non-empty string `id`, `timestamp`, `phase`, and `summary`. Event IDs must be unique within the run so gap and follow-up references identify exactly one event.

Both `validate` and `render` exit nonzero for invalid input. A render still writes its Markdown or JSON diagnostic artifact, including validation findings, so it can be inspected or retained by automation.

The package exports `readRun`, `validateRun`, `buildTimeline`, and
`renderMarkdown` from its root entry point.

## Input and validation

Input must be a JSON object with a non-empty `events` array. Each event must be
an object containing non-empty string `id`, `timestamp`, `phase`, and `summary`
fields. `phase` must be one of `intake`, `planning`, `change`, `verification`,
or `reporting`; unknown phases are validation errors so they cannot silently
disappear from the grouped Markdown timeline. Timestamps must identify a real
UTC calendar instant in `YYYY-MM-DDTHH:mm:ssZ` form, optionally with one to
three fractional-second digits (for example, `2026-07-22T00:00:00.123Z`).
Calendar rollovers such as February 30, timezone offsets, and local timestamps
are rejected. Optional `evidence` and
`followups` fields must be arrays when present, and every array member must be
a non-empty string. Findings identify malformed members by their event and
zero-based array index (for example,
`event 1 evidence[0] must be a non-empty string.`). Rendered follow-ups and
evidence omit invalid members instead of coercing them into misleading text.

`validateRun` accepts any JSON value and returns
`{ ok, errors, warnings }`; malformed input is reported through deterministic
findings instead of throwing a `TypeError`. `buildTimeline` and
`renderMarkdown` likewise return a safe artifact whose `validation` result
describes malformed input. The CLI writes that artifact for `validate` and
both `render` formats, then exits with status 1 when validation fails.
`render` defaults to Markdown when `--format` is omitted. If `--format` is
present it requires an explicit `markdown` or `json` value; a missing or
unsupported value exits nonzero with an actionable error.

## Limitations

This package is local-first. It does not fetch private chat logs, call connectors, store credentials, or approve writes. Treat output as a review aid, not as proof that an external system changed.

## Safety notes

Secret-looking values are replaced with `[REDACTED]` in every render format. Validation warnings identify the affected fields without repeating their values. Run against redacted fixtures when possible and review validation warnings before sharing reports outside the project context.

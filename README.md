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

The package exports `readRun`, `validateRun`, `buildTimeline`, and
`renderMarkdown` from its root entry point.

## Input and validation

Input must be a JSON object with a non-empty `events` array. Each event must be
an object containing non-empty string `id`, `timestamp`, `phase`, and `summary`
fields. `phase` must be one of `intake`, `planning`, `change`, `verification`,
or `reporting`; unknown phases are validation errors so they cannot silently
disappear from the grouped Markdown timeline. Optional `evidence` and
`followups` fields must be arrays when present.

`validateRun` accepts any JSON value and returns
`{ ok, errors, warnings }`; malformed input is reported through deterministic
findings instead of throwing a `TypeError`. `buildTimeline` and
`renderMarkdown` likewise return a safe artifact whose `validation` result
describes malformed input. The CLI writes that artifact for `validate` and
both `render` formats, then exits with status 1 when validation fails.

## Limitations

This package is local-first. It does not fetch private chat logs, call connectors, store credentials, or approve writes. Treat output as a review aid, not as proof that an external system changed.

## Safety notes

Secret-looking values are replaced with `[REDACTED]` in every render format. Validation warnings identify the affected fields without repeating their values. Run against redacted fixtures when possible and review validation warnings before sharing reports outside the project context.

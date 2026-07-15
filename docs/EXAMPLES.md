# Examples

```bash
node bin/agent-run-timeline.js validate fixtures/run.valid.json
node bin/agent-run-timeline.js render fixtures/run.valid.json --format markdown
node bin/agent-run-timeline.js render fixtures/run.valid.json --format json
```

Use the invalid fixture to confirm failures and warnings are visible:

```bash
node bin/agent-run-timeline.js validate fixtures/run.invalid.json
```

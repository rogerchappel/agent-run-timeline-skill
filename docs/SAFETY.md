# Safety

- This project is read-only and local-first.
- It never executes connector actions.
- It never sends data to external services.
- Secret-looking strings in the root title and event fields are replaced with
  `[REDACTED]` in Markdown and JSON renders.
- Validation warnings report only the affected field location, never the
  secret-looking value; warnings do not make otherwise valid input fail.
- Approval decisions remain with the calling agent or human operator.

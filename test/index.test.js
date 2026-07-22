import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildTimeline, renderMarkdown, validateRun } from "../src/index.js";

const valid = JSON.parse(readFileSync(new URL("../fixtures/run.valid.json", import.meta.url), "utf8"));
const invalid = JSON.parse(readFileSync(new URL("../fixtures/run.invalid.json", import.meta.url), "utf8"));

test("valid fixture passes validation", () => {
  const result = validateRun(valid);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("invalid fixture reports actionable findings", () => {
  const result = validateRun(invalid);
  assert.equal(result.ok, false);
  assert.match([...result.errors, ...result.warnings].join("\n"), /Secret-looking|missing|required|invalid/i);
});

test("markdown render includes timeline sections", () => {
  const rendered = renderMarkdown(valid);
  assert.match(rendered, /# /);
  assert.match(rendered, /Validation: pass/);
});

test("normalizer exposes validation and structured output", () => {
  const output = buildTimeline(valid);
  assert.equal(output.validation.ok, true);
  assert.ok(Object.keys(output).length > 2);
});

test("render formats redact secret-like values while retaining validation warnings", () => {
  const secrets = ["token=supersecretvalue123", "ghp_abcdefghijklmnopqrstuvwxyz1234567890", "password=hunter123456"];
  const input = {
    events: [{
      id: "secret-test",
      timestamp: "2026-07-22T00:00:00Z",
      phase: "change",
      summary: `Changed config with ${secrets[0]}`,
      evidence: [`log: ${secrets[1]}`],
      followups: [`rotate ${secrets[2]}`]
    }]
  };

  const markdown = renderMarkdown(input);
  const json = JSON.stringify(buildTimeline(input));
  for (const secret of secrets) {
    assert.doesNotMatch(markdown, new RegExp(secret));
    assert.doesNotMatch(json, new RegExp(secret));
  }
  assert.match(markdown, /\[REDACTED\]/);
  assert.match(json, /\[REDACTED\]/);
  assert.match(markdown, /Secret-looking value at events\[0\]\.summary/);
});

test("CLI render redacts secret-like values in markdown and JSON", () => {
  const secret = "token=supersecretvalue123";
  const input = JSON.stringify({
    events: [{ id: "secret-test", timestamp: "2026-07-22T00:00:00Z", phase: "change", summary: secret }]
  });

  for (const format of ["markdown", "json"]) {
    const output = execFileSync("node", ["bin/agent-run-timeline.js", "render", "-", "--format", format], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      input
    });
    assert.doesNotMatch(output, new RegExp(secret));
    assert.match(output, /REDACTED/);
  }
});

test("CLI validate exits successfully for valid fixture", () => {
  const output = execFileSync("node", ["bin/agent-run-timeline.js", "validate", "fixtures/run.valid.json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });
  assert.match(output, /"ok": true/);
});

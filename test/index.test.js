import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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

test("validation handles every JSON root without throwing", () => {
  for (const [input, message] of [
    [null, "run must be a JSON object."],
    [[], "run must be a JSON object."],
    ["run", "run must be a JSON object."],
    [42, "run must be a JSON object."]
  ]) {
    assert.deepEqual(validateRun(input), { ok: false, errors: [message], warnings: [] });
    assert.equal(buildTimeline(input).validation.errors[0], message);
  }
});

test("validation reports malformed events and collection fields", () => {
  const input = {
    events: [
      null,
      { id: "two", timestamp: "2026-07-22T00:00:00Z", phase: "change", summary: "Changed", evidence: "log", followups: "task" }
    ]
  };
  const result = validateRun(input);
  assert.deepEqual(result.errors, [
    "event 1 must be an object.",
    "event 2 evidence must be an array.",
    "event 2 followups must be an array."
  ]);
  assert.doesNotThrow(() => renderMarkdown(input));
  assert.doesNotThrow(() => buildTimeline(input));
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

test("unknown phases are validation errors in library artifacts", () => {
  const input = {
    events: [{
      id: "custom-phase",
      timestamp: "2026-07-22T00:00:00Z",
      phase: "analysis",
      summary: "Used an unsupported phase",
      evidence: ["run.log#L1"]
    }]
  };

  const finding = "event custom-phase uses unknown phase: analysis";
  assert.deepEqual(validateRun(input).errors, [finding]);

  const timeline = buildTimeline(input);
  assert.equal(timeline.validation.ok, false);
  assert.deepEqual(timeline.validation.errors, [finding]);
  assert.equal(timeline.events.length, 1);

  const markdown = renderMarkdown(input);
  assert.match(markdown, /Validation: fail/);
  assert.match(markdown, new RegExp(finding));
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

test("stdin CLI commands reject unknown phases consistently", () => {
  const input = JSON.stringify({
    events: [{
      id: "custom-phase",
      timestamp: "2026-07-22T00:00:00Z",
      phase: "analysis",
      summary: "Used an unsupported phase"
    }]
  });

  for (const args of [
    ["validate", "-"],
    ["render", "-", "--format", "markdown"],
    ["render", "-", "--format", "json"]
  ]) {
    const result = spawnSync("node", ["bin/agent-run-timeline.js", ...args], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      input
    });
    assert.equal(result.status, 1, `${args.join(" ")} should reject an unknown phase`);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /event custom-phase uses unknown phase: analysis/);
  }
});

test("stdin CLI commands fail consistently with actionable findings for invalid shapes", () => {
  const inputs = [
    [null, "run must be a JSON object."],
    [[], "run must be a JSON object."],
    [{ events: [null] }, "event 1 must be an object."],
    [{
      events: [{ id: "one", timestamp: "2026-07-22T00:00:00Z", phase: "change", summary: "Changed", evidence: {}, followups: "task" }]
    }, "event 1 evidence must be an array."]
  ];

  for (const [input, finding] of inputs) {
    for (const args of [
      ["validate", "-"],
      ["render", "-", "--format", "markdown"],
      ["render", "-", "--format", "json"]
    ]) {
      const result = spawnSync("node", ["bin/agent-run-timeline.js", ...args], {
        cwd: new URL("..", import.meta.url),
        encoding: "utf8",
        input: JSON.stringify(input)
      });
      assert.equal(result.status, 1, `${args.join(" ")} should reject ${JSON.stringify(input)}`);
      assert.equal(result.stderr, "");
      assert.match(result.stdout, new RegExp(finding.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(result.stdout, /TypeError|Cannot read properties/);
    }
  }
});

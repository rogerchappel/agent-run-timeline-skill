import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const packageRoot = new URL("..", import.meta.url);
const temporaryRoot = mkdtempSync(join(tmpdir(), "agent-run-timeline-package-"));
const consumer = join(temporaryRoot, "consumer.mjs");

try {
  const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", temporaryRoot], {
    cwd: packageRoot,
    encoding: "utf8"
  }));
  const tarball = join(temporaryRoot, packed[0].filename);

  writeFileSync(join(temporaryRoot, "package.json"), '{"private":true,"type":"module"}\n');
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
    cwd: temporaryRoot,
    stdio: "inherit"
  });

  writeFileSync(consumer, [
    'import { renderMarkdown } from "agent-run-timeline-skill";',
    'const input = { events: [{ id: "1", timestamp: "2026-01-01T00:00:00Z", phase: "verification", summary: "Passed" }] };',
    "const markdown = renderMarkdown(input);",
    'if (!markdown.includes("Validation: pass")) process.exitCode = 1;',
    ""
  ].join("\n"));
  execFileSync("node", [consumer], { cwd: temporaryRoot, stdio: "inherit" });

  const manifest = JSON.parse(readFileSync(join(temporaryRoot, "node_modules/agent-run-timeline-skill/package.json"), "utf8"));
  assert.equal(manifest.exports["."], "./src/index.js");
  console.log("Packed package supports the documented library import.");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

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

  const installedRoot = join(temporaryRoot, "node_modules/agent-run-timeline-skill");
  const readme = readFileSync(join(installedRoot, "README.md"), "utf8");
  const libraryExample = readme.match(/## Library API\s+```js\n([\s\S]*?)\n```/);
  assert.ok(libraryExample, "README Library API JavaScript example is missing");

  writeFileSync(consumer, `${libraryExample[1]}\nassertMarkdown(markdown);\nfunction assertMarkdown(value) {\n  if (!value.includes("Validation: pass")) throw new Error("Library API example did not render a valid timeline");\n}\n`);
  execFileSync("node", [consumer], { cwd: temporaryRoot, stdio: "inherit" });

  const manifest = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8"));
  assert.equal(manifest.exports["."], "./src/index.js");
  console.log("Packed package executes the README Library API example.");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

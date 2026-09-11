import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const skill = readFileSync(new URL("../SKILL.md", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

const matrixVersions = (workflow.match(/node-version:\s*\[([\d,\s]+)\]/)?.[1] ?? "")
  .split(/[\s,]+/)
  .map((part) => Number(part))
  .filter((value) => Number.isInteger(value));

const enginesFloor = Number((packageJson.engines?.node ?? "").match(/^>=(\d+)$/)?.[1]);

test("CI declares a matrix of in-support Node.js runtimes", () => {
  assert.ok(matrixVersions.length >= 2, "ci.yml must test a matrix of at least two Node.js versions");
  assert.ok(matrixVersions.every((version) => version >= 22), "CI matrix must not include end-of-life Node.js lines below 22");
  assert.match(workflow, /node-version:\s*\$\{\{\s*matrix\.node-version\s*\}\}/, "setup-node must consume the matrix version");
});

test("engines floor matches the lowest CI-verified runtime", () => {
  assert.ok(Number.isInteger(enginesFloor), "package.json engines.node must declare an explicit >=<major> floor");
  assert.equal(Math.min(...matrixVersions), enginesFloor, "CI must verify the declared engines floor");
});

test("SKILL.md and README repeat the CI-verified runtime floor", () => {
  assert.match(skill, new RegExp(`Node\\.js ${enginesFloor} or newer`), "SKILL.md must declare the same floor CI verifies");
  assert.match(readme, new RegExp(`verified in CI against Node\\.js ${enginesFloor}(?: and \\d+)*`), "README runtime support statement must match CI");
  assert.ok(readme.includes("(`>=" + enginesFloor + "`)"), "README must quote the current engines range");
});

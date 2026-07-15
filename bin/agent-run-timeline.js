#!/usr/bin/env node
import { buildTimeline, readRun, renderMarkdown, validateRun } from "../src/index.js";

const [command, filePath, ...args] = process.argv.slice(2);

if (!command || !filePath || ["-h", "--help"].includes(command)) {
  printHelp();
  process.exit(command ? 0 : 1);
}

try {
  const input = readRun(filePath);
  if (command === "validate") {
    const result = validateRun(input);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(result.ok ? 0 : 1);
  }
  if (command === "render") {
    const format = readOption(args, "--format") || "markdown";
    if (format === "markdown") process.stdout.write(renderMarkdown(input));
    else if (format === "json") process.stdout.write(`${JSON.stringify(buildTimeline(input), null, 2)}\n`);
    else throw new Error(`Unsupported format: ${format}`);
    process.exit(0);
  }
  throw new Error(`Unknown command: ${command}`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function printHelp() {
  process.stdout.write(`agent-run-timeline\n\nUsage:\n  agent-run-timeline validate <file|->\n  agent-run-timeline render <file|-> --format markdown|json\n`);
}

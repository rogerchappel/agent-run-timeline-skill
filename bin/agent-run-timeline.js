#!/usr/bin/env node
import { buildTimeline, readRun, renderMarkdown, validateRun } from "../src/index.js";

const [command, filePath, ...args] = process.argv.slice(2);

if (!command || !filePath || ["-h", "--help"].includes(command)) {
  printHelp();
  process.exit(command ? 0 : 1);
}

try {
  if (!["validate", "render"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
  const options = parseArguments(command, args);
  const input = readRun(filePath);
  if (command === "validate") {
    const result = validateRun(input);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(result.ok ? 0 : 1);
  }
  if (command === "render") {
    const format = options.format || "markdown";
    const timeline = buildTimeline(input);
    if (format === "markdown") process.stdout.write(renderMarkdown(input));
    else if (format === "json") process.stdout.write(`${JSON.stringify(timeline, null, 2)}\n`);
    process.exit(timeline.validation.ok ? 0 : 1);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

function parseArguments(command, args) {
  if (command === "validate") {
    if (args.length === 0) return {};
    const argument = args[0];
    if (argument === "--format") {
      throw new Error("Option --format is not valid for validate.");
    }
    if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}.`);
    }
    throw new Error(`Unexpected argument: ${argument}.`);
  }

  let format;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument !== "--format") {
      if (argument.startsWith("--")) throw new Error(`Unknown option: ${argument}.`);
      throw new Error(`Unexpected argument: ${argument}.`);
    }
    if (format !== undefined) {
      throw new Error("Option --format may only be specified once.");
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing value for --format. Expected markdown or json.\n\nUsage: agent-run-timeline render <file|-> --format markdown|json");
    }
    if (!["markdown", "json"].includes(value)) {
      throw new Error(`Unsupported format: ${value}.`);
    }
    format = value;
    index += 1;
  }
  return { format };
}

function printHelp() {
  process.stdout.write(`agent-run-timeline\n\nUsage:\n  agent-run-timeline validate <file|->\n  agent-run-timeline render <file|-> --format markdown|json\n`);
}

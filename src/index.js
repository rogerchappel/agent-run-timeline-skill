import fs from "node:fs";

const PHASES = ["intake", "planning", "change", "verification", "reporting"];
const REQUIRED_FIELDS = ["id", "timestamp", "phase", "summary"];
const SECRET_PATTERNS = [/sk-[A-Za-z0-9_-]{12,}/, /gh[opsu]_[A-Za-z0-9_]{20,}/, /password\s*[:=]\s*\S+/i, /token\s*[:=]\s*\S+/i];

export function readRun(filePath) {
  const raw = filePath === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    const issue = new Error(`Invalid JSON in ${filePath}: ${error.message}`);
    issue.code = "INVALID_JSON";
    throw issue;
  }
}

export function validateRun(input) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(input.events) || input.events.length === 0) {
    errors.push("events must contain at least one run event.");
    return { ok: false, errors, warnings };
  }
  for (const [index, event] of input.events.entries()) {
    for (const field of REQUIRED_FIELDS) {
      if (!isNonEmptyString(event[field])) errors.push(`event ${index + 1} missing required field: ${field}`);
    }
    if (event.phase && !PHASES.includes(event.phase)) warnings.push(`event ${event.id || index + 1} uses unknown phase: ${event.phase}`);
    if (event.timestamp && Number.isNaN(Date.parse(event.timestamp))) errors.push(`event ${event.id || index + 1} has invalid timestamp.`);
    for (const finding of findSecretLikeValues(event)) warnings.push(`Secret-looking value at events[${index}]${finding.path.slice(1)}`);
  }
  const ordered = [...input.events].filter((event) => event.timestamp).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (!ordered.some((event) => event.phase === "verification")) warnings.push("No verification phase event recorded.");
  if (!ordered.some((event) => event.phase === "reporting")) warnings.push("No reporting phase event recorded.");
  return { ok: errors.length === 0, errors, warnings };
}

export function buildTimeline(input, options = {}) {
  const idleMinutes = Number(options.idleMinutes || 30);
  const validation = validateRun(input);
  const events = [...(input.events || [])].sort((a, b) => Date.parse(a.timestamp || 0) - Date.parse(b.timestamp || 0));
  const gaps = [];
  for (let index = 1; index < events.length; index += 1) {
    const previous = Date.parse(events[index - 1].timestamp);
    const current = Date.parse(events[index].timestamp);
    if (!Number.isNaN(previous) && !Number.isNaN(current)) {
      const minutes = Math.round((current - previous) / 60000);
      if (minutes >= idleMinutes) gaps.push({ after: events[index - 1].id, before: events[index].id, minutes });
    }
  }
  const phases = Object.fromEntries(PHASES.map((phase) => [phase, events.filter((event) => event.phase === phase)]));
  const followups = events.flatMap((event) => (event.followups || []).map((task) => ({ event: event.id, task })));
  return { title: input.title || "Agent run", validation, phases, events, gaps, followups };
}

export function renderMarkdown(input, options = {}) {
  const timeline = buildTimeline(input, options);
  const lines = [`# Agent Run Timeline: ${timeline.title}`, "", `- Validation: ${timeline.validation.ok ? "pass" : "fail"}`, `- Events: ${timeline.events.length}`, `- Gaps: ${timeline.gaps.length}`, ""];
  for (const phase of PHASES) {
    lines.push(`## ${capitalize(phase)}`, "");
    const events = timeline.phases[phase] || [];
    if (events.length === 0) lines.push("- none recorded");
    for (const event of events) {
      lines.push(`- ${event.timestamp || "unknown time"} [${event.id || "missing id"}] ${event.summary || "missing summary"}`);
      for (const ref of event.evidence || []) lines.push(`  - evidence: ${ref}`);
    }
    lines.push("");
  }
  if (timeline.gaps.length) {
    lines.push("## Idle Gaps", "");
    for (const gap of timeline.gaps) lines.push(`- ${gap.minutes} minutes between ${gap.after} and ${gap.before}`);
    lines.push("");
  }
  if (timeline.followups.length) {
    lines.push("## Follow-ups", "");
    for (const item of timeline.followups) lines.push(`- ${item.event}: ${item.task}`);
    lines.push("");
  }
  appendFindings(lines, timeline.validation);
  return `${lines.join("\n")}\n`;
}

function appendFindings(lines, validation) {
  if (!validation.errors.length && !validation.warnings.length) return;
  lines.push("## Validation Findings", "");
  for (const error of validation.errors) lines.push(`- error: ${error}`);
  for (const warning of validation.warnings) lines.push(`- warning: ${warning}`);
}

function findSecretLikeValues(value, path = "$") {
  const findings = [];
  if (typeof value === "string") return SECRET_PATTERNS.some((pattern) => pattern.test(value)) ? [{ path }] : findings;
  if (Array.isArray(value)) value.forEach((entry, index) => findings.push(...findSecretLikeValues(entry, `${path}[${index}]`)));
  else if (value && typeof value === "object") for (const [key, entry] of Object.entries(value)) findings.push(...findSecretLikeValues(entry, `${path}.${key}`));
  return findings;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

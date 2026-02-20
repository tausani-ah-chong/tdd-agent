import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import * as path from "path";

const client = new Anthropic();

// --- Config ---
const SANDBOX_DIR = "./sandbox";
const MAX_ITERATIONS = 100;

// --- Clean sandbox of previous run's files ---
function cleanSandbox() {
  const files = readdirSync(SANDBOX_DIR).filter((f) => f.endsWith(".ts"));
  for (const file of files) {
    unlinkSync(path.join(SANDBOX_DIR, file));
  }
}

// --- Types ---
type TDDPhase = "write_test" | "write_impl" | "done";

interface AgentState {
  phase: TDDPhase;
  iteration: number;
  history: Anthropic.MessageParam[];
  lastTestOutput: string;
  totalInputTokens: number;
  totalOutputTokens: number;
}

// --- ANSI colors ---
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
};

const fmt = {
  bold: (s: string) => `${c.bold}${s}${c.reset}`,
  dim: (s: string) => `${c.dim}${s}${c.reset}`,
  green: (s: string) => `${c.green}${s}${c.reset}`,
  red: (s: string) => `${c.red}${s}${c.reset}`,
  yellow: (s: string) => `${c.yellow}${s}${c.reset}`,
  blue: (s: string) => `${c.blue}${s}${c.reset}`,
  cyan: (s: string) => `${c.cyan}${s}${c.reset}`,
  gray: (s: string) => `${c.gray}${s}${c.reset}`,
};

// --- Spinner ---
class Spinner {
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private i = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private startTime = Date.now();
  private label: string;

  constructor(label: string) {
    this.label = label;
  }

  start() {
    this.startTime = Date.now();
    this.interval = setInterval(() => {
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      process.stdout.write(
        `\r  ${fmt.cyan(this.frames[this.i % this.frames.length])} ${this.label} ${fmt.dim(`(${elapsed}s)`)}`
      );
      this.i++;
    }, 80);
    return this;
  }

  stop(suffix = "") {
    if (this.interval) clearInterval(this.interval);
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    process.stdout.write(
      `\r  ${fmt.gray("✓")} ${this.label} ${fmt.dim(`(${elapsed}s)`)}${suffix}\n`
    );
  }
}

// --- Format vitest output to just the key lines ---
function formatTestOutput(raw: string): {
  summary: string;
  errors: string[];
  passed: number;
  failed: number;
} {
  const lines = raw.split("\n");

  // Extract pass/fail summary line e.g. "Tests  2 failed | 1 passed (3)"
  const testLine = lines.find((l) => /Tests\s+\d+/.test(l)) ?? "";
  const passMatch = testLine.match(/(\d+) passed/);
  const failMatch = testLine.match(/(\d+) failed/);
  const passed = passMatch ? parseInt(passMatch[1]) : 0;
  const failed = failMatch ? parseInt(failMatch[1]) : 0;

  // Extract key error lines (AssertionError, TypeError, etc.)
  const errors: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (
      l.match(/^(AssertionError|TypeError|Error|SyntaxError|ReferenceError):/) ||
      l.startsWith("- Expected") ||
      l.startsWith("+ Received") ||
      l.startsWith("expected ") ||
      l.includes("is not defined") ||
      l.includes("is not a function") ||
      l.match(/^✗|^FAIL /)
    ) {
      errors.push("    " + fmt.dim(l));
    }
  }

  // Fallback: if we couldn't parse, show last few relevant lines
  if (errors.length === 0 && failed > 0) {
    const relevant = lines
      .filter(
        (l) =>
          l.trim() &&
          !l.includes("Duration") &&
          !l.includes("Start at") &&
          !l.includes("node_modules") &&
          !l.trim().startsWith("at ")
      )
      .slice(-8);
    errors.push(...relevant.map((l) => "    " + fmt.dim(l.trim())));
  }

  const fileMatch = lines.find((l) => /FAIL|PASS/.test(l) && l.includes(".ts"));
  const summary = fileMatch?.trim() ?? (failed > 0 ? "Tests failed" : "Tests passed");

  return { summary, errors, passed, failed };
}

// --- Extract JSON from Claude's response ---
// Claude sometimes wraps JSON in code fences or adds preamble text.
// Strategy: strip fences first, then find the outermost { } block.
function extractJson(raw: string): any {
  // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
  const stripped = raw.replace(/```(?:json)?\n?([\s\S]*?)```/g, "$1").trim();

  // 2. Try parsing the stripped text directly
  try {
    return JSON.parse(stripped);
  } catch {}

  // 3. Find the outermost { ... } block in the original text
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(raw.slice(start, end + 1));
  }

  throw new Error("No JSON object found in response");
}

// --- System Prompt ---
const SYSTEM_PROMPT = `You are a strict TDD agent. You follow red-green-refactor religiously, one tiny step at a time.

You operate in phases:
1. WRITE_TEST phase: Add exactly ONE new it() to the test file. That's it.
2. WRITE_IMPL phase: Write the minimum implementation to make that one test pass. Nothing more.

Rules you never break:
- Each WRITE_TEST turn adds exactly ONE it() — never two, never a full suite
- Start with the simplest conceivable case (e.g. add(0, 0) returns 0, fizzbuzz(0) returns [])
- Only add the next-simplest case on the next WRITE_TEST turn
- In WRITE_IMPL phase, only output implementation code
- Never write implementation before a failing test exists
- Only write the minimum code needed to pass the current test — fake it if you have to
- No future-proofing, no handling cases not yet tested

Filenames:
- Derive the filename from the function name in the task (e.g. for a function called "add": "add.ts" and "add.test.ts")
- Use the same filename pair consistently throughout the entire session

Test file format ({name}.test.ts):
- Import from './{name}'
- Use vitest: import { describe, it, expect } from 'vitest'
- Each WRITE_TEST turn: output the FULL test file with all previous it()s plus the one new it() appended

Implementation file format ({name}.ts):
- Export named functions

Output format - always respond with ONLY a JSON object:
{
  "phase": "write_test" | "write_impl" | "done",
  "filename": "{name}.test.ts" or "{name}.ts",
  "code": "// your code here",
  "reasoning": "brief explanation of what you did and why"
}`;

// --- Run tests ---
function runTests(): { passed: boolean; output: string } {
  try {
    const output = execSync("npm test 2>&1", { encoding: "utf8" });
    return { passed: true, output };
  } catch (err: any) {
    return { passed: false, output: err.stdout || err.message };
  }
}

// --- Write file to sandbox + save a history snapshot ---
function writeToSandbox(filename: string, code: string, iteration: number, phase: TDDPhase, runId: string) {
  const filepath = path.join(SANDBOX_DIR, filename);
  writeFileSync(filepath, code, "utf8");

  const historyDir = path.join(SANDBOX_DIR, "history", runId);
  mkdirSync(historyDir, { recursive: true });
  const snapshotName = `iteration-${iteration}-${phase}-${filename}`;
  const snapshotPath = path.join(historyDir, snapshotName);
  writeFileSync(snapshotPath, code, "utf8");

  const lines = code.split("\n");
  const preview = lines.slice(0, 4).map((l) => "      " + fmt.dim(l)).join("\n");
  const more = lines.length > 4 ? fmt.dim(`      … ${lines.length - 4} more lines`) : "";

  console.log(`  ${fmt.gray("↳")} Write(${fmt.cyan(filename)}) ${fmt.dim(`${lines.length} lines`)}`);
  console.log(preview);
  if (more) console.log(more);
  console.log(`  ${fmt.gray("↳")} Snapshot: ${fmt.dim(`sandbox/history/${runId}/${snapshotName}`)}`);
}

// --- Main agent loop ---
async function runTDDAgent(task: string) {
  const totalStart = Date.now();

  cleanSandbox();

  const runId = new Date().toISOString().replace(/[:.]/g, "-");

  // Header
  const line = "─".repeat(Math.min(task.length + 10, 60));
  console.log(`\n${fmt.bold("╭─ TDD Agent " + line + "╮")}`);
  console.log(`${fmt.bold("│")} ${fmt.cyan("Task:")} ${task}`);
  console.log(`${fmt.bold("╰" + "─".repeat(line.length + 13) + "╯")}\n`);

  let completed = false;

  const state: AgentState = {
    phase: "write_test",
    iteration: 0,
    history: [],
    lastTestOutput: "",
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };

  state.history.push({
    role: "user",
    content: `Task: ${task}

You are in WRITE_TEST phase. Write ONE single it() for the simplest possible case — the most trivial input you can think of.
Do not write multiple tests. Do not think ahead. Just one it().
Output ONLY valid JSON in the format specified.`,
  });

  while (state.iteration < MAX_ITERATIONS) {
    state.iteration++;

    const phaseLabel =
      state.phase === "write_test"
        ? fmt.red("● write_test")
        : fmt.green("● write_impl");

    console.log(`${phaseLabel}  ${fmt.dim(`iteration ${state.iteration}`)}`);

    // Call Claude with spinner
    const spinner = new Spinner("Calling Claude…").start();
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: state.history,
    });
    spinner.stop();

    // Token usage
    state.totalInputTokens += response.usage.input_tokens;
    state.totalOutputTokens += response.usage.output_tokens;
    console.log(
      `  ${fmt.gray("↳")} tokens: ${fmt.dim(`${response.usage.input_tokens.toLocaleString()} in · ${response.usage.output_tokens.toLocaleString()} out`)}`
    );

    // Thinking excerpt
    const thinkingBlock = response.content.find((b) => b.type === "thinking");
    if (thinkingBlock && thinkingBlock.type === "thinking") {
      const excerpt = thinkingBlock.thinking.replace(/\n+/g, " ").slice(0, 120);
      console.log(`  ${fmt.gray("↳")} thinking: ${fmt.dim(`"${excerpt}…"`)}`);
    }

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock?.type === "text" ? textBlock.text : "";

    // Parse JSON response — retry if empty or unparseable
    let agentResponse: {
      phase: TDDPhase;
      filename: string;
      code: string;
      reasoning: string;
    };

    try {
      if (!rawText.trim()) throw new Error("empty");
      agentResponse = extractJson(rawText);
    } catch {
      if (!rawText.trim()) {
        console.log(`  ${fmt.yellow("⚠")} Empty text block (thinking-only response) — asking Claude to output JSON`);
      } else {
        console.log(`  ${fmt.yellow("⚠")} Could not parse JSON — asking Claude to retry`);
        console.log(fmt.dim(`  raw: ${JSON.stringify(rawText).slice(0, 200)}`));
      }
      // Append what we got (even if empty) then ask for a retry
      state.history.push({ role: "assistant", content: response.content });
      state.history.push({
        role: "user",
        content: `Your last response did not contain valid JSON. Please respond with ONLY a valid JSON object in the exact format specified — no preamble, no markdown fences, just the raw JSON object.`,
      });
      continue;
    }

    console.log(`  ${fmt.gray("↳")} reasoning: ${fmt.dim(agentResponse.reasoning)}`);

    // Append full content (including thinking blocks) for valid API history
    state.history.push({
      role: "assistant",
      content: response.content,
    });

    // Write file with preview
    writeToSandbox(agentResponse.filename, agentResponse.code, state.iteration, state.phase, runId);

    if (agentResponse.phase === "done") {
      completed = true;
      console.log(`\n  ${fmt.green("✓")} Agent signalled done\n`);
      break;
    }

    // Run tests with spinner
    console.log();
    const testSpinner = new Spinner("Running vitest…").start();
    const { passed, output } = runTests();
    testSpinner.stop();
    state.lastTestOutput = output;

    const { summary, errors, passed: numPassed, failed: numFailed } = formatTestOutput(output);

    if (passed) {
      console.log(`  ${fmt.green("✓")} ${fmt.green("PASS")} ${fmt.dim(summary)}`);
      if (numPassed > 0) {
        console.log(`  ${fmt.dim(`${numPassed} test${numPassed > 1 ? "s" : ""} passed`)}`);
      }
    } else {
      console.log(`  ${fmt.red("✗")} ${fmt.red("FAIL")} ${fmt.dim(summary)}`);
      if (numFailed > 0) {
        console.log(`  ${fmt.dim(`${numFailed} test${numFailed > 1 ? "s" : ""} failed`)}`);
      }
      if (errors.length > 0) {
        errors.slice(0, 5).forEach((e) => console.log(e));
      }
    }
    console.log();

    // Phase transitions
    if (state.phase === "write_test" && !passed) {
      state.phase = "write_impl";
      state.history.push({
        role: "user",
        content: `Good - the test is failing as expected (red phase).

Test output:
${output}

Now move to WRITE_IMPL phase. Write the minimum implementation to make this test pass.
Output ONLY valid JSON.`,
      });
    } else if (state.phase === "write_impl" && passed) {
      // Tests green — go back to write_test for the next case, unless agent signals done
      state.phase = "write_test";
      state.history.push({
        role: "user",
        content: `Tests are green. Now add the next single it() for the next-simplest case not yet covered.
If all meaningful cases are covered, output phase: "done".
Output ONLY valid JSON.`,
      });
    } else if (state.phase === "write_impl" && !passed) {
      state.history.push({
        role: "user",
        content: `Tests are still failing. Fix the implementation — minimum code only.

Test output:
${output}

Output ONLY valid JSON.`,
      });
    } else if (state.phase === "write_test" && passed) {
      state.history.push({
        role: "user",
        content: `The test passed without any implementation — it's not a real failing test.
Write a proper failing test that tests the actual functionality.
Output ONLY valid JSON.`,
      });
    }
  }

  // Footer
  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
  const status = completed
    ? fmt.green("✓ Red-Green cycle complete")
    : fmt.yellow("⚠ Did not complete");

  const footerLine = "─".repeat(50);
  console.log(`${fmt.bold("╭─ Done " + footerLine + "╮")}`);
  console.log(`${fmt.bold("│")} ${status} in ${state.iteration} iteration${state.iteration > 1 ? "s" : ""} ${fmt.dim(`(${totalElapsed}s)`)}`);
  console.log(`${fmt.bold("│")} ${fmt.dim(`Tokens: ${state.totalInputTokens.toLocaleString()} in · ${state.totalOutputTokens.toLocaleString()} out`)}`);
  console.log(`${fmt.bold("╰" + "─".repeat(footerLine.length + 8) + "╯")}\n`);
}

// --- Entry point ---
const task =
  process.argv[2] ||
  "Write a function called add that takes two numbers and returns their sum";

runTDDAgent(task);

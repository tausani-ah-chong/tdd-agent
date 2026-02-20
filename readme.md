gent

A standalone TDD enforcement agent using the Anthropic TypeScript SDK.

## What it does

Enforces strict red-green-refactor TDD cycle:
1. Tells Claude to write a **failing test first**
2. Blocks implementation until a failing test exists
3. Then asks Claude to write **minimum code** to pass the test
4. Loops until tests are green

## Setup

```bash
npm install
```

Add your Anthropic API key:
```bash
export ANTHROPIC_API_KEY=your_key_here
```

## Run

Default task (add function):
```bash
npm run agent
```

Custom task:
```bash
npm run agent "Write a function called multiply that takes two numbers and returns their product"
```

## Project Structure

```
tdd-agent/
├── src/
│   └── agent.ts          # Main TDD agent loop
├── sandbox/
│   ├── solution.ts        # Implementation (written by agent)
│   └── solution.test.ts   # Tests (written by agent)
├── package.json
└── tsconfig.json
```

## How the loop works

```
Task input
    ↓
Claude writes failing test → saved to sandbox/solution.test.ts
    ↓
Run vitest → should fail (red)
    ↓
Claude writes minimum implementation → saved to sandbox/solution.ts
    ↓
Run vitest → should pass (green)
    ↓
Done
```

## What to observe for your blog post

- Does Claude stay within TDD constraints?
- How many iterations does it take to get to green?
- Where does it try to cheat (write impl before test, write extra code)?
- Compare this to Claude Code with TDD in CLAUDE.md

# 🚀 Agentic Dev Team — Claude Code Skill

A reusable Claude Code skill that launches a parallel agentic development team with structured planning, adversarial review, and parallel implementation.

## What It Does

When you run `/dev-team`, the orchestrator spins up three agent roles:

| Agent | Model | Role |
|-------|-------|------|
| **Project Manager** | Sonnet | Breaks your scope into discrete tasks with dependencies and parallel groups |
| **Dev Supervisor** | Opus | Adversarial reviewer — catches hallucinated APIs, governance violations, unsupported claims |
| **Developers** | Sonnet | Implement tasks in parallel, write tests, follow approved plans |

## Workflow

```
You describe scope
       │
       ▼
┌─ PHASE 1: PLAN & REVIEW ──────────────────────────┐
│  PM decomposes → Devs plan → Supervisor reviews    │
│  Revision loop (max 2 cycles) → You approve        │
└────────────────────────────────────────────────────┘
       │
       ▼
┌─ PHASE 2: IMPLEMENT ──────────────────────────────┐
│  Devs implement in parallel groups                 │
│  Supervisor reviews code → Rework if needed        │
│  PM delivers final report                          │
└────────────────────────────────────────────────────┘
```

**No code is written until you approve the plan.** The Supervisor acts as an antagonist — challenging every plan and implementation for hallucinations, governance violations, and missing tests before anything ships.

## Install

### Clone and install to your project

```bash
git clone https://github.com/YOUR_USER/agentic-dev-team.git
cd agentic-dev-team
./install.sh                # project-local install
# or
./install.sh --global       # available in all projects
```

### Manual install

```bash
# Copy into your project
mkdir -p .claude/skills/dev-team/agents .claude/commands
cp SKILL.md .claude/skills/dev-team/
cp agents/*.md .claude/skills/dev-team/agents/
cp commands/dev-team.md .claude/commands/

# Create output directory
mkdir -p docs/dev-team/{plans,reviews,status}
```

### Uninstall

```bash
./install.sh --uninstall            # remove from project
./install.sh --uninstall --global   # remove globally
```

## Usage

### Slash command with scope

```
/dev-team Build a REST API with JWT auth, user CRUD, and rate limiting using Express and Prisma
```

### Slash command (interactive)

```
/dev-team
```

Then describe your scope when prompted.

### Natural language

Just mention "dev team" or "spin up agents" in your prompt:

```
Spin up the dev team to refactor the payment module into microservices
```

## What the Supervisor Catches

The Dev Supervisor runs on Opus and is deliberately antagonistic. It checks every plan and implementation for:

- **CLAUDE.md violations** — any project convention breach is CRITICAL severity
- **Hallucinated dependencies** — verifies packages exist via `npm info` / `pip show`
- **Fabricated APIs** — catches method calls that don't exist on the library
- **Unsupported claims** — "this is the standard approach" gets challenged
- **Missing tests** — every acceptance criterion must have a corresponding test
- **File path accuracy** — referenced files must exist or be created by the task

Severity levels:
- **CRITICAL** — blocks approval, must be fixed
- **WARNING** — should be fixed, can proceed with justification
- **INFO** — suggestions, doesn't block

## Output Artifacts

The skill creates structured artifacts in `docs/dev-team/`:

```
docs/dev-team/
├── task-manifest.md          # PM's task breakdown
├── governance-rules.md       # Extracted from CLAUDE.md
├── plans/
│   └── task-{id}-plan.md     # Developer implementation plans
├── reviews/
│   ├── phase1-review.md      # Supervisor plan reviews
│   └── phase2-review.md      # Supervisor code reviews
├── status/
│   └── task-{id}-done.md     # Developer completion reports
└── final-report.md           # PM's summary
```

## CLAUDE.md Integration

The skill works best when your project has a `CLAUDE.md` with coding conventions. The Supervisor enforces everything in it. If no CLAUDE.md exists, you'll be prompted to either create one or proceed without governance rules.

Example CLAUDE.md rules the Supervisor will enforce:
- "Use pnpm, not npm"
- "All API routes must validate input with zod"
- "Use conventional commit messages"
- "No default exports"

## Customization

### Change agent models

Edit the `model:` field in any agent file:
- `opus` — strongest reasoning, highest cost
- `sonnet` — balanced (default for PM and Developers)
- `haiku` — fastest and cheapest

### Add specialized agents

Create new `.md` files in `agents/` with proper frontmatter, then reference them in `SKILL.md`.

### Adjust revision limits

The default max revision cycles is 2. Edit `SKILL.md` to change.

## Cost Estimate

Each run spawns multiple subagents. Rough token usage for a 5-task scope:

| Phase | Agents | Model | ~Tokens |
|-------|--------|-------|---------|
| PM planning | 1 | Sonnet | 5-10k |
| Dev planning | 5 | Sonnet | 25-50k |
| Supervisor review | 1 | Opus | 10-20k |
| Revisions | varies | mixed | 5-15k |
| Implementation | 5 | Sonnet | 50-150k |
| Final review | 1 | Opus | 10-20k |

**Total: ~100-250k tokens per run.** Keep scope focused (3-8 tasks) for best cost/quality balance.

## Requirements

- Claude Code (updated to latest)
- Subagent support (default in recent versions)
- Optional: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` for full inter-agent communication

## License

MIT

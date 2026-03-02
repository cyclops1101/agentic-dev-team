# Dev Team Skill — Installation & Configuration

## Quick Install

From your project root:

```bash
# Create directories
mkdir -p .claude/skills/dev-team/agents
mkdir -p .claude/commands

# Copy skill files
cp SKILL.md .claude/skills/dev-team/
cp agents/*.md .claude/skills/dev-team/agents/

# Copy slash command
cp commands/dev-team.md .claude/commands/

# Create the docs output directory
mkdir -p docs/dev-team/{plans,reviews,status}
```

## Global Install (available in all projects)

```bash
# Create global directories
mkdir -p ~/.claude/skills/dev-team/agents
mkdir -p ~/.claude/commands

# Copy skill files
cp SKILL.md ~/.claude/skills/dev-team/
cp agents/*.md ~/.claude/skills/dev-team/agents/

# Copy slash command
cp commands/dev-team.md ~/.claude/commands/
```

## Usage

### Option 1: Slash Command
```
/dev-team Build a REST API for user management with JWT auth, CRUD endpoints, and rate limiting
```

### Option 2: Natural Language
Just describe the work and mention "dev team" or "parallel agents":
```
Spin up the dev team to refactor the payment processing module into separate services
```

### Option 3: Interactive
```
/dev-team
```
Then enter your scope when prompted.

## Prerequisites

- Claude Code installed and updated
- A project with a CLAUDE.md file (recommended but not required)
- Subagent support enabled (default in recent Claude Code versions)

## Optional: Enable Agent Teams (experimental)

For full parallel execution with inter-agent communication:

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

Without this, agents still run as subagents — just dispatched by the orchestrator
rather than communicating laterally.

## Cost Considerations

Each dev-team run spawns multiple subagents. Approximate token usage per run:

| Phase | Agents Spawned | Model | Est. Tokens |
|-------|---------------|-------|-------------|
| Planning (PM) | 1 | Sonnet | ~5-10k |
| Planning (Devs) | 1 per task | Sonnet | ~5-10k each |
| Review | 1 | Opus | ~10-20k |
| Revision | varies | Sonnet + Opus | ~5-15k |
| Implementation | 1 per task | Sonnet | ~10-30k each |
| Final Review | 1 | Opus | ~10-20k |

For a typical 5-task scope: ~100-200k tokens total.

**Tips to reduce cost:**
- Keep scope focused (3-6 tasks per run)
- Write a detailed CLAUDE.md to reduce back-and-forth
- Provide clear requirements upfront to minimize revision cycles

## Customization

### Change Agent Models

Edit the `model:` field in agent frontmatter:
- `opus` — strongest reasoning, highest cost
- `sonnet` — balanced (default for Devs and PM)
- `haiku` — fastest and cheapest (good for simple tasks)

### Add Domain-Specific Agents

Create new agent files in `.claude/skills/dev-team/agents/`:

```markdown
---
name: database-specialist
description: "Database schema design and migration specialist"
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

You are a database specialist...
```

Then reference the new agent in SKILL.md's team roles table.

### Adjust Revision Limits

The default max revision cycles is 2. To change, edit the SKILL.md and adjust
the "max 2 revision cycles" references in both Phase 1 and Phase 2.

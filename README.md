# Agentic Dev Team

A reusable Claude Code skill that launches a parallel agentic development team with structured planning, adversarial review, and parallel implementation. Uses [Task Orchestrator](https://github.com/jpicklyk/task-orchestrator) for persistent task tracking and cross-session memory.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Task Orchestrator (MCP Server — Docker)                │
│  Handles: persistence, task tracking, dependencies,     │
│  lifecycle, notes, cross-session context                │
├─────────────────────────────────────────────────────────┤
│  Skill (SKILL.md + agents/)                             │
│  Handles: orchestration, subagent spawning, workflow,   │
│  adversarial review, governance enforcement             │
├─────────────────────────────────────────────────────────┤
│  /dev-team command                                      │
│  Entry point for the user                               │
└─────────────────────────────────────────────────────────┘
```

**Task Orchestrator** handles all infrastructure — persistent storage, task state machines, dependency graphs, and note-based metadata. The **skill files** handle orchestration — spawning PM, Supervisor, and Developer subagents with an adversarial review workflow.

## Quick Start

### 1. Pull Task Orchestrator

```bash
docker pull ghcr.io/jpicklyk/task-orchestrator:latest
```

### 2. Add to your project's `.mcp.json`

```json
{
  "mcpServers": {
    "task-orchestrator": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-v", "dev-team-data:/app/data",
        "ghcr.io/jpicklyk/task-orchestrator:latest"
      ]
    }
  }
}
```

The named volume `dev-team-data` persists task history across container restarts.

### 3. Install the skill

```bash
# Project-local install
./install.sh

# Or global install (all projects)
./install.sh --global
```

### 4. Run it

```
/dev-team Build a REST API with JWT auth, user CRUD, and rate limiting
```

## Workflow

```
You describe scope
       │
       ▼
┌─ PHASE 1: PLAN & REVIEW ───────────────────────────┐
│  PM decomposes → Devs plan → Supervisor reviews     │
│  Revision loop (max 2 cycles) → You approve         │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─ PHASE 2: IMPLEMENT ───────────────────────────────┐
│  Devs implement in parallel groups                  │
│  Supervisor reviews code → Rework if needed         │
│  PM delivers final report                           │
└─────────────────────────────────────────────────────┘
```

## Team Roles

| Agent | Model | Role |
|-------|-------|------|
| **Project Manager** | Sonnet | Decomposes scope into tasks with dependencies and parallel groups |
| **Dev Supervisor** | Opus | Adversarial reviewer — catches hallucinated APIs, CLAUDE.md violations |
| **Developers** | Sonnet | Implement tasks in parallel, write tests, follow approved plans |

## What the Supervisor Catches

The Dev Supervisor is the core differentiator. It acts as an adversarial quality gate that catches:

- **Hallucinated dependencies** — packages that don't exist on npm/PyPI
- **Fabricated API methods** — calling methods that aren't real
- **Governance violations** — ignoring CLAUDE.md conventions
- **Missing test coverage** — every acceptance criterion needs a test
- **Unsupported claims** — "this is the standard approach" without evidence
- **Implementation drift** — code that deviates from the approved plan

## How Persistence Works

All state lives in Task Orchestrator's database via standardized note keys:

| Note Key | Created By | Purpose |
|----------|-----------|---------|
| `governance-rules` | Orchestrator | CLAUDE.md rules extracted at startup |
| `execution-plan` | PM | Task grouping and dependency order |
| `acceptance-criteria` | PM | Per-task success criteria |
| `implementation-plan` | Developer | Technical approach for each task |
| `review-verdict` | Supervisor | APPROVED / NEEDS_REVISION / ESCALATED |
| `done-criteria` | Developer | Implementation summary with test results |
| `final-report` | PM | Consolidated completion summary |

Data persists across sessions via the Docker named volume, so you can resume work or review past runs.

## Requirements

- Docker
- Claude Code (latest)

## Uninstall

```bash
./install.sh --uninstall           # project-local
./install.sh --uninstall --global  # global
```

## License

MIT

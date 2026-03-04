# 🚀 Agentic Dev Team

A reusable Claude Code skill + MCP server that launches a parallel agentic development team with structured planning, adversarial review, and parallel implementation.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  MCP Server (dev-team)                                  │
│  Handles: install, init, dep validation, status, history│
├─────────────────────────────────────────────────────────┤
│  Skill (SKILL.md + agents/)                             │
│  Handles: orchestration, subagent spawning, workflow    │
├─────────────────────────────────────────────────────────┤
│  /dev-team command                                      │
│  Entry point for the user                               │
└─────────────────────────────────────────────────────────┘
```

The **MCP server** manages infrastructure — installing the skill, validating dependencies, tracking status, and recording run history. The **skill files** handle the actual orchestration — spawning PM, Supervisor, and Developer subagents.

## Quick Start

### 1. Install the MCP server

```bash
git clone https://github.com/YOUR_USER/agentic-dev-team.git
cd agentic-dev-team/mcp-server
npm install
npm run build
```

### 2. Register with Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "dev-team": {
      "command": "node",
      "args": ["/absolute/path/to/agentic-dev-team/mcp-server/build/index.js"]
    }
  }
}
```

Or add to global Claude Code settings for all projects.

### 3. Install the skill into your project

In Claude Code:

```
Use dev_team_install to set up the dev team in this project
```

Or globally:

```
Use dev_team_install with global=true
```

### 4. Run it

```
/dev-team Build a REST API with JWT auth, user CRUD, and rate limiting
```

## MCP Server Tools

| Tool | Purpose |
|------|---------|
| `dev_team_install` | Install skill files, agents, command, and output dirs |
| `dev_team_uninstall` | Remove skill files (preserves output artifacts) |
| `dev_team_init` | Scaffold dirs, extract CLAUDE.md governance rules |
| `dev_team_status` | Consolidated view of manifest, statuses, reviews |
| `dev_team_validate_deps` | Verify npm/PyPI packages exist |
| `dev_team_history` | Record, list, and retrieve past runs |
| `dev_team_check_installed` | Verify installation completeness |

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

## Alternative: Skill-Only Install (no MCP)

```bash
cd /path/to/your-project
/path/to/agentic-dev-team/install.sh           # project-local
/path/to/agentic-dev-team/install.sh --global  # all projects
```

## Requirements

- Claude Code (latest)
- Node.js 18+ (for MCP server)
- Optional: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

## License

MIT

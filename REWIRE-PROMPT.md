# Rewire Agentic Dev Team Skill to Use Task Orchestrator

## Context

We built an "agentic dev team" Claude Code skill that orchestrates parallel development with three agent roles: a Project Manager (Sonnet) that decomposes scope, a Dev Supervisor (Opus) that acts as an adversarial reviewer, and Developers (Sonnet) that implement in parallel. The workflow has two phases: Plan & Review (no code until approved), then Implementation.

We originally built a custom MCP server for persistence, but we're ditching that in favor of **jpicklyk/task-orchestrator** — an existing MCP server that handles persistent memory, task tracking, dependency graphs, status progression, and cross-session context. It already solves the infrastructure problems we were solving poorly.

**What we're keeping**: The skill files (SKILL.md, agents/, commands/) and the adversarial review workflow. These are the differentiator — Task Orchestrator doesn't have governance enforcement or hallucination catching.

**What we're dropping**: The entire `mcp-server/` directory. All persistence, status tracking, history, and context now goes through Task Orchestrator's MCP tools.

## Task Orchestrator API Reference

Task Orchestrator uses a unified **WorkItem** model — there are no separate Project/Feature/Task types. Items nest by `parentId` up to 4 levels deep. The hierarchy is whatever you need:

```
WorkItem (depth 0): "E-Commerce Platform"        ← our "scope"
  └── WorkItem (depth 1): "User Authentication"   ← a parallel group or domain
      ├── WorkItem (depth 2): "Database schema"    ← individual task
      ├── WorkItem (depth 2): "Login API"
      └── WorkItem (depth 2): "Integration tests"
```

### Key Tools (13 total)

**Work Items**:
- `create_work_tree(name, description, children, deps)` — Create a parent item with children and dependency chains in one call. Returns created items with IDs.
- `get_work_item(id)` — Get a single work item by ID.
- `query_items(operation)` — Query items. Operations include `"overview"` (dashboard), `"next"` (what to work on), filtered queries by status/tag/parent.
- `get_next_item()` — Get the highest-priority unblocked item ready for work.
- `update_work_item(id, ...)` — Update item fields (description, priority, tags, etc.).
- `delete_work_item(id)` — Delete an item and its children.

**Lifecycle**:
- `advance_item(id, trigger)` — Move item through phases. Triggers: `"start"` (queue→work), `"submit"` (work→review), `"approve"` (review→done), `"reject"` (review→work), `"cancel"`.
- `get_context(itemId, includeAncestors)` — Get item with full context including ancestors, dependencies, gate status. Returns `canAdvance`, `missing` (unfilled required notes), `guidancePointer`.

**Notes** (attached to work items):
- `manage_notes(action, itemId, key, body)` — CRUD for notes on items. Actions: `"create"`, `"read"`, `"update"`, `"delete"`, `"list"`. Notes are key-value pairs attached to work items. Keys like `"done-criteria"`, `"approach"`, `"review-feedback"` are conventions.

**Dependencies**:
- `manage_dependencies(action, ...)` — Create/delete/query typed dependency edges. Types: `BLOCKS`, `IS_BLOCKED_BY`, `RELATES_TO`. Supports pattern shortcuts: linear chains, fan-out, fan-in.

**Workflow patterns**:
```
create_work_tree("Auth Feature", children=[...], deps=[schema→api→tests])
get_next_item() → "Database schema" (queue, no blockers)
advance_item(id, trigger="start") → moves to work
manage_notes(action="create", itemId=id, key="done-criteria", body="Migration applied, indexes created")
advance_item(id, trigger="submit") → moves to review
advance_item(id, trigger="approve") → done
```

## Prerequisites

Before starting:

1. **Install Task Orchestrator**: `docker pull ghcr.io/jpicklyk/task-orchestrator:latest`
2. **Read the existing skill files** in this repo: `SKILL.md`, `agents/project-manager.md`, `agents/dev-supervisor.md`, `agents/developer.md`, `commands/dev-team.md`
3. **Read Task Orchestrator docs** if available at the repo's `docs/` directory for the full tool API reference

## Changes Required

### 1. Delete the `mcp-server/` directory entirely

Remove:
- `mcp-server/src/`
- `mcp-server/build/`
- `mcp-server/package.json`
- `mcp-server/tsconfig.json`
- `mcp-server/docker-compose.yml`
- `mcp-server/PROMPT.md`
- `mcp-server/UPDATE-PROMPT.md`
- All of `mcp-server/`

### 2. Create `.mcp.json` for Task Orchestrator

Create `.mcp.json` at the repo root:

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

Use a named volume `dev-team-data` so task history persists across container restarts.

### 3. Rewrite `SKILL.md` — The Orchestrator

This is the main rewrite. The orchestrator's job stays the same (coordinate PM → Devs → Supervisor in two phases) but now it uses Task Orchestrator tools for persistence instead of writing markdown files.

**Keep the same structure**: Welcome message, Startup Sequence, Phase 1, Phase 2, Getting Started.

**Replace all file-based operations with Task Orchestrator tool calls:**

#### Startup Sequence (rewrite)

1. Display welcome message
2. Wait for user scope
3. Read CLAUDE.md files for governance rules (still file-based — this is a local project concern, not task tracking)
4. Store governance rules as a note on the root work item (not as a file)
5. Enter Phase 1

#### Phase 1 — Planning & Review (rewrite)

**Step 1 — PM decomposes scope.**
- PM agent calls `create_work_tree` to create the scope as a root WorkItem with child tasks, dependencies, and parallel groups
- Each child gets tags for domain (e.g. `"backend"`, `"database"`, `"frontend"`)
- PM stores the execution plan as a note on the root item: `manage_notes(action="create", key="execution-plan", body="...")`
- This replaces writing `docs/dev-team/task-manifest.md`

**Step 2 — Developers produce plans.**
- Spawn Developer subagents in parallel, one per task
- Each Developer reads its assigned work item via `get_work_item(id)` and any parent context via `get_context(id, includeAncestors=true)`
- Each Developer stores its plan as a note: `manage_notes(action="create", itemId=taskId, key="implementation-plan", body="...")`
- This replaces writing `docs/dev-team/plans/task-{id}-plan.md`

**Step 3 — Supervisor reviews all plans.**
- Spawn Supervisor with IDs of all task items
- Supervisor reads each plan via `manage_notes(action="read", itemId=taskId, key="implementation-plan")`
- Supervisor reads governance rules via `manage_notes(action="read", itemId=rootId, key="governance-rules")`
- Supervisor stores review as a note on the root: `manage_notes(action="create", itemId=rootId, key="phase1-review", body="...")`
- For each task, stores per-task verdict: `manage_notes(action="create", itemId=taskId, key="review-verdict", body="APPROVED|NEEDS_REVISION|ESCALATED: <feedback>")`
- This replaces writing `docs/dev-team/reviews/phase1-review.md`

**Step 4 — Revision loop.**
- For NEEDS_REVISION tasks, respawn Developer with feedback from `manage_notes(action="read", key="review-verdict")`
- Developer updates its plan: `manage_notes(action="update", key="implementation-plan", body="<revised>")`
- Max 2 revision cycles, then escalate to user

**Step 5 — Present plan to user.**
- Orchestrator calls `query_items(operation="overview")` to get the full dashboard
- Shows summary with task count, dependency graph, and any escalations
- Waits for user approval

#### Phase 2 — Implementation (rewrite)

**Step 1 — Sequence work by dependencies.**
- Call `get_next_item()` to get the first unblocked task
- Call `advance_item(id, trigger="start")` to move it to work phase

**Step 2 — Developers implement.**
- Spawn Developer subagents for all tasks in the current parallel group
- Each Developer reads its plan via `manage_notes(action="read", key="implementation-plan")`
- Developer implements, writes code and tests
- On completion, writes summary: `manage_notes(action="create", key="done-criteria", body="<what was implemented, files changed, tests passing>")`
- Advances item: `advance_item(id, trigger="submit")` → moves to review

**Step 3 — Supervisor reviews implementations.**
- Reads `done-criteria` notes on submitted items
- Verifies code matches approved plan
- Verifies tests pass
- Stores review: `manage_notes(action="create", key="impl-review", body="APPROVED|NEEDS_REWORK: <feedback>")`
- For approved: `advance_item(id, trigger="approve")` → done
- For rework: `advance_item(id, trigger="reject")` → back to work

**Step 4 — Rework loop.** Max 2 cycles, then escalate.

**Step 5 — Repeat** for next parallel group via `get_next_item()`.

**Step 6 — Final report.**
- Orchestrator calls `query_items(operation="overview")` for final state
- Stores final report as note on root: `manage_notes(action="create", key="final-report", body="...")`
- Presents summary to user

### 4. Rewrite `agents/project-manager.md`

The PM now uses Task Orchestrator tools instead of writing markdown files.

**Key changes**:
- Remove all references to `docs/dev-team/task-manifest.md`
- Replace "Save to docs/dev-team/" with Task Orchestrator tool calls
- The PM's primary action is `create_work_tree` to build the hierarchical task structure
- Use `manage_notes` to store execution plan, acceptance criteria
- Use `manage_dependencies` if complex dependency patterns are needed beyond what `create_work_tree` handles
- In Phase 2, use `advance_item` and `query_items` for status tracking
- Final report via `manage_notes` on root item, not a file

**Decomposition output** — instead of a markdown manifest, the PM creates:
```
create_work_tree(
  name="<scope title>",
  description="<scope description>",
  tags=["scope"],
  children=[
    { name="Task 1", description="...", tags=["backend", "database"], priority=1 },
    { name="Task 2", description="...", tags=["backend", "api"], priority=2 },
    ...
  ],
  deps=["Task 1" → "Task 2", ...]
)
```

Then attaches notes for acceptance criteria per task:
```
manage_notes(action="create", itemId=<task1Id>, key="acceptance-criteria", body="...")
```

### 5. Rewrite `agents/dev-supervisor.md`

The Supervisor's adversarial review behavior stays **exactly the same** — this is the core value. Only the I/O changes.

**Keep**:
- All 6 check categories (Governance Compliance, Hallucination Detection, Unsupported Claims, Test Coverage, Plan Feasibility, Implementation Accuracy)
- Severity levels (CRITICAL, WARNING, INFO)
- Max 2 revision cycle rule
- The adversarial tone and specificity requirements

**Change I/O**:
- Read plans via `manage_notes(action="read", key="implementation-plan")`
- Read governance via `manage_notes(action="read", key="governance-rules")`
- Write reviews via `manage_notes(action="create", key="review-verdict")`
- Write phase reviews via `manage_notes(action="create", key="phase1-review")` or `manage_notes(action="create", key="impl-review")`
- For approved items: `advance_item(id, trigger="approve")`
- For rejected items: `advance_item(id, trigger="reject")`
- Can still use Bash tool to run `npm info` / `pip show` for hallucination checking — that's runtime validation, not persistence

### 6. Rewrite `agents/developer.md`

**Change I/O**:
- Read assignment via `get_work_item(id)` and `get_context(id, includeAncestors=true)`
- Read governance via `manage_notes(action="read", key="governance-rules")` on root item
- Write plan via `manage_notes(action="create", key="implementation-plan")`
- Write completion report via `manage_notes(action="create", key="done-criteria")`
- Read review feedback via `manage_notes(action="read", key="review-verdict")`
- Update plan on revision via `manage_notes(action="update", key="implementation-plan")`
- Signal completion via `advance_item(id, trigger="submit")`

**Keep**: All implementation standards (no TODOs, no debug logging, no bare catch blocks, tests alongside code, run tests before reporting).

### 7. Rewrite `commands/dev-team.md`

Update to reference Task Orchestrator:

```markdown
---
description: Launch the agentic dev team — parallel agents with PM, Supervisor, and Developers
argument-hint: "<describe what the team should build>"
---

Read the dev-team skill and follow its instructions to launch the agentic dev team.

Locate the skill by checking these paths in order:
1. `.claude/skills/dev-team/SKILL.md`
2. `~/.claude/skills/dev-team/SKILL.md`

Also read all agent definitions in the skill's `agents/` directory.

Verify Task Orchestrator is connected: run `/mcp` and confirm `task-orchestrator` is listed. If not connected, inform the user they need to set up Task Orchestrator first.

The user's scope is:

$ARGUMENTS

If no arguments were provided, display the welcome message from the skill and prompt the user to describe what they want built.
```

### 8. Rewrite `install.sh`

Simplify — no longer needs to install MCP server files. Now it:
1. Copies skill files to `.claude/skills/dev-team/`
2. Copies command to `.claude/commands/dev-team.md`
3. Checks if `.mcp.json` exists and contains `task-orchestrator` — if not, warns the user
4. Does NOT create `docs/dev-team/` directories (Task Orchestrator handles persistence)

### 9. Rewrite `README.md`

Update to reflect the new architecture:

- Prerequisites: Docker, Claude Code, Task Orchestrator
- Setup: `docker pull ghcr.io/jpicklyk/task-orchestrator:latest`, add to `.mcp.json`, install skill
- Remove all references to the custom MCP server, Postgres, JSON files
- Explain that Task Orchestrator handles persistence and our skill handles orchestration + adversarial review
- Keep the workflow diagram, team roles table, cost estimates
- Keep the "What the Supervisor Catches" section — that's the selling point

### 10. Optional: Create `.taskorchestrator/config.yaml`

If Task Orchestrator supports custom note schemas that gate transitions, create a config that requires:
- `implementation-plan` note before a task can advance from queue to work
- `done-criteria` note before a task can advance from work to review
- `review-verdict` note before a task can advance from review to done

This enforces the two-phase workflow at the infrastructure level. Check Task Orchestrator's docs for the exact config format.

## Note Convention Map

All agents use these standardized note keys:

| Note Key | Created By | Phase | Purpose |
|----------|-----------|-------|---------|
| `governance-rules` | Orchestrator | Startup | CLAUDE.md content extracted at init |
| `execution-plan` | PM | Phase 1 | Task grouping, dependency order, parallel groups |
| `acceptance-criteria` | PM | Phase 1 | Per-task success criteria |
| `implementation-plan` | Developer | Phase 1 | How the developer will implement the task |
| `review-verdict` | Supervisor | Phase 1 | APPROVED / NEEDS_REVISION / ESCALATED + feedback |
| `phase1-review` | Supervisor | Phase 1 | Consolidated review of all plans |
| `done-criteria` | Developer | Phase 2 | What was implemented, files changed, tests passing |
| `impl-review` | Supervisor | Phase 2 | Post-implementation review verdict |
| `final-report` | PM | Phase 2 | Consolidated completion summary |

## File Summary

| File | Action |
|------|--------|
| `mcp-server/` | **DELETE** — entire directory |
| `.mcp.json` | **CREATE** — Task Orchestrator config |
| `SKILL.md` | **REWRITE** — use Task Orchestrator tools |
| `agents/project-manager.md` | **REWRITE** — use Task Orchestrator tools |
| `agents/dev-supervisor.md` | **REWRITE** — change I/O, keep review logic |
| `agents/developer.md` | **REWRITE** — change I/O, keep implementation standards |
| `commands/dev-team.md` | **REWRITE** — add Task Orchestrator check |
| `install.sh` | **REWRITE** — simplify, remove MCP server |
| `README.md` | **REWRITE** — new architecture |
| `.taskorchestrator/config.yaml` | **CREATE** (optional) — note schema gates |
| `LICENSE` | **NO CHANGE** |

## Do Not

- Do not change the adversarial review behavior of the Supervisor — that's the entire value proposition
- Do not change agent model assignments (PM=sonnet, Supervisor=opus, Developer=sonnet)
- Do not add custom MCP server code — all persistence goes through Task Orchestrator
- Do not create `docs/dev-team/` directories — notes live in Task Orchestrator's database
- Do not change the two-phase workflow (plan-then-implement with user approval gate)
- Do not remove the max 2 revision cycles rule

## Success Criteria

1. All files updated per the table above
2. No references to the old MCP server, JSON files, Postgres, or `docs/dev-team/` anywhere
3. All Task Orchestrator tool calls use correct tool names (`create_work_tree`, `manage_notes`, `advance_item`, `get_next_item`, `query_items`, `get_context`, `manage_dependencies`, `get_work_item`, `update_work_item`)
4. Note keys are consistent across all agents (see Note Convention Map)
5. The `/dev-team` command works end-to-end: scope → PM creates work tree → Devs plan → Supervisor reviews → User approves → Devs implement → Supervisor reviews → Done
6. `install.sh` works for project and global installs
7. README accurately describes the new setup

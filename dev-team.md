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

#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { SKILL_ASSETS } from "./assets.js";

// ─── Helpers ────────────────────────────────────────────

/** Resolve the .claude directory — project-local or global */
function resolveTarget(global: boolean): string {
  return global
    ? path.join(process.env.HOME ?? "~", ".claude")
    : path.join(process.cwd(), ".claude");
}

/** Check if a file exists */
async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Recursively find CLAUDE.md files upward from cwd */
async function findClaudeMdFiles(): Promise<string[]> {
  const found: string[] = [];
  let dir = process.cwd();
  const root = path.parse(dir).root;

  while (dir !== root) {
    for (const name of ["CLAUDE.md", ".claude/CLAUDE.md"]) {
      const candidate = path.join(dir, name);
      if (await exists(candidate)) found.push(candidate);
    }
    dir = path.dirname(dir);
  }
  return found;
}

/** Read and concatenate all CLAUDE.md content */
async function extractGovernanceRules(): Promise<string> {
  const files = await findClaudeMdFiles();
  if (files.length === 0) return "";

  const sections: string[] = [];
  for (const f of files) {
    const content = await fs.readFile(f, "utf-8");
    sections.push(`# From ${f}\n\n${content}`);
  }
  return sections.join("\n\n---\n\n");
}

/** Read all status files and return consolidated view */
async function readStatusFiles(): Promise<
  { taskId: string; content: string }[]
> {
  const statusDir = path.join(process.cwd(), "docs/dev-team/status");
  if (!(await exists(statusDir))) return [];

  const files = await fs.readdir(statusDir);
  const results: { taskId: string; content: string }[] = [];

  for (const file of files.filter((f) => f.endsWith(".md"))) {
    const content = await fs.readFile(path.join(statusDir, file), "utf-8");
    const taskId = file.replace("-done.md", "").replace("task-", "");
    results.push({ taskId, content });
  }
  return results;
}

/** Simple SQLite-free JSON history store */
const HISTORY_FILE = path.join(
  process.env.HOME ?? "~",
  ".claude",
  "dev-team-history.json"
);

interface RunRecord {
  id: string;
  timestamp: string;
  project: string;
  scope: string;
  taskCount: number;
  status: "planning" | "implementing" | "complete" | "failed";
  tasks: { id: string; title: string; status: string }[];
}

async function loadHistory(): Promise<RunRecord[]> {
  try {
    const data = await fs.readFile(HISTORY_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveHistory(records: RunRecord[]): Promise<void> {
  const dir = path.dirname(HISTORY_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(HISTORY_FILE, JSON.stringify(records, null, 2));
}

// ─── Server Setup ───────────────────────────────────────

const server = new McpServer({
  name: "dev-team",
  version: "1.0.0",
});

// ─── Tool: dev_team_install ─────────────────────────────

server.tool(
  "dev_team_install",
  "Install the agentic dev team skill into a project. Creates skill files, agent definitions, slash command, and output directories. Use --global to install to ~/.claude/ for all projects.",
  {
    global: z
      .boolean()
      .default(false)
      .describe("Install globally to ~/.claude/ instead of project .claude/"),
  },
  async ({ global: isGlobal }) => {
    const target = resolveTarget(isGlobal);
    const installed: string[] = [];

    try {
      for (const asset of SKILL_ASSETS) {
        // The command asset path starts with "../" to go up from skills/ to commands/
        const resolvedPath = asset.path.startsWith("../")
          ? path.join(target, asset.path.slice(3))
          : path.join(target, asset.path);

        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, asset.content, "utf-8");
        installed.push(resolvedPath);
      }

      // Create output directories (project installs only)
      if (!isGlobal) {
        const dirs = [
          "docs/dev-team/plans",
          "docs/dev-team/reviews",
          "docs/dev-team/status",
        ];
        for (const d of dirs) {
          await fs.mkdir(path.join(process.cwd(), d), { recursive: true });
        }
      }

      // Check for CLAUDE.md
      const hasClaudeMd =
        (await exists(path.join(process.cwd(), "CLAUDE.md"))) ||
        (await exists(path.join(process.cwd(), ".claude/CLAUDE.md")));

      const label = isGlobal ? "globally (~/.claude/)" : "to project (.claude/)";
      let msg = `✅ dev-team skill installed ${label}\n\nFiles created:\n${installed.map((f) => `  ${f}`).join("\n")}\n\nUsage: /dev-team <scope description>`;

      if (!hasClaudeMd && !isGlobal) {
        msg +=
          "\n\n⚠️  No CLAUDE.md found. The Dev Supervisor works best with governance rules from CLAUDE.md.";
      }

      return { content: [{ type: "text", text: msg }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Install failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ─── Tool: dev_team_uninstall ───────────────────────────

server.tool(
  "dev_team_uninstall",
  "Remove the agentic dev team skill from a project or global install. Does not remove docs/dev-team/ output artifacts.",
  {
    global: z.boolean().default(false).describe("Remove from ~/.claude/"),
  },
  async ({ global: isGlobal }) => {
    const target = resolveTarget(isGlobal);

    try {
      const skillDir = path.join(target, "skills/dev-team");
      const cmdFile = path.join(target, "commands/dev-team.md");

      if (await exists(skillDir))
        await fs.rm(skillDir, { recursive: true, force: true });
      if (await exists(cmdFile)) await fs.rm(cmdFile, { force: true });

      const label = isGlobal ? "globally" : "from project";
      return {
        content: [
          {
            type: "text",
            text: `✅ dev-team skill removed ${label}.\n\nNote: docs/dev-team/ artifacts were preserved.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Uninstall failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ─── Tool: dev_team_init ────────────────────────────────

server.tool(
  "dev_team_init",
  "Initialize a dev-team run: scaffold docs/dev-team/ directories, read CLAUDE.md files, extract governance rules into structured output. Call this at the start of every dev-team session.",
  {},
  async () => {
    try {
      // Scaffold directories
      const dirs = [
        "docs/dev-team/plans",
        "docs/dev-team/reviews",
        "docs/dev-team/status",
      ];
      for (const d of dirs) {
        await fs.mkdir(path.join(process.cwd(), d), { recursive: true });
      }

      // Extract governance
      const rules = await extractGovernanceRules();
      const govPath = path.join(
        process.cwd(),
        "docs/dev-team/governance-rules.md"
      );

      if (rules) {
        await fs.writeFile(govPath, rules, "utf-8");
        return {
          content: [
            {
              type: "text",
              text: `✅ Initialized docs/dev-team/\n\nGovernance rules extracted from CLAUDE.md and saved to docs/dev-team/governance-rules.md\n\n---\n\n${rules}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `✅ Initialized docs/dev-team/\n\n⚠️  No CLAUDE.md found in project hierarchy. Governance rules file not created.\n\nThe Dev Supervisor will have no governance rules to enforce. Consider creating a CLAUDE.md first.`,
            },
          ],
        };
      }
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Init failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ─── Tool: dev_team_status ──────────────────────────────

server.tool(
  "dev_team_status",
  "Get consolidated status of the current dev-team run. Reads task manifest, all status files, and review files to produce a unified view.",
  {},
  async () => {
    try {
      const base = path.join(process.cwd(), "docs/dev-team");

      // Read manifest
      const manifestPath = path.join(base, "task-manifest.md");
      const manifest = (await exists(manifestPath))
        ? await fs.readFile(manifestPath, "utf-8")
        : null;

      // Read status files
      const statuses = await readStatusFiles();

      // Read reviews
      const reviewDir = path.join(base, "reviews");
      const reviews: { name: string; content: string }[] = [];
      if (await exists(reviewDir)) {
        for (const f of await fs.readdir(reviewDir)) {
          if (f.endsWith(".md")) {
            reviews.push({
              name: f,
              content: await fs.readFile(path.join(reviewDir, f), "utf-8"),
            });
          }
        }
      }

      // Build report
      const parts: string[] = ["# Dev Team Status\n"];

      if (!manifest) {
        parts.push(
          "No task manifest found. Run has not started or docs/dev-team/ is empty."
        );
      } else {
        parts.push("## Task Manifest\n", manifest, "\n");
      }

      if (statuses.length > 0) {
        parts.push("## Task Completion Status\n");
        for (const s of statuses) {
          parts.push(`### Task ${s.taskId}\n`, s.content, "\n");
        }
      }

      if (reviews.length > 0) {
        parts.push("## Reviews\n");
        for (const r of reviews) {
          parts.push(`### ${r.name}\n`, r.content, "\n");
        }
      }

      return { content: [{ type: "text", text: parts.join("\n") }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Status read failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ─── Tool: dev_team_validate_deps ───────────────────────

server.tool(
  "dev_team_validate_deps",
  "Validate that a list of package dependencies actually exist in their registries. Checks npm for node packages and PyPI for Python packages. Returns verification results for each.",
  {
    packages: z
      .array(
        z.object({
          name: z.string().describe("Package name"),
          version: z
            .string()
            .optional()
            .describe("Specific version to check (optional)"),
          registry: z
            .enum(["npm", "pypi"])
            .default("npm")
            .describe("Package registry"),
        })
      )
      .describe("List of packages to validate"),
  },
  async ({ packages }) => {
    const results: string[] = [];

    for (const pkg of packages) {
      try {
        if (pkg.registry === "npm") {
          const query = pkg.version ? `${pkg.name}@${pkg.version}` : pkg.name;
          const output = execSync(`npm info ${query} version 2>&1`, {
            encoding: "utf-8",
            timeout: 10000,
          }).trim();

          if (output) {
            results.push(`✅ ${pkg.name}${pkg.version ? `@${pkg.version}` : ""} — exists (latest: ${output})`);
          } else {
            results.push(`❌ ${pkg.name} — not found on npm`);
          }
        } else {
          // PyPI check via HTTPS
          const output = execSync(
            `pip index versions ${pkg.name} 2>&1 || pip show ${pkg.name} 2>&1`,
            { encoding: "utf-8", timeout: 10000 }
          ).trim();

          if (
            output.includes("Available versions:") ||
            output.includes("Name:")
          ) {
            results.push(`✅ ${pkg.name} — exists on PyPI`);
          } else {
            results.push(
              `❌ ${pkg.name} — not found on PyPI (or pip not available)`
            );
          }
        }
      } catch {
        results.push(
          `⚠️  ${pkg.name} — could not verify (command failed or timed out)`
        );
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `# Dependency Validation Results\n\n${results.join("\n")}`,
        },
      ],
    };
  }
);

// ─── Tool: dev_team_history ─────────────────────────────

server.tool(
  "dev_team_history",
  "View or record dev-team run history. Stores run metadata in ~/.claude/dev-team-history.json. Use action 'list' to view past runs, 'record' to log a new run, 'get' to retrieve a specific run.",
  {
    action: z.enum(["list", "record", "get"]).describe("Action to perform"),
    run: z
      .object({
        id: z.string().optional(),
        scope: z.string().optional(),
        taskCount: z.number().optional(),
        status: z
          .enum(["planning", "implementing", "complete", "failed"])
          .optional(),
        tasks: z
          .array(z.object({ id: z.string(), title: z.string(), status: z.string() }))
          .optional(),
      })
      .optional()
      .describe("Run data (for record action)"),
    runId: z
      .string()
      .optional()
      .describe("Run ID to retrieve (for get action)"),
  },
  async ({ action, run, runId }) => {
    try {
      const history = await loadHistory();

      if (action === "list") {
        if (history.length === 0) {
          return {
            content: [{ type: "text", text: "No dev-team runs recorded yet." }],
          };
        }
        const summary = history
          .slice(-20) // last 20 runs
          .map(
            (r) =>
              `- **${r.id}** (${r.timestamp}) — ${r.project}\n  Scope: ${r.scope}\n  Tasks: ${r.taskCount} | Status: ${r.status}`
          )
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `# Dev Team Run History (last ${Math.min(history.length, 20)})\n\n${summary}`,
            },
          ],
        };
      }

      if (action === "record" && run) {
        const record: RunRecord = {
          id: run.id ?? `run-${Date.now()}`,
          timestamp: new Date().toISOString(),
          project: process.cwd(),
          scope: run.scope ?? "(no scope recorded)",
          taskCount: run.taskCount ?? 0,
          status: run.status ?? "planning",
          tasks: run.tasks ?? [],
        };
        history.push(record);
        await saveHistory(history);

        return {
          content: [
            {
              type: "text",
              text: `✅ Run recorded: ${record.id}`,
            },
          ],
        };
      }

      if (action === "get" && runId) {
        const found = history.find((r) => r.id === runId);
        if (!found) {
          return {
            content: [{ type: "text", text: `Run ${runId} not found.` }],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `# Run: ${found.id}\n\n- **Date**: ${found.timestamp}\n- **Project**: ${found.project}\n- **Scope**: ${found.scope}\n- **Tasks**: ${found.taskCount}\n- **Status**: ${found.status}\n\n## Tasks\n${found.tasks.map((t) => `- ${t.id}: ${t.title} (${t.status})`).join("\n")}`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: "Invalid action or missing parameters." }],
        isError: true,
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `❌ History error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ─── Tool: dev_team_check_installed ─────────────────────

server.tool(
  "dev_team_check_installed",
  "Check whether the dev-team skill is installed in the current project or globally. Returns what's found and what's missing.",
  {},
  async () => {
    const checks = [
      { label: "Project skill", path: path.join(process.cwd(), ".claude/skills/dev-team/SKILL.md") },
      { label: "Project command", path: path.join(process.cwd(), ".claude/commands/dev-team.md") },
      { label: "Project agents", path: path.join(process.cwd(), ".claude/skills/dev-team/agents") },
      { label: "Global skill", path: path.join(process.env.HOME ?? "~", ".claude/skills/dev-team/SKILL.md") },
      { label: "Global command", path: path.join(process.env.HOME ?? "~", ".claude/commands/dev-team.md") },
      { label: "Global agents", path: path.join(process.env.HOME ?? "~", ".claude/skills/dev-team/agents") },
      { label: "Output dirs", path: path.join(process.cwd(), "docs/dev-team") },
      { label: "CLAUDE.md", path: path.join(process.cwd(), "CLAUDE.md") },
    ];

    const results: string[] = [];
    for (const c of checks) {
      const found = await exists(c.path);
      results.push(`${found ? "✅" : "❌"} ${c.label}: ${c.path}`);
    }

    return {
      content: [
        {
          type: "text",
          text: `# Dev Team Installation Check\n\n${results.join("\n")}`,
        },
      ],
    };
  }
);

// ─── Start Server ───────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});

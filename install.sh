#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="2.0.0"

usage() {
    cat <<EOF
dev-team skill installer v${VERSION}

Usage:
  ./install.sh              Install to current project (.claude/)
  ./install.sh --global     Install globally (~/.claude/)
  ./install.sh --uninstall  Remove from current project
  ./install.sh --uninstall --global  Remove globally
  ./install.sh --help       Show this message

Prerequisites:
  - Docker (for Task Orchestrator)
  - docker pull ghcr.io/jpicklyk/task-orchestrator:latest

After installing, use:
  /dev-team <scope description>
EOF
}

install_skill() {
    local target="$1"
    local label="$2"

    echo "Installing dev-team skill ${label}..."

    # Skill files
    mkdir -p "$target/skills/dev-team/agents"
    cp "$SCRIPT_DIR/SKILL.md" "$target/skills/dev-team/"
    cp "$SCRIPT_DIR/project-manager.md" "$target/skills/dev-team/agents/"
    cp "$SCRIPT_DIR/dev-supervisor.md" "$target/skills/dev-team/agents/"
    cp "$SCRIPT_DIR/developer.md" "$target/skills/dev-team/agents/"

    # Slash command
    mkdir -p "$target/commands"
    cp "$SCRIPT_DIR/dev-team.md" "$target/commands/"

    echo ""
    echo "Installed successfully ${label}"
    echo ""
    echo "Files:"
    echo "  $target/skills/dev-team/SKILL.md"
    echo "  $target/skills/dev-team/agents/project-manager.md"
    echo "  $target/skills/dev-team/agents/dev-supervisor.md"
    echo "  $target/skills/dev-team/agents/developer.md"
    echo "  $target/commands/dev-team.md"
    echo ""

    # Check for Task Orchestrator in .mcp.json
    if [[ "$target" != "$HOME/.claude" ]]; then
        local mcp_json=".mcp.json"
        if [[ -f "$mcp_json" ]] && grep -q "task-orchestrator" "$mcp_json" 2>/dev/null; then
            echo "Task Orchestrator found in .mcp.json"
        else
            echo "WARNING: Task Orchestrator not found in .mcp.json"
            echo "  The dev-team skill requires Task Orchestrator for persistence."
            echo ""
            echo "  Setup:"
            echo "    docker pull ghcr.io/jpicklyk/task-orchestrator:latest"
            echo ""
            echo "  Add to your .mcp.json:"
            echo '    {'
            echo '      "mcpServers": {'
            echo '        "task-orchestrator": {'
            echo '          "command": "docker",'
            echo '          "args": ["run", "--rm", "-i", "-v", "dev-team-data:/app/data", "ghcr.io/jpicklyk/task-orchestrator:latest"]'
            echo '        }'
            echo '      }'
            echo '    }'
        fi
    fi

    # Check for CLAUDE.md
    if [[ "$target" != "$HOME/.claude" ]] && [[ ! -f "CLAUDE.md" ]] && [[ ! -f ".claude/CLAUDE.md" ]]; then
        echo ""
        echo "NOTE: No CLAUDE.md found in this project."
        echo "  The Dev Supervisor enforces governance rules from CLAUDE.md."
        echo "  Consider creating one for best results."
    fi

    echo ""
    echo "Usage:  /dev-team <scope description>"
}

uninstall_skill() {
    local target="$1"
    local label="$2"

    echo "Removing dev-team skill ${label}..."

    rm -rf "$target/skills/dev-team"
    rm -f "$target/commands/dev-team.md"

    echo "Removed ${label}"
}

# Parse arguments
GLOBAL=false
UNINSTALL=false

for arg in "$@"; do
    case "$arg" in
        --global)  GLOBAL=true ;;
        --uninstall) UNINSTALL=true ;;
        --help|-h) usage; exit 0 ;;
        *) echo "Unknown option: $arg"; usage; exit 1 ;;
    esac
done

if $GLOBAL; then
    TARGET="$HOME/.claude"
    LABEL="globally (~/.claude/)"
else
    TARGET=".claude"
    LABEL="to project (.claude/)"
fi

if $UNINSTALL; then
    uninstall_skill "$TARGET" "$LABEL"
else
    install_skill "$TARGET" "$LABEL"
fi

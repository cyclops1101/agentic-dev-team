#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="1.0.0"

usage() {
    cat <<EOF
dev-team skill installer v${VERSION}

Usage:
  ./install.sh              Install to current project (.claude/)
  ./install.sh --global     Install globally (~/.claude/)
  ./install.sh --uninstall  Remove from current project
  ./install.sh --uninstall --global  Remove globally
  ./install.sh --help       Show this message

After installing, use:
  /dev-team <scope description>
EOF
}

install_skill() {
    local target="$1"
    local label="$2"

    echo "📦 Installing dev-team skill ${label}..."

    # Skill files
    mkdir -p "$target/skills/dev-team/agents"
    cp "$SCRIPT_DIR/SKILL.md" "$target/skills/dev-team/"
    cp "$SCRIPT_DIR/agents/"*.md "$target/skills/dev-team/agents/"

    # Slash command
    mkdir -p "$target/commands"
    cp "$SCRIPT_DIR/commands/dev-team.md" "$target/commands/"

    # Output directories (only for project installs)
    if [[ "$target" != "$HOME/.claude" ]]; then
        mkdir -p "docs/dev-team/plans" "docs/dev-team/reviews" "docs/dev-team/status"
    fi

    echo ""
    echo "✅ Installed successfully ${label}"
    echo ""
    echo "Files:"
    echo "  $target/skills/dev-team/SKILL.md"
    echo "  $target/skills/dev-team/agents/project-manager.md"
    echo "  $target/skills/dev-team/agents/dev-supervisor.md"
    echo "  $target/skills/dev-team/agents/developer.md"
    echo "  $target/commands/dev-team.md"
    echo ""
    echo "Usage:  /dev-team <scope description>"
    echo ""

    # Check for CLAUDE.md
    if [[ "$target" != "$HOME/.claude" ]] && [[ ! -f "CLAUDE.md" ]] && [[ ! -f ".claude/CLAUDE.md" ]]; then
        echo "⚠️  No CLAUDE.md found in this project."
        echo "   The Dev Supervisor enforces governance rules from CLAUDE.md."
        echo "   Consider creating one for best results."
    fi
}

uninstall_skill() {
    local target="$1"
    local label="$2"

    echo "🗑️  Removing dev-team skill ${label}..."

    rm -rf "$target/skills/dev-team"
    rm -f "$target/commands/dev-team.md"

    echo "✅ Removed ${label}"
    echo ""
    echo "Note: docs/dev-team/ output artifacts were not removed."
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

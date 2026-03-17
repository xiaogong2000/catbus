#!/usr/bin/env bash
set -euo pipefail

# CatBus Skills Hub - Batch installer for 90 curated OpenClaw skills
# Usage:
#   ./install.sh                    # Install all 90 skills
#   ./install.sh --category devops  # Install one category
#   ./install.sh --list             # List all skills
#   ./install.sh --dry-run          # Show what would be installed

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

CATEGORY_NAMES="development browser research devops git agent productivity security data-media"

skills_for_category() {
  case "$1" in
    development)  echo "code-security-audit bug-audit debug-methodology auto-test-generator astrai-code-review architecture-research agentlens ftw dependency-auditor context-builder" ;;
    browser)      echo "super-browser agent-browser mac-use n8n-workflow browser-use mcp-chrome actionbook android-adb camoufox cdp-browser" ;;
    research)     echo "super-research web-search-pro exa-search academic-deep-research agent-deep-research tavily autonomous-research arxiv-watcher content-research meyhem-researcher" ;;
    devops)       echo "agentic-devops docker-skill cloudflare-guard grafana-lens aws-infra neo-tf-module-generator neo-docker-to-k8s-manifests ansible-skill aws-ecs-monitor azure-infra" ;;
    git)          echo "super-github conventional-commits git-changelog git-essentials git-workflows git-pushing arc-skill-gitops auto-pr-merger repo-pr-triage fork-manager" ;;
    agent)        echo "capability-evolver self-improving-agent adaptive-reasoning agent-guardrails agent-cost-monitor agent-orchestrator agent-mode-upgrades cortex-memory agent-sentinel agora-council" ;;
    productivity) echo "mission-control clawflows summarize agent-autopilot meeting-to-action cairn-cli asana adaptlypost blogburst ai-daily-briefing" ;;
    security)     echo "agent-safety agents-skill-security-audit credential-scanner agent-hardening ggshield-scanner credential-manager 1password bitwarden domain-trust-check secure-auth-patterns" ;;
    data-media)   echo "gog composio elevenlabs-agent openai-whisper faster-whisper data-analyst csv-pipeline duckdb-en senior-data-scientist supabase" ;;
    *) echo "" ;;
  esac
}

label_for_category() {
  case "$1" in
    development)  echo "Development & Coding" ;;
    browser)      echo "Browser & Automation" ;;
    research)     echo "Search & Research" ;;
    devops)       echo "DevOps & Cloud" ;;
    git)          echo "Git & GitHub" ;;
    agent)        echo "AI & Agent Intelligence" ;;
    productivity) echo "Productivity & Workflow" ;;
    security)     echo "Security & Safety" ;;
    data-media)   echo "Data, Media & Integration" ;;
    *) echo "$1" ;;
  esac
}

print_header() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║   CatBus Skills Hub Installer            ║${NC}"
  echo -e "${BLUE}║   90 Curated OpenClaw Skills (9 × 10)    ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
  echo ""
}

list_skills() {
  echo -e "${YELLOW}Available categories and skills (90 total):${NC}"
  echo ""
  local total=0
  for cat in $CATEGORY_NAMES; do
    local label
    label=$(label_for_category "$cat")
    echo -e "  ${GREEN}[$cat]${NC} ${CYAN}$label${NC}"
    local count=0
    for skill in $(skills_for_category "$cat"); do
      count=$((count + 1))
      printf "    %2d. %s\n" "$count" "$skill"
    done
    total=$((total + count))
    echo ""
  done
  echo -e "${YELLOW}Total: $total skills${NC}"
}

install_skill() {
  local skill="$1"
  local dry_run="${2:-false}"

  if [ "$dry_run" = "true" ]; then
    echo -e "  ${YELLOW}[DRY RUN]${NC} Would install: $skill"
    return 0
  fi

  echo -ne "  ${BLUE}Installing${NC} $skill... "
  if clawhub install "$skill" 2>/dev/null; then
    echo -e "${GREEN}✓${NC}"
  else
    echo -e "${RED}✗${NC} (try: clawhub install $skill)"
  fi
}

install_category() {
  local category="$1"
  local dry_run="${2:-false}"
  local skills
  skills=$(skills_for_category "$category")

  if [ -z "$skills" ]; then
    echo -e "${RED}Unknown category: $category${NC}"
    echo "Valid categories: $CATEGORY_NAMES"
    exit 1
  fi

  local label
  label=$(label_for_category "$category")
  echo -e "\n${GREEN}▸ $label${NC} ${CYAN}[$category]${NC}"
  for skill in $skills; do
    install_skill "$skill" "$dry_run"
  done
}

check_cli() {
  if ! command -v clawhub &>/dev/null; then
    echo -e "${RED}Error: clawhub CLI not found.${NC}"
    echo "Install with: npm install -g clawhub"
    echo "Or use:       npx clawhub@latest install <skill-name>"
    exit 1
  fi
}

# Parse args
DRY_RUN=false
CATEGORY=""
ACTION="install-all"

while [[ $# -gt 0 ]]; do
  case $1 in
    --category|-c)
      CATEGORY="$2"
      ACTION="install-category"
      shift 2
      ;;
    --list|-l)
      ACTION="list"
      shift
      ;;
    --dry-run|-n)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      print_header
      echo "Usage: ./install.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --category, -c <name>  Install a specific category"
      echo "  --list, -l             List all skills by category"
      echo "  --dry-run, -n          Show what would be installed"
      echo "  --help, -h             Show this help"
      echo ""
      echo "Categories: $CATEGORY_NAMES"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

print_header

case $ACTION in
  list)
    list_skills
    ;;
  install-category)
    [ "$DRY_RUN" = "false" ] && check_cli
    install_category "$CATEGORY" "$DRY_RUN"
    echo -e "\n${GREEN}Done!${NC}"
    ;;
  install-all)
    [ "$DRY_RUN" = "false" ] && check_cli
    echo -e "${GREEN}Installing all 90 skills across 9 categories...${NC}"
    for cat in $CATEGORY_NAMES; do
      install_category "$cat" "$DRY_RUN"
    done
    echo -e "\n${GREEN}╔══════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   All 90 skills installed! 🎉    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════╝${NC}"
    ;;
esac

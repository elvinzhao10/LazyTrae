#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
bash "$REPO_ROOT/.trae/hooks/context-recovery.sh" recover

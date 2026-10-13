#!/usr/bin/env bash
set -euo pipefail
version=2.75.0
tools_dir="${GAMI_TOOLS_DIR:-/workspace/tools}"
if [ -x "$tools_dir/supabase" ] && [ "$("$tools_dir/supabase" --version)" = "$version" ]; then exit 0; fi
case "$(uname -m)" in x86_64) arch=amd64;; aarch64|arm64) arch=arm64;; *) echo 'Unsupported architecture'; exit 1;; esac
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
artifact="supabase_linux_${arch}.tar.gz"
base="https://github.com/supabase/cli/releases/download/v${version}"
curl -fsSL "$base/$artifact" -o "$stage/$artifact"
curl -fsSL "$base/supabase_${version}_checksums.txt" -o "$stage/checksums.txt"
(cd "$stage"; awk -v name="$artifact" '$2 == name {print}' checksums.txt > selected.txt; test -s selected.txt; sha256sum --check selected.txt)
mkdir -p "$tools_dir"
tar -xzf "$stage/$artifact" -C "$tools_dir" supabase
"$tools_dir/supabase" --version

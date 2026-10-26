#!/usr/bin/env bash
exec > "/tmp/claude-501/-Users-estaff-agent-Workspace-website-designer/2c62b3e2-faa9-41b2-ae92-992d319b8da7/scratchpad/probe3.out" 2>&1
# cron と同じ実行経路で codex の挙動を確認する診断用スクリプト（本日のラン画像3枚）
cd /Users/estaff-agent/Workspace/website-designer
R=docs/quality/runs/corporate-20260919-0500/motion
IMGS=()
for f in $R/*-full.jpg; do IMGS+=(-i "$f"); done
echo "== 画像 $(( ${#IMGS[@]} / 2 )) 枚 =="
ls -la $R/*-full.jpg
echo "== codex（3枚）=="
echo 'これらの画像の基調色をそれぞれ一言で。' | codex exec --skip-git-repo-check "${IMGS[@]}" 2>&1 | tail -12
echo "== codex（1枚）=="
echo 'この画像の基調色を一言で。' | codex exec --skip-git-repo-check -i "$(ls $R/*-full.jpg | head -1)" 2>&1 | tail -6
echo "== 終了 =="

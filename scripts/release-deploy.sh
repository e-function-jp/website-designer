#!/usr/bin/env bash
#
# Website Designer 本番デプロイ (release ブランチ + GitHub webhook 方式)
# Usage: ./scripts/release-deploy.sh [--skip-build] [--dry-run|-n] [--no-wait]
#
# 構成:
#   main    = ソース
#   release = ビルド成果物 (dist/ の中身をそのまま載せた孤立ブランチ)
#
#   ローカルで build → dist/ を release へコミット → git push
#     → GitHub webhook → <docroot>/_hook/deploy.php → サーバ側で git pull + rsync
#
# SSH が IP 制限で使えない環境でも、GitHub への push だけで本番へ反映できる。
# 旧 rsync 方式 (scripts/deploy-prod.sh (未整備)) は SSH が通る環境用の緊急手段として残置。
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RELEASE_BRANCH="release"
WORKTREE="${PROJECT_ROOT}/.release-worktree"
DIST="${PROJECT_ROOT}/dist"
APP_URL="https://website.e-function.site"
POLL_TIMEOUT=300   # 秒。webhook 反映を待つ上限
POLL_INTERVAL=10

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
die() { echo "${RED}エラー: $*${NC}" >&2; exit 1; }

SKIP_BUILD=""; DRY_RUN=""; NO_WAIT=""; SKIP_CHECK=""
for a in "$@"; do case "$a" in
  --skip-build) SKIP_BUILD=1;;
  --dry-run|-n) DRY_RUN=1;;
  --no-wait)    NO_WAIT=1;;
  --skip-check) SKIP_CHECK=1;;
  *) die "不明な引数: $a";;
esac; done

cd "$PROJECT_ROOT"

SOURCE_SHA="$(git rev-parse HEAD)"
SOURCE_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEPLOY_ID="${SOURCE_SHA:0:12}-${STAMP}"

echo "=========================================="
echo -e "${RED}Website Designer 本番デプロイ${NC}  ${APP_URL}"
echo "=========================================="
echo "ソース  : ${SOURCE_BRANCH} @ ${SOURCE_SHA:0:12}"
echo "deploy_id: ${DEPLOY_ID}"

# 1) ビルド
if [[ -z "$SKIP_BUILD" ]]; then
  echo "--- build ---"
  npm run build || die "build 失敗"
fi
[[ -d "$DIST" ]] || die "${DIST} が無い (先に build が必要)"

# 1.5) 品質ゲート
#     LP と違い website は「サイト全体で URL が閉じているか」が品質そのもので、
#     リンク切れや必須ページ欠落を本番へ出す意味がない。
#     ここを通さずに出荷したい場合は --skip-check を明示する。
if [[ -z "$SKIP_CHECK" ]]; then
  echo "--- 品質チェック (high があれば中止) ---"
  node "${SCRIPT_DIR}/web-quality-check.mjs" || die "品質チェック失敗"
  python3 - "${PROJECT_ROOT}/docs/quality/latest.md" <<'PYEOF'
import re, sys, pathlib
md = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
highs = re.findall(r"^\| 🔴 high \| ([^:]+):", md, re.M)
if highs:
    from collections import Counter
    print("出荷中止: high の指摘が残っています")
    for rule, n in Counter(highs).items():
        print(f"  - {rule}: {n} 件")
    print("docs/quality/latest.md を確認してください（--skip-check で強制可）")
    sys.exit(1)
print("high の指摘なし")
PYEOF
  [[ $? -eq 0 ]] || die "品質ゲートで停止"

  # 描画検証。静的解析では「出るはずの要素が出ていない」を判定できない。
  # 実測で、静的 100/100 のページがトップの4割空白だった事故がある。
  echo "--- 描画検証 ---"
  node "${SCRIPT_DIR}/web-render-check.mjs" || die "描画検証で high の指摘あり"
fi

# 2) postprocess: 絶対 URL を相対パス化
echo "--- postprocess (URL → relative) ---"
python3 "${SCRIPT_DIR}/web-postprocess-deploy.py" "$DIST" || die "postprocess 失敗"

# 3) version.json: デプロイ到達確認用の目印
#    サーバへ反映されたかどうかを HTTP だけで判定できるようにする。
cat > "${DIST}/version.json" <<JSON
{
  "deploy_id": "${DEPLOY_ID}",
  "source_sha": "${SOURCE_SHA}",
  "source_branch": "${SOURCE_BRANCH}",
  "built_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

# 4) release ブランチの作業ツリーを用意
echo "--- release worktree ---"
git worktree remove --force "$WORKTREE" 2>/dev/null || true
rm -rf "$WORKTREE"

git fetch --quiet origin "$RELEASE_BRANCH" 2>/dev/null || true
if git show-ref --verify --quiet "refs/remotes/origin/${RELEASE_BRANCH}"; then
  git worktree add --quiet -B "$RELEASE_BRANCH" "$WORKTREE" "origin/${RELEASE_BRANCH}"
else
  echo "${YELLOW}origin/${RELEASE_BRANCH} が無いので孤立ブランチとして新規作成します${NC}"
  git worktree add --quiet --detach "$WORKTREE"
  git -C "$WORKTREE" checkout --quiet --orphan "$RELEASE_BRANCH"
  git -C "$WORKTREE" rm -rq --cached . 2>/dev/null || true
fi

# 5) dist/ の中身を release 作業ツリーへ同期
#    worktree の .git ファイルだけは消さない。
rsync -a --delete --exclude='.git' --exclude='.DS_Store' "${DIST}/" "${WORKTREE}/"

git -C "$WORKTREE" add -A
if git -C "$WORKTREE" diff --cached --quiet; then
  echo "${YELLOW}ビルド成果物に変更なし。デプロイをスキップします${NC}"
  git worktree remove --force "$WORKTREE"
  exit 0
fi

CHANGED="$(git -C "$WORKTREE" diff --cached --numstat | wc -l | tr -d ' ')"
echo "変更ファイル: ${CHANGED} 件"

if [[ -n "$DRY_RUN" ]]; then
  git -C "$WORKTREE" diff --cached --stat | tail -20
  echo -e "${GREEN}[DRY-RUN] 上記が release へ載る。push はしない${NC}"
  git -C "$WORKTREE" reset -q
  git worktree remove --force "$WORKTREE"
  exit 0
fi

git -C "$WORKTREE" commit -q -m "deploy ${DEPLOY_ID}

source: ${SOURCE_BRANCH} @ ${SOURCE_SHA}
files:  ${CHANGED}"

# 6) push → GitHub webhook がサーバ側の git pull を起動する
echo "--- push ---"
git -C "$WORKTREE" push -q origin "$RELEASE_BRANCH" || die "push 失敗"
RELEASE_SHA="$(git -C "$WORKTREE" rev-parse HEAD)"
echo "release @ ${RELEASE_SHA:0:12} を push しました"
git worktree remove --force "$WORKTREE"

[[ -z "$NO_WAIT" ]] || { echo "${YELLOW}--no-wait: 反映確認をスキップ${NC}"; exit 0; }

# 7) 反映確認: version.json の deploy_id が一致するまでポーリング
#    rsync 方式の「HTTP 200 が返るか」だけの確認と違い、
#    今回の成果物が本当に届いたかを判定できる。
echo "--- 反映確認 (最大 ${POLL_TIMEOUT}s) ---"
elapsed=0
while (( elapsed < POLL_TIMEOUT )); do
  got="$(curl -fsS -m 15 "${APP_URL}/version.json?_=${elapsed}" 2>/dev/null \
         | python3 -c 'import json,sys; print(json.load(sys.stdin).get("deploy_id",""))' 2>/dev/null || true)"
  if [[ "$got" == "$DEPLOY_ID" ]]; then
    echo -e "${GREEN}デプロイ完了${NC}  ${APP_URL}  (${elapsed}s)"
    exit 0
  fi
  sleep "$POLL_INTERVAL"
  elapsed=$(( elapsed + POLL_INTERVAL ))
  echo "  待機中... ${elapsed}s (現在の deploy_id: ${got:-取得できず})"
done

die "反映確認タイムアウト。GitHub の webhook 配信履歴と ~/.website-deploy/deploy.log を確認すること"

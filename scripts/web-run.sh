#!/usr/bin/env bash
# 学習ラン 1 回分を通しで実行する。
#
#   1. 参照サイトのモーション実測 + キャプチャ
#   2. Look（codex / 画像を見る）
#   3. Direction ×2（grok-4.5 / hermes）
#   4. 画像生成（grok-imagine / hermes）
#   5. 実装 ×2（minimax-m3 / hermes opencode-go）
#   6. 品質チェック + 独立judge採点
#
# 使い方:
#   bash scripts/web-run.sh <run_dir> [--from <step>] [--skip-images]
#     step: motion | look | direction | images | implement | measure
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RUN_DIR="${1:?run_dir required}"; shift || true
FROM="motion"
SKIP_IMAGES=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) FROM="$2"; shift 2 ;;
    --skip-images) SKIP_IMAGES=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

JOB="$RUN_DIR/job.json"
[[ -f "$JOB" ]] || { echo "job.json がありません: $JOB（先に npm run next:run）" >&2; exit 1; }
SITE_TYPE="$(python3 -c "import json;print(json.load(open('$JOB'))['site_type'])")"
STAMP="$(python3 -c "import json;print(json.load(open('$JOB'))['stamp'])")"
REF_URL="$(python3 -c "import json;print(json.load(open('$JOB'))['reference'].get('url',''))")"
MODELS="$(python3 -c "import json;print(' '.join(json.load(open('$JOB'))['models']))")"

order=(motion look direction images implement measure)
started=0
should() {
  local step="$1"
  for s in "${order[@]}"; do
    [[ "$s" == "$FROM" ]] && started=1
    [[ "$s" == "$step" ]] && { [[ $started -eq 1 ]] && return 0 || return 1; }
  done
  return 1
}

if should motion; then
  echo "### 1/6 モーション実測 ($REF_URL)"
  [[ -n "$REF_URL" ]] || { echo "参照URLがありません" >&2; exit 1; }
  node scripts/web-analyze-reference-motion.mjs --url="$REF_URL" --out="$RUN_DIR" --follow-nav=2
fi

if should look; then
  echo "### 2/6 Look（codex）"
  bash scripts/web-look-analyze.sh "$RUN_DIR"
fi

if should direction; then
  for v in $MODELS; do
    echo "### 3/6 Direction: $v"
    bash scripts/web-direction.sh "$RUN_DIR" "$v" || echo "  (充足チェックに引っかかりました。$RUN_DIR/direction-$v.html を確認してください)"
  done
fi

if should images && [[ $SKIP_IMAGES -eq 0 ]]; then
  for v in $MODELS; do
    echo "### 4/6 画像生成: $v"
    node scripts/web-generate-images-from-direction.mjs \
      --run-dir "$RUN_DIR" --category "$SITE_TYPE" --stamp "$STAMP" --variant "$v" || true
  done
fi

if should implement; then
  for v in $MODELS; do
    echo "### 5/6 実装: $v（minimax-m3）"
    bash scripts/web-implement-minimax.sh "$RUN_DIR" "$v"
  done
fi

if should measure; then
  echo "### 6/6 計測"
  npm run check:web
  bash scripts/web-design-score.sh "$RUN_DIR" "$SITE_TYPE" "$STAMP" $MODELS || \
    echo "  (採点をスキップしました。撮影は $RUN_DIR/shots/ にあります)"
fi

echo
echo "完了。次にやること:"
echo "  - $RUN_DIR/design-score-data.json の指摘を読む"
echo "  - Extract: 両案から再利用ブロックを src/components/ へ切り出す"
echo "  - npm run check:web:strict && npm run check:catalog"

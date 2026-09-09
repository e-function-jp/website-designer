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
[[ -f "$JOB" ]] || { echo "job.json がありません: ${JOB}（先に npm run next:run）" >&2; exit 1; }
SITE_TYPE="$(python3 -c "import json;print(json.load(open('$JOB'))['site_type'])")"
STAMP="$(python3 -c "import json;print(json.load(open('$JOB'))['stamp'])")"
REF_URL="$(python3 -c "import json;print(json.load(open('$JOB'))['reference'].get('url',''))")"
MODELS="$(python3 -c "import json;print(' '.join(json.load(open('$JOB'))['models']))")"

order=(motion look brand direction images implement measure)
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
  echo "### 1/7 モーション実測 ($REF_URL)"
  [[ -n "$REF_URL" ]] || { echo "参照URLがありません" >&2; exit 1; }
  node scripts/web-analyze-reference-motion.mjs --url="$REF_URL" --out="$RUN_DIR" --follow-nav=2
fi

if should look; then
  echo "### 2/7 Look（codex）"
  bash scripts/web-look-analyze.sh "$RUN_DIR"
  # Look の成果をサイト種別プレイブックへ蓄積する。
  # ここを飛ばすと解析がラン限りで使い捨てられ、次の Direction に効かない。
  python3 scripts/web-update-playbook.py "$RUN_DIR" "$SITE_TYPE" || \
    echo "  (プレイブック更新に失敗。ラン自体は続行)" >&2
fi

if should brand; then
  echo "### 3/7 ブランド確定（2案で共有する企業設定）"
  bash scripts/web-brand.sh "$RUN_DIR"
fi

if should direction; then
  for v in $MODELS; do
    echo "### 4/7 Direction: ${v}"
    # ディレクションが空のまま次段へ進むと、画像生成も実装も無意味に走って
    # 時間と API を捨てる（実測 2026-09-09: 3ラン全部がこれで無駄になった）。
    # 一時的なプロバイダ失敗は起きるので1回だけ再試行し、駄目ならランを止める。
    if ! bash scripts/web-direction.sh "$RUN_DIR" "${v}"; then
      echo "  ディレクション生成に失敗。60秒待って1回だけ再試行します。" >&2
      sleep 60
      if ! bash scripts/web-direction.sh "$RUN_DIR" "${v}"; then
        echo "  x ディレクション(${v})が2回とも失敗しました。ランを中止します。" >&2
        echo "    $RUN_DIR/direction-${v}.raw.log を確認してください。" >&2
        exit 1
      fi
    fi
  done
fi

if should images && [[ $SKIP_IMAGES -eq 0 ]]; then
  for v in $MODELS; do
    echo "### 5/7 画像生成: $v"
    node scripts/web-generate-images-from-direction.mjs \
      --run-dir "$RUN_DIR" --category "$SITE_TYPE" --stamp "$STAMP" --variant "$v" || true
  done
fi

if should implement; then
  for v in $MODELS; do
    echo "### 6/7 実装: ${v}（minimax-m3）"
    bash scripts/web-implement-minimax.sh "$RUN_DIR" "$v"
  done
fi

if should measure; then
  echo "### 7/7 計測"
  npm run check:web
  bash scripts/web-design-score.sh "$RUN_DIR" "$SITE_TYPE" "$STAMP" $MODELS || \
    echo "  (採点をスキップしました。撮影は $RUN_DIR/shots/ にあります)"
  # 採点の指摘を実装 SKILL へ書き戻す。これが無いと同じ指摘が毎回繰り返される。
  python3 scripts/web-update-skill-from-score.py "$RUN_DIR" || \
    echo "  (SKILL 更新に失敗。採点結果は $RUN_DIR/design-score-data.json にあります)" >&2
fi

echo
echo "完了。次にやること:"
echo "  - $RUN_DIR/design-score-data.json の指摘を読む"
echo "  - Extract: 両案から再利用ブロックを src/components/ へ切り出す"
echo "  - npm run check:web:strict && npm run check:catalog"

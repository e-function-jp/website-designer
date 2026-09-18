#!/usr/bin/env bash
# 学習ラン 1 回分を通しで実行する。
#
#   1. 参照サイトのモーション実測 + キャプチャ
#   2. Look（codex / 画像を見る）
#   3. ブランド確定
#   4. Direction（grok-4.5。ラン1本ぶん）
#   5. 画像生成（grok-imagine）
#   6. たたき台の実装（minimax-m3）
#   7. たたき台を独立judgeで採点 → 直す材料を出す
#   8. 提出版の実装（同じディレクション + 7 の指摘）
#   9. たたき台を破棄し、提出版だけを残す
#  10. 品質チェック + 独立judge採点（提出版）
#
# 2案を並べて勝ちを選ぶ方式はやめた（2026-09-18）。実測3ランで
# a=59/61/38 に対し b=61/69/63 と b が勝ち続けたが、差の大半は
# 「b が後から走り、a の部品と画像を引き継げる」順番の利得と、
# 採点が3ページの静止画だけを見ることによるもので、案の優劣ではなかった。
# 順番の利得を捨てるのではなく、はっきり「たたき台 → 採点 → 提出版」に
# 積み替えて、1ランの成果物を1サイトにする。
#
# 使い方:
#   bash scripts/web-run.sh <run_dir> [--from <step>] [--skip-images]
#     step: motion | look | brand | direction | images | draft | judge-draft | submit | measure
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
# a = たたき台 / b = 提出版。job.json の models は互換のため残しているが、
# ラン内での役割はこの2つに固定する。
DRAFT="a"
SUBMIT="b"

order=(motion look brand direction images draft judge-draft submit measure)
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
  echo "### 1/10 モーション実測 ($REF_URL)"
  [[ -n "$REF_URL" ]] || { echo "参照URLがありません" >&2; exit 1; }
  node scripts/web-analyze-reference-motion.mjs --url="$REF_URL" --out="$RUN_DIR" --follow-nav=2
fi

if should look; then
  echo "### 2/10 Look（codex）"
  # Look が空のまま進むと、中身の無いディレクションが生成される。
  # 一時的なレート制限が起きるので1回だけ再試行し、駄目ならランを止める。
  if ! bash scripts/web-look-analyze.sh "$RUN_DIR"; then
    echo "  Look に失敗。120秒待って1回だけ再試行します。" >&2
    sleep 120
    if ! bash scripts/web-look-analyze.sh "$RUN_DIR"; then
      echo "  x Look が2回とも失敗しました。ランを中止します。" >&2
      exit 1
    fi
  fi
  # Look の成果をサイト種別プレイブックへ蓄積する。
  # ここを飛ばすと解析がラン限りで使い捨てられ、次の Direction に効かない。
  python3 scripts/web-update-playbook.py "$RUN_DIR" "$SITE_TYPE" || \
    echo "  (プレイブック更新に失敗。ラン自体は続行)" >&2
fi

if should brand; then
  echo "### 3/10 ブランド確定"
  bash scripts/web-brand.sh "$RUN_DIR"
fi

if should direction; then
  for v in $DRAFT; do
    echo "### 4/10 Direction"
    # ディレクションが空のまま次段へ進むと、画像生成も実装も無意味に走って
    # 時間と API を捨てる（実測 2026-09-09: 3ラン全部がこれで無駄になった）。
    #
    # primary(grok/xai-oauth) のレート制限は数分続くことがあり、60秒の
    # 一度きりの再試行では足りなかった（実測: 2回とも同じフォールバック失敗）。
    # 待ち時間を伸ばしながら3回まで試し、それでも駄目ならランを止める。
    ok=0
    for wait in 0 90 240; do
      [ "$wait" -gt 0 ] && { echo "  ${wait}秒待って再試行します。" >&2; sleep "$wait"; }
      if bash scripts/web-direction.sh "$RUN_DIR" "${v}"; then ok=1; break; fi
    done
    if [ "$ok" -ne 1 ]; then
      echo "  x ディレクション(${v})が3回とも失敗しました。ランを中止します。" >&2
      echo "    $RUN_DIR/direction-${v}.raw.log を確認してください。" >&2
      echo "    primary が落ちて hermes のフォールバック(opencode-go)へ流れている場合、" >&2
      echo "    そちらは -z ワンショットでは使えないため必ず失敗します。" >&2
      exit 1
    fi
  done
fi

if should images && [[ $SKIP_IMAGES -eq 0 ]]; then
  for v in $DRAFT; do
    echo "### 5/10 画像生成（提出版もこの写真を使う）"
    node scripts/web-generate-images-from-direction.mjs \
      --run-dir "$RUN_DIR" --category "$SITE_TYPE" --stamp "$STAMP" --variant "$v" || true
  done
fi

if should draft; then
  echo "### 6/10 たたき台の実装（minimax-m3）"
  # 実装が空のまま採点へ進むと "not found" 画像に 0 点が付き、
  # その講評が SKILL へ蓄積されて学習を汚す（実測 2026-09-14）。
  if ! bash scripts/web-implement-minimax.sh "$RUN_DIR" "$DRAFT"; then
    echo "  x たたき台の実装に失敗しました。ランを中止します。" >&2
    exit 1
  fi
fi

if should judge-draft; then
  echo "### 7/10 たたき台の採点（独立judge）"
  # 採点は dist を撮る。撮る前にビルドし直さないと、前回のランの
  # 成果物を撮ってしまう。
  npm run build || { echo "  x ビルドに失敗しました。" >&2; exit 1; }
  if ! WEB_DESIGNER_SCORE_STAGE=draft \
       bash scripts/web-design-score.sh "$RUN_DIR" "$SITE_TYPE" "$STAMP" "$DRAFT"; then
    echo "  x たたき台の採点に失敗しました。提出版の材料が無いので中止します。" >&2
    exit 1
  fi
fi

if should submit; then
  echo "### 8/10 提出版の実装（たたき台の指摘を直す）"
  DRAFT_SCORE="$RUN_DIR/design-score-draft.json"
  [[ -f "$DRAFT_SCORE" ]] || {
    echo "  x たたき台の採点結果がありません: $DRAFT_SCORE" >&2
    echo "    --from judge-draft でやり直してください。" >&2
    exit 1
  }
  if ! bash scripts/web-implement-minimax.sh "$RUN_DIR" "$SUBMIT" "$DRAFT_SCORE"; then
    echo "  x 提出版の実装に失敗しました。ランを中止します。" >&2
    exit 1
  fi

  echo "### 9/10 たたき台の破棄（提出版だけを残す）"
  # たたき台は採点のための中間生成物で、サンプル一覧に出す成果物ではない。
  # 採点結果と撮影は $RUN_DIR に残るので、後から何を直したかは追える。
  DRAFT_DIR="src/pages/sites/${SITE_TYPE}/${DRAFT}-${STAMP}"
  if [[ -d "$DRAFT_DIR" ]]; then
    rm -rf "$DRAFT_DIR"
    rm -f "public/thumbs/${SITE_TYPE}/${DRAFT}-${STAMP}.jpg"
    echo "  破棄: $DRAFT_DIR"
  fi
fi

if should measure; then
  echo "### 10/10 計測（提出版）"
  npm run check:web
  bash scripts/web-design-score.sh "$RUN_DIR" "$SITE_TYPE" "$STAMP" "$SUBMIT" || \
    echo "  (採点をスキップしました。撮影は $RUN_DIR/shots/ にあります)"
  # 採点の指摘を実装 SKILL へ書き戻す。これが無いと同じ指摘が毎回繰り返される。
  python3 scripts/web-update-skill-from-score.py "$RUN_DIR" || \
    echo "  (SKILL 更新に失敗。採点結果は $RUN_DIR/design-score-data.json にあります)" >&2
fi

echo
echo "完了。次にやること:"
echo "  - $RUN_DIR/design-score-draft.json（たたき台）と design-score-data.json（提出版）を読む"
echo "  - Extract: 提出版から再利用ブロックを src/components/ へ切り出す"
echo "  - npm run check:web:strict && npm run check:catalog"

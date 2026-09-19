#!/usr/bin/env bash
# Look段（参照サイトの言語化）を codex exec で実行する。
#
# ディレクターは grok（hermes 経由）だが、hermes -z は画像添付に対応していない。
# よって「画像を見て言語化する」役は画像を渡せる codex に任せ、
# grok はその текст とモーション実測 JSON を読んでディレクションする、という分担にする。
#
# 使い方:
#   bash scripts/web-look-analyze.sh <run_dir>
# 前提: web-analyze-reference-motion.mjs が {run_dir}/motion/ を作り終えていること
# 出力: <run_dir>/look-analysis.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RUN_DIR="${1:?run_dir required}"
TEMPLATE="scripts/web-look-prompt-template.txt"
OUT="$RUN_DIR/look-analysis.md"
RAW_LOG="$RUN_DIR/look-analysis.raw.log"
MOTION_DIR="$RUN_DIR/motion"

[[ -f "$MOTION_DIR/summary.json" ]] || {
  echo "モーション実測がありません: $MOTION_DIR/summary.json" >&2
  echo "先に: node scripts/web-analyze-reference-motion.mjs --url=... --out=$RUN_DIR" >&2
  exit 1
}

# キャプチャは motion 解析が保存した {slug}-full.jpg を使う。トップを先頭に。
IMG_ARGS=()
if [[ -f "$MOTION_DIR/top-full.jpg" ]]; then IMG_ARGS+=(-i "$MOTION_DIR/top-full.jpg"); fi
while IFS= read -r f; do
  [[ "$(basename "$f")" == "top-full.jpg" ]] && continue
  IMG_ARGS+=(-i "$f")
done < <(find "$MOTION_DIR" -name '*-full.jpg' | sort | head -3)
[[ ${#IMG_ARGS[@]} -eq 0 ]] && { echo "キャプチャがありません: $MOTION_DIR" >&2; exit 1; }

SITE_META="$(python3 -c "
import json, sys
d = json.load(open('$RUN_DIR/job.json')) if __import__('os').path.exists('$RUN_DIR/job.json') else {}
r = d.get('reference', {})
print('参照サイト:', r.get('title', '-'), r.get('url', ''))
print('ギャラリー業種:', r.get('gallery_industry', '-'), '/ 推定業種:', r.get('industry', '-'))
print('サイト種別:', d.get('site_type_label', '-'))
")"

# summary.json は pages 配列が長くなるので、ディレクター向けの要点だけ渡す
MOTION_SUMMARY="$(python3 -c "
import json
d = json.load(open('$MOTION_DIR/summary.json'))
out = {
  'direction_hints': d.get('direction_hints'),
  'cross_page': d.get('cross_page'),
  'reduced_motion': d.get('reduced_motion'),
  'page_transition': d.get('page_transition'),
  'pages': [{k: p.get(k) for k in ('slug','revealCount','dominantKind','durationMs','easings','viewportsTall','keyframes','libs')} for p in d.get('pages', [])],
}
print(json.dumps(out, ensure_ascii=False, indent=2))
")"

PROMPT="$(cat "$TEMPLATE")"
PROMPT="${PROMPT//\{\{SITE_META\}\}/$SITE_META}"
PROMPT="${PROMPT//\{\{MOTION_SUMMARY\}\}/$MOTION_SUMMARY}"

# モデルは codex 側の設定に従う（env で上書き可）。
LOOK_MODEL="${WEB_DESIGNER_JUDGE_MODEL:-}"
MODEL_ARGS=(); [[ -n "$LOOK_MODEL" ]] && MODEL_ARGS=(-m "$LOOK_MODEL")
LOOK_CMD="${WEB_DESIGNER_LOOK_CMD:-codex}"
IMG_COUNT=$(( ${#IMG_ARGS[@]} / 2 ))

# 出力が「参照サイトの言語化」として成立しているか。
# 実測: codex が node の警告だけ出して終わり、508文字の警告文が
# そのまま次段へ流れたことがある（2026-09-10/11、および 09-16〜19 の cron）。
look_ok() {
  local f="$1"
  [[ -s "$f" ]] || return 1
  local chars; chars="$(wc -m < "$f" | tr -d ' ')"
  [[ "${chars:-0}" -ge 800 ]] || return 1
  grep -q '^#\{1,4\} ' "$f"
}

echo "==> ${LOOK_CMD} exec${LOOK_MODEL:+ ($LOOK_MODEL)} で Look 解析中（画像 ${IMG_COUNT} 枚）"
echo "$PROMPT" | "$LOOK_CMD" exec ${MODEL_ARGS[@]+"${MODEL_ARGS[@]}"} --skip-git-repo-check "${IMG_ARGS[@]}" > "$RAW_LOG" 2>&1 || true

extract_body() {
python3 - "$1" "$2" <<'PYEOF'
import sys, re
raw_path, out_path = sys.argv[1], sys.argv[2]
text = open(raw_path, encoding='utf-8').read()
# codex exec は途中でツールを呼ぶので、**最後**の "codex" 行から
# "tokens used" 行の直前までを最終回答として抜く。
codex_pos = [m.start() for m in re.finditer(r'^codex$', text, re.M)]
tok_pos = [m.start() for m in re.finditer(r'^tokens used', text, re.M)]
if codex_pos:
    last = codex_pos[-1]
    end = next((t for t in tok_pos if t > last), len(text))
    body = text[last + len('codex'):end].strip()
else:
    body = text.strip()
# codex のフック（SessionStart/Stop 等）の進行行が回答の直後に挟まるので除く。
body = re.sub(r'^hook: .*\n?', '', body, flags=re.M).strip()
open(out_path, 'w', encoding='utf-8').write(body + '\n')
PYEOF
}
extract_body "$RAW_LOG" "$OUT"

# codex が落ちたときの代替経路。実測 2026-09-16〜19 の cron で4回連続、
# codex が node の警告だけ出してセッションも作らずに終了した（手動で同じ画像を
# 同じ経路に流すと成功するため、時間帯の資源状況が原因と見ている）。
# ここで止まるとランが丸ごと無駄になるので、画像を扱える別 CLI へ逃がす。
if ! look_ok "$OUT"; then
  FALLBACK_CMD="${WEB_DESIGNER_LOOK_FALLBACK_CMD:-copilot}"
  FALLBACK_MODEL="${WEB_DESIGNER_LOOK_FALLBACK_MODEL:-gpt-5.6-terra}"
  if command -v "$FALLBACK_CMD" >/dev/null 2>&1; then
    echo "  codex の出力が不十分。${FALLBACK_CMD} (${FALLBACK_MODEL}) へ切り替えて再生成します" >&2
    ATT_ARGS=()
    for ((i = 1; i < ${#IMG_ARGS[@]}; i += 2)); do ATT_ARGS+=(--attachment "${IMG_ARGS[$i]}"); done
    "$FALLBACK_CMD" -p "$PROMPT" --model "$FALLBACK_MODEL" --allow-all-tools -s \
      "${ATT_ARGS[@]}" -C "$ROOT" > "$RAW_LOG.fallback" 2>&1 || true
    # copilot は応答本文だけを返すので、そのまま採用してよい
    cp "$RAW_LOG.fallback" "$OUT"
  fi
fi

# 出力の検証。Look が空でも次段（Direction）は走ってしまい、
# 中身の無いディレクションが生成される。実測(2026-09-10/11 の cron):
# codex が node の警告だけ出して終わり、look-analysis.md が 508 文字の
# 警告文になったまま Direction へ流れた。
LINES="$(wc -l < "$OUT" | tr -d ' ')"
CHARS="$(wc -m < "$OUT" | tr -d ' ')"
# 参照サイトの言語化は最低でも数十行になる。見出しが1つも無いのも異常。
if [ "${CHARS:-0}" -lt 800 ] || ! grep -q '^#\{1,4\} ' "$OUT"; then
  echo "  x Look の出力が不十分です（${LINES}行 / ${CHARS}文字、見出しなし）" >&2
  echo "    生ログ: $RAW_LOG" >&2
  if grep -qi "rate.limit\|429\|quota\|unauthorized\|401" "$RAW_LOG" 2>/dev/null; then
    echo "    レート制限か認証エラーの可能性があります。" >&2
  fi
  exit 1
fi

echo "==> 出力: $OUT (${LINES} 行)"

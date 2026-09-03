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

echo "==> codex exec で Look 解析中（画像 $(( ${#IMG_ARGS[@]} / 2 )) 枚）"
echo "$PROMPT" | codex exec --skip-git-repo-check "${IMG_ARGS[@]}" > "$RAW_LOG" 2>&1 || true

python3 - "$RAW_LOG" "$OUT" <<'PYEOF'
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
open(out_path, 'w', encoding='utf-8').write(body + '\n')
PYEOF

echo "==> 出力: $OUT ($(wc -l < "$OUT") 行)"

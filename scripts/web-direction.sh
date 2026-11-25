#!/usr/bin/env bash
# ディレクション生成。既定のディレクターは claude（参照キャプチャを自分で見る）。
# WEB_DESIGNER_DIRECTOR=grok|codex で旧経路に戻せる。
#
# 使い方:
#   bash scripts/web-direction.sh <run_dir> <variant> [<brand_hint>]
#     variant: a=たたき台（このランの唯一のディレクション）
#              b は使わない。提出版は a のディレクションを採点の指摘で直す。
# 出力: <run_dir>/direction-{variant}.html
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RUN_DIR="${1:?run_dir required}"
VARIANT="${2:?variant required (a|b)}"
BRAND_HINT="${3:-}"

JOB="$RUN_DIR/job.json"
[[ -f "$JOB" ]] || { echo "job.json がありません: $JOB" >&2; exit 1; }

# reproduce（参照の高再現。2026-11-24〜の既定）/ adapt（旧方式）。
# mode の無い既存ランは adapt として扱い、挙動を変えない。
MODE="$(python3 -c "import json;print(json.load(open('$JOB')).get('mode') or 'adapt')")"

# ディレクターの既定は claude（2026-11-24〜）。
# grok は hermes 経由で画像を受け取れず、参照を見ないまま文章だけで設計していた。
# Look→Direction→実装が全段テキストの伝言になり、余白・写真の枚数・ナビの形が
# 段ごとに落ちていたのが再現度が上がらない主因だった。
DIRECTOR="${WEB_DESIGNER_DIRECTOR:-claude}"
DIRECTOR_MODEL="${WEB_DESIGNER_DIRECTOR_MODEL:-$([[ "$DIRECTOR" == grok ]] && echo grok-4.5 || echo opus)}"
DIRECTOR_PROVIDER="${WEB_DESIGNER_DIRECTOR_PROVIDER:-xai-oauth}"

OUT="$RUN_DIR/direction-${VARIANT}.html"
RAW_LOG="$RUN_DIR/direction-${VARIANT}.raw.log"
TEMPLATE="scripts/web-direction-prompt-template.txt"
[[ "$MODE" == "reproduce" ]] && TEMPLATE="scripts/web-direction-prompt-template-reproduce.txt"

# job.json から値を取り出す。tone_hint に空白が入るので1項目ずつ読む。
SITE_TYPE="$(python3 -c "import json;print(json.load(open('$JOB'))['site_type'])")"
SITE_TYPE_LABEL="$(python3 -c "import json;print(json.load(open('$JOB'))['site_type_label'])")"
RUN_ID="$(python3 -c "import json;print(json.load(open('$JOB'))['run_id'])")"
STAMP="$(python3 -c "import json;print(json.load(open('$JOB'))['stamp'])")"
TONE_HINT="$(python3 -c "import json;print(json.load(open('$JOB')).get('tone_hint') or '')")"
REQUIRED="$(python3 -c "import json;print(', '.join(json.load(open('$JOB')).get('required_pages',[])))")"
RECOMMENDED="$(python3 -c "import json;print(', '.join(json.load(open('$JOB')).get('recommended_pages',[])))")"
SITE_BASE="/sites/${SITE_TYPE}/${VARIANT}-${STAMP}/"

# 2案（堅実 / 冒険）を並べる方式はやめた（2026-09-18）。3ランの採点で
# 堅実側の講評に出続けた弱点は「参照の構造は写すが、写真サイズ・余白・密度の
# *変化* を写さず、均等な一覧に均してしまう」であり、冒険側の弱点は
# 「整っているが参照から離れ、一般的な会社サイトに寄る」だった。
# どちらか一方を選ぶのではなく、両方の講評をこの1本の指示に畳んである。
REFERENCE_URL="$(python3 -c "import json;print(json.load(open('$JOB'))['reference'].get('url',''))")"
REFERENCE_PAGES="$(python3 -c "import json;print(', '.join(json.load(open('$JOB')).get('reference_pages',[])))")"
# 参照キャプチャ一覧（motion 段が保存。トップを先頭に）。claude はパスを渡せば自分で開いて見る。
REFERENCE_CAPTURES="$(find "$RUN_DIR/motion" -maxdepth 1 -name '*.jpg' 2>/dev/null | sort | awk '/top-/{print "- " $0; next} {rest = rest "- " $0 "\n"} END {printf "%s", rest}')"
[[ -n "$REFERENCE_CAPTURES" ]] || REFERENCE_CAPTURES="(キャプチャなし。motion 段を先に実行すること)"

if [[ "$MODE" == "reproduce" ]]; then
  VARIANT_HINT="このランのディレクションは**1本**。この指示どおりのたたき台を作り、参照と並べて採点し、その指摘を直したものを提出版にする。
だから**参照と見比べて検証できる粒度で**書くこと（列数・比率・px・枚数・文字数・ms）。"
else
case "$VARIANT" in
  a|b) VARIANT_HINT="このランのディレクションは**1本**。後でこの指示どおりのたたき台を作り、独立の審査員に採点させ、その指摘を直したものを提出版にする。だから**実装できる粒度で具体的に**書くこと。
方針:
- 情報設計は参照サイトを踏襲する。ページの粒度・回遊の作り・下層の厚みまで写す。
- **参照の「変化」も写す。** 写真のサイズ差、セクションごとの余白の広狭、密度の緩急を、均等な一覧に均さない。ここを均すと講評で必ず『単調な一覧に置き換えている』と減点される。
- 視覚システム（配色・書体階層・余白の単位）は自分で決めて全ページで一貫させる。参照の色をそのまま拾うことより、サイト内で揃っていることを優先する。
- 装飾的な英語小見出しを日本語見出しと重ねない。
- モーションは参照の実測値どおり。必須ページ・a11y・reduced-motion 対応は崩さない。" ;;
  *) echo "variant は a か b" >&2; exit 2 ;;
esac
fi

# ブランドはラン単位で1つに固定する。2案が別会社になると設計の比較にならない
# （ラン1回目で a=商社 / b=酒蔵 になった）。
if [[ -z "$BRAND_HINT" ]]; then
  if [[ -f "$RUN_DIR/brand.json" ]]; then
    BRAND_HINT="$(python3 -c "
import json
d = json.load(open('$RUN_DIR/brand.json'))
lines = [f\"**この企業設定を両案で共有する。変更・創作しない。**\"]
for k, label in [('name','商号'),('reading','よみ'),('industry','業種'),('business','事業内容'),
                 ('founded','設立'),('employees','従業員数'),('location','所在地'),
                 ('tagline','キャッチ'),('target','主な訪問者'),('cta','主要CTA')]:
    if d.get(k): lines.append(f'- {label}: {d[k]}')
if d.get('proof_points'): lines.append('- 実績: ' + ' / '.join(d['proof_points']))
print('\\n'.join(lines))
")"
  else
    BRAND_HINT="架空企業。参照サイトの固有名詞・実在企業名は使わない。"
  fi
fi

LOOK_ANALYSIS="(look-analysis.md なし)"
[[ -f "$RUN_DIR/look-analysis.md" ]] && LOOK_ANALYSIS="$(cat "$RUN_DIR/look-analysis.md")"

MOTION_SUMMARY="(モーション実測なし)"
if [[ -f "$RUN_DIR/motion/summary.json" ]]; then
  MOTION_SUMMARY="$(python3 -c "
import json
d = json.load(open('$RUN_DIR/motion/summary.json'))
print(json.dumps({k: d.get(k) for k in ('direction_hints','cross_page','reduced_motion','page_transition')}, ensure_ascii=False, indent=2))
")"
fi

# 部品カタログ（pattern_archive）。サイト全体の参照とは別テーブルで、
# ローテ対象ではなく Direction が設計時に引く実例集。
PATTERN_CATALOG="(部品カタログ未収集。python3 pattern_archive/fetch_pattern_archive.py で収集)"
if [[ -f "pattern_archive/summary.json" ]]; then
  PATTERN_CATALOG="$(python3 -c "
import json
d = json.load(open('pattern_archive/summary.json'))
lab = {'cta': 'CTA', 'navbar': 'グローバルナビ', 'mobile': 'モバイル表現'}
for k, items in (d.get('samples') or {}).items():
    print(f\"### {lab.get(k, k)}（{d['counts'][k]} 件収集）\")
    for it in items[:10]:
        print(f\"- {it['title']}  {it['url']}\")
    print()
")"
fi

PROMPT="$(cat "$TEMPLATE")"
PROMPT="${PROMPT//\{\{VARIANT_HINT\}\}/$VARIANT_HINT}"
PROMPT="${PROMPT//\{\{SITE_TYPE\}\}/$SITE_TYPE}"
PROMPT="${PROMPT//\{\{SITE_TYPE_LABEL\}\}/$SITE_TYPE_LABEL}"
PROMPT="${PROMPT//\{\{RUN_ID\}\}/$RUN_ID}"
PROMPT="${PROMPT//\{\{BRAND_HINT\}\}/$BRAND_HINT}"
PROMPT="${PROMPT//\{\{TONE_HINT\}\}/$TONE_HINT}"
PROMPT="${PROMPT//\{\{REQUIRED_PAGES\}\}/$REQUIRED}"
PROMPT="${PROMPT//\{\{RECOMMENDED_PAGES\}\}/$RECOMMENDED}"
PROMPT="${PROMPT//\{\{SITE_BASE\}\}/$SITE_BASE}"
PROMPT="${PROMPT//\{\{REFERENCE_URL\}\}/$REFERENCE_URL}"
PROMPT="${PROMPT//\{\{REFERENCE_PAGES\}\}/$REFERENCE_PAGES}"
PROMPT="${PROMPT//\{\{REFERENCE_CAPTURES\}\}/$REFERENCE_CAPTURES}"
PROMPT="${PROMPT//\{\{LOOK_ANALYSIS\}\}/$LOOK_ANALYSIS}"
PROMPT="${PROMPT//\{\{PATTERN_CATALOG\}\}/$PATTERN_CATALOG}"
PROMPT="${PROMPT//\{\{MOTION_SUMMARY\}\}/$MOTION_SUMMARY}"
if [[ -f "$RUN_DIR/reference-fidelity.json" ]]; then
  python3 scripts/web-reference-fidelity.py "$RUN_DIR" contract
  PROMPT="$PROMPT

## 参照再現契約（一般的なトーン、定型CTA、文章量の目安より優先）
各項目を該当ページの配置・文章量、画像の役割、動作、許可された差分として具体化する。
HTMLに data-fidelity-id と data-fidelity-decision を持つ要素を項目ごとに一度だけ書く。
adapt / omit の理由を維持し、安全・アクセシビリティと矛盾したら記録して止める。
$(cat "$RUN_DIR/reference-fidelity.json")"
fi

REF_IMG=""
[[ -f "$RUN_DIR/motion/top-full.jpg" ]] && REF_IMG="$RUN_DIR/motion/top-full.jpg"

# hermes 経由の grok は「エージェント」であってテキスト補完ではない。
# 自分でファイルを書けるので、書かせたうえで stdout からの抽出は
# **フォールバック** に降格する。初回はエージェントが書いたファイルを
# 後処理が上書きして壊していた（実測: direction-a.html が講評文になった）。
rm -f "$OUT"

echo "==> [${DIRECTOR}/${VARIANT}] ディレクション生成中"
case "$DIRECTOR" in
  grok)
    # hermes -z は画像添付に対応していないので、キャプチャのパスを渡して自分で読ませる
    GROK_PROMPT="$PROMPT

## 出力方法（重要）

チャットに HTML を貼り付けず、**次のファイルに直接書き出すこと**:
  ${ROOT}/${OUT}

書き終えたら、ページ数・セクション数・各 data-role の件数だけを短く報告する。
HTML 本文をチャットに再掲しない（長すぎて途中で切れるため）。"
    [[ -n "$REF_IMG" ]] && GROK_PROMPT="$GROK_PROMPT

## 参照キャプチャ

次のファイルを読んで実際の見た目を確認すること（リポジトリ ${ROOT} 内）:
- ${REF_IMG}"
    hermes -z "$GROK_PROMPT" -m "$DIRECTOR_MODEL" --provider "$DIRECTOR_PROVIDER" > "$RAW_LOG" 2>&1 || true

    # grok(xai-oauth) は大きいプロンプトで失敗し、hermes が壊れたフォールバック
    # (opencode-go) へ落ちる。実測(2026-09-10〜14): 7,935文字までは通るが、
    # ディレクションの実プロンプト(約15,000文字)では毎回 400 になった。
    # ここで諦めるとランが止まるので、画像も大きいプロンプトも扱える codex へ
    # 自動的に切り替える。ディレクターの指定より「ランが進むこと」を優先する。
    if grep -q "x-opencode-session\|Error from provider (Console Go)" "$RAW_LOG" 2>/dev/null \
       || [ ! -s "$OUT" ]; then
      echo "  grok が失敗したため codex へ切り替えて再生成します" >&2
      IMG_ARGS=(); [[ -n "$REF_IMG" ]] && IMG_ARGS+=(-i "$REF_IMG")
      echo "$PROMPT" | codex exec --skip-git-repo-check ${IMG_ARGS[@]+"${IMG_ARGS[@]}"} > "$RAW_LOG" 2>&1 || true
      echo "  (codex で再生成しました)" >&2
    fi
    ;;
  claude)
    # claude -p はファイルを自分で読める（画像も Read で見られる）。直接書き出させる。
    CLAUDE_PROMPT="$PROMPT

## 出力方法（重要）

チャットに HTML を貼り付けず、Write ツールで**次のファイルに直接書き出すこと**:
  ${ROOT}/${OUT}

書き出す前に、上の「参照キャプチャ」をすべて Read で開いて見ること。
書き終えたら、ページ数・セクション数・各 data-role の件数だけを短く報告する。"
    echo "$CLAUDE_PROMPT" | claude -p --model "$DIRECTOR_MODEL" \
      --permission-mode acceptEdits \
      --allowedTools "Read,Write,Edit,Glob,Grep" \
      --add-dir "$ROOT" > "$RAW_LOG" 2>&1 || true
    # claude の CLI 認証が切れていたら codex（画像を添付できる）で作る。
    if grep -qi "Failed to authenticate\|access_token\|Re-authenticate\|Not logged in" "$RAW_LOG" 2>/dev/null; then
      echo "  claude の認証が切れているため codex で生成します" >&2
      DIRECTOR=codex
      IMG_ARGS=()
      while IFS= read -r f; do IMG_ARGS+=(-i "$f"); done < <(find "$RUN_DIR/motion" -maxdepth 1 -name '*-full.jpg' | sort)
      echo "$PROMPT" | codex exec --skip-git-repo-check ${IMG_ARGS[@]+"${IMG_ARGS[@]}"} > "$RAW_LOG" 2>&1 || true
    fi
    ;;
  codex)
    # 参照キャプチャは全ページ分を添付する（トップだけでは下層の意匠が落ちる）。
    IMG_ARGS=()
    while IFS= read -r f; do IMG_ARGS+=(-i "$f"); done < <(find "$RUN_DIR/motion" -maxdepth 1 -name '*-full.jpg' | sort)
    echo "$PROMPT" | codex exec --skip-git-repo-check ${IMG_ARGS[@]+"${IMG_ARGS[@]}"} > "$RAW_LOG" 2>&1 || true
    ;;
  *) echo "未知のディレクター: $DIRECTOR (claude|grok|codex)" >&2; exit 2 ;;
esac

# hermes は primary(grok/xai-oauth) が失敗するとフォールバック
# (minimax-m3/opencode-go) へ落ちる。そのフォールバックは -z ワンショットでは
# 使えず 400 を返すため、ディレクションが空のまま次段へ流れる。
# 実測(2026-09-09): 3ラン連続で走らせて grok 側が失敗し、これで全滅した。
# 生ログにその痕跡があれば、静かに空を返さず明示的に落とす。
if grep -q "x-opencode-session\|Error from provider (Console Go)" "$RAW_LOG" 2>/dev/null; then
  echo "  ✗ プロバイダのフォールバックが失敗しています（primary が落ちて opencode-go へ落ちた）" >&2
  echo "    生ログ: $RAW_LOG" >&2
  exit 3
fi

# CLI の認証切れは、エラー文が「ディレクション本文」として書き出され、
# 充足チェックで「ページ0件」とだけ出て原因が分からなくなる（実測 2026-11-24）。
if grep -qi "Failed to authenticate\|access_token\|Re-authenticate\|Not logged in" "$RAW_LOG" 2>/dev/null; then
  echo "  x ${DIRECTOR} の認証が切れています: $(head -c 200 "$RAW_LOG")" >&2
  rm -f "$OUT"
  exit 4
fi

python3 - "$RAW_LOG" "$OUT" <<'PYEOF'
import sys, re, os
raw_path, out_path = sys.argv[1], sys.argv[2]

# エージェントが自分で書いたファイルが既にあり、機械可読な構造を
# 持っているなら、それが正。stdout からの抽出で上書きしない。
if os.path.exists(out_path):
    existing = open(out_path, encoding='utf-8').read()
    if 'data-page=' in existing and 'data-role="animation"' in existing:
        print('  （エージェントが直接書き出したファイルを採用）')
        sys.exit(0)

text = open(raw_path, encoding='utf-8').read()
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
m = re.search(r'```html\s*\n(.*?)\n```', body, re.S)
if m:
    body = m.group(1).strip()
# hermes(grok) 経由は前置きの散文が混ざることがある。HTML が取れるならそこだけ採用。
m = re.search(r'(<!doctype html.*?</html>)', body, re.S | re.I)
if m:
    body = m.group(1).strip()
open(out_path, 'w', encoding='utf-8').write(body + '\n')
PYEOF

# 充足チェック。空欄を放置すると実装者が意匠を自分で決めてしまい、
# 参照との差が縮まらない（lp-designer で実測済み）。
python3 - "$OUT" <<'PYEOF'
import re, sys
html = open(sys.argv[1], encoding='utf-8').read()
pages = re.findall(r'<article[^>]*data-page="([^"]+)"', html)
sections = re.findall(r'<section[^>]*data-section=', html)
roles = {r: len(re.findall(r'data-role="%s"' % r, html)) for r in
         ('purpose', 'layout', 'copy', 'components', 'animation', 'image')}
print(f"  ページ: {len(pages)} 件 {pages}")
print(f"  セクション: {len(sections)} 件")
print(f"  role 充足: {roles}")
# ディレクション内の整合: #pages が参照する画像 placement が
# #images に全部載っているか。実測(corporate-20260903-1448)では
# 本文が hub-01〜05 の5枚を指示しているのに #images には3枚しか無く、
# 実装が3行に落として番号が 01→02→04 と飛んだ。
import re as _re
images_sec = _re.search(r'<section id="images">([\s\S]*?)</section>', html)
declared = set(_re.findall(r'data-placement="([^"]+)"', images_sec.group(1) if images_sec else ''))
referenced = set()
# placement は「{ページ}:{用途}」の形。左辺が CSS プロパティ名でも同じ形に
# なるので、素朴に word:word を拾うと font-size:11px や
# grid-template-columns:1fr まで「未宣言の画像」と誤検出する（実測）。
# ページ側の接頭辞を direction 自身の data-page から作って限定する。
page_slugs = {'top'}
for pg in _re.findall(r'data-page="/([^/"]*)', html):
    page_slugs.add(pg or 'top')
# 右辺は ASCII の英数字とハイフンのみ。日本語が続く場合（「top:hero を再利用」）は
# そこで切れるように \w ではなく明示的な文字集合を使う。
placement_re = _re.compile(r'\b(' + '|'.join(_re.escape(x) for x in sorted(page_slugs)) + r'):([a-z0-9][a-z0-9-]*)')

# data-role の中身は <code> 等で入れ子になることがある。[^<]* だと空で拾ってしまう
# （実測でこれに引っかかり、欠落を検出できていなかった）。閉じタグまで取ってから剥がす。
for body in _re.findall(r'data-role="image"[^>]*>([\s\S]*?)</(?:p|td|li|div|span)>', html):
    text = _re.sub(r'<[^>]+>', ' ', body)
    referenced |= {f'{a}:{b}' for a, b in placement_re.findall(text)}
missing_images = sorted(referenced - declared - {'none'})

problems = []
if missing_images:
    problems.append(f"本文が参照している画像が #images に無い: {', '.join(missing_images[:8])}")
if len(pages) < 4:
    problems.append(f"ページが {len(pages)} 件しかない（website として不足）")
if sections and roles['animation'] < len(sections):
    problems.append(f"animation 指示が {roles['animation']}/{len(sections)} セクション（全セクションに必要。無い場合も none と書く）")
if sections and roles['copy'] < len(sections) * 0.8:
    problems.append(f"copy が {roles['copy']}/{len(sections)} セクション（実装者が文章を考えることになる）")
if problems:
    print("\n  ⚠ ディレクションが不十分:")
    for p in problems:
        print(f"    - {p}")
    sys.exit(1)
print("  ✓ ディレクション充足")
PYEOF

python3 scripts/web-reference-fidelity.py "$RUN_DIR" direction
echo "==> 出力: $OUT"

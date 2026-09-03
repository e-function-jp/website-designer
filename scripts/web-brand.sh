#!/usr/bin/env bash
# 架空ブランドをラン単位で1つ確定させる。
#
# 背景:
#   ラン1回目で、a案が「北星物産株式会社（商社）」、b案が「瀬尾酒造株式会社（酒蔵）」
#   という**別会社**になった。2案は同じ課題への異なる設計解でなければ比較にならない。
#   ディレクションより前にブランドを固定し、両案に同じものを渡す。
#
# 使い方: bash scripts/web-brand.sh <run_dir>
# 出力: <run_dir>/brand.json
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"

RUN_DIR="${1:?run_dir required}"
OUT="$RUN_DIR/brand.json"
RAW_LOG="$RUN_DIR/brand.raw.log"
JOB="$RUN_DIR/job.json"
[[ -f "$JOB" ]] || { echo "job.json がありません" >&2; exit 1; }

SITE_TYPE_LABEL="$(python3 -c "import json;print(json.load(open('$JOB'))['site_type_label'])")"
REF="$(python3 -c "
import json; d=json.load(open('$JOB'))['reference']
print(f\"{d.get('title','')} / {d.get('url','')} / 業種: {d.get('industry','')} ({d.get('gallery_industry','')})\")")"
LOOK=""
[[ -f "$RUN_DIR/look-analysis.md" ]] && LOOK="$(head -c 6000 "$RUN_DIR/look-analysis.md")"

PROMPT="架空の日本企業を1社だけ設定する。これから同じ企業の website を2つの設計案で作り、
設計の優劣を比較するため、**企業設定は1つに固定する必要がある**。

サイト種別: ${SITE_TYPE_LABEL}
参照サイト: ${REF}

参照サイトの解析（抜粋）:
${LOOK}

参照サイトと**同じ業種帯**で、しかし固有名詞・商品・沿革は完全に別物の企業を作る。
実在企業と紛らわしい名前は避ける。

次の JSON だけを出力する（前後に文章を書かない）:
{
  \"name\": \"◯◯株式会社\",
  \"reading\": \"よみがな\",
  \"industry\": \"業種（日本語）\",
  \"business\": \"事業内容を1〜2文で。何を作り誰に売っているか具体的に\",
  \"founded\": \"YYYY年\",
  \"employees\": \"◯名\",
  \"location\": \"都道府県市区町村まで\",
  \"tagline\": \"サイトのキャッチ。20字以内\",
  \"proof_points\": [\"数値を伴う実績を3件。例: 年間出荷◯万本\"],
  \"target\": \"サイトの主な訪問者\",
  \"cta\": \"主要CTAの文言\"
}"

DIRECTOR_MODEL="${WEB_DESIGNER_DIRECTOR_MODEL:-grok-4.5}"
DIRECTOR_PROVIDER="${WEB_DESIGNER_DIRECTOR_PROVIDER:-xai-oauth}"

echo "==> ブランド設定を確定中 (${DIRECTOR_MODEL})"
hermes -z "$PROMPT" -m "$DIRECTOR_MODEL" --provider "$DIRECTOR_PROVIDER" > "$RAW_LOG" 2>&1 || true

python3 - "$RAW_LOG" "$OUT" <<'PYEOF'
import json, re, sys
raw, out = sys.argv[1], sys.argv[2]
text = open(raw, encoding='utf-8').read()
m = re.findall(r'\{[^{}]*"name"[\s\S]*?\}', text)
if not m:
    print("ブランド JSON を抽出できませんでした。raw ログを確認してください。", file=sys.stderr)
    sys.exit(1)
data = json.loads(m[-1])
open(out, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print(f"  {data['name']}（{data['industry']}）/ {data['location']} / {data['tagline']}")
PYEOF
echo "==> 出力: $OUT"

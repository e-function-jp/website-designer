#!/usr/bin/env bash
#
# website-designer の学習ループを1本回して本番へ反映する。
#
# LLM オーケストレータを挟まない（hermes cron --no-agent）。
# パイプラインは scripts/web-run.sh で完全にスクリプト化されており、
# モデル呼び出しは各段の中で完結する。オーケストレータを噛ませると
# 設定ドリフトで無音停止する事故があるため（lp-designer の実績）、
# 決定的に走らせる。
#
# 出力はそのまま Discord へ配送される。無音にしない（失敗も報告する）。
set -uo pipefail

REPO="/Users/estaff-agent/Workspace/website-designer"
LOCK="/tmp/website-designer-learning-loop.lock.d"
cd "$REPO" || { echo "リポジトリが無い: $REPO"; exit 1; }

# 手動実行や前回のランと衝突させない。global.css のテーマ列挙と dist を
# 共有しているので、並走すると壊れる。
# macOS には flock が無いので mkdir のアトミック性でロックする。
if ! mkdir "$LOCK" 2>/dev/null; then
  # 古いロックの残骸なら剥がす（前回が異常終了した場合）
  if [ -f "$LOCK/pid" ] && ! kill -0 "$(cat "$LOCK/pid" 2>/dev/null)" 2>/dev/null; then
    echo "古いロックを掃除しました（前回のランが異常終了した形跡）"
    rm -rf "$LOCK"
    mkdir "$LOCK" 2>/dev/null || { echo "ロック取得に失敗"; exit 1; }
  else
    echo "website-designer: 別のランが実行中のためスキップしました。"
    exit 0
  fi
fi
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT

STARTED="$(date '+%Y-%m-%d %H:%M:%S')"
echo "website-designer 学習ループ 開始: $STARTED"

# 1) 参照サイトの収集を更新（週1回だけ深掘りし、他は軽く）
if [ "$(date +%u)" = "1" ]; then
  echo "--- 参照サイト収集（月曜のみ深掘り）---"
  python3 site_archive/fetch_site_archive.py --pages 5 --all-types 2>&1 | tail -4
fi

# 2) 次のランを選ぶ
OUT="$(npm run --silent next:run 2>&1)"
RUN_ID="$(printf '%s' "$OUT" | python3 -c "import json,sys;raw=sys.stdin.read();print(json.loads(raw[raw.index('{'):])['run_id'])" 2>/dev/null)"
if [ -z "${RUN_ID:-}" ]; then
  echo "❌ ランの作成に失敗しました"
  printf '%s\n' "$OUT" | tail -10
  exit 1
fi
INFO="$(printf '%s' "$OUT" | python3 -c "
import json,sys
raw=sys.stdin.read(); d=json.loads(raw[raw.index('{'):])
r=d['reference']
print(f\"業種={d.get('industry_label') or d.get('industry','-')} / 参照={r.get('title','')} {r.get('url','')}\")" 2>/dev/null)"
echo "ラン: $RUN_ID"
echo "  $INFO"

# 3) 本体
bash scripts/web-run.sh "docs/quality/runs/$RUN_ID" > /tmp/website-run.log 2>&1
RC=$?
tail -25 /tmp/website-run.log

if [ $RC -ne 0 ]; then
  echo "❌ ランが異常終了しました (exit=$RC)。/tmp/website-run.log を確認してください。"
  exit 1
fi

# 4) 採点結果
SCORE="docs/quality/runs/$RUN_ID/design-score-data.json"
if [ -f "$SCORE" ]; then
  python3 -c "
import json
d=json.load(open('$SCORE'))
t={k:v.get('total') for k,v in (d.get('models') or {}).items()}
print('採点:', t, '/ 勝者:', d.get('winner'))
print('総評:', (d.get('verdict') or '')[:160])
" 2>/dev/null
else
  echo "⚠ 採点結果がありません（judge が失敗した可能性）"
fi

# 5) 出荷
echo "--- デプロイ ---"
git add -A && git -c user.name="E-STAFF" -c user.email="yokosuka@e-function.jp" \
  commit -q -m "feat($RUN_ID): 学習ラン（cron 自動実行）" 2>&1 | tail -2
git push -q origin main 2>&1 | tail -2
bash scripts/release-deploy.sh 2>&1 | tail -6

echo "website-designer 学習ループ 終了: $(date '+%H:%M:%S')（開始 ${STARTED}）"
echo "https://website.e-function.site/"

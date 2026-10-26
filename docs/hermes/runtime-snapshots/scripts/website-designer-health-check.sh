#!/usr/bin/env bash
#
# website-designer の健全性チェック。異常があるときだけ出力する（無音=正常）。
# hermes cron --no-agent と組み合わせる。
set -uo pipefail
REPO="/Users/estaff-agent/Workspace/website-designer"
URL="https://website.e-function.site"
PROBLEMS=""

cd "$REPO" 2>/dev/null || { echo "❌ リポジトリが無い: $REPO"; exit 0; }

# 1) 本番が生きているか / 最新が載っているか
CODE="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "$URL/" 2>/dev/null || echo 000)"
[ "$CODE" = "200" ] || PROBLEMS="${PROBLEMS}\n- 本番トップが ${CODE} を返しています"

REMOTE_ID="$(curl -sS -m 20 "$URL/version.json" 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin).get("deploy_id",""))' 2>/dev/null)"
[ -n "$REMOTE_ID" ] || PROBLEMS="${PROBLEMS}\n- version.json が取得できません（デプロイ経路の異常）"

# 2) noindex が外れていないか（α版までは必須）
if ! curl -sS -m 20 "$URL/robots.txt" 2>/dev/null | grep -q "Disallow: /"; then
  PROBLEMS="${PROBLEMS}\n- robots.txt の Disallow が外れています（α版まで noindex のはず）"
fi
if ! curl -sS -m 20 "$URL/" 2>/dev/null | grep -q 'content="noindex'; then
  PROBLEMS="${PROBLEMS}\n- トップの meta robots noindex が外れています"
fi

# 3) main が push されているか（ローカルに置き去りが無いか）
git fetch -q origin 2>/dev/null
AHEAD="$(git rev-list --count origin/main..main 2>/dev/null || echo 0)"
[ "$AHEAD" = "0" ] || PROBLEMS="${PROBLEMS}\n- main に未 push のコミットが ${AHEAD} 件あります"

# 4) 品質スコアが後退していないか（履歴の直近2件を比較）
REG="$(python3 -c "
import json
h=json.load(open('docs/quality/history.json'))
if len(h)>=2 and h[-1]['total'] < h[-2]['total']:
    print(f\"品質スコアが後退: {h[-2]['total']} -> {h[-1]['total']}\")
" 2>/dev/null)"
[ -z "$REG" ] && : || PROBLEMS="${PROBLEMS}\n- ${REG}"

# 5) 未撮影のサムネイルが無いか
THUMB="$(node scripts/web-build-thumbnails.mjs --check 2>&1 | grep -v "OK:" | head -3)"
[ -z "$THUMB" ] && : || PROBLEMS="${PROBLEMS}\n- サムネイル: ${THUMB}"

if [ -n "$PROBLEMS" ]; then
  echo "website-designer 健全性チェック: 異常あり"
  printf '%b\n' "$PROBLEMS"
  echo "  $URL / deploy_id=${REMOTE_ID:-取得不可}"
fi
# 正常なら何も出さない（無音）

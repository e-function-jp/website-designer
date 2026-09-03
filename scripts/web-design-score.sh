#!/usr/bin/env bash
# 生成サイトを「独立モデルによる視覚採点」にかける。
#
# lp-designer の lp-design-score.sh の website 版。変更点は 2 つ:
#   1. 採点単位がページではなくサイト。トップ + 下層ページを並べて撮り、
#      1サイト分の画像束として審査させる。ナビの一貫性や回遊は
#      1枚のスクリーンショットでは判定できない。
#   2. ルーブリック第1層を conversion から information_architecture に差し替えた。
#      website の良し悪しはCV導線ではなく情報設計で決まる。
#
# 使い方:
#   bash scripts/web-design-score.sh <run_dir> <site_type> <stamp> <model> [<model2> ...]
# 例:
#   bash scripts/web-design-score.sh docs/quality/runs/corporate-20260903-1400 corporate 20260903-1400 a b
#
# 出力: <run_dir>/design-score-data.json  … 5層スコア + 指摘（機械可読）
#       <run_dir>/shots/{model}-{page}.jpg
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RUN_DIR="${1:?run_dir required}"
SITE_TYPE="${2:?site_type required}"
STAMP="${3:?stamp required}"
shift 3
MODELS=("$@")
[[ ${#MODELS[@]} -eq 0 ]] && { echo "model(s) required" >&2; exit 2; }

SHOTS="$RUN_DIR/shots"
mkdir -p "$SHOTS"

# 採点にかけるページ。トップに加えて下層を2枚撮る。
# ナビの一貫性・パンくず・現在地表示はトップだけでは判定できない。
SCORE_PAGES="${WEB_DESIGNER_SCORE_PAGES:-/ /about/ /service/}"

IMG_ARGS=()

# --- 1. 参照サイトのキャプチャ（あれば先頭に置く） ---
for cand in "$RUN_DIR/ref-top.jpg" "$RUN_DIR/ref-full.jpg" "$RUN_DIR/ref-pc-full.jpg"; do
  [[ -f "$cand" ]] && IMG_ARGS+=(-i "$cand") && break
done

# --- 2. 生成サイトを実描画で撮影 ---
for m in "${MODELS[@]}"; do
  for page in $SCORE_PAGES; do
    route="/sites/$SITE_TYPE/$m-$STAMP${page}"
    slug="$(echo "$page" | tr -d '/' )"; slug="${slug:-top}"
    out="$SHOTS/$m-$slug.jpg"
    echo "==> shoot $route"
    if node scripts/web-shoot-sample.mjs "$route" "$out" >/dev/null 2>&1; then
      IMG_ARGS+=(-i "$out")
    else
      echo "    (skip: $route はビルド結果に無い)" >&2
    fi
  done
done

REF_JSON="$RUN_DIR/job.json"
REF_CONTEXT="(job.json なし)"
[[ -f "$REF_JSON" ]] && REF_CONTEXT="$(cat "$REF_JSON")"

MODEL_LIST="$(IFS=,; echo "${MODELS[*]}")"

PROMPT=$(cat <<EOF
あなたは website（多ページサイト）デザインの審査員。**あなたはこれらを生成していない。**
忖度せず、減点理由を具体的に挙げること。甘い点をつけない。

添付画像の順番:
1枚目 = 参照サイト（実物）のキャプチャ ※無い場合あり
以降 = 採点対象。モデルごとに ${SCORE_PAGES} の順で並ぶ。モデル順: ${MODEL_LIST}

ラン情報（サイト種別・必須ページ・参照サイト・トーン方針）:
${REF_CONTEXT}

## 採点ルーブリック（各20点・合計100点）

1. **information_architecture** — サイトマップの妥当性 / グローバルナビの分節 /
   現在地の分かりやすさ / 下層への導線と戻り導線 / ページ粒度（1ページに詰め込みすぎ・薄すぎ）
2. **visual** — 配色の一貫性 / タイポ階層 / 画像の質と事業内容との一致 / 余白 / モバイル耐性
3. **nielsen** — 一貫性 / 認知負荷 / エラー防止 / 自由度 / 実世界との一致
4. **reference_fit** — 参照サイトの構造とトーンを咀嚼できているか（丸写し不可、無関係も不可）
5. **quality** — 実装の丁寧さ / a11y / 崩れの無さ / ページ間の作り込みムラ

## 必ず減点する項目（発見したら明示）

- ページ間でヘッダー/フッターの内容や位置が変わっている
- トップだけ作り込まれ、下層がテンプレの流用で薄い
- グローバルナビの項目が事業内容を表していない（「サービス」「事業」等の空ラベル連発）
- パンくずが無い、または現在地が分からない
- DaisyUI 既定テーマ（light/dark/cupcake）のまま
- 事業と無関係なストック写真、emoji を主ビジュアルにしている
- 英語小見出しの連発（ABOUT / SERVICE / CONTACT を飾りで量産）
- テキストの重なり・見切れ・コントラスト不足

## 出力（JSONのみ。前後に文章を書かない）

{
  "models": {
    "<model名>": {
      "total": <0-100>,
      "layers": {"information_architecture":<0-20>,"visual":<0-20>,"nielsen":<0-20>,"reference_fit":<0-20>,"quality":<0-20>},
      "issues": ["具体的な指摘", "..."],
      "strengths": ["..."],
      "page_notes": {"<ページパス>": "そのページ固有の指摘"}
    }
  },
  "winner": "<model名>",
  "verdict": "1-2文の総評"
}
EOF
)

# 採点は生成に使っていない CLI に寄せる。「自分が作ったものを自分で採点しない」が要件。
JUDGE="${WEB_DESIGNER_JUDGE_CMD:-codex}"
if ! command -v "$JUDGE" >/dev/null 2>&1; then
  echo "judge CLI '$JUDGE' が見つかりません。WEB_DESIGNER_JUDGE_CMD で指定してください。" >&2
  echo "撮影は完了しています: $SHOTS" >&2
  exit 3
fi

echo "==> scoring with independent judge ($JUDGE)"
RAW="$("$JUDGE" exec "${IMG_ARGS[@]}" --skip-git-repo-check "$PROMPT" 2>/dev/null || true)"

python3 - "$RUN_DIR" "$STAMP" "$SITE_TYPE" <<PYEOF
import json, re, sys, pathlib, datetime
run_dir, stamp, site_type = sys.argv[1], sys.argv[2], sys.argv[3]
raw = """$RAW"""
m = re.search(r'\{.*\}', raw, re.S)
if not m:
    print("WARN: judge output had no JSON; design-score-data.json は更新しない", file=sys.stderr)
    sys.exit(1)
data = json.loads(m.group(0))
data.update({
    "run_id": f"{site_type}-{stamp}",
    "site_type": site_type,
    "scored_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
    "method": "independent judge on rendered multi-page screenshots vs reference capture",
})

run_dir_p = pathlib.Path(run_dir)

# 反復履歴を残す。lp-designer の実測で、指摘を読んで直す反復が単調改善せず
# (65/63 -> 60/56 -> 49/47 -> 62/68)、最後の結果を採用するとベストより
# 悪い状態で出荷される事故が起きた。後退は明示的に警告する。
hist_p = run_dir_p / "design-score-history.jsonl"
attempt = sum(1 for _ in hist_p.open(encoding="utf-8")) + 1 if hist_p.exists() else 1
data["attempt"] = attempt

totals = {k: v.get("total", 0) for k, v in data.get("models", {}).items()}
best_prev = {}
if hist_p.exists():
    for line in hist_p.read_text(encoding="utf-8").splitlines():
        if line.strip():
            for k, v in (json.loads(line).get("totals") or {}).items():
                best_prev[k] = max(best_prev.get(k, 0), v)

with hist_p.open("a", encoding="utf-8") as f:
    f.write(json.dumps({"attempt": attempt, "scored_at": data["scored_at"],
                        "totals": totals, "winner": data.get("winner")}, ensure_ascii=False) + "\n")

regressions = {k: (best_prev[k], v) for k, v in totals.items() if k in best_prev and v < best_prev[k]}
data["best_so_far"] = {k: max(best_prev.get(k, 0), v) for k, v in totals.items()}
if regressions:
    data["regressed_vs_best"] = {k: {"best": b, "now": n} for k, (b, n) in regressions.items()}

(run_dir_p / "design-score-data.json").write_text(
    json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(data, ensure_ascii=False, indent=2))

if regressions:
    detail = ", ".join(f"{k}: best {b} -> now {n}" for k, (b, n) in regressions.items())
    print(f"\n*** REGRESSION: 今回の修正でスコアが下がっています ({detail})", file=sys.stderr)
    print("*** 直前の修正を巻き戻し、ベストの状態で出荷してください。", file=sys.stderr)
PYEOF

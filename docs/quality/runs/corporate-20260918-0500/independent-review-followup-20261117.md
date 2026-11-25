# 蒼紙舎・独立レビューフォロー（2026-11-17）

既存2サイクルの後、別担当による独立レビューで指摘された点だけを追加修正した。本人評価30/100は変えない。About は基準時点でも理念本文が初期画面内にあり、前回の正確な成果は「開始位置を上げた」である。

## 限定差分

- Projects: 一覧を55反復タイルから5つの代表作品へ整理。既存の identity / mark / editorial / sign / exhibition 詳細へのリンクは維持。冒頭で「架空の制作例」「実在企業の受注実績ではない」と表示。
- TOP: 根拠のない 420件、68%、35件の数値を削除。制作例は架空である旨を作品紹介前に表示。
- 撮影: `scripts/web-self-review-capture.mjs` を追加。config JSON に参照・サンプル URL、viewport、mode を置き、`--config`、`--out`、`--phase` で実行。manifest は HEAD、diff SHA-256、Git 状態、各画面の URL、UTC、viewport、motion、HTTP、フォント・有限演出の完了状態、スクロール量、画像 hash、エラーを記録。フォントと可視画像の load/decode、有限演出を最大6秒待ち、default と reduced-motion を別条件として扱う。

## 実行条件と証拠

- WSL Ubuntu、`/home/yokosuka/workspace/website-designer`、Node 22.19。日本語フォントは既存 Windows フォントを参照する `FONTCONFIG_FILE=/mnt/c/Users/yokos/Documents/Codex/2026-11-17/task/aogami-fontconfig.xml`。外部フォントの契約や参照画像の転載は行っていない。
- `npm run build` → `npx astro preview --host 127.0.0.1 --port 4323` → `node scripts/web-self-review-capture.mjs --config /mnt/c/Users/yokos/Documents/Codex/2026-11-17/task/aogami-capture-config.json --out /mnt/c/Users/yokos/Documents/Codex/2026-11-17/task/aogami-review-evidence --phase followup-final`。
- `aogami-review-evidence/followup-final/manifest.json` と同ディレクトリの PNG。比較代表: `baseline/baseline-sample-projects-390-top.png`、`followup-final/followup-final-sample-projects-390-default-top.png`、`followup-final/followup-final-reference-projects-390-default-top.png`、`followup-final/followup-final-reference-about-1280-default-top.png`。前回の dev toolbar 入り画像と区別し、最終サンプルは production preview で撮影。
- default 参照は参照サイト自身の動作を待った状態。reduced-motion はサンプル TOP だけ別条件で取得し、通常描画と混同しない。
- 参照 About の英語副文は有限 Web Animation の完了後にも薄い段階が残った。8秒後の別撮影で表示が進むことを実見したため、config の `settleMs: 8000` を設定して `aogami-about-settle-config.json` で About だけ `followup-settled-about/` に再撮影した。これは参照固有の待機条件で、通常条件の `followup-final/` と区別する。参照の DOM や CSS は変更していない。

## TOP high の判断

1280×900 の H1 は初期 y=1064、390×900 は y=926。いずれも1画面目の外なので `render-hero-h1-hidden` は検査器の誤検出ではない。参照 TOP も写真主体であり、大きな H1 を写真へ重ねる変更は行わなかった。写真直後の短い主題文、スクロール後の H1（可視・opacity 1）、キーボード Tab の本文スキップ、スマホメニューと詳細遷移、reduced-motion での表示を確認した。初期画面の主題理解は改善余地があるため **high を未解決の公開ゲート**として残す。汎用検査は変更しない。

## 停止条件・残件

この限定フォローは5代表作・架空表示・安定撮影・回帰確認で止める。参照へのアクセス不能、画像欠損、既存詳細の破損、重大な描画退行があれば失敗として停止する。TOP high、About の文章量、作品写真の独自性、他サンプルへの影響は引き続きレビュー対象。静的点数を視覚点数とは扱わない。独立レビュー後の再確認はセルフ検証であり、再独立レビューとは呼ばない。

## テスト結果

- `npm run build`: 成功、88 routes と postbuild。
- `node scripts/web-quality-check.mjs`: exit 0、総合100/100、8サイト89ページ。これは静的検査のみ。
- `npm run check:catalog`: exit 0、151/151、簡易表示40。
- 対象描画: TOP exit 1、About exit 0、Projects exit 0。個別レポートをリポジトリ外へ別名保存。
- Playwright 操作: 1280/390、default/reduced で TOP H1 位置、スクロール後の表示、Tab、メニュー、Projects から identity 詳細まで確認。作品一覧は5件。
- 全体描画: 全87ページ、exit 1、high 9。対象 TOP は既存 high 1 と medium 2、About は medium 1、Projects は medium 1。`aogami-followup-render-all.json` に別名保全。基準レポートの high 14 との差は原因別に判定していないため改善成果とは断定しない。

## ソース・検証・公開の版

HEAD `a53460d8c4534d9aab2b530f6690bfedfc548c08` ＋未コミット差分。`manifest.json` の diff SHA-256 と作業後パッチを版識別に使う。公開済み専用レビュー URL は従来の基準 HEAD のまま。今回の修正は **未配信**、push なし。Mac の「つづり」8ページも未移植。

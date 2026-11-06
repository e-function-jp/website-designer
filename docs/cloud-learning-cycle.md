# クラウドでの参照学習と公開

対象は website-designer。1 shot = 参照取得 → 観察 → 部品改善 → 1カテゴリーの多ページサイト → 品質検証 → main/release push → 公開照合。
現在の自動選定は corporate の業種ローテーション。service/recruit/media は観察専用であり、自動生成対象へ変える場合は IA と品質基準を先に整える。

## 実行環境

Node >=22.12、Python 3、npm ci、Playwright。Mac専用Hermes/Copilotの代わりに、このクラウドタスクのCodexが観察・設計・実装を担当する。スクリプトだけでAI生成まで無人実行する構成ではない。定期ポーリングは、以下の手順を実行するクラウドタスクをスケジュールする。常駐プロセスは環境の公開・復元をまたいで存続しない。

```bash
export ASTRO_TELEMETRY_DISABLED=1
export XDG_CONFIG_HOME=/workspace/.config
export WEB_DESIGNER_CHROMIUM_PATH=/usr/bin/chromium
cd /workspace/website-designer
python3 scripts/web-cloud-cycle.py prepare
```

通常のPlaywrightブラウザを使う環境では WEB_DESIGNER_CHROMIUM_PATH を省略する。既存のチェックアウトを使う。ユーザーの明示的依頼なしに開発用worktreeを追加しない。公開スクリプトは既存方式のrelease用worktreeを使うため、実行前に既存の `.release-worktree` と `git worktree list` を確認し、ユーザー作業があれば保存してから進む。

必要な通信先: muuuuu.org、選ばれた参照サイトとその画像・フォント配信元、github.com、website.e-function.site。Playwrightブラウザを取得する場合は cdn.playwright.dev と実際のリダイレクト先。取得できない参照を観察済み扱いにしない。通信エラー時は許可先を追加して再開する。取得失敗時に古いアーカイブで成功扱いにしない。

## Codexが行うデザイン工程

1. prepare が出力したランの job.json、motion、スクリーンショットを読む。トップと下層2ページを実際に確認する。取得できなければ停止し、ランを未完了として扱う。
2. `.claude/skills/frontend-design-web/SKILL.md` と AGENTS.md を読み、look-analysis.md に情報設計・余白・書体・色・動きと採用理由を記録する。参照の文章・画像・ロゴの複製はせず、構成上の学びを抽出する。
3. direction.md に架空企業、業種、必須/推奨ページ、配色、写真の利用根拠、再利用する部品、新規/修正する部品を記載する。
4. `_site.ts` を先に作り、全ページを SiteLayout で構築する。各ページ2件以上、サイト全体6種類以上の共有コンポーネントを使用し、少なくとも1つの再利用可能な部品を追加または改善する。
5. トップ・主要下層をPC/モバイルで描画確認し、スクリーンショットと修正内容をランへ記録する。独立judgeを実行していない場合は独立採点済みと書かない。
6. `python3 scripts/web-cloud-cycle.py verify` を実行する。全サイトの静的/描画highを解消する。新規サンプルだけ通っても公開しない。
7. 学びを docs/playbooks/<site_type>.md に反映し、ランの結果を記録する。変更をレビューし、対象ファイルを明示してcommitする。秘密情報・キャッシュ・失敗ログを混入させない。
8. 公開の指示があるタスクでは `python3 scripts/web-cloud-cycle.py publish`。検証後にソースをmainへpushし、既存release-deploy.shが成果物をreleaseへpushする。webhookの反映は公開先version.jsonのdeploy_idで照合する。品質ゲートのskipオプションを使わない。

## 2026-11-06 の実行状況

- Mac統合ブランチ 68f3c76 をmainに反映済み。元の31コミットに描画検査・Noxray/白澄サイトの保存を追加したもの。
- ビルド成功。静的チェック: 8サイト89ページ、100/100、highなし。カタログ151/151件（40件簡易表示）。サムネイル8件。
- クラウドのChromiumで白澄トップを検査すると、コントラストhighが1分類（32要素）報告された。写真/半透明オーバーレイ上の判定を含むため、実画面との照合が必要。ゲートは有効のまま。
- prepare を実行したが、muuuuu.orgへの接続がプロキシの403で停止。公開先も403。新規ラン作成・学習・生成・release push・公開完了には到達していない。
- 許可先追加は環境設定ドラフトに保存済み。適用後にpreflightから再実行する。選定した参照サイトの許可も必要になる。

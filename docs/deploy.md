# 本番デプロイ運用ガイド

## 最重要ルール

> **本番反映は `bash scripts/release-deploy.sh` を使うこと。**
>
> ファイルマネージャ・手動 rsync・FTP・SFTP 拡張の `uploadOnSave` による
> 部分アップロードは禁止。必ずローカルで `npm run build` した `dist/` を
> `release` ブランチ経由で一括反映する。

## 構成

lp-designer と同じ「release ブランチ + GitHub webhook」方式。
社内ネットワークで SSH が IP 制限されており、rsync 方式が使えないため
（実測: `Connection closed by 162.43.104.136 port 10022`）、
**GitHub への push だけで本番へ届く経路**にしてある。HTTP/HTTPS は制限対象外。

```
main (ソース)
  │  ローカル: npm run build → 品質ゲート → postprocess → version.json
  ↓  dist/ の中身を release ブランチへコミット
release (ビルド成果物だけを載せた孤立ブランチ)
  │  git push origin release
  ↓  GitHub webhook (push / refs/heads/release, HMAC-SHA256)
https://website.e-function.site/_hook/deploy.php
  │  署名検証 → 202 即返し → flock → git fetch + reset --hard
  ↓  rsync --delete (.htaccess は保護)
docroot
```

サーバ上の clone は**ドキュメントルート外**（`~/website-designer_release`）に置く。
`.git` が HTTP 公開される事故を構造的に防ぐため。

## 前提条件

| 項目 | 値 |
|---|---|
| 本番 URL | `https://website.e-function.site/` |
| 本番サーバ | Xserver (efunction02) |
| ドキュメントルート | bootstrap が自動検出（`WEB_DEPLOY_DOCROOT` で上書き可） |
| サーバ上の clone | `~/website-designer_release`（release ブランチ） |
| サーバ設定 | `~/.website-deploy/config.php`（**リポジトリ外**。秘密情報はここだけ） |
| Astro の `site` | `https://website.e-function.site`（canonical / OGP / sitemap に効く） |

## 初回セットアップ（サーバ側・1回だけ）

SSH が通る環境から実行する。

```bash
ssh -p 10022 efunction02@efunction02.xsrv.jp 'bash -s' \
  < scripts/release-deploy-bootstrap.sh
```

1回目はデプロイキーの公開鍵を表示して `exit 2` で止まる。
表示された鍵を
[Deploy keys](https://github.com/e-function-jp/website-designer/settings/keys)
に **Read-only** で登録してから、同じコマンドを再実行する。

> lp-designer が既に `~/.ssh/config` に `Host github.com` を持っているため、
> このスクリプトは **`Host github-website` という別名**を追加する。
> 同名 Host を後から足しても先勝ちで効かないため。

完了時に webhook secret が表示される。それを
[Webhooks](https://github.com/e-function-jp/website-designer/settings/hooks) に登録する。

| 項目 | 値 |
|---|---|
| Payload URL | `https://website.e-function.site/_hook/deploy.php` |
| Content type | `application/json` |
| Secret | bootstrap が表示した値 |
| Events | Just the push event |

ドキュメントルートを自動検出できない場合は候補を列挙して止まるので、
`WEB_DEPLOY_DOCROOT=<絶対パス>` を付けて再実行する。

## 検索エンジンへの露出（α版まで noindex）

α版になるまで、本番は検索エンジンにインデックスさせない。
本番 URL は疎通確認のために公開しているが、中身は学習ループの生成物であり、
架空企業のサイトが検索結果に出ると実在企業と誤認されうるため。

| 場所 | 内容 |
|---|---|
| `src/lib/seo.ts` の `NOINDEX` | `true` の間、全ページに `<meta name="robots" content="noindex, nofollow, noarchive">` を出す |
| `public/robots.txt` | `Disallow: /` |

**この2つは連動していない。** α版で解除するときは両方直すこと。

1. `src/lib/seo.ts` の `NOINDEX` を `false` に
2. `public/robots.txt` を `Allow: /` に戻し、`Sitemap:` 行を復活
3. `npm run check:web` と `npm run check:render` を通してからデプロイ
4. 反映後に `curl -s https://website.e-function.site/robots.txt` と
   トップの `<meta name="robots">` が消えたことを確認

## 通常デプロイ

```bash
bash scripts/release-deploy.sh
```

実行内容:

1. `npm run build`
2. **品質ゲート** — `web-quality-check.mjs` を走らせ、high の指摘があれば中止
3. postprocess — 開発ホスト（localhost / Tailscale 等）を指す絶対 URL を相対化
4. `dist/version.json` を生成（到達確認用の `deploy_id`）
5. `release` ブランチの一時 worktree へ `dist/` を同期 → コミット → push
6. `https://website.e-function.site/version.json` の `deploy_id` が一致するまでポーリング

成果物に変化がなければコミットせず終了する。

### フラグ

```bash
bash scripts/release-deploy.sh --dry-run      # release へ載る差分を見るだけ
bash scripts/release-deploy.sh --skip-build   # 既存の dist/ をそのまま使う
bash scripts/release-deploy.sh --skip-check   # 品質ゲートを飛ばす（緊急時のみ）
bash scripts/release-deploy.sh --no-wait      # push まで実行し、反映確認を待たない
```

### なぜ品質ゲートを入れたか

lp-designer の `release-deploy.sh` にはこの段が無い。website は
「サイト全体で URL が閉じているか」が品質そのものなので、
リンク切れ・必須ページ欠落・title 重複を本番へ出す意味がない。
`check:web:strict`（スコア後退ガード）とは別に、**high の指摘だけは
絶対に出荷しない**ゲートとして置いている。

## 反映確認

ビルド時に `version.json` へ `deploy_id` を焼き込み、push 後にそれが本番で
見えるまで待つ。webhook が落ちていればスクリプトがタイムアウトで異常終了するため、
自動ランが「デプロイ失敗」を取りこぼさない。

```bash
curl -s https://website.e-function.site/version.json
```

## ロールバック

`release` は線形履歴なので、過去のコミットへ戻すだけで巻き戻せる。

```bash
git fetch origin release
git push origin +<戻したいSHA>:release
```

push が webhook を起動し、サーバ側が同じ手順でその世代へ同期する。

## トラブルシューティング

| 症状 | 原因 / 対処 |
|---|---|
| `反映確認タイムアウト` | GitHub の Webhooks → Recent Deliveries と `~/.website-deploy/deploy.log` を確認 |
| webhook が `401 signature mismatch` | GitHub 側の secret と `~/.website-deploy/config.php` の `secret` の不一致 |
| webhook が `500 config not found` | bootstrap が未実行、または PHP の HOME が想定と違う |
| デプロイが届かない回がある | **GitHub は push イベントを再送しない**。配信履歴で失敗を確認し、再実行する |
| `another deploy is running, gave up` | 前回が 120 秒以上かかっている。`~/.website-deploy/deploy.lock` を確認 |
| `500 git fetch failed` | サーバの GitHub 認証（デプロイキー / PAT）の失効 |
| 品質ゲートで停止 | `docs/quality/latest.md` の high を潰す。緊急時のみ `--skip-check` |
| `.htaccess` を消したい | `--filter='P .htaccess'` が保護している。サーバ側で手動削除 |

## 禁止事項

- ❌ FTP / ファイルマネージャでの直接アップロード（差分管理不能）
- ❌ リモート側で直接ファイル編集（`git reset --hard` で消える）
- ❌ `release` ブランチを手で編集（生成物専用。必ずスクリプト経由）
- ❌ `_hook/deploy.php` に秘密情報を書く（配信対象。設定は `~/.website-deploy/config.php`）

## 関連

- [scripts/release-deploy.sh](../scripts/release-deploy.sh) — デプロイ本体
- [scripts/release-deploy-bootstrap.sh](../scripts/release-deploy-bootstrap.sh) — サーバ側初回セットアップ
- [public/_hook/deploy.php](../public/_hook/deploy.php) — webhook 受け口
- [scripts/web-postprocess-deploy.py](../scripts/web-postprocess-deploy.py) — 配信前の URL 後処理

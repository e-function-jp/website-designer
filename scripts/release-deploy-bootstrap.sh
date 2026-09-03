#!/usr/bin/env bash
#
# サーバ側 (Xserver) の初回セットアップ。**サーバ上で実行する**。
#
#   ssh -p 10022 efunction02@efunction02.xsrv.jp 'bash -s' \
#     < scripts/release-deploy-bootstrap.sh
#
# やること:
#   1. git / rsync / PHP exec の可否を確認
#   2. ドキュメントルートを自動検出（環境変数で上書き可）
#   3. GitHub への到達手段を判定 (SSH デプロイキー or HTTPS PAT)
#   4. release ブランチを ~/website-designer_release へ clone
#   5. ~/.website-deploy/config.php を生成 (webhook secret を含む。docroot 外)
#   6. ドキュメントルートへ初回 rsync
#
# 環境変数:
#   WEB_DEPLOY_DOCROOT  ドキュメントルート絶対パス（未指定なら自動検出）
#   WEB_DEPLOY_SECRET   GitHub webhook secret（未指定なら生成して表示）
#   WEB_GITHUB_PAT      HTTPS で clone する場合の fine-grained PAT (contents:read)
#
set -euo pipefail

REPO_DIR="${HOME}/website-designer_release"
CONF_DIR="${HOME}/.website-deploy"
BRANCH="release"
GH_SSH="git@github.com:e-function-jp/website-designer.git"
GH_HTTPS_HOST="github.com/e-function-jp/website-designer.git"

say() { printf '\n=== %s ===\n' "$1"; }

say "1. 前提コマンド"
GIT="$(command -v git || true)";     echo "git   : ${GIT:-見つからない}"
RSYNC="$(command -v rsync || true)"; echo "rsync : ${RSYNC:-見つからない}"
[[ -n "$GIT" && -n "$RSYNC" ]] || { echo "git / rsync が無い" >&2; exit 1; }
git --version; rsync --version | head -1

say "2. ドキュメントルート"
# lp 側は ~/e-function.site/lp-designer_app/public だった。website 側の実際の
# パスは環境に依存するので、決め打ちせず候補を探す。
DOCROOT="${WEB_DEPLOY_DOCROOT:-}"
if [[ -z "$DOCROOT" ]]; then
  for cand in \
    "${HOME}/e-function.site/website-designer_app/public" \
    "${HOME}/e-function.site/website_app/public" \
    "${HOME}/website.e-function.site/public_html" \
    "${HOME}/e-function.site/public_html/website" \
    "${HOME}/e-function.site/public_html/website.e-function.site"
  do
    [[ -d "$cand" ]] && { DOCROOT="$cand"; break; }
  done
fi
if [[ -z "$DOCROOT" ]]; then
  echo "ドキュメントルートを自動検出できなかった。候補:" >&2
  find "${HOME}" -maxdepth 4 -type d \( -name 'public_html' -o -name 'public' \) 2>/dev/null | head -20 >&2
  echo >&2
  echo "WEB_DEPLOY_DOCROOT=<絶対パス> を指定して再実行すること" >&2
  exit 1
fi
echo "docroot: $DOCROOT"
ls -la "$DOCROOT" | head -8
echo "--- .htaccess ---"
[[ -f "${DOCROOT}/.htaccess" ]] && cat "${DOCROOT}/.htaccess" || echo "(なし)"

say "3. GitHub への到達手段"
# サーバの git は 1.8.3.1 で GIT_SSH_COMMAND (git 2.3+) が無く、
# ssh は OpenSSH 7.4 で StrictHostKeyChecking=accept-new も無い。
# 鍵の指定は ~/.ssh/config の Host エントリで行う。
CLONE_URL=""
if [[ -n "${WEB_GITHUB_PAT:-}" ]]; then
  echo "PAT が渡されたので HTTPS を使う"
  CLONE_URL="https://x-access-token:${WEB_GITHUB_PAT}@${GH_HTTPS_HOST}"
else
  # lp-designer が既に github.com のデプロイキーを ~/.ssh/config に登録済みなら
  # それをそのまま使える（同じ GitHub org の別リポジトリなので、
  # リポジトリ単位のデプロイキーだと足りない点に注意）。
  KEY="${HOME}/.ssh/id_ed25519_webdeploy"
  mkdir -p "${HOME}/.ssh"; chmod 700 "${HOME}/.ssh"
  if [[ ! -f "$KEY" ]]; then
    ssh-keygen -q -t ed25519 -N '' -C 'website-designer deploy key' -f "$KEY"
    echo "デプロイキーを生成した"
  fi

  SSH_CONF="${HOME}/.ssh/config"
  if ! grep -q 'website-designer deploy key' "$SSH_CONF" 2>/dev/null; then
    # lp 側が既に `Host github.com` を持っている場合、後から同名 Host を
    # 足しても先勝ちで効かない。別名 Host を作り、clone URL 側で使い分ける。
    cat >> "$SSH_CONF" <<CONF

# website-designer deploy key (自動追記)
Host github-website
    HostName github.com
    User git
    IdentityFile ${KEY}
    IdentitiesOnly yes
    StrictHostKeyChecking no
CONF
    chmod 600 "$SSH_CONF"
    echo "~/.ssh/config に Host github-website を追記した"
  fi

  # `ssh -T` は認証成功でも終了コード 1 を返す。-n は必須
  # （bash -s で流し込まれるため、ssh が stdin を食うと残りが消える）。
  GH_OUT="$(ssh -n -o BatchMode=yes -o ConnectTimeout=10 -T git@github-website 2>&1 || true)"
  if printf '%s' "$GH_OUT" | grep -q 'successfully authenticated'; then
    echo "GitHub の SSH 認証に成功: ${GH_OUT}"
  else
    echo
    echo "デプロイキーがまだ GitHub に登録されていない。"
    echo "e-function-jp/website-designer の Settings → Deploy keys に"
    echo "以下を Read-only で登録してから、このスクリプトを再実行すること。"
    echo "---------------------------------------------------------------"
    cat "${KEY}.pub"
    echo "---------------------------------------------------------------"
    exit 2
  fi
  CLONE_URL="git@github-website:e-function-jp/website-designer.git"
fi

say "4. release ブランチを clone"
if [[ -d "${REPO_DIR}/.git" ]]; then
  echo "既存の clone を更新"
  ( cd "$REPO_DIR" \
    && git remote set-url origin "$CLONE_URL" \
    && git fetch --prune --depth 1 origin \
         "+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}" \
    && git reset --hard "origin/${BRANCH}" )
else
  git clone --branch "$BRANCH" --single-branch --depth 1 "$CLONE_URL" "$REPO_DIR"
fi
( cd "$REPO_DIR" && git rev-parse HEAD )

say "5. 設定ファイル"
mkdir -p "$CONF_DIR"; chmod 700 "$CONF_DIR"
SECRET="${WEB_DEPLOY_SECRET:-$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')}"
cat > "${CONF_DIR}/config.php" <<PHP
<?php
// Website Designer デプロイ webhook 設定。ドキュメントルート外に置くこと。
return [
    'secret'  => '${SECRET}',
    'repo'    => '${REPO_DIR}',
    'docroot' => '${DOCROOT}',
    'git'     => '${GIT}',
    'rsync'   => '${RSYNC}',
    'log'     => '${CONF_DIR}/deploy.log',
];
PHP
chmod 600 "${CONF_DIR}/config.php"
echo "${CONF_DIR}/config.php を作成"
echo
echo "--- GitHub webhook に設定する secret ---"
echo "${SECRET}"
echo "---------------------------------------"

say "6. 初回 rsync"
"$RSYNC" -a --delete \
  --exclude=.git --exclude=.gitignore --exclude=.DS_Store \
  --filter='P .htaccess' \
  "${REPO_DIR}/" "${DOCROOT}/"
echo "同期完了"

say "7. PHP から exec が使えるか"
php -r 'echo "disable_functions=[", ini_get("disable_functions"), "]\n";
        echo function_exists("exec") ? "exec: 使える\n" : "exec: 使えない\n";' 2>/dev/null \
  || echo "php CLI が無い。ブラウザから https://website.e-function.site/_hook/deploy.php を GET して 405 が返れば設置は成功"

say "完了"
cat <<NEXT
次の手順:
  1. 上の secret を GitHub の Webhook に登録
     https://github.com/e-function-jp/website-designer/settings/hooks
       Payload URL : https://website.e-function.site/_hook/deploy.php
       Content type: application/json
       Secret      : (上の値)
       Events      : Just the push event
  2. ローカルで \`bash scripts/release-deploy.sh\` を実行し、
     version.json の deploy_id が一致すれば開通

docroot: ${DOCROOT}
NEXT

<?php
/**
 * Website Designer デプロイ webhook 受け口 (Xserver / website.e-function.site)
 *
 * GitHub の push イベント (refs/heads/release) を受けて、サーバ上の
 * release クローンを更新し、ドキュメントルートへ rsync する。
 *
 *   GitHub --push--> release --webhook--> ここ --git pull--> ~/website-designer_release
 *                                             --rsync-->  <docroot>/
 *
 * 設定はリポジトリに含めない。ドキュメントルート外の config.php から読む:
 *   /home/<user>/.website-deploy/config.php
 *     <?php return [
 *       'secret'   => '...',                                  // GitHub webhook secret
 *       'repo'     => '/home/<user>/website-designer_release',  // release ブランチのクローン
 *       'docroot'  => '/home/<user>/e-function.site/website-designer_app/public',
 *       'git'      => '/usr/bin/git',
 *       'rsync'    => '/usr/bin/rsync',
 *       'log'      => '/home/<user>/.website-deploy/deploy.log',
 *     ];
 *
 * このファイル自身は release ブランチに含まれて配信されるため、
 * 秘密情報を書かないこと。
 */

declare(strict_types=1);

const BRANCH = 'release';

/** ログ1行追記（失敗しても処理は続行）。 */
function dlog(?string $path, string $msg): void
{
    if ($path === null) {
        return;
    }
    @file_put_contents(
        $path,
        sprintf("[%s] %s\n", date('c'), $msg),
        FILE_APPEND | LOCK_EX
    );
}

/** ステータスコードとメッセージを返して終了。 */
function bail(int $code, string $msg, ?string $log = null): never
{
    dlog($log, "{$code} {$msg}");
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    echo $msg, "\n";
    exit;
}

// --- 設定読み込み -----------------------------------------------------------
$home = getenv('HOME') ?: (posix_getpwuid(posix_geteuid())['dir'] ?? '');
$configPath = $home . '/.website-deploy/config.php';
if (!is_file($configPath)) {
    bail(500, 'config not found');
}
/** @var array{secret:string,repo:string,docroot:string,git:string,rsync:string,log:?string} $cfg */
$cfg = require $configPath;
$log = $cfg['log'] ?? null;

foreach (['secret', 'repo', 'docroot', 'git', 'rsync'] as $key) {
    if (empty($cfg[$key])) {
        bail(500, "config: {$key} is missing", $log);
    }
}

// --- リクエスト検証 ---------------------------------------------------------
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    bail(405, 'method not allowed', $log);
}

$event = $_SERVER['HTTP_X_GITHUB_EVENT'] ?? '';
if ($event !== 'push' && $event !== 'ping') {
    bail(204, "ignored event: {$event}", $log);
}

$payload = file_get_contents('php://input');
if ($payload === false || $payload === '') {
    bail(400, 'empty payload', $log);
}

// HMAC-SHA256 署名検証。hash_equals でタイミング差を潰す。
$sent = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
$expected = 'sha256=' . hash_hmac('sha256', $payload, $cfg['secret']);
if ($sent === '' || !hash_equals($expected, $sent)) {
    bail(401, 'signature mismatch', $log);
}

$body = json_decode($payload, true);
if (!is_array($body)) {
    bail(400, 'invalid json', $log);
}

// ping は署名検証の後で応える。検証前に応えると、署名を持たない相手でも
// ログに書き込めてしまう。
if ($event === 'ping') {
    dlog($log, 'ping ok');
    header('Content-Type: text/plain; charset=utf-8');
    echo "pong\n";
    exit;
}

$ref = $body['ref'] ?? '';
if ($ref !== 'refs/heads/' . BRANCH) {
    bail(204, "ignored ref: {$ref}", $log);
}
$after = (string)($body['after'] ?? '');
if ($after === '' || preg_match('/^0+$/', $after)) {
    bail(204, 'branch deleted, nothing to deploy', $log);
}

// --- 先に応答を返す ---------------------------------------------------------
// GitHub の webhook 配信は 10 秒でタイムアウトする。git fetch と rsync を
// 終えてから応答すると、成果物の量によっては配信が失敗扱いになり、
// GitHub は push イベントを再送しないため反映が丸ごと落ちる。
// 検証を終えた時点で 202 を返し、実処理は接続を切ってから続行する。
ignore_user_abort(true);
set_time_limit(0);

$accepted = json_encode(
    ['status' => 'accepted', 'commit' => $after],
    JSON_UNESCAPED_SLASHES
) . "\n";
http_response_code(202);
header('Content-Type: application/json; charset=utf-8');
header('Content-Length: ' . strlen($accepted));
header('Connection: close');
echo $accepted;
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
} else {
    while (ob_get_level() > 0) {
        @ob_end_flush();
    }
    @flush();
}

// --- 排他制御 ---------------------------------------------------------------
// 同時 push で pull と rsync が交差しないようにする。
// 応答済みなので 409 を返す先が無い。少し待って取れなければログに残して終わる。
$lockPath = $home . '/.website-deploy/deploy.lock';
$lock = fopen($lockPath, 'c');
if ($lock === false) {
    dlog($log, 'lock file open failed');
    exit;
}
$waited = 0;
while (!flock($lock, LOCK_EX | LOCK_NB)) {
    if ($waited >= 120) {
        dlog($log, "another deploy is running, gave up: {$after}");
        exit;
    }
    sleep(3);
    $waited += 3;
}

// --- デプロイ本体 -----------------------------------------------------------
/**
 * コマンドを実行し [終了コード, 出力] を返す。
 * 引数は escapeshellarg 済みの前提で呼び出す。
 */
function run(string $cmd): array
{
    $out = [];
    $rc = 0;
    exec($cmd . ' 2>&1', $out, $rc);
    return [$rc, implode("\n", $out)];
}

$git = escapeshellarg($cfg['git']);
$repo = escapeshellarg($cfg['repo']);
$branch = escapeshellarg(BRANCH);

dlog($log, "deploy start: {$after}");

// Xserver の git は 1.8.3.1 で `git -C` (1.8.5 以降) が無いため cd で入る。
$in = "cd {$repo} && ";
$steps = [
    // 明示的な refspec で remote-tracking ref を確実に更新する。
    // `git fetch origin release` だけだと古い git では refs/remotes/origin/release
    // が更新されず、直後の reset --hard が古いコミットに戻してしまう。
    // --depth 1 でサーバ側の clone を浅いまま保つ。
    'fetch' => "{$in}{$git} fetch --prune --depth 1 origin "
             . escapeshellarg('+refs/heads/' . BRANCH . ':refs/remotes/origin/' . BRANCH),
    'reset' => "{$in}{$git} reset --hard " . escapeshellarg('origin/' . BRANCH),
    'clean' => "{$in}{$git} clean -fd",
];
foreach ($steps as $name => $cmd) {
    [$rc, $out] = run($cmd);
    if ($rc !== 0) {
        dlog($log, "{$name} failed (rc={$rc}): {$out}");
        flock($lock, LOCK_UN);
        exit;
    }
}

// 実際に取得できた HEAD が webhook の after と一致するか確認する。
[, $head] = run("{$in}{$git} rev-parse HEAD");
$head = trim($head);
if ($head !== $after) {
    dlog($log, "warning: HEAD {$head} != after {$after}");
}

// ドキュメントルートへ同期。
// --delete で release に無いファイルは掃除するが、サーバ側で手動配置した
// .htaccess は消さない（現行 rsync デプロイと同じ挙動）。
$rsync = escapeshellarg($cfg['rsync']);
$src = escapeshellarg(rtrim($cfg['repo'], '/') . '/');
$dst = escapeshellarg(rtrim($cfg['docroot'], '/') . '/');
$cmd = "{$rsync} -a --delete "
     . "--exclude=.git --exclude=.git/ --exclude=.gitignore --exclude=.DS_Store "
     . "--filter=" . escapeshellarg('P .htaccess') . ' '
     . "{$src} {$dst}";
[$rc, $out] = run($cmd);
if ($rc !== 0) {
    dlog($log, "rsync failed (rc={$rc}): {$out}");
    flock($lock, LOCK_UN);
    exit;
}

dlog($log, "deploy ok: {$head}");
flock($lock, LOCK_UN);

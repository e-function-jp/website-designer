/**
 * 公開ポリシーの一元スイッチ。
 *
 * α版になるまでは検索エンジンにインデックスさせない。
 * 本番 URL（https://website.e-function.site/）は疎通確認のために公開しているが、
 * 中身は学習ループの生成物であり、架空企業のサイトが検索結果に出ると
 * 実在企業と誤認されうるため。
 *
 * ## α版になったらやること
 * 1. `NOINDEX` を `false` にする
 * 2. `public/robots.txt` を Allow に戻し、Sitemap 行を復活させる
 *    （このファイルと robots.txt は連動していないので**両方**必要）
 * 3. `npm run check:web` と `npm run check:render` を通してからデプロイ
 */
export const NOINDEX = true;

/** <meta name="robots"> に入れる値。NOINDEX が false のときは null（タグを出さない）。 */
export const ROBOTS_CONTENT: string | null = NOINDEX ? 'noindex, nofollow, noarchive' : null;

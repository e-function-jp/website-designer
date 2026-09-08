/**
 * サンプルサイトの索引データを Astro ビルド時に生成する。
 *
 * `src/pages/sites/{type}/{model}-{stamp}/_site.ts` をビルド時に収集し、
 * lp-designer の `samples-index.json` 相当の役割を持たせる。JSON レジストリを
 * 別ファイルに持たないのは、website は「_site.ts を必ず置く」が規約なので
 * そっちが正本であり、二重管理にするとズレるため。
 *
 * サイト種別のラベル/説明は docs/site-types.json（web-export-site-types.py が
 * 生成、正本は scripts/site_categories.py）から取る。ハードコードしない。
 */
import type { SiteConfig } from './site';
import siteTypesRaw from '../../docs/site-types.json';

export interface SiteTypeMeta {
  id: string;
  label: string;
  description: string;
  tone?: string;
  required_pages: string[];
  recommended_pages: string[];
}

export interface IndustryMeta {
  id: string;
  label: string;
}

const { site_types, industries } = siteTypesRaw as unknown as {
  site_types: Array<{
    id: string;
    label: string;
    tone?: string | null;
    required_pages?: string[];
    recommended_pages?: string[];
    description?: string;
  }>;
  industries: IndustryMeta[];
};

export const SITE_TYPES: SiteTypeMeta[] = site_types.map((t) => ({
  id: t.id,
  label: t.label,
  description: deriveDescription(t),
  tone: t.tone ?? undefined,
  required_pages: t.required_pages ?? [],
  recommended_pages: t.recommended_pages ?? [],
}));

export const INDUSTRIES: IndustryMeta[] = industries;

const SITE_TYPE_BY_ID = new Map(SITE_TYPES.map((t) => [t.id, t]));
const INDUSTRY_BY_ID = new Map(INDUSTRIES.map((i) => [i.id, i]));

export function siteTypeLabel(id: string): string {
  return SITE_TYPE_BY_ID.get(id)?.label ?? id;
}
export function industryLabel(id: string | undefined): string {
  if (!id) return '';
  return INDUSTRY_BY_ID.get(id)?.label ?? id;
}

export interface SampleEntry {
  type: string;
  model: string;
  stamp: string;
  slug: string;
  base: string;
  name: string;
  tagline: string;
  theme: string;
  industry: string;
  /** ページ数（src/pages/sites/{type}/{slug} 配下の index.astro を数える） */
  pageCount: number;
}

/**
 * SiteTypeMeta.tone から、カードのサブコピー用に短い 1 行説明を派生する。
 * tone は決定的だが長いため、ピリオドで区切った前半だけを採用する。
 */
function deriveDescription(t: { id: string; tone?: string | null; description?: string }): string {
  if (t.description) return t.description;
  if (!t.tone) return '';
  const head = t.tone.split(/[。.]/)[0]?.trim();
  return head ?? '';
}

/**
 * src/pages/sites/{type}/{model}-{stamp}/_site.ts を全件走査し、
 * カード表示に必要なメタ情報を返す。
 *
 * `import.meta.glob` の第3引数で `as: 'raw'` 相当のファイル列挙は使えないので、
 * 動的 import して site を取り出す。ビルド時に 1 度だけ走る。
 *
 * ページ数 (pageCount) は同じ glob の第2引数で `index.astro` を数える。
 * 1 サンプルのファイル数はせいぜい十数件で 1 ビルド 1 度なので負荷は無い。
 */
export function collectSamples(): SampleEntry[] {
  const modules = import.meta.glob<{ site: SiteConfig }>(
    '../pages/sites/*/*/_site.ts',
    { eager: true },
  );
  // 各 _site.ts に対して、そのサンプル配下の index.astro を数えるためのキーリスト
  const pageFiles = import.meta.glob<unknown>(
    '../pages/sites/*/*/**/index.astro',
    { eager: true },
  );
  const pageCountBySample = new Map<string, number>();
  for (const path of Object.keys(pageFiles)) {
    const m = path.match(/^\.\.\/pages\/sites\/([^/]+)\/(.+?-\d{8}-\d{4})\//);
    if (!m) continue;
    const key = `${m[1]}/${m[2]}`;
    pageCountBySample.set(key, (pageCountBySample.get(key) ?? 0) + 1);
  }

  return Object.entries(modules)
    .map(([path, mod]) => {
      const m = path.match(/^\.\.\/pages\/sites\/([^/]+)\/(.+?)-(\d{8}-\d{4})\/_site\.ts$/);
      const site = mod.site;
      const slug = m ? `${m[2]}-${m[3]}` : '';
      const type = m?.[1] ?? 'unknown';
      return {
        type,
        model: m?.[2] ?? 'unknown',
        stamp: m?.[3] ?? '',
        slug,
        base: site.base,
        name: site.name,
        tagline: site.tagline ?? '',
        theme: site.theme,
        industry: site.industry ?? '',
        pageCount: pageCountBySample.get(`${type}/${slug}`) ?? 0,
      } satisfies SampleEntry;
    })
    .sort((a, b) => (a.stamp < b.stamp ? 1 : -1));
}
/**
 * .astro コンポーネントの `interface Props` を読んで、
 * カタログ表示用のサンプル props を組み立てる。
 *
 * /components のページがビルド時に呼ぶ。ここで自動生成することで、
 * 学習ループが新しいコンポーネントを切り出しても手作業なしでカタログに載る。
 * 「手順書に追記し忘れて反映されない」事故を構造的に防ぐのが狙い。
 *
 * 必須プロパティ（`?` の付かないもの）だけを埋める。任意プロパティは
 * コンポーネント自身の既定値を見せたいので触らない。
 */

export interface PropField {
  name: string;
  optional: boolean;
  type: string;
}

/** 対応する閉じ括弧の位置を返す。開き括弧の index を渡す。 */
function matchBrace(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** frontmatter（先頭の `---` に挟まれた部分）を取り出す。 */
export function frontmatterOf(src: string): string {
  if (!src.startsWith('---')) return '';
  const end = src.indexOf('\n---', 3);
  return end === -1 ? '' : src.slice(3, end);
}

/**
 * `interface X { ... }` と `type X = { ... }` を名前 → 本文で集める。
 * 入れ子の `{}` があるので正規表現ではなく括弧の対応で切り出す。
 */
export function collectInterfaces(fm: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /(?:interface\s+(\w+)\s*|type\s+(\w+)\s*=\s*)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fm)) !== null) {
    const name = m[1] ?? m[2];
    const open = fm.indexOf('{', m.index);
    const close = matchBrace(fm, open);
    if (close === -1) continue;
    out.set(name, fm.slice(open + 1, close));
    re.lastIndex = close;
  }
  return out;
}

/**
 * interface 本文をフィールドへ分解する。
 * 入れ子の `{}` / `<>` / `[]` の内側にある `;` `,` では区切らない。
 */
export function parseFields(body: string): PropField[] {
  const fields: PropField[] = [];
  let depth = 0;
  let buf = '';
  const flush = () => {
    const line = buf.trim();
    buf = '';
    if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) return;
    const colon = splitAtTopLevelColon(line);
    if (colon === -1) return;
    let name = line.slice(0, colon).trim();
    const type = line.slice(colon + 1).trim();
    if (!name || !type) return;
    const optional = name.endsWith('?');
    if (optional) name = name.slice(0, -1).trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) return;
    fields.push({ name, optional, type });
  };
  for (const ch of body) {
    if (ch === '{' || ch === '<' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === '>' || ch === ']' || ch === ')') depth--;
    if (depth === 0 && (ch === ';' || ch === ',' || ch === '\n')) {
      flush();
      continue;
    }
    buf += ch;
  }
  flush();
  return fields;
}

/** 入れ子の外側にある区切り文字で分割する。`|` や `,` の分解に使う。 */
function splitTopLevel(src: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of src) {
    if (ch === '{' || ch === '<' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === '>' || ch === ']' || ch === ')') depth--;
    if (depth === 0 && ch === sep) {
      out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((s) => s.length > 0);
}

/** 入れ子の外側にある最初の `:` の位置。コメントや型内の `:` を避ける。 */
function splitAtTopLevelColon(line: string): number {
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '{' || ch === '<' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === '>' || ch === ']' || ch === ')') depth--;
    else if (ch === ':' && depth === 0) return i;
  }
  return -1;
}

/** フィールド名から、それらしい日本語のサンプル文字列を決める。 */
function sampleString(name: string, index: number): string {
  const n = name.toLowerCase();
  const nth = index > 0 ? String(index + 1) : '';
  if (/^(href|url|link|action)$/.test(n) || n.endsWith('href') || n.endsWith('url')) return '#';
  if (/(^|_)(src|image|img|photo|thumb|bg|background|icon)/.test(n)) {
    return '/ogp.svg';
  }
  if (n.includes('alt')) return 'サンプル画像';
  if (n.includes('email') || n.includes('mail')) return 'sample@example.com';
  if (n.includes('tel') || n.includes('phone')) return '0120-000-000';
  if (n.includes('date') || n.includes('time')) return '2026.09.02';
  if (n.includes('price') || n.includes('amount') || n.includes('cost')) return '¥12,800';
  if (n.includes('color') || n.includes('theme')) return 'primary';
  if (n.includes('eyebrow') || n.includes('kicker') || n.includes('badge') || n.includes('tag')) {
    return `ラベル${nth}`;
  }
  if (n.includes('title') || n.includes('heading') || n.includes('headline')) {
    return `見出しテキスト${nth}`;
  }
  if (n.includes('sub')) return `サブテキスト${nth}`;
  if (n.includes('desc') || n.includes('body') || n.includes('text') || n.includes('lead')) {
    return `説明文のサンプルです。${nth}実際の文言はコンポーネント利用側から渡します。`;
  }
  if (n.includes('label') || n.includes('name') || n.includes('cta') || n.includes('button')) {
    return `ラベル${nth}`;
  }
  if (n.includes('note') || n.includes('caption') || n.includes('annotation')) return '※注釈テキスト';
  if (n.includes('value') || n.includes('number') || n.includes('count')) return '128';
  if (n.includes('unit')) return '件';
  return `サンプル${nth || ''}`.trim();
}

/** リテラル union（'a' | 'b' や 2 | 3）から先頭の候補を取り出す。 */
function firstLiteral(type: string): string | number | null {
  const parts = type.split('|').map((p) => p.trim());
  const first = parts[0];
  if (!first) return null;
  const str = first.match(/^'([^']*)'$/) ?? first.match(/^"([^"]*)"$/);
  if (str) return str[1];
  if (/^-?\d+(\.\d+)?$/.test(first)) return Number(first);
  return null;
}

const MAX_DEPTH = 4;

/** 型文字列からサンプル値を作る。解決できない型は undefined を返す。 */
export function sampleValue(
  type: string,
  name: string,
  interfaces: Map<string, string>,
  depth = 0,
  index = 0,
): unknown {
  const t = type.trim().replace(/;$/, '');
  if (depth > MAX_DEPTH) return undefined;

  // リテラル union は先に拾う（'a' | 'b' や 2 | 3）
  const lit0 = firstLiteral(t);
  if (lit0 !== null) return lit0;

  // それ以外の union は左から順に試して、最初に解決できた形を使う。
  // 例: `[SpecCard, SpecCard] | SpecCard[]` や `TroubleItem[] | string[]`。
  // 配列判定より前に分解しないと `(.*)\[\]` が union 全体を飲み込む。
  const branches = splitTopLevel(t, '|');
  if (branches.length > 1) {
    for (const b of branches) {
      const v = sampleValue(b, name, interfaces, depth, index);
      if (v !== undefined) return v;
    }
    return undefined;
  }

  // タプル: [A, B] / [A, B, C]
  if (t.startsWith('[') && t.endsWith(']') && !t.endsWith('[]')) {
    const parts = splitTopLevel(t.slice(1, -1), ',');
    const items: unknown[] = [];
    for (let i = 0; i < parts.length; i++) {
      const v = sampleValue(parts[i], name, interfaces, depth + 1, i);
      if (v === undefined) return undefined;
      items.push(v);
    }
    return items;
  }

  // 配列: T[] / Array<T> / (A | B)[]
  const arr = t.match(/^(.*)\[\]$/) ?? t.match(/^Array<(.*)>$/);
  if (arr) {
    const inner = arr[1].replace(/^\((.*)\)$/, '$1');
    const items: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      const v = sampleValue(inner, name, interfaces, depth + 1, i);
      if (v === undefined) return undefined;
      items.push(v);
    }
    return items;
  }

  // オブジェクトリテラル
  if (t.startsWith('{')) {
    const close = matchBrace(t, 0);
    if (close === -1) return undefined;
    return buildObject(parseFields(t.slice(1, close)), interfaces, depth + 1, index);
  }

  if (t === 'string') return sampleString(name, index);
  if (t === 'number') return 3;
  if (t === 'boolean') return false;
  if (t === 'string | number' || t === 'number | string') return sampleString(name, index);
  if (t === 'any' || t === 'unknown') return sampleString(name, index);

  // ローカル定義の型を解決
  const local = interfaces.get(t);
  if (local !== undefined) {
    return buildObject(parseFields(local), interfaces, depth + 1, index);
  }

  return undefined;
}

function buildObject(
  fields: PropField[],
  interfaces: Map<string, string>,
  depth: number,
  index: number,
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const f of fields) {
    // 入れ子の中は任意プロパティも埋める。中身が空だと見た目が判断できないため。
    const v = sampleValue(f.type, f.name, interfaces, depth, index);
    if (v !== undefined) obj[f.name] = v;
  }
  return obj;
}

export interface PreviewSpec {
  /** 描画に渡す props。必須プロパティのみ。 */
  props: Record<string, unknown>;
  /** Props の一覧（カタログに型を表示する用） */
  fields: PropField[];
  /** サンプル値を作れなかった必須プロパティ名 */
  unresolved: string[];
}

/** .astro のソースからプレビュー用の props を組み立てる。 */
export function buildPreviewSpec(src: string): PreviewSpec {
  const fm = frontmatterOf(src);
  const interfaces = collectInterfaces(fm);
  const body = interfaces.get('Props') ?? '';
  const fields = parseFields(body);
  const props: Record<string, unknown> = {};
  const unresolved: string[] = [];
  for (const f of fields) {
    if (f.optional) continue;
    const v = sampleValue(f.type, f.name, interfaces);
    if (v === undefined) unresolved.push(f.name);
    else props[f.name] = v;
  }
  return { props, fields, unresolved };
}

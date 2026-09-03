"""website サイト種別・業種分類の正本。

site_archive/fetch_site_archive.py（収集・分類）と
scripts/web-learning-next.py（ローテ選定）の両方から import される共有モジュール。

LP との違い
-----------
lp-designer は「業種」1軸でローテしていた。LP は 1 ページなので業種が決まれば
構成もほぼ決まるためである。website は同じ業種でもコーポレート/サービス/採用で
情報設計がまったく別物になるので、**サイト種別を主軸、業種を従軸**にする。

サイト種別ごとの `required_pages` が website 固有の中核定義で、
`scripts/web-quality-check.mjs` の `ia-required-page-missing` が直接参照する
（JSON へは `scripts/web-export-site-types.py` で書き出す）。
"""
from __future__ import annotations

# rotation=True のサイト種別のみ web-learning-next.py の自動ローテ対象になる。
# rotation=False は収集・分類のみに使う観察カテゴリ（tone / required_pages 未成熟）。
SITE_TYPES = [
    {
        "id": "corporate",
        "label": "コーポレートサイト",
        # サイト種別を判定するためのギャラリー側タグ / タイトル語
        "keywords": ["コーポレート", "会社", "企業サイト", "オフィシャル", "corporate",
                     "株式会社", "有限会社", "ホールディングス", "グループ",
                     "Inc.", "INC", "Co., Ltd", "Corporation"],
        # URL 側のシグナル。ギャラリーのタイトルはブランド名だけのことが多く、
        # タイトルだけでは 6 割以上が 'other' に落ちる（実測）。
        "url_keywords": ["co.jp", "corp.", "//corp", ".or.jp"],
        # 必須ページ。1つでも欠けると ia-required-page-missing (high)
        "required_pages": ["/", "/about/", "/service/", "/news/", "/contact/"],
        # 推奨ページ。欠けると medium
        "recommended_pages": ["/company/", "/recruit/", "/privacy/"],
        "tone": "信頼・堅実。彩度を抑えたコーポレートカラー1色＋アクセント1色、"
                "写真は事業/人物の実写、数値による実績提示、問い合わせ導線は全ページ到達可能",
        "rotation": True,
    },
    {
        "id": "service",
        "label": "サービス・製品サイト",
        "keywords": ["サービス", "SaaS", "プロダクト", "製品", "ツール", "プラットフォーム",
                     "service", "product"],
        "url_keywords": ["/service", "/product", ".app", "lp."],
        "required_pages": ["/", "/feature/", "/price/", "/case/", "/contact/"],
        "recommended_pages": ["/faq/", "/document/", "/about/"],
        "tone": "機能価値の言語化。比較表・料金表・導入事例が主役、"
                "資料請求と無料トライアルの2系統CTA",
        "rotation": False,
    },
    {
        "id": "recruit",
        "label": "採用サイト",
        "keywords": ["採用", "RECRUIT", "リクルート", "新卒", "中途", "キャリア", "求人",
                     "recruit", "careers"],
        "url_keywords": ["recruit", "saiyo", "/careers", "career."],
        "required_pages": ["/", "/about/", "/people/", "/jobs/", "/entry/"],
        "recommended_pages": ["/culture/", "/flow/", "/faq/"],
        "tone": "社員写真とストーリー主導。1日の流れ／座談会／数字で見る当社、"
                "エントリー導線を全ページ固定",
        "rotation": False,
    },
    {
        "id": "media",
        "label": "メディア・オウンドメディア",
        "keywords": ["メディア", "マガジン", "ジャーナル", "コラム", "ブログ", "magazine", "journal"],
        "url_keywords": ["/magazine", "/journal", "/media", "/blog"],
        "required_pages": ["/", "/articles/", "/category/", "/about/"],
        "recommended_pages": ["/tag/", "/search/", "/contact/"],
        "tone": "可読性最優先のエディトリアル。一覧→詳細の回遊設計、"
                "カテゴリ/タグ/ページネーション/関連記事",
        "rotation": False,
    },
    # --- 観察のみ（占有率算出用。ローテ対象外） ---
    {
        "id": "brand",
        "label": "ブランドサイト",
        "keywords": ["ブランド", "brand", "世界観", "コレクション"],
        "required_pages": [], "recommended_pages": [], "tone": None, "rotation": False,
    },
    {
        "id": "ec",
        "label": "EC・通販",
        "keywords": ["オンラインストア", "通販", "ショップ", "STORE", "EC"],
        "required_pages": [], "recommended_pages": [], "tone": None, "rotation": False,
    },
    {
        "id": "public",
        "label": "公共・教育・医療機関",
        "keywords": ["市", "県", "自治体", "大学", "学校", "病院", "クリニック", "法人"],
        "url_keywords": [".ac.jp", ".go.jp", ".lg.jp", ".ed.jp"],
        "required_pages": [], "recommended_pages": [], "tone": None, "rotation": False,
    },
]

# 従軸。サイト種別が決まったあと、参照サイトの業種を揃えるために使う。
# lp-designer の lp_categories.py の業種軸を website 向けに引き継いだもの。
INDUSTRIES = [
    {"id": "manufacturing", "label": "製造・工業",
     "keywords": ["製作所", "工業", "機械", "精密", "金属", "electronics", "産業"]},
    {"id": "construction", "label": "建設・不動産",
     "keywords": ["建設", "工務店", "住宅", "不動産", "設計", "リフォーム"]},
    {"id": "it", "label": "IT・ソフトウェア",
     "keywords": ["システム", "ソフト", "IT", "テック", "デジタル", "DX", "AI"]},
    {"id": "professional", "label": "士業・コンサル",
     "keywords": ["法律", "会計", "税理士", "社労士", "コンサル", "事務所"]},
    {"id": "medical", "label": "医療・福祉",
     "keywords": ["医療", "クリニック", "病院", "介護", "福祉", "薬"]},
    {"id": "food", "label": "食品・飲食",
     "keywords": ["食品", "飲料", "レストラン", "カフェ", "酒造", "菓子"]},
    {"id": "retail", "label": "小売・サービス業",
     "keywords": ["小売", "店舗", "サロン", "ホテル", "旅館", "物流", "運送"]},
    {"id": "education", "label": "教育",
     "keywords": ["学校", "大学", "スクール", "塾", "教育", "学園"]},
]

# 分類の評価順。宣言順（表示順）で評価すると、採用サイトが corporate に
# 吸われてしまう（"株式会社◯◯ 採用サイト" は両方にマッチする）。
# 具体的な種別を先に評価し、corporate は最後の受け皿にする。
CLASSIFY_ORDER = ["recruit", "media", "service", "public", "ec", "brand", "corporate"]

BY_ID = {c["id"]: c for c in SITE_TYPES}
INDUSTRY_BY_ID = {c["id"]: c for c in INDUSTRIES}


def classify_site_type(text: str, url: str = "") -> str:
    """タイトル(+URL)からサイト種別 id を返す。マッチなしは 'other'。

    text にタイトル、url に掲載サイトの URL を渡す。URL シグナルのほうが
    タイトルより強い（ブランド名だけのタイトルが多いため）ので先に見る。
    """
    lower_url = url.lower()
    for cid in CLASSIFY_ORDER:
        cat = BY_ID.get(cid)
        if not cat:
            continue
        if lower_url and any(k in lower_url for k in cat.get("url_keywords", [])):
            return cid
    for cid in CLASSIFY_ORDER:
        cat = BY_ID.get(cid)
        if not cat:
            continue
        if any(k in text for k in cat["keywords"]):
            return cid
    return "other"


def classify_industry(text: str) -> str:
    for cat in INDUSTRIES:
        if any(k in text for k in cat["keywords"]):
            return cat["id"]
    return "other"


def rotation_site_types() -> list[dict]:
    return [c for c in SITE_TYPES if c["rotation"]]


def tally(entries: list[dict], key: str = "title") -> dict[str, int]:
    """{site_type_id: 件数} を返す。"""
    counts: dict[str, int] = {}
    for e in entries:
        cid = classify_site_type(e.get(key) or "")
        counts[cid] = counts.get(cid, 0) + 1
    return counts

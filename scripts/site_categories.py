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

分類はギャラリーのタクソノミを正とする
--------------------------------------
当初はタイトルと URL のキーワードでサイト種別を推測していたが、
**190 件中 98 件（52%）が 'other' に落ちた**。ギャラリーの掲載タイトルは
ブランド名だけのことが多く、推測では届かない。

muuuuu.org は自前で `category/sitetype/`（16種）と `category/industry/`（34種）の
タクソノミを持っている。掲載側が人手で付けた分類なので、こちらの推測より正確で
安定している。したがって:

- サイト種別 … `GALLERY_SITETYPE_MAP` で muuuuu の sitetype スラッグから引く
- 業種       … muuuuu の industry スラッグをそのまま採用する（`INDUSTRIES`）

キーワード分類（`classify_site_type`）は、タクソノミを持たない収集元のための
フォールバックとして残す。
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
        # co=コーポレートサイト・企業サイト(3047件) / b2b-company=BtoB企業サイト(76件)
        "gallery_sitetypes": ['co', 'b2b-company'],
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
        # service=サービスサイト(107件)
        "gallery_sitetypes": ['service'],
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
        # recruit=採用サイト・採用ページ
        "gallery_sitetypes": ['recruit'],
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
        # owned-media=オウンドメディア(234件) / webmagazine=メディア・情報サイト・Webマガジン
        "gallery_sitetypes": ['owned-media', 'webmagazine'],
        "rotation": False,
    },
    # --- 観察のみ（占有率算出用。ローテ対象外） ---
    {
        "id": "brand",
        "label": "ブランドサイト",
        "keywords": ["ブランド", "brand", "世界観", "コレクション"],
        "required_pages": [], "recommended_pages": [], "tone": None, # brand=ブランドサイト・コンセプトサイト(2373件)
        "gallery_sitetypes": ['brand'],
        "rotation": False,
    },
    {
        "id": "ec",
        "label": "EC・通販",
        "keywords": ["オンラインストア", "通販", "ショップ", "STORE", "EC"],
        "required_pages": [], "recommended_pages": [], "tone": None, # ec=ECサイト・オンラインショップ(483件)
        "gallery_sitetypes": ['ec'],
        "rotation": False,
    },
    {
        "id": "public",
        "label": "公共・教育・医療機関",
        "keywords": ["市", "県", "自治体", "大学", "学校", "病院", "クリニック", "法人"],
        "url_keywords": [".ac.jp", ".go.jp", ".lg.jp", ".ed.jp"],
        "required_pages": [], "recommended_pages": [], "tone": None, # portal=ポータルサイト・プラットフォーム(258件)。行政・教育は industry 側で絞る
        "gallery_sitetypes": ['portal'],
        "rotation": False,
    },
]

# 従軸。muuuuu.org の industry タクソノミ（34種）をそのまま採用する。
# 以前は自前で 8 種に丸めていたが、掲載側の分類を潰して精度を落とすだけだった
# （実測で 190 件中 97 件が 'other' になった）。業種軸は参照サイトを揃えるのに
# 使うだけで品質ルールには効かないので、収集元の分類をそのまま持つのが正しい。
INDUSTRIES = [
    {"id": "ad", "label": "制作・開発・企画・マーケティング・コンサル"},
    {"id": "area", "label": "地域・海外・地方"},
    {"id": "art", "label": "デザイン・アート"},
    {"id": "beauty", "label": "美容・コスメ・化粧品・ケア用品"},
    {"id": "building", "label": "建築・建設・不動産・住宅"},
    {"id": "car", "label": "自動車・バイク・自転車・モビリティ"},
    {"id": "company", "label": "暮らし・インフラ・工業・メーカー"},
    {"id": "eco", "label": "エコ・チャリティー"},
    {"id": "education-service", "label": "教育サービス"},
    {"id": "electrical", "label": "家電製品・カメラ・携帯電話"},
    {"id": "entertainment", "label": "エンターテイメント・アニメ・ホビー"},
    {"id": "fashion", "label": "ファッション（女性）"},
    {"id": "fashionall", "label": "ファッション（全般）"},
    {"id": "finance", "label": "金融・投資・保険・士業"},
    {"id": "food", "label": "飲料・食品"},
    {"id": "group", "label": "地域活性・行政・公共"},
    {"id": "healthcare", "label": "健康・ヘルスケア・ウェルネス"},
    {"id": "hospital", "label": "医療・病院"},
    {"id": "human-resources", "label": "人材・HRサービス"},
    {"id": "interior", "label": "インテリア・雑貨・家具"},
    {"id": "kids", "label": "ベビー・キッズ・ファミリー"},
    {"id": "life", "label": "農業・植物"},
    {"id": "music", "label": "音楽"},
    {"id": "publication", "label": "本・出版・印刷"},
    {"id": "restaurant", "label": "カフェ・レストラン・飲食店・テイクアウト"},
    {"id": "school", "label": "学校・大学・教育"},
    {"id": "science-research", "label": "科学・研究機関"},
    {"id": "shopping", "label": "ショッピング・商業施設"},
    {"id": "sports", "label": "スポーツ・ジム・スポーツウェア"},
    {"id": "technology", "label": "Web・IT・AI・SaaS・テクノロジー"},
    {"id": "trip", "label": "ホテル・旅館・温泉・旅行"},
    {"id": "watch", "label": "時計・宝石"},
    {"id": "wedding", "label": "ウェディング"},
    {"id": "welfare-care", "label": "福祉・介護"},
]

# 収集時の除外に使う muuuuu の sitetype。日本市場向けサイトを作るのが目的なので、
# 海外サイトは参照候補から外す。
EXCLUDE_GALLERY_SITETYPES = ["overseas-site"]

# 分類の評価順。宣言順（表示順）で評価すると、採用サイトが corporate に
# 吸われてしまう（"株式会社◯◯ 採用サイト" は両方にマッチする）。
# 具体的な種別を先に評価し、corporate は最後の受け皿にする。
CLASSIFY_ORDER = ["recruit", "media", "service", "public", "ec", "brand", "corporate"]

BY_ID = {c["id"]: c for c in SITE_TYPES}

# muuuuu の sitetype スラッグ → 本プロジェクトのサイト種別 id
GALLERY_SITETYPE_MAP = {
    slug: c["id"]
    for c in SITE_TYPES
    for slug in c.get("gallery_sitetypes", [])
}

# 収集で巡回すべき sitetype スラッグ（ローテ対象を優先して先に置く）
def gallery_sitetype_slugs(rotation_only: bool = False) -> list[str]:
    out = []
    for c in SITE_TYPES:
        if rotation_only and not c["rotation"]:
            continue
        out.extend(c.get("gallery_sitetypes", []))
    return out
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


def classify_site_type_by_gallery(slugs) -> str | None:
    """muuuuu の sitetype スラッグ群から本プロジェクトのサイト種別を決める。

    掲載側が人手で付けた分類なので、これが取れるならキーワード推測より優先する。
    複数該当した場合は CLASSIFY_ORDER の順（具体的な種別が先）で決める。
    """
    mapped = {GALLERY_SITETYPE_MAP[s] for s in slugs if s in GALLERY_SITETYPE_MAP}
    if not mapped:
        return None
    for cid in CLASSIFY_ORDER:
        if cid in mapped:
            return cid
    return sorted(mapped)[0]


def rotation_site_types() -> list[dict]:
    return [c for c in SITE_TYPES if c["rotation"]]


def tally(entries: list[dict], key: str = "title") -> dict[str, int]:
    """{site_type_id: 件数} を返す。"""
    counts: dict[str, int] = {}
    for e in entries:
        cid = classify_site_type(e.get(key) or "")
        counts[cid] = counts.get(cid, 0) + 1
    return counts

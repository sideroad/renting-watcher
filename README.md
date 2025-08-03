# Renting Watcher

複数の賃貸サイトから物件を定期的にスクレイピングし、新着物件をSlackに通知するバッチシステムです。

## 機能

- 朝7時〜22時（JST）まで1時間おきにGitHub Actionsで自動実行
- 複数の賃貸サイトに対応：SUUMO、Nifty賃貸、Goodrooms、R-Store、Yahoo不動産、スマイティ
- 設定URLから物件情報をスクレイピング（ページネーション対応）
- 住所・面積・価格の正規化による高精度な重複物件の検出
- 画像URL取得機能付き
- Supabaseデータベースに物件情報を保存（upsertによる安全な保存）
- 新着物件をSlackに詳細通知（メッセージ分割・ソート機能付き）
- モジュラー設計：各サイト専用のスクレイパーとユーティリティ
- 包括的なエラーハンドリングとレート制限機能
- Jest テストスイート付き

## セットアップ

### 1. Supabaseの設定

1. [Supabase](https://supabase.com)でプロジェクトを作成
2. 以下のSQLでテーブルを作成：

```sql
CREATE TABLE properties (
  id VARCHAR(16) PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  price TEXT NOT NULL,
  address TEXT NOT NULL,
  layout TEXT NOT NULL,
  area TEXT NOT NULL,
  building_type TEXT NOT NULL,
  access TEXT[] NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_properties_created_at ON properties(created_at);
```

### 2. Slack Webhookの設定

1. Slack Appを作成し、Incoming Webhooksを有効化
2. Webhook URLを取得

### 3. 環境変数の設定

`.env.example`をコピーして`.env`を作成し、値を設定：

```bash
cp .env.example .env
```

### 4. GitHub Secretsの設定

GitHubリポジトリで以下の手順でSecretsを設定：

1. リポジトリの「Settings」タブを開く
2. 左側メニューの「Secrets and variables」→「Actions」を選択
3. 「New repository secret」ボタンをクリック
4. 以下の3つのSecretを追加：

- `SLACK_WEBHOOK_URL`: SlackのWebhook URL
  - 例: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX`
- `SUPABASE_URL`: SupabaseプロジェクトのURL
  - 例: `https://xxxxxxxxxxxxx.supabase.co`
- `SUPABASE_ANON_KEY`: SupabaseのAnon Key
  - Supabaseダッシュボードの「Settings」→「API」から取得

**注意**: Secretsが正しく設定されていない場合、GitHub Actionsの実行時に「Supabase configuration is missing」エラーが発生します。

## ローカルでの実行

```bash
# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build

# 実行
npm start

# 開発モード（TypeScriptを直接実行）
npm run dev
```

## GitHub Actionsでの自動実行

リポジトリにプッシュすると、自動的にGitHub Actionsが設定され、1時間ごとに実行されます。

手動実行も可能です：
1. GitHubリポジトリのActions タブを開く
2. "Scrape Rental Properties"ワークフローを選択
3. "Run workflow"をクリック

## カスタマイズ

### 検索URLの変更

`src/config.ts`の`URLS`配列を編集して、監視したい賃貸サイトの検索URLを設定できます。URLのドメインによって自動的に適切なスクレイパーが選択されます。

```typescript
export const URLS = [
    // SUUMO URLs
    'https://suumo.jp/jj/chintai/...',
    // Nifty URLs  
    'https://myhome.nifty.com/rent/...',
    // Goodrooms URLs
    'https://www.goodrooms.jp/tokyo/search/...',
    // R-Store URLs
    'https://www.r-store.jp/search/...',
    // Yahoo Real Estate URLs
    'https://realestate.yahoo.co.jp/rent/search/...',
    // Sumaity URLs
    'https://sumaity.com/chintai/...',
];
```

### 実行頻度の変更

`.github/workflows/scrape.yml`のcron設定を変更することで、実行頻度を調整できます。

## コマンドライン操作

### 開発・テスト

```bash
# TypeScriptの型チェック
npm run typecheck

# ESLintによる構文チェック
npm run lint

# Jestテストの実行
npm test

# ウォッチモードでテスト実行
npm run test:watch
```

### 全データ削除

```bash
npm start -- --delete-all
```

データベース内の全物件データを削除して、スクレイピングを再実行します。

## 技術仕様

### 重複検出ロジック

物件の一意性は以下の正規化されたデータの組み合わせで判定されます：

- **住所**: 丁目レベルまでに正規化（建物名・部屋番号除去）
  - 例: `東京都立川市柴崎町２丁目2-3ハイツ101号室` → `東京都立川市柴崎町２丁目`
  - 例: `世田谷区三軒茶屋2-1-1` → `世田谷区三軒茶屋2丁目`
- **面積**: 数値のみ抽出（小数点以下の0は除去）
  - 例: `83.0㎡` → `83`
  - 例: `83 m²` → `83`
- **価格**: 万円単位に統一
  - 例: `205,000円` → `20.5`
  - 例: `20.5万円` → `20.5`

同一バッチ内での重複も自動的に除去されます。

### Slack通知

- メッセージ分割機能（5件ずつ）で大量物件にも対応
- 面積降順・価格昇順での自動ソート
- 価格帯別サマリー表示（10万円未満、10-15万円、15-20万円、20-25万円、25万円以上）
- 各物件の詳細情報（価格、住所、間取り、面積、アクセス）
- 物件詳細ページへの直接リンクボタン
- エラー時のフォールバック通知機能

### スクレイピング対象

- **SUUMO**: 物件一覧・詳細ページ（建物ごと表示・部屋ごと表示の両方に対応）
- **Nifty賃貸**: ページネーション対応で全ページ取得
- **Goodrooms**: 詳細リンク検出とおすすめセクション除外機能
- **R-Store**: 複数のフォールバックセレクター対応
- **Yahoo不動産**: ListBukken__itemセレクター対応
- **スマイティ**: 複合的な物件リンク検出システム

### URLの自動振り分け

`src/config.ts`の`URLS`配列に設定されたURLは、ドメインによって自動的に振り分けられます：
- `suumo.jp`を含むURL → SUUMOスクレイパー
- `myhome.nifty.com`を含むURL → Nifty賃貸スクレイパー
- `goodrooms.jp`を含むURL → Goodroomsスクレイパー
- `r-store.jp`を含むURL → R-Storeスクレイパー
- `realestate.yahoo.co.jp`を含むURL → Yahoo不動産スクレイパー
- `sumaity.com`を含むURL → スマイティスクレイパー

### プロジェクト構造

```
src/
├── scrapers/           # 各サイト専用スクレイパー
│   ├── base.ts        # ベーススクレイパークラス
│   ├── suumo.ts       # SUUMOスクレイパー
│   ├── nifty.ts       # Nifty賃貸スクレイパー
│   ├── goodrooms.ts   # Goodroomsスクレイパー
│   ├── rstore.ts      # R-Storeスクレイパー
│   ├── yahoo.ts       # Yahoo不動産スクレイパー
│   ├── sumaity.ts     # スマイティスクレイパー
│   └── index.ts       # スクレイパーエクスポート
├── utils/             # ユーティリティ関数
│   ├── address.ts     # 住所正規化関数
│   ├── property.ts    # プロパティID生成
│   ├── errors.ts      # エラーハンドリング
│   └── index.ts       # ユーティリティエクスポート
├── types/             # TypeScript型定義
│   └── index.ts
├── config.ts          # 設定ファイル
├── database.ts        # データベース操作
├── slack.ts          # Slack通知機能
└── index.ts          # メインエントリポイント
```

## トラブルシューティング

### GitHub Actionsで「Supabase configuration is missing」エラーが発生する場合

1. **GitHub Secretsが正しく設定されているか確認**
   - リポジトリの Settings → Secrets and variables → Actions を開く
   - `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SLACK_WEBHOOK_URL` の3つが登録されているか確認
   - Secret名は大文字で正確に入力されているか確認

2. **Secretsの値が空でないか確認**
   - 各Secretの「Update」ボタンから値が入力されているか確認
   - コピー&ペースト時に余分な空白が入っていないか確認

3. **リポジトリの権限を確認**
   - フォークしたリポジトリの場合、Secretsは引き継がれないため再設定が必要
   - Organization所有のリポジトリの場合、Secretsへのアクセス権限を確認

4. **Actions実行ログで確認**
   - 「Check environment setup」ステップで各Secretが「configured」と表示されるか確認
   - 「not configured」の場合は、そのSecretが設定されていない
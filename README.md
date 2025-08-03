# Renting Watcher

SUUMO・Nifty賃貸の物件を定期的にスクレイピングし、新着物件をSlackに通知するバッチシステムです。

## 機能

- 朝8時〜22時（JST）まで1時間おきにGitHub Actionsで自動実行
- SUUMO・Nifty賃貸の設定URLから物件情報をスクレイピング
- ページネーション対応で全ページの物件を取得
- 住所・面積・価格の正規化による重複物件の検出
- Supabaseデータベースに物件情報を保存
- 新着物件をSlackに通知

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

GitHubリポジトリのSettings > Secretsで以下を設定：

- `SLACK_WEBHOOK_URL`: SlackのWebhook URL
- `SUPABASE_URL`: SupabaseプロジェクトのURL
- `SUPABASE_ANON_KEY`: SupabaseのAnon Key

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

`src/config.ts`の`URLS`配列を編集して、監視したいSUUMO・Nifty賃貸の検索URLを設定できます。URLのドメインによって自動的に適切なスクレイパーが選択されます。

```typescript
export const URLS = [
    // SUUMO URLs
    'https://suumo.jp/jj/chintai/...',
    // Nifty URLs  
    'https://myhome.nifty.com/rent/...',
];
```

### 実行頻度の変更

`.github/workflows/scrape.yml`のcron設定を変更することで、実行頻度を調整できます。

## コマンドライン操作

### 全データ削除

```bash
npm start -- --delete-all
```

データベース内の全物件データを削除して、スクレイピングを再実行します。

## 技術仕様

### 重複検出ロジック

物件の一意性は以下の正規化されたデータの組み合わせで判定されます：

- **住所**: 丁目レベルまでに正規化（建物名・部屋番号除去）
- **面積**: 数値のみ抽出（`83.0㎡` → `83`）
- **価格**: 万円単位に統一（`205,000円` → `20.5`）

### Slack通知

- 新着物件のシンプルなリスト表示
- 各物件の詳細情報（価格、住所、間取り、面積、アクセス）
- 物件詳細ページへの直接リンク

### スクレイピング対象

- **SUUMO**: 物件一覧・詳細ページ
- **Nifty賃貸**: ページネーション対応で全ページ取得

### URLの自動振り分け

`src/config.ts`の`URLS`配列に設定されたURLは、ドメインによって自動的に振り分けられます：
- `suumo.jp`を含むURL → SUUMOスクレイパー
- `myhome.nifty.com`を含むURL → Nifty賃貸スクレイパー
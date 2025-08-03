# Renting Watcher

SUUMOの賃貸物件を定期的にスクレイピングし、新着物件をSlackに通知するバッチシステムです。

## 機能

- 朝8時〜22時（JST）まで1時間おきにGitHub Actionsで自動実行
- 設定されたSUUMOのURLから物件情報をスクレイピング
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

`src/config.ts`の`URLS`配列を編集して、監視したいSUUMOの検索URLを設定できます。

### 実行頻度の変更

`.github/workflows/scrape.yml`のcron設定を変更することで、実行頻度を調整できます。
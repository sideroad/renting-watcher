# Renting Watcher

SUUMO・Nifty賃貸の物件を定期的にスクレイピングし、新着物件をSlackに通知するバッチシステムです。

## 機能

- 朝8時〜22時（JST）まで1時間おきにGitHub Actionsで自動実行
- SUUMO・Nifty賃貸の設定URLから物件情報をスクレイピング
- ページネーション対応で全ページの物件を取得
- 住所・面積・価格の正規化による高精度な重複物件の検出
- Supabaseデータベースに物件情報を保存（upsertによる安全な保存）
- 新着物件をSlackに詳細通知（メッセージ分割・ソート機能付き）

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

### URLの自動振り分け

`src/config.ts`の`URLS`配列に設定されたURLは、ドメインによって自動的に振り分けられます：
- `suumo.jp`を含むURL → SUUMOスクレイパー
- `myhome.nifty.com`を含むURL → Nifty賃貸スクレイパー

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
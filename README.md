# パソコン教室 予約管理アプリ

パソコン教室向けの予約管理 Web アプリケーションです。  
管理者は Web ブラウザから操作し、顧客は LINE 公式アカウントから予約・変更・キャンセルができます。

---

## 機能

### 管理者 Web 画面

| ページ | 機能 |
|---|---|
| ダッシュボード | 本日・明日の予約サマリー、顧客総数 |
| 予約管理 | 月次カレンダー、フレックス/固定予約の追加・編集・キャンセル |
| 顧客管理 | 顧客の追加・編集・削除、固定予約（曜日・時間）の設定 |
| 講座設定 | IDプレフィックスと講座名の管理・カラー設定 |
| 印刷 | 指定日の予約をSVGタイムラインで表示・印刷 |

### LINE Bot（顧客向け）

- 友だち追加 → 顧客IDで本人確認・登録
- **予約する** — 日付・開始時間・終了時間をQuick Replyで選択
- **予約確認・変更** — 直近の予約をFlex Messageカードで表示、変更ボタンで日時変更
- **キャンセル** — 予約カードから1タップでキャンセル

---

## 顧客 ID ルール

顧客IDは4桁の数字で、先頭の数字が講座を決定します。

| 先頭数字 | 講座（デフォルト） |
|---|---|
| 1xxx | MOS資格試験対策講座 |
| 5xxx | 子ども向けITプログラミング講座 |
| 8xxx | 子ども向け本格プログラミング講座 |

講座設定画面から自由に追加・変更できます。

---

## 技術スタック

| 役割 | 技術 |
|---|---|
| フレームワーク | Next.js 14 (App Router, TypeScript) |
| スタイリング | Tailwind CSS |
| ORM | Prisma |
| データベース | PostgreSQL 16 |
| LINE連携 | @line/bot-sdk |
| 認証 | JWT (jose) + httpOnly Cookie |
| コンテナ | Docker Compose |

---

## セットアップ

### 前提条件

- Docker / Docker Compose がインストール済み
- LINE Developers アカウントと公式LINEアカウント（Messaging API）

### 1. リポジトリをクローン

```bash
git clone https://github.com/ch1w4/booking-manage-app.git
cd booking-manage-app
```

### 2. 環境変数を設定

```bash
cp .env.example .env
```

`.env` を編集して各値を設定してください。

```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/pckyo
JWT_SECRET=ランダムな32文字以上の文字列
LINE_CHANNEL_SECRET=LINEチャンネルシークレット
LINE_CHANNEL_ACCESS_TOKEN=LINEチャンネルアクセストークン
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ログインパスワード
NEXT_PUBLIC_APP_URL=https://your-domain.com
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

### 3. 起動

```bash
docker compose up --build
```

初回起動時に自動で以下が実行されます：
- Prisma マイグレーション
- 初期データのシード（講座3種・管理者アカウント）

アプリは **ポート 3000** で起動します。

---

## 外部 Nginx からのリバースプロキシ設定

別 VM で Nginx を運用している場合は `nginx/nginx.conf` を参考に設定してください。

```nginx
location / {
    proxy_pass http://<このVMのIP>:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

詳細は [nginx/nginx.conf](nginx/nginx.conf) を参照してください。

---

## LINE Webhook 設定

LINE Developers コンソールの Messaging API 設定で Webhook URL を以下に設定してください。

```
https://your-domain.com/api/line/webhook
```

---

## ディレクトリ構成

```
.
├── docker-compose.yml
├── .env.example
├── nginx/
│   └── nginx.conf          # 外部Nginx用設定例
└── app/
    ├── Dockerfile
    ├── prisma/
    │   ├── schema.prisma   # DBスキーマ定義
    │   └── seed.ts         # 初期データ
    └── src/
        ├── app/
        │   ├── (admin)/    # 管理画面ページ群
        │   ├── api/        # REST API + LINE Webhook
        │   └── login/      # ログインページ
        ├── components/     # 共通コンポーネント
        └── lib/            # DB・認証・LINEユーティリティ
```

---

## ライセンス

MIT

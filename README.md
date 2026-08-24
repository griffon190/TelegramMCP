# Telegram MCP Server

Gemini Spark や Claude Desktop などの MCP（Model Context Protocol）クライアントから、Telegram メッセージの送受信を行えるようにするための MCP サーバーです。

---

## 前提条件

動作には **Node.js** が必要です。

1. **Node.js のインストール**:
   - まだインストールされていない場合は、[Node.js 公式サイト](https://nodejs.org/) から LTS 版をダウンロードしてインストールしてください。
   - インストール完了後、コマンドプロンプトや PowerShell を再起動し、`node -v` および `npm -v` が動作することを確認してください。

2. **Telegram Bot の作成**:
   - Telegram アプリ内で [@BotFather](https://t.me/BotFather) を検索し、`/newbot` コマンドを使用して新しい Bot を作成します。
   - 作成後に表示される **HTTP API Token**（例: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`）を控えておきます。

---

## セットアップ手順

1. **リポジトリディレクトリに移動し、依存関係をインストールします**:
   ```bash
   npm install
   ```

2. **環境変数の設定**:
   - ディレクトリ内の `.env.example` を `.env` にコピーします。
   ```bash
   copy .env.example .env
   ```
   - `.env` ファイルを開き、控えておいた `TELEGRAM_BOT_TOKEN` を設定します。
   ```env
   TELEGRAM_BOT_TOKEN=ここにBotのトークンを貼り付け
   TELEGRAM_DEFAULT_CHAT_ID=（任意）デフォルトの宛先チャットID
   ```
   > ※ `TELEGRAM_DEFAULT_CHAT_ID` を指定しておくと、ツール呼び出し時にチャットIDを省略した場合に自動的にそのチャットに送信されます。

3. **ビルドの実行**:
   TypeScript を JavaScript にコンパイルします。
   ```bash
   npm run build
   ```

---

## サーバーの起動とMCPクライアントへの登録方法

### 1. サーバーの起動
ローカルで起動する場合は、依存関係をインストール、ビルドした後に以下のように起動します。
```bash
npm start
```
デフォルトではポート `3000` でサーバーが起動し、以下のエンドポイントが利用可能になります。
- SSEエンドポイント: `http://localhost:3000/sse`

ポート番号を変更したい場合は、環境変数 `PORT` を指定して起動するか、`.env` ファイルに `PORT=8080` のように追記してください。

### 2. MCP クライアントへの登録

#### Claude Desktop の場合
設定ファイル（例: `AppData\Roaming\Claude\claude_desktop_config.json`）に以下のように SSE サーバーを追加します。

```json
{
  "mcpServers": {
    "telegram-mcp": {
      "type": "sse",
      "url": "http://localhost:3000/sse"
    }
  }
}
```

#### Gemini Spark 等のクライアントの場合
クライアントの設定画面で SSE トランスポートを選択し、URL に `http://localhost:3000/sse` を指定して登録します。

---

## 提供ツール

### 1. `telegram_get_me`
- **概要**: Bot自身のアカウント情報を取得します。接続確認テストに便利です。
- **パラメータ**: なし

### 2. `telegram_send_message`
- **概要**: 指定した `chat_id` にメッセージを送信します。
- **パラメータ**:
  - `text` (string, 必須): 送信するメッセージ。
  - `chat_id` (string, 任意): 送信先チャットIDまたはユーザー名（例: `@my_channel`）。指定しない場合は `.env` のデフォルトIDが使用されます。
  - `parse_mode` (string, 任意): 書式設定モード（`Markdown`, `HTML`, `MarkdownV2` から選択）。

### 3. `telegram_get_updates`
- **概要**: Bot宛ての最新メッセージ（アップデート）を取得します。
- **パラメータ**:
  - `offset` (number, 任意): 取得開始位置となるアップデートID。
  - `limit` (number, 任意): 一度に取得する最大件数（1〜100、デフォルト100）。
  - `timeout` (number, 任意): ロングポーリングのタイムアウト秒数。

# Reacture

講義資料を表示しながら、受講生がスマホからリアルタイムでリアクションやコメントを送れる授業支援ツールです。

## 特徴

- **リアクション** — 👏 拍手 / 😄 笑顔 / ❤️ いいね / 😮 おお！ / ❓ 質問 / 👍 OK の6種類＋教員がカスタム絵文字を1つ追加可能
- **効果音** — リアクションごとに効果音が再生され、教室が盛り上がる（ボリューム調整・ミュート対応）
- **コメント** — テキストコメントがニコニコ動画風に画面を流れる
- **アンケート** — リアルタイム投票を作成し、終了後に結果をグラフ表示
- **スライド表示** — 画像/PDF のアップロード、または外部スライド（Google Slides / Gamma / PowerPoint）の埋め込み
- **QRコード** — 参加用URLとルームコードを大きく表示

## システム構成

```
Vercel (Next.js)          Render (Socket.IO)
┌──────────────────┐      ┌──────────────────┐
│ フロントエンド     │◄────►│ リアルタイム通信   │
│ ・教員画面        │  WS  │ ・ルーム管理      │
│ ・参加者画面      │      │ ・リアクション中継  │
│ ・PDF / スライド  │      │ ・アンケート管理   │
└──────────────────┘      └──────────────────┘
```

- **Vercel** — Next.js のホスティング。CDN で高速配信
- **Render** — Socket.IO サーバー。WebSocket による常時接続

## 使い方

### 教員（発表者）

1. トップページで「ルームを作成」をクリック
2. スクリーン画面が表示される。以下の方法でスライドを設定：
   - **画像 / PDF をアップロード** — ドラッグ＆ドロップまたはファイル選択
   - **外部スライドを埋め込み** — Google Slides / Gamma / PowerPoint の共有URLを入力
3. QRコード（キーボード `Q` キーまたはメニューから）を表示して受講生に共有
4. 画面下部にマウスを移動するとコントロールバーが表示される：
   - ページ送り（← →）、キーボードの矢印キーでも操作可能
   - 🔊 ボリューム調整・ミュート
   - 📊 アンケート作成・終了
   - 🎨 カスタムリアクション設定
   - QRコード表示

### 受講生（参加者）

1. QRコードを読み取るか、トップページでルームコード（4文字）を入力
2. リアクションボタンをタップして反応を送信
3. テキスト欄からコメントを送信
4. アンケートが開始されたら選択肢をタップして投票

## ローカル開発

### 前提条件

- Node.js 20 以上
- npm

### セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/634nakajima/reacture.git
cd reacture

# フロントエンド依存関係
npm install

# サーバー依存関係
cd server
npm install
cd ..
```

### 開発サーバーの起動

2つのターミナルで起動します：

```bash
# ターミナル1: Socket.IO サーバー（ポート 3001）
cd server
npm run dev

# ターミナル2: Next.js（ポート 3000）
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

## デプロイ

### 1. Socket.IO サーバー（Render）

1. [Render](https://render.com) で **New** → **Web Service** を作成
2. GitHub リポジトリを接続し、以下を設定：
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
3. 環境変数を設定：
   - `CLIENT_ORIGIN` = Vercel のデプロイURL（例: `https://reacture-alpha.vercel.app`）

### 2. フロントエンド（Vercel）

1. [Vercel](https://vercel.com) でプロジェクトをインポート
2. 環境変数を設定：
   - `NEXT_PUBLIC_SOCKET_URL` = Render のデプロイURL（例: `https://reacture-server.onrender.com`）
3. デプロイ（GitHub 連携で push 時に自動デプロイ）

### 注意事項

- Render 無料プランでは15分間アクセスがないとサーバーがスリープします。授業前に一度アクセスして起こしておいてください
- 外部スライド埋め込みは、サービス側が iframe を許可している必要があります（Canva は非対応）

## 効果音のカスタマイズ

`public/sounds/` に音声ファイルを配置し、`src/types/index.ts` のパスを更新してください。

| リアクション | ファイル |
|---|---|
| 👏 拍手 | `public/sounds/clap.mp3` |
| 😄 笑顔 | `public/sounds/laugh.mp3` |
| ❤️ いいね | `public/sounds/chime.mp3` |
| 😮 おお！ | `public/sounds/wow.mp3` |
| ❓ 質問 | `public/sounds/question.mp3` |
| 👍 OK | `public/sounds/pop.mp3` |

mp3 / wav / ogg / m4a に対応しています。

## Reacture Desktop（macOS アプリ）

PowerPoint・Keynote・PDF など**任意のアプリの上に**リアクションやコメントをオーバーレイ表示できる macOS ネイティブアプリです。ブラウザ版とは異なり、普段のプレゼンソフトをそのまま使いながら教室のインタラクションを実現します。

### 主な機能

- **透明オーバーレイ** — 全画面透明ウィンドウでリアクション絵文字・ニコニコ風コメントを表示。マウス操作を透過するためスライド操作に干渉しない
- **ルーム作成 / 管理** — 設定画面からワンクリックでルームを作成。トレイメニューからも操作可能
- **QRコード表示** — 別ウィンドウ（800×1000）で大きく表示。教室のプロジェクターに映しやすいサイズ
- **アンケート** — 設定画面から設問を作成。投票状況・結果は別ウィンドウでリアルタイム表示
- **カスタムリアクション** — 任意の絵文字を1つ追加可能
- **効果音** — リアクションに応じた効果音を再生（ボリューム調整可）
- **トレイメニュー** — メニューバーからルーム管理・オーバーレイ ON/OFF・QR表示/非表示を操作。設定画面を閉じていても全機能を制御可能
- **ショートカット** — `Cmd+Shift+R` でオーバーレイの表示/非表示を切り替え

### インストール

ビルド済みアプリ（`desktop/dist/mac-arm64/Reacture Desktop.app`）を `Applications` フォルダにコピーするか、ソースから実行します。

### ソースからの起動

```bash
cd desktop
npm install
npm start
```

### macOS アプリのビルド

```bash
cd desktop
npm run build
# → desktop/dist/mac-arm64/Reacture Desktop.app が生成される
```

### アーキテクチャ

```
┌────────────────────────────┐
│  Electron Main Process     │
│  ├── Socket.IO Client      │  ← サーバーとの通信
│  ├── Setup Window          │  ← ルーム管理・設定UI
│  ├── Overlay Window        │  ← 透明・全画面・最前面
│  ├── QR Window             │  ← 別ウィンドウ表示
│  ├── Poll Window           │  ← 投票/結果の別ウィンドウ
│  └── Tray Menu             │  ← メニューバー操作
└────────────────────────────┘
```

- Socket.IO の接続はメインプロセスで管理し、IPC 経由で各ウィンドウにイベントを配信
- オーバーレイは `alwaysOnTop: true` + `transparent: true` + `setIgnoreMouseEvents(true)` で実現
- 設定画面を閉じてもトレイに常駐し、再表示時に状態を復元

## 技術スタック

- **フロントエンド**: Next.js 16 / React 19 / Tailwind CSS 4 / TypeScript
- **デスクトップ**: Electron + electron-builder（macOS）
- **リアルタイム通信**: Socket.IO
- **PDF表示**: PDF.js
- **デプロイ**: Vercel（フロントエンド）+ Render（Socket.IO サーバー）

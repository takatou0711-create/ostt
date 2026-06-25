# SMASHFINDER — Netlify公開手順

## ファイル構成

```
smashfinder/
├── index.html                    # 大会一覧ページ（トップ）
├── submit.html                   # 大会投稿フォーム
├── approved.json                 # 手動承認済み大会データ（トナメル等）
├── netlify.toml                  # Netlify設定
└── netlify/
    └── functions/
        └── tournaments.js        # APIプロキシ（サーバーレス関数）
```

---

## STEP 1｜start.gg APIキーを取得する

1. https://start.gg にログイン（アカウントがなければ無料登録）
2. 右上のアイコン → **Settings**
3. 左メニュー **Developer Settings** を開く
4. **Create new token** をクリック → トークンが表示される
5. コピーして手元に保存しておく（一度しか表示されないので注意）

---

## STEP 2｜GitHubにリポジトリを作る

1. https://github.com にログイン
2. 右上 **+** → **New repository**
3. Repository name: `smashfinder`（任意）
4. **Private** を選択（APIキーをコードに書かないので公開でも可）
5. **Create repository** をクリック

---

## STEP 3｜ファイルをGitHubにアップロードする

### 方法A：ブラウザから（Git不要、簡単）

1. 作成したリポジトリのページを開く
2. **uploading an existing file** リンクをクリック
3. 以下のファイルをすべてドラッグ＆ドロップ：
   - `index.html`
   - `submit.html`
   - `approved.json`
   - `netlify.toml`
4. **フォルダごとアップロード**が必要なので、`netlify/functions/tournaments.js` は：
   - GitHubの **Create new file** ボタンから
   - ファイル名欄に `netlify/functions/tournaments.js` と直接入力（スラッシュでフォルダが自動生成される）
   - コードをペーストして保存
5. **Commit changes** をクリック

### 方法B：Gitコマンド（ターミナルが使える場合）

```bash
cd smashfinder
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/smashfinder.git
git push -u origin main
```

---

## STEP 4｜Netlifyにデプロイする

1. https://netlify.com にログイン（GitHubアカウントで登録可）
2. **Add new site** → **Import an existing project**
3. **GitHub** を選択 → リポジトリ `smashfinder` を選択
4. ビルド設定はそのまま（変更不要）
5. **Deploy site** をクリック

→ 数十秒でデプロイ完了。仮のURLが発行される（例: `https://random-name-123.netlify.app`）

---

## STEP 5｜APIキーを環境変数に設定する（重要）

APIキーはコードに書かずに、Netlifyの環境変数として安全に管理する。

1. Netlify管理画面 → サイトを選択
2. **Site configuration** → **Environment variables**
3. **Add a variable** をクリック
4. 以下を入力：
   - **Key**: `STARTGG_API_KEY`
   - **Value**: STEP 1 でコピーしたトークン
5. **Save** をクリック

---

## STEP 6｜再デプロイして動作確認する

環境変数は次のデプロイから反映される。

1. Netlify管理画面 → **Deploys** タブ
2. **Trigger deploy** → **Deploy site**
3. デプロイ完了後、発行されたURLにアクセス
4. 大会一覧が表示されれば完了 ✅

---

## STEP 7｜独自ドメインを設定する（任意）

1. Netlify管理画面 → **Domain management**
2. **Add a domain** → 所有ドメインを入力
3. DNSの設定を案内に従って変更する

---

## 運用：トナメル大会を追加する方法

投稿フォーム（`/submit.html`）から主催者が投稿 → Netlifyのメール通知が届く。

承認したい場合：

1. `approved.json` をGitHubで開いて編集
2. 以下の形式でデータを追記：

```json
{
  "id": "manual_001",
  "source": "manual",
  "name": "大会名",
  "startAt": 1753200000,
  "endAt":   1753200000,
  "city": "東京",
  "countryCode": "JP",
  "venueName": "会場名",
  "venueAddress": "住所",
  "numAttendees": 64,
  "url": "https://tonamel.com/competition/xxxxx",
  "platform": "tonamel",
  "game": "Super Smash Bros. Ultimate",
  "images": []
}
```

> `startAt` / `endAt` はUNIXタイムスタンプ（秒）。
> https://www.unixtimestamp.com で日時 → 数値に変換できる。

3. GitHubで **Commit changes** → Netlifyが自動で再デプロイ

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| 大会一覧が表示されない | APIキー未設定 | STEP 5 を確認 |
| `API key not configured` エラー | 環境変数名が違う | `STARTGG_API_KEY` と完全一致か確認 |
| 再デプロイしても変わらない | キャッシュ | Netlify管理画面から **Clear cache and deploy** |
| フォーム投稿が届かない | Netlify Formsが未有効化 | デプロイ後に **Forms** タブで確認 |

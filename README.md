# つくえ

片付けなくていいメモ帳。触った紙は手前に残り、触らない紙は黄ばんで沈んでいきます。
スマホのホーム画面に追加して使うWebアプリ(PWA)です。

<img src="icons/icon-192.png" width="96" alt="つくえのアイコン">

## 特徴

- 検索もフォルダもない、散らかしたままの机
- 触らない紙は時間とともに黄ばみ、下へ沈む
- 窓の光は端末の時刻に合わせて動き、夕方から卓上ライトに移り変わる
- 紙の影は光源から計算し、反りや持ち上げた高さで形が変わる
- オフラインで動作し、メモは端末の中だけに保存

## 公開する(GitHub Pages)

1. GitHubで新しいリポジトリを作る(例:`tsukue`、公開範囲は Public、README などは追加しない)
2. このフォルダの中身を `main` ブランチに入れる(下の A か B)
3. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする
4. **Actions** タブで「Deploy to GitHub Pages」が完了するのを待つ(1〜2分)
5. `https://<ユーザー名>.github.io/tsukue/` をスマホで開く

以降は `main` に push するたびに自動で公開されます。

### A. git コマンドで入れる

```sh
cd tsukue
git init -b main
git add .
git commit -m "つくえ 初版"
git remote add origin https://github.com/<ユーザー名>/tsukue.git
git push -u origin main
```

### B. ブラウザからアップロードする

1. リポジトリの画面で **Add file → Upload files** を開き、フォルダの中身をドラッグ&ドロップして Commit
2. `.github` フォルダは隠しフォルダのためアップロードから漏れやすいので、**Add file → Create new file** でファイル名に `.github/workflows/pages.yml` と入力し、同名ファイルの中身を貼り付けて Commit
3. `.nojekyll`(中身は空)も同じ方法で作成

## スマホに入れる

- **iPhone(Safari)**:共有ボタン → 「ホーム画面に追加」
- **Android(Chrome)**:メニュー → 「アプリをインストール」

## 手元で動かす

PWAの仕組み(オフライン保存)は `http://localhost` か https でしか動きません。ファイルを直接ダブルクリックせず、簡易サーバーで開いてください。

```sh
python3 -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

手元で `sw.js` の動きを試すときは、`VERSION` を書き換えるか、ブラウザの開発者ツールで Service Worker を更新してください。公開時は GitHub Actions がコミットごとに自動で付け替えます。

## ファイル構成

| パス | 役割 |
|---|---|
| `index.html` | 画面の骨組み |
| `css/style.css` | 見た目(紙・机・レンズ・パネル) |
| `js/app.js` | 動き・光・影・木目の描画・メモの保存 |
| `sw.js` | オフライン用のファイル保存 |
| `manifest.webmanifest` | アプリ名・アイコン・起動方法 |
| `icons/` | ホーム画面用アイコン(iPhone用・Android用・マスカブル) |
| `.github/workflows/pages.yml` | GitHub Pages への自動公開 |

## 主な調整箇所(`js/app.js`)

| 調整したいこと | 探す場所 |
|---|---|
| 夕方・朝の移り変わりの時刻 | `function sunState()` の `D` と `wl` |
| 陽だまりの位置・明るさ | `function computeLight()` の `PATCH` |
| 紙の沈む速さの初期値 | `sinkDays` |
| サンプルの紙 | `function seed()` |
| 木目の模様 | `WOOD_FS`(シェーダー) |

## データについて

- メモはその端末のブラウザの中(localStorage)だけに保存され、どこにも送信されません
- アプリやブラウザのデータを削除すると、メモも消えます
- 機種変更での引き継ぎ(書き出し・読み込み)は未実装です

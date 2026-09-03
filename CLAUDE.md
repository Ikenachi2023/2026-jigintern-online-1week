# CLAUDE.md

## プロジェクト概要
ライブ配信視聴画面（HLS動画再生 + コメント/アイテム送信）。フレームワークなし、
ビルドツールはVite（`npm run start`でdevサーバー起動、`public/`を直接配信）。

## 構成
- `public/index.html` — 画面構造。SVGアイコンは`<symbol>`にまとめ`<use>`で参照
- `public/main.js` — 全ロジック（モジュール分割なし、1ファイルにセクション分けで記述）
- `public/styles.css` — スタイル。CSS変数は`:root`に最小限（例: `--hibiscus`）

外部依存（サーバー側は別リポジトリ、フロントからfetch/SSEで叩くのみ）:
- HLSストリーム: `https://intern-hls-server.*.workers.dev/stream.m3u8`
- コメントSSE/POST/アイテムAPI: `https://intern-comment-server.*.deno.net`
  （仕様は https://github.com/jigintern/intern-comment-server の USAGE.md 参照）

## 複数セッション運用
ユーザーは複数セッションを同時起動し、それぞれ別ブランチで作業させることがある。
- 作業ディレクトリは`git worktree add -b <branch> .claude/worktrees/<name>`で分けて
  衝突を避ける（`EnterWorktree`はこの環境ではエラーになるため手動で行う）
- `git rebase`など`main`を含む共有ブランチの履歴を書き換える操作は禁止。rebaseで
  他セッションのコミットを意図せずdropし消失させる事故が過去にあった。取り込みは
  `cherry-pick`や`merge`など履歴を書き換えない方法を使う

## コーディング方針
- vanilla JS。`querySelector`で要素取得し、`if (el1 && el2 && ...)`で存在チェックしてから
  イベント登録するガード節パターンを徹底する
- 関数・変数名は英語、コメントは日本語。コメントは「何をしているか」より
  **「なぜそうしているか」**（ブラウザ制約、仕様上の理由、ハック的対応など）を書く
- 状態はDOM属性（`aria-pressed`, `aria-expanded`, `hidden`, `dataset.mode`）で表現し、
  JS側のフラグ変数と二重管理する場合は両方を更新する関数を1箇所にまとめる
- 一時的な仮実装（ダミーデータ、プレースホルダー色など）には
  「実データが来たら不要」等、剥がすタイミングが分かるコメントを残す
- ユーザーが書いたコメントは尊重し、削除する場合は許可を求める

## UI/UXの方針
- 具体的な見た目・演出の要望はCLAUDE.mdに書かず、セッションごとに伝える
- アニメーション/フィードバックは`prefers-reduced-motion`に配慮する
- UI/デザイン作業では`frontend-design`・`web-design-guidelines`スキルを使う

## 自動チェック
- `public/main.js`を変更したら、コミット・作業完了報告の前に`npm run check`
  （`node --check`によるJS構文チェック）を実行し、エラーがないことを確認する

## 禁止行為
- 既存ファイルの丸ごと上書き（Write等）・全削除。差分編集（Edit）を使う
- `git reset --hard`, `git push --force`, `git clean`, `rm -rf`など、既存の変更を
  破壊する操作
- `public/`以外（README.md, package.json, docs/, CLAUDE.md自身など）のファイルを
  指示なく変更する
- ユーザーの確認なしにcommit・pushする
- 外部API（コメントサーバー等）の仕様をUSAGE.mdで確認せず、推測で実装する
- フレームワーク・ビルドツール・外部ライブラリの新規導入
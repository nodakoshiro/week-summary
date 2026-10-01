# Week Summary

Google カレンダーのサイドバーに、今週の合計を表示する Google Workspace アドオン。
個人開発。公開先は Google Workspace Marketplace（申請前）。

## 何をするか

予定を分類して、週ごとに集計する。分類の軸は2つ。

- **予定の色**（主軸）— 色IDに名前をつけると、その名前で集計される
- **タグ**（補助）— 色が付いていない予定向け。タイトルか説明に含まれる文字列で判定

1つの予定は1つのラベルにしか入らない。色が設定されていればタグより優先する。

金額は色では表現できないので、テキストから拾う（`¥1200`）。
金額表記があればその予定は金額として、なければ所要時間として積む。

## アーキテクチャ

層を跨がせないこと。ここが崩れると集計のテストが書けなくなる。

```
Code.gs       エントリ。薄く保つ
calendar.gs   CalendarApp → 内部Event型への変換。CalendarApp はここだけ
aggregate.gs  純粋ロジック。Google の API を一切参照しない
ui.gs         CardService。CardService はここだけ
config.gs     PropertiesService。設定の読み書きはここだけ
```

**`aggregate.gs` に Google の API を持ち込まない。** これが唯一の重要な制約。
このファイルが純粋である限り、Node でそのままテストでき、将来 Go + HTTP
エンドポイントに移すときも仕様とテストがそのまま移せる。

内部で受け渡す型：

```js
// 内部Event型（calendar.gs が組み立てる）
{ title, description, startMs, endMs, allDay, declined, colorId, dayIndex }

// Summary（ui.gs が受け取る）
{ rangeLabel, rows: [{ label, count, value, detail, delta, goal }] }
```

## コマンド

```sh
npm test        # 純粋層のテスト。Google に繋がずに走る
npm run push    # clasp push
npm run open    # Apps Script エディタを開く
```

`tools/test.js` は `.gs` を vm で読み込んで実行する。`.gs` 側に Node 用の
記述を足す必要はない。`.claspignore` により、clasp に渡るのは `.gs` と
`appsscript.json` だけ。

## 必ず守ること

### oauthScopes を明示しているので自動検出が効かない

`appsscript.json` に `oauthScopes` を書いた時点で、Apps Script の自動検出は
**完全に上書きされる**。新しい Google サービスを使ったら、必要なスコープを
手で足すこと。足し忘れると認可エラーになり、原因が非常に分かりにくい。

過去に `calendar.addons.execute` を書き漏らして半日溶かしている。

確認方法：`oauthScopes` を一時的に丸ごと外して保存すると、自動検出された
スコープが表示される。そこに見慣れないものが増えていないか見る。

### スコープを増やさない

現在は読み取りのみ（`calendar.readonly`）。カレンダーへの書き込みは実装しない。
「読むだけで何も変更しない」という説明の単純さが、審査とユーザーの安心感の
両方で効いている。自動で色を付ける、サマリーを予定として登録する、といった
機能は意図的に見送っている。

### プライバシーポリシーと実装を一致させる

https://nodakoshiro.com/week-summary/privacy.html が実装より先に書かれている。
データの扱いを変えたら、必ずページ側も直すこと。審査では実際に動かして
確認される。

### API の色名と UI の色名が違う

`CalendarApp.EventColor.PALE_BLUE` はカレンダー UI では「ラベンダー」。
利用者に見せるのは必ず `COLOR_NAMES`（config.gs）の方。

## 集計の仕様（バグりやすい箇所）

- 終日予定は時間集計から外す（24時間として入ってくるため）
- 辞退した予定は除外する
- 繰り返し予定は展開後の各インスタンスで数える
- `getEvents` は範囲に「重なる」予定を返すので、週の開始より前に始まる予定も
  含まれる。曜日内訳からは外すが、合計分数には入れている
- 既定のカレンダーのみ対象
- 色を指定していない予定は `getColor()` が空文字を返す想定。**実機で未確認**

## 現在の状態

できているもの：

- 集計ロジックと Node でのテスト（13ケース、全部通る）
- 色とタグによる分類、金額の抽出、先週比、週の目標と達成率
- `PropertiesService` による利用者ごとの設定保存
- 設定カード（色ごとのラベル、タグ、目標）
- サイト（https://nodakoshiro.com）とプライバシーポリシー、利用規約
- OAuth 同意画面、ドメイン所有権確認、アイコン

次にやること：

1. **実機での動作確認**。GCP プロジェクトを移したので、再インストールと再認可が必要
2. `getColor()` が既定色の予定で何を返すか確認し、必要なら分岐を直す
3. 設定カードの保存後にサマリーが正しく更新されるか確認
4. スクリーンショットを撮ってサイトの図を差し替える
5. OAuth 検証の申請（デモ動画が必要）→ アプリ審査

## 環境

- Apps Script（V8）、GCP プロジェクトに紐付け済み
- デプロイはテストデプロイのみ。未公開
- `clasp` でローカルから push

# Week Summary

Google カレンダーのサイドバーに、今週の合計を出すアドオン。

予定の色に名前をつけると、その名前で集計される。色を使わない予定は
タグ（タイトルか説明に含まれる文字列）でも拾える。

```
バジルの予定        → 「運動」として所要時間を合計
トマトの予定 ¥1200  → 「食費」として金額を合計
```

## 開発

```sh
npm test        # 純粋層のテスト。Google に繋がずに走る
npm run push    # clasp push
npm run open    # Apps Script エディタを開く
```

clasp を使う前に `.clasp.json` を手で作る。スクリプト ID を含むので `.gitignore` に入れてある。

```json
{ "scriptId": "<スクリプト ID>", "rootDir": "." }
```

## ファイル

```
appsscript.json   マニフェスト
Code.gs           エントリ
calendar.gs       CalendarApp からの取得
aggregate.gs      集計（純粋。Google の API を参照しない）
ui.gs             CardService
config.gs         PropertiesService による設定の保存
test.gs           テスト
tools/test.js     Node 用のテストランナー
```

設計の意図と注意点は CLAUDE.md を参照。

## v1 からの変更

- 分類の主軸をタグから**予定の色**に変更（タグも併用可）
- 設定を `config.gs` のベタ書きから `PropertiesService` に移し、設定カードを追加
- 週の目標と達成率を追加
- 1つの予定は1つのラベルにしか入らないよう変更（v1 は複数タグに重複計上）

## 次にやること

1. 実機での動作確認（GCP プロジェクト移行にともなう再インストールと再認可）
2. `getColor()` が既定色の予定で返す値の確認
3. スクリーンショットの差し替え
4. OAuth 検証の申請 → アプリ審査

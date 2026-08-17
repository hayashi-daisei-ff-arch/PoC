# Virtual Patient Mini PoC

GitHub Pagesで公開できる、選択肢式バーチャル患者シミュレーションのミニPoCです。

## 構成

- `index.html`: 画面本体
- `styles.css`: UIスタイル
- `script.js`: CSV読み込み、会話遷移、5秒表示、ログ出力
- `data/scenarios.csv`: 会話フロー

## GitHub Pages

リポジトリのPages設定で、公開元を `main` ブランチのルートにすると動作します。

## CSV

`data/scenarios.csv` の各行が選択肢です。

```csv
scene_id,scene_title,patient_state,prompt,choice_id,choice_text,response_label,next_scene,feedback,score_delta
opening,Opening,初診受付後・緊張あり,最初の声かけを選択してください,1,選択肢①,選択肢①に対する画像や動画などの表示,route_1,ここに選択肢①に対するフィードバック,1
route_1,Route 1,選択肢①を受けた反応,選択肢①の後に出る分岐です,1-1,選択肢①-1,選択肢①-1に対する画像や動画などの表示,complete,ここに選択肢①-1に対するフィードバック,1
```

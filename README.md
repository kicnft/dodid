# DoDiD!
For DID. Do DID!

# URLs(GitPages)

- [index.html](https://kicnft.github.io/dodid/)
- [testnet.html](https://kicnft.github.io/dodid/testnet.html)
- tomato.html

# 画面

![image](https://github.com/kicnft/dodid/assets/143278361/5c5c874c-1277-498b-a7bf-e274135992c9)


# 機能

- Multisig Tree
  - 操作可能なアカウントをマルチシグツリーで表示します
- Address List
  - 送信先に指定可能なアドレスリストをグループとアドレスのツリーで表示します
- Transaction List
  - 作成中のトランザクションをリストで表示します。
- Information
  - 連署待機中のトランザクションなどをツリーで表示します。
- Address QR
  - 現在ログインしているアドレスのQRコードを表示します。

# 操作ガイド
- 新規作成・ログイン
- アドレスリスト
- 転送トランザクション
- マルチシグ変更
- 鍵情報表示

### 新規作成・ログイン
URLにアクセスすると認証画面が表示されます。

![image](https://github.com/kicnft/dodid/assets/143278361/6bbb6b8d-c799-4324-ab84-c1e55eec0d38)

初めてのアクセスの場合は、パスワードと秘密鍵を入力してアカウントにアクセスしてください。
秘密鍵が未入力の場合は、自動でランダムな秘密鍵が生成されます。
パスワードにより秘密鍵は暗号化され、ローカルストレージに保存されます。
ローカルストレージは一般的に外部からアクセス可能な領域とお考えください。安直なパスワードの設定はアカウント情報の流出につながりますのでご注意ください。
また、ローカルストレージの情報を定期的に削除するOS・ブラウザがありますので、秘密鍵は必ず外部の記憶媒体に保管しておくようにしてください。

２回目以降は、パスワードのみ入力してアカウントにアクセスすることができます。

![image](https://github.com/kicnft/dodid/assets/143278361/323c3f76-033f-444e-88af-cef7bca3e4a0)


リセットして新規設定画面に戻りたい場合は URLの後ろに `?reset=true` とクエリをつけてアクセスしてください。
パスワードと秘密鍵を入力した後にローカルストレージの内容を上書き保存するか聞かれるので、前回までの情報を消したい場合はOKをクリックしてください。

![image](https://github.com/kicnft/dodid/assets/143278361/9a11742e-9058-4ac0-b727-942aecfebe0a)

アカウント情報は画面一番下のAddress QRから鍵情報を表示することで公開鍵と秘密鍵を表示することができます。
秘密鍵は誰にも見せず、必ず外部の記憶媒体に保管しておくようにしてください。

![image](https://github.com/kicnft/dodid/assets/143278361/30fca2cf-42ef-4394-a8e8-bb0227ca1f47)


### アドレスリスト
アドレスリストに登録することで、登録済みのアドレスに対してモザイクを送信することができます。未登録のアドレスに対してトランザクションを実行することはできません。
アドレスリストには一般グループとイベントグループがあります。一般グループに追加したアドレスは随時ローカルストレージに保存されますが、イベントグループに追加したアドレスはリロードすると消えてしまいますので、一時領域としてお使いください。

![image](https://github.com/kicnft/dodid/assets/143278361/3a78fb7c-e07c-4584-bb39-fb89343162a2)

その他イベント領域には、都度開催中のイベント対象アドレスなどが表示されることがあります。
追加できるのはアドレスとグループの2種類があります。
どのグループの下に追加したいかを選択してから、アドレス追加・グループ追加のボタンをクリックしてください。削除する場合も、削除したいグループ、アドレスを選択してから削除ボタンをクリックします。
アドレス追加ボタンをクリックすると、Webカメラを搭載している端末の場合はブラウザ上でQRスキャナが起動します。搭載していない端末の場合は「画像でスキャン」ボタンをクリックしてQRコードの画像ファイルを読み込んでください。

![image](https://github.com/kicnft/dodid/assets/143278361/9e3b5451-9d44-412f-b72f-f79e034d487b)

アドレスの直接手入力はサポートしておりません。どうしてもアドレス文字列しかわからない方は以下のURLを参考に取得したいアドレスのQRコードを生成してください。

```
URL
https://chart.apis.google.com/chart?chs=150x150&cht=qr&chl={"data":{"address":{"address":"Symbolアドレス"}}}

例）
https://chart.apis.google.com/chart?chs=150x150&cht=qr&chl={"data":{"address":{"address":"TCEIM4GM4FTRD3HBFACN4YQICCXAJCKOEWG3WHY"}}}
```


### 転送トランザクション
マルチシグリストに表示されている作成したアカウントから、アドレスリストに登録したアドレス、グループに対してモザイクを送信することができます。
双方をマウスでクリックして選択してから、転送ボタンをクリックしてください。
転送ボタンをクリックすると、転送元に指定したアカウントが所有するモザイク一覧と送信メッセージが表示されます。

![image](https://github.com/kicnft/dodid/assets/143278361/3d43092e-1cf5-4db5-b818-841aa9cd1ccf)

一度に複数のモザイクを送信することも可能です。

![image](https://github.com/kicnft/dodid/assets/143278361/a3972830-9b2b-4e63-afdb-5deceb8925ec)

OKボタンをクリックするとトランザクションリストに追加されます（この時点ではまだトランザクションは実行されていません。）
送信先はグループを選択することも可能です。その場合、トランザクションは分割して作成されトランザクションリストに追加されます。

![image](https://github.com/kicnft/dodid/assets/143278361/259b3fc2-d312-4cf6-8e35-b91564bb629a)

最後に署名・通知ボタンをクリックしてトランザクションを実行してください。最後に簡単な確認画面が表示されます。

![image](https://github.com/kicnft/dodid/assets/143278361/0a80d25e-1b39-4f16-af8e-d9319c5f4769)



### マルチシグ変更
マルチシグの構成を変更したいアカウントを選択して、新規にアカウントの追加や既存のアカウントの削除を行ってください。
マルチシグに変更すると、アカウントのアイコンがファイル画像からフォルダ画像に変更されます（画面をリロードして再ログインしてください）。
マルチシグ化すると(x,y)-of-n という表記がアドレス前部に付記されます。

- n:そのマルチシグアドレスの連署者の総数です。
- x:そのマルチシグアドレスからトランザクションを実行する場合に必要な連署者の承認数です。
- y:そのマルチシグアドレスの連署者を削除するために必要な連署者の承認数です。

連署者になった場合、自分以外のアカウントからもモザイクの送信トランザクションの実行が行えるようになります。
前述と同様に連署対象のアカウントと送信先を選択してトランザクションを実行してください。
最後に、「連署処理中...」とのポップアップ表記になります。これは他の連署者の承認を待っている状態です。
画面をリロードして再ログインすれば、現在の連署状況をInformationで確認することができます。
（現在、複数のトランザクションが署名待ちの場合は1件のみ表示されます）

### その他のトランザクション
現在その他のトランザクションにはまだ対応しておりません。
見覚えのないトランザクションについては、絶対に連署しないようにご注意ください。





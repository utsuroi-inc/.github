# 公開・実利用ゲートの定義

> 版0.1 / 提案中。既存本番の自動デプロイ・アクセス権限は変更しない。

## Gate 0: アプリ登録とデータ分類

- [ ] 社内台帳にアプリID、責任者、GitHub repo、環境、デプロイURLを登録
- [ ] 取り扱うデータ（公開／社内／顧客・個人・財務）と保存先、外部送信先を把握
- [ ] L0〜L3を判定し、顧客契約やNDAの条件を確認
- [ ] 未承認の外部AIサービス・クラウドへの顧客データ送信がない

## Gate 1: 設計レビュー

- [ ] 本来アクセスできる人と、できない人を一覧化
- [ ] 画面だけでなくサーバーAPI・DBで権限を検証する設計
- [ ] 機密情報・APIキーをサーバー側のSecretsとして管理
- [ ] ログ、バックアップ、復旧、利用停止方法を定義
- [ ] AIの操作範囲と人間承認が必要な操作を定義

## Gate 2: PRの自動検査（PASS必須）

| チェック | 合格条件 | 例 |
| --- | --- | --- |
| build / lint / typecheck / tests | 全ジョブ成功。未実装なら「スキップ」ではなく対応を決める | npm scripts, pytest等 |
| Secrets | 未解決の実秘密情報0件 | Gitleaks、GitHub Secret Protection |
| Dependencies | 未解決の既知Critical/Highは原則0件 | Dependabot、OSV-Scanner、npm audit |
| Code scanning | 未解決のCritical/Highは原則0件 | Semgrep OSS、CodeQL等 |
| 権限・業務ロジック | 匿名・別ユーザー・一般ユーザー・管理者の否定テスト合格 | 自動APIテスト |

注：機械検出には誤検知や見逃しがある。誤検知は根拠と承認を記録。重大な真の脆弱性は公開を止める。スキャンだけでは「安全の証明」にならない。

## Gate 3: 独立レビュー（人の承認）

- [ ] PRの変更理由、データ、権限、外部送信を確認
- [ ] 開発を担当したAIとは別の検査と人の判断を実施
- [ ] L2/L3は必要な専門家レビューを実施
- [ ] `templates/SECURITY_TEST_MATRIX.md`のテストをステージングで実行
- [ ] リスクと未解決事項をPRに残し、承認者が判断

AI同士の相互監査をしても、L2/L3の人によるレビューを省略しない。

## Gate 4: デプロイ・実利用の承認

- [ ] `templates/RELEASE_RECORD.md`にアプリIDとコミットSHAを固定
- [ ] 必要なCIジョブが実行済みで成功（未実行・skipped・neutralを合格扱いにしない）
- [ ] Gate 3の承認者、日時、承認内容を記録
- [ ] Cloudflareの保護対象URL、API、プレビュー経路、認証方法を確認
- [ ] 本番とテストのSecretsが分離され、デプロイ権限は最小限
- [ ] 復旧手順・前バージョンへの戻し方を確認
- [ ] 公開後に未認証・許可ユーザー・拒否ユーザーの実動作確認を行う

**1つでも未確認ならRELEASE_APPROVEDにしない。**

## 本番へ「勝手に出ない」ための技術的な制御

### GitHub

1. アプリごとにPull Request必須、直接push禁止、必須の`secure-gate`などをRuleset／Branch Protectionで強制する。
2. 書き込み権限、Actions実行権限、Secrets閲覧・編集権限を最小化する。
3. 自動チェックの**ジョブ名を確認してから**、実際に失敗したPRがマージできないことをテストする。
4. `production`へデプロイできる資格を、承認済みコミットに限定する。監査記録と公開対象SHAを一致させる。

### Cloudflare Pages / Workers

1. まず現在の公開方式（Git連携による自動公開か、手動・Actions公開か）を調べる。
2. Git連携は通常pushで自動公開されるため、Gateが完成する前に本番直結にしない。必要に応じて自動productionデプロイを停止し、承認済みリリース専用の経路へ切り替える。
3. **プレビューは初期状態で公開アクセスできる場合がある。** PR作成前にプレビュー自動デプロイ設定とAccessを確認し、未審査PRが公開される経路を塞ぐ。
4. `*.pages.dev`、`*.workers.dev`、プレビュー、カスタムドメイン、APIなど、すべての到達経路を列挙する。
5. 内部アプリにはCloudflare Accessの**再利用可能なポリシー**を設定し、許可／拒否の両方をテストする。
6. Cloudflare Pagesの「プレビュー用Access」だけでは本番の`*.pages.dev`やカスタムドメインは守られない。
7. Accessは入口の制御であり、アプリ内部のユーザー別・データ別権限を代替しない。

### GitHub契約による制約

GitHub Free／Pro／Teamでは、**非公開リポジトリのEnvironment必須レビュアー**が使えない場合がある。プランを確認せず、`environment: production`だけで人の承認が必須になると仮定しない。利用できない場合は、保護されたリリース用ブランチとPR承認、公開用資格情報の権限分離などを設計し、実際に遮断できることを確認する。

## 緊急停止・復旧

1. 秘密漏えい、権限漏れ、事故の疑いを検出したら、責任者へ連絡し、該当アプリを`SUSPENDED`へ移行する。
2. 必要なら公開停止、Access拒否、APIキー無効化・再発行、前バージョンへ戻す。
3. 被害範囲、発見時刻、対応、検証を機密のインシデント記録へ残す。公開Issueに秘密を記載しない。
4. 再検査・新しいSHAの承認なしに復旧公開しない。

## 毎月の確認

- 未解決セキュリティ警告、期限切れ依存関係、退職・異動ユーザーのアクセス権
- 実稼働アプリ一覧と公開URL、台帳との不一致
- Secretsの権限・漏えいアラート、復旧バックアップの成否
- 廃止するアプリ、顧客側へ移管するアプリの扱い

## 公式参考資料（実装時は最新版を再確認）

- [OWASP ASVS](https://asvs.owasp.org/)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [Cloudflare Pages Git連携](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Cloudflare Access Application Types](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/choose-application-type/)
- [Cloudflare Access Policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)

# utsuroi-inc/.github — 作業ルール

このリポジトリは株式会社うつろいのGitHub共通運用の正本です。
ここでの変更は、Organization内の複数リポジトリのIssue、PR、セキュリティ案内へ影響します。

## 作業開始前

1. `README.md` でこのリポジトリの役割を確認する。
2. `GOVERNANCE.md` で運用の目的と全体像を確認する。
3. `CONTRIBUTING.md` で実際の作業手順を確認する。
4. 変更がOrganization全体へ波及するかを整理する。

## 変更ルール

- `main` へ直接pushせず、作業ブランチからPRを作る。
- PRに「目的」「変更内容」「確認結果」を書く。
- テンプレートの項目を変える場合は、初めて使う人が迷わない表現にする。
- 公開範囲、Ruleset、権限、必須チェックの変更は、影響を説明して明示承認を得てから行う。
- APIキー、個人情報、顧客データ、社内限定情報をこの公開リポジトリへ置かない。
- Organization共通文書と各リポジトリ固有文書の役割を混ぜない。

## 完了前

- `git diff --check` を実行する。
- YAMLを変更した場合は構文を確認する。
- PRの `docs-check` が成功したことを確認する。
- `README.md`、`GOVERNANCE.md`、`CONTRIBUTING.md` の説明が矛盾していないか確認する。

## Code Review Rules

- `main` への直接変更を前提にする記述を指摘する。
- 秘密情報や個人情報を公開リポジトリへ置く手順を指摘する。
- PRや確認結果を省略して正式版へ反映する手順を指摘する。


## アプリ開発の追加参照（提案中）

アプリの作成・公開に関係する場合は、`SECURE_DEVELOPMENT.md`、`RELEASE_GATES.md`、`ROLLOUT_PLAN.md`の全社案も確認し、リリース承認と自動検査・公開設定の実効性を区別すること。各リポジトリのAGENTS.mdへは`templates/AGENTS_SECURITY.md`を製品特性に合わせて統合する。勝手に既存公開経路を変更しない。

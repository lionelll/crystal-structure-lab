# 开发与发版规则

本仓库统一使用 `dev` 进行开发，使用 `release` 准备和发布生产版本。

## 分支职责

- `dev`：唯一的日常开发分支。功能、修复、测试和文档修改都必须先进入 `dev`。
- `release`：只保存可发布代码，只接收经过确认的 `dev` 版本，不允许直接在此分支开发。
- `main`：保留为稳定基线；除非仓库所有者明确调整规则，否则不作为自动部署来源。
- 禁止提交 `.claude/`、本地截图、临时浏览器脚本、凭据、私钥或生成的 `dist/`。

## 日常开发流程

1. 切换到 `dev`，并与 `origin/dev` 同步。
2. 在 `dev` 完成功能开发、修复和验证。
3. 推送前必须运行 `npm test` 和 `npm run build`。
4. 日常开发只提交和推送到 `dev`。

## 发版流程

1. 只有仓库所有者明确要求发版后，才启动发版流程。
2. 将已经确认的 `dev` 提交同步到 `release`，不得混入其他修改。
3. 确认工作区干净，并确认本地 `release` 与 `origin/release` 一致。
4. 在 `release` 上运行 `npm test` 和 `npm run build`。
5. 只有仓库所有者明确给出 Tag 名称后，才能创建对应的 SemVer Tag，例如 `v1.2.0`。
6. 推送 Tag 后，由 GitHub Actions 自动部署到 AWS。

“部署”“发布”“准备发版”或“更新 release”都不代表允许创建 Tag。创建 Tag 必须收到包含明确版本号的直接指令，例如：`打 tag v1.2.0`。

## Tag 规则

- Tag 必须符合 `vMAJOR.MINOR.PATCH`，例如 `v1.0.0`。
- Tag 指向的提交必须存在于 `origin/release` 历史中。
- 不允许推测版本号，不允许移动、删除已有 Tag，也不允许强制推送 Tag。
- 当前任务中没有仓库所有者的明确 Tag 指令时，禁止创建或推送任何 Tag。

## AWS 自动部署

`.github/workflows/deploy-tag-to-aws.yml` 只在符合格式的版本 Tag 被推送时运行：

1. 校验 Tag 对应提交属于 `origin/release`。
2. 安装依赖，运行测试并构建静态站点。
3. 通过 SSH 将构建产物上传到 AWS。
4. 备份 `/var/www/guli.run/material/`，再同步新的 `dist/`。
5. 通过线上 `release.json` 校验 Tag 和提交 SHA，确认部署的是本次版本。

仓库必须配置：

- Secret：`AWS_SSH_PRIVATE_KEY`
- Secret：`AWS_KNOWN_HOSTS`
- Variable：`AWS_HOST`
- Variable：`AWS_USER`
- Variable：`AWS_DEPLOY_PATH`
- Variable：`AWS_SITE_URL`

手动部署只用于仓库所有者明确要求的紧急发布或回滚；正常发版必须通过版本 Tag 触发自动部署。

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
6. 推送 Tag 后，按仓库所有者的明确指令手动部署到阿里云。

“部署”“发布”“准备发版”或“更新 release”都不代表允许创建 Tag。创建 Tag 必须收到包含明确版本号的直接指令，例如：`打 tag v1.2.0`。

## Tag 规则

- Tag 必须符合 `vMAJOR.MINOR.PATCH`，例如 `v1.0.0`。
- Tag 指向的提交必须存在于 `origin/release` 历史中。
- 不允许推测版本号，不允许移动、删除已有 Tag，也不允许强制推送 Tag。
- 当前任务中没有仓库所有者的明确 Tag 指令时，禁止创建或推送任何 Tag。

## 阿里云手动部署

当前项目不使用 GitHub Actions 自动部署。AWS 自动部署工作流已删除并禁用，任何 Tag 都不得再触发 AWS 发布。

收到仓库所有者的明确部署指令后：

1. 校验指定 Tag 对应提交属于 `origin/release`。
2. 安装依赖，运行测试并构建静态站点。
3. 写入包含 Tag 和提交 SHA 的 `release.json`。
4. 将构建产物上传到阿里云的独立版本目录 `/data/wwwroot/crystal.changyanedu.cn/releases/`。
5. 原子切换 `current` 软链接，并保留上一版本用于回滚。
6. 通过 `https://crystal.changyanedu.cn/release.json` 验证线上版本。

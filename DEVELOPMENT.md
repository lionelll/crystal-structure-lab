# 开发、测试与发版规则

本文件是 `crystal-structure-lab` 的强制工作流。任何人工开发、Codex 修改、合并、打 Tag 或部署操作开始前，都必须先阅读本文件与仓库根目录的 `AGENTS.md`。

## 1. 分支职责

| 分支 | 职责 | 允许的来源 | 对应环境 |
|---|---|---|---|
| `feature/*` | 具体版本、功能或缺陷开发 | 必须从最新 `dev` 创建 | 本地开发环境 |
| `dev` | 已完成开发的集成与测试基线 | 只接收通过验证的 `feature/*` | 阿里云测试环境 |
| `release` | 可正式发布的生产基线 | 只接收已验收的 `dev` | 正式环境 |
| `main` | 已确认正式版本的备份 | 只接收已发布并验证的 `release` | 不部署 |

强制约束：

- 禁止直接在 `dev`、`release` 或 `main` 上开发功能或修复缺陷。
- 禁止将 `feature/*` 直接合并到 `release` 或 `main`。
- 禁止从 `dev` 直接合并到 `main`。
- 禁止强制推送受保护分支，禁止通过重写历史解决分支差异。
- `release` 的代码必须与正式环境计划发布或已发布的代码一致。
- `main` 只承担正式代码备份，不是开发分支，也不是任何环境的部署来源。

## 2. Feature 分支规则

开发新版本时，先同步 `dev`，再从 `dev` 创建版本分支。例如开发 v1.1 系列：

```bash
git switch dev
git fetch origin
git pull --ff-only origin dev
git switch -c feature/v1.1
```

命名规则：

- 版本开发：`feature/v1.1`、`feature/v2.0`。
- 独立功能：`feature/<short-name>`。
- 普通缺陷：`fix/<short-name>`，同样必须从 `dev` 创建并回到 `dev`。
- 分支名称使用小写英文、数字、连字符、斜杠，不使用空格或中文。

Feature 分支只负责开发和本地验证，不允许在该分支创建正式 Tag，也不允许直接部署正式环境。

## 3. 开发到测试流程

1. 开始编码前阅读 `AGENTS.md` 和本文件。
2. 确认当前分支是从最新 `origin/dev` 创建的 `feature/*` 或 `fix/*`。
3. 在功能分支完成代码、测试和必要文档修改。
4. 提交前运行：

   ```bash
   npm test
   npm run build
   ```

5. 检查工作区，不得混入 `.claude/`、凭据、私钥、临时截图或无关文件。
6. 将功能分支推送到 GitHub，检查提交范围后合并到 `dev`。
7. 合并后的 `dev` 再次运行测试和生产构建。
8. 推送 `dev` 后，由 GitHub Actions 运行完整测试和生产构建，成功后自动部署到测试服务器供验收。

`dev` 是测试环境的唯一代码来源。禁止从功能分支或 `release` 反向覆盖测试环境。

## 4. 测试环境规则

- 测试环境与正式环境必须按下表核对，禁止仅凭服务器名称、历史命令或记忆选择部署目标：

  | 项目 | 测试环境 | 正式环境 |
  |---|---|---|
  | 代码来源 | `dev` | `release` 上明确确认的 Tag |
  | 部署方式 | GitHub Actions 自动部署 | 产品所有者明确授权后手动部署 |
  | 公网 IP | `123.57.11.145` | `123.57.56.114` |
  | 访问地址 | `http://123.57.11.145:8080/` | `https://crystal.changyanedu.cn/` |
  | 站点目录 | `/var/www/crystal-dev` | `/data/wwwroot/crystal.changyanedu.cn` |
  | 版本目录 | 测试环境工作流管理的独立版本目录 | `/data/wwwroot/crystal.changyanedu.cn/releases/<tag>-<sha>` |
  | 当前版本入口 | 测试环境工作流管理的 `current` 软链接 | `/data/wwwroot/crystal.changyanedu.cn/current` |
  | Nginx 配置 | 测试服务器独立配置 | `/usr/local/nginx/conf/vhost/crystal.changyanedu.cn.conf` |
  | `release.json` 标识 | `"environment": "test"` | `"environment": "production"` |

- 部署前必须同时核对目标 IP、代码来源、版本号、提交 SHA、目标目录和 `release.json.environment`，任一项不匹配立即停止。
- 禁止将 `dev`、未打 Tag 的 `release` 或本地临时构建部署到正式服务器。
- 禁止将正式 Tag 部署到测试目录，禁止在两个服务器之间复用站点目录、软链接或 Nginx 配置。
- 服务器密码、私钥、Token 和其他凭据必须保存在仓库之外，本表只记录非敏感的环境标识。
- 测试环境用于验证 `dev`，不得使用正式域名或覆盖正式目录。
- 当前测试地址为 `http://123.57.11.145:8080/`，独立目录为 `/var/www/crystal-dev`。
- `.github/workflows/deploy-dev.yml` 是唯一测试自动部署入口，只允许 `refs/heads/dev` 触发。
- 工作流必须先执行 `npm ci`、`npm test` 和 `npm run build`；任何一步失败都不得更新测试站点。
- 部署使用专用无 sudo SSH 账号、固定服务器 Host Key、独立版本目录和 `current` 软链接，禁止使用 root 密码或覆盖正式服务。
- 测试部署必须暴露版本、提交 SHA、部署时间和环境标识，便于确认测试内容。
- 测试通过不等于允许发版、打 Tag 或部署正式环境。

## 5. 正式发版流程

发版必须依次执行，禁止跳级：

> 本节描述允许发版后的执行顺序，不代表流程可以自行启动。只有产品所有者在当前指令中明确要求“合并到 `release`”时，才能执行第 3 至第 5 步。完成开发、合并 `dev`、测试通过、测试环境验收或讨论版本号，均不构成合并 `release` 的授权。

1. 产品所有者明确确认本次 `dev` 可以发版。
2. 确认功能分支已合并、`dev` 已推送并通过测试环境验收。
3. 将 `dev` 合并到 `release`，不得夹带其他修改。
4. 在 `release` 上运行 `npm test` 和 `npm run build`。
5. 推送 `release`，确认本地与 `origin/release` 一致。
6. 产品所有者明确给出完整版本号后，在 `release` 对应提交上创建注解 Tag。
7. 部署该 Tag 对应的精确提交到正式环境。
8. 验证正式站点、核心流程、静态资源和 `release.json`。
9. 正式环境验收后，按明确指令将 `release` 快进同步到 `main` 作为备份。

推荐的分支同步方式：

```bash
git switch release
git merge --ff-only dev
git push origin release
```

如果 `--ff-only` 失败，必须先查明分支为何分叉；不得使用强制推送、rebase 已共享历史或随意创建合并提交掩盖问题。

## 6. Tag 规则

- Tag 必须符合 `vMAJOR.MINOR.PATCH`，例如 `v1.1.0`。
- Tag 必须创建在已推送到 `origin/release` 的提交上。
- 只有产品所有者明确说出版本号并要求打 Tag 时才能执行。
- “准备发版”“合并 release”“部署”均不自动包含打 Tag 权限。
- 不允许推测版本号，不允许移动、覆盖、删除或强制推送已有 Tag。
- 推荐使用注解 Tag，并在说明中记录版本主题与关键变更。

## 7. 正式环境部署

- `release` 对应正式环境，实际部署单位是 `release` 上经确认的精确 Tag。
- 当前正式站点为 `https://crystal.changyanedu.cn/`，服务器 IP 为 `123.57.56.114`，部署根目录为 `/data/wwwroot/crystal.changyanedu.cn`。
- AWS 部署已停用，不得恢复或触发 AWS 工作流。
- 只有产品所有者在当前指令中明确要求“部署/发布到正式环境”时，才能执行正式部署。合并 `release`、推送 `release`、创建 Tag 或测试环境验收，均不自动授予正式部署权限。
- 当前正式部署保持人工触发。未经产品所有者另行明确修改本规则，不得新增由 `release` 推送或 Tag 推送直接触发的正式环境自动部署。
- 正式部署无论手动执行还是未来经授权改造成自动化，都必须部署明确 Tag，而不是未标记的分支最新提交。
- 部署产物必须包含 `release.json`，至少记录 `version`、`commit`、`deployedAt` 和环境标识。
- 发布采用独立版本目录和 `current` 软链接切换，保留上一版本以便回滚，不得覆盖其他服务目录。
- 正式部署完成后必须从公网检查首页、最新静态资源和 `/release.json`；只有 Tag、提交 SHA 与 `"environment": "production"` 全部匹配才算完成。

## 8. Main 备份规则

- `main` 只能接收 `release`，并且只在正式版本已经部署和验证后更新。
- 更新 `main` 前必须确认 `release` 与 `origin/release` 一致。
- 使用 `git merge --ff-only release`，禁止从 `dev`、`feature/*` 或 `fix/*` 合并。
- 更新 `main` 只代表备份，不代表再次发布、打 Tag 或部署。

## 9. 紧急修复

正式环境发生阻塞性问题时：

1. 从当前 `release` 创建 `hotfix/vX.Y.Z`。
2. 完成最小范围修复并运行全部测试与构建。
3. 将修复合并回 `release`，并同步回 `dev`，避免后续版本丢失修复。
4. 只有收到明确版本号和 Tag 指令后才能打补丁 Tag。
5. 部署并验证后，再按明确指令同步 `main`。

## 10. 独立授权门槛

以下操作彼此独立，不能从一个指令推导出另一个指令：

- 合并到 `dev`。
- 部署测试环境。
- 合并到 `release`。
- 创建并推送 Tag。
- 部署正式环境。
- 将 `release` 同步到 `main`。

执行前必须核对用户本次指令是否明确包含对应操作。

授权判断必须遵守：

- “开发完成”“修复完成”“测试通过”“可以验收”只允许停留在功能分支或已明确授权的 `dev` 流程，不允许主动合并 `release`。
- “合并到 `release`”只允许合并并推送 `release`，不包含打 Tag、部署正式环境或同步 `main`。
- “打 Tag”只允许创建并推送产品所有者明确给出的 Tag，不包含正式部署。
- “部署/发布到正式环境”只允许部署已经确认的 Tag，不包含补做未明确授权的分支合并、Tag 或 `main` 同步。
- 指令存在歧义或缺少任一授权时必须停止在上一个安全阶段，等待产品所有者明确说明，不得以历史习惯或技术便利代替授权。

## 11. 禁止提交内容

- `.claude/` 和个人编辑器配置。
- 密码、Token、SSH 私钥、证书私钥和云服务器凭据。
- 临时截图、浏览器调试脚本、测试下载文件和系统缓存。
- 未经约定的构建目录、日志和本机绝对路径配置。

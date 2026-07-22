# Coding Agent Rules

任何自动化编码代理在读取或修改本仓库代码前，必须执行以下步骤：

1. 先完整阅读根目录 `DEVELOPMENT.md`。
2. 运行 `git status --short --branch`、`git branch -vv`，确认仓库状态与当前分支。
3. 刷新 `origin` 后，从最新 `dev` 创建或继续正确的 `feature/*`、`fix/*`、`hotfix/*` 分支。
4. 禁止直接在 `dev`、`release`、`main` 上开发或提交代码。
5. 代码修改完成后运行 `npm test` 与 `npm run build`。
6. 未收到明确指令时，不得合并 `release`、创建 Tag、部署正式环境或同步 `main`。
7. 不得提交 `.claude/`、凭据、私钥、临时文件或无关修改。

分支与环境的固定关系：

```text
feature/* 或 fix/*
        ↓
      dev          -> 测试环境（待配置）
        ↓
     release       -> 正式环境（部署精确 Tag）
        ↓
      main         -> 已发布代码备份，不部署
```

如用户指令与 `DEVELOPMENT.md` 冲突，必须先指出冲突并请求确认，不得自行绕过规则。

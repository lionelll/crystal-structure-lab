# Coding Agent Rules

任何自动化编码代理在读取或修改本仓库代码前，必须执行以下步骤：

1. 先完整阅读根目录 `DEVELOPMENT.md`。
2. 运行 `git status --short --branch`、`git branch -vv`，确认仓库状态与当前分支。
3. 刷新 `origin` 后，从最新 `dev` 创建或继续正确的 `feature/*`、`fix/*`、`hotfix/*` 分支。
4. 禁止直接在 `dev`、`release`、`main` 上开发或提交代码。
5. 代码修改完成后运行 `npm test` 与 `npm run build`。
6. 合并 `release`、创建 Tag、部署正式环境、同步 `main` 是四个独立授权动作；只有产品所有者在当前指令中逐项明确要求时才能执行。
7. 不得提交 `.claude/`、凭据、私钥、临时文件或无关修改。
8. 不得因开发完成、测试通过、合并 `dev`、测试环境验收、推送 `release` 或创建 Tag 而主动推导后续发版权限；指令有歧义时必须停在上一个安全阶段。

分支与环境的固定关系：

```text
feature/* 或 fix/*
        ↓
      dev          -> 阿里云测试环境（自动部署）
        ↓
     release       -> 正式环境（部署精确 Tag）
        ↓
      main         -> 已发布代码备份，不部署
```

如用户指令与 `DEVELOPMENT.md` 冲突，必须先指出冲突并请求确认，不得自行绕过规则。

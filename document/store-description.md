# Account Note - Chrome 商店上架文案

> 适用版本：v1.1.0 · 最后更新：2026-09-16

## 一、简短描述（商店摘要，上限 132 字符）

**中文（58 字）：**

> 登录时自动显示账号备注，一眼分清「这是哪个账号」。纯本地存储，不碰密码，无需配置。

**English (92 chars):**

> Shows your note next to the login form, so you always know which account is which. Local-only, no passwords, zero setup.

## 二、详细描述（中文）

**还在靠测试账号、备注 1、备用号来猜这是哪个账号？**

Account Note 会在你聚焦登录页账号框时，自动在旁边显示你为这个账号写的备注——「这是公司的主账号，需双因子」「这是用来发帖的小号」。一眼分清，不再试错。

**主要功能**

- 智能识别：评分制引擎综合关键词、表单结构与输入框属性，自动锁定账号框，装完即用、无需配置
- 手动锚定：遇到识别不了的输入框（多步登录、延迟渲染），手动指定一次，之后永久命中
- 即时编辑：点击备注卡正文直接输入，回车保存；支持标签与收藏
- 放心删除：删除进回收站保留 7 天，随时撤销，批量操作同样可逆
- 集中管理：按网站、用户名、标签、内容搜索与排序；批量整理
- 数据备份：一键导出 / 导入 JSON，标签、主题、锚定等设置一并迁移
- 免打扰：单次隐藏 / 此网站禁用 / 全局禁用三种粒度，悬停备注卡即可设置
- 原生体验：Chrome 风格界面，自适应明暗主题，中英双语

**隐私与安全**

- 不读取、不存储任何密码——备注只与「网站 + 用户名」关联
- 所有数据仅保存在你的浏览器本地，无服务器、无同步、无上传
- 权限极简：仅需 `storage`（本地存储）与 `activeTab`（当前标签页）

**适用场景**

- 区分同一网站的个人号 / 工作号 / 测试号
- 记录账号用途、权限范围、登录限制
- 团队共享机器上标注账号归属（数据不出本机）

## 三、详细描述（English）

**Still guessing which account is which — "test", "backup", "new one"?**

Account Note shows your own note right next to the account field when you focus a login form — "main work account, 2FA required" or "posting-only alt". Know instantly, no trial and error.

**Key Features**

- Smart Detection: A scoring engine combines keywords, form structure, and input attributes to lock onto the account field. Zero setup.
- Manual Anchoring: For fields the engine can't identify (multi-step logins, delayed rendering), pick it once — it's remembered forever.
- Instant Editing: Click the note text to type, Enter to save. Tags and favorites supported.
- Safe Deletion: Deleted notes stay in a trash for 7 days and can be undone — batch deletion included.
- Central Management: Search and sort by site, username, tag, or content. Batch actions.
- Data Backup: One-click JSON export / import, including tags, theme, and anchors.
- Do-not-Disturb: Disable per session / per site / globally — one hover on the note card.
- Native Feel: Chrome-style UI, automatic light/dark theme, English & Chinese.

**Privacy & Security**

- Passwords are never read or stored — notes are linked only to "site + username"
- Everything stays in your browser: no server, no sync, no upload
- Minimal permissions: `storage` (local) and `activeTab` (current tab) only

**Use Cases**

- Tell apart personal / work / test accounts on the same site
- Record account purpose, permissions, and login restrictions
- Label accounts on shared machines (data never leaves the device)

## 四、商店类目与元信息建议

| 项 | 建议值 |
|---|---|
| 类目 | 效率工具（Productivity） |
| 语言 | 中文（简体）、English |
| 权限说明 | 仅 `storage` + `activeTab`，无 host 权限申请（content script 走 `<all_urls>` 注入，需在隐私说明中解释） |
| 单一用途说明 | 为用户在网页上输入的账号提供本地文字备注的显示与管理 |
| 隐私政策 | `document/privacy-policy.md`（上架时作为 URL 填写，建议放到 GitHub Pages 或仓库 Wiki） |

## 五、上架素材清单

- [ ] 图标 128×128（现有 `icons/icon128.png`）
- [ ] 截图 1280×800 至少 3 张：登录页备注卡 / 工具栏弹窗 / 管理页（明暗各一组更佳）
- [ ] 宣传图 440×280（小图块）
- [ ] 软删除回收站演示（可作为截图第 4 张，突出差异化）

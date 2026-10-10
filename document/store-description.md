# Account Note - Chrome 商店上架文案

> 适用版本：v1.2.0 · 最后更新：2026-09-17

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
- 集中管理：备注按站点分组展示，同站账号聚合一处；搜索、排序、标签筛选、批量整理，工具栏实时计数
- 数据备份：一键导出 / 导入 JSON，标签、主题、锚定等设置一并迁移
- 免打扰：单次隐藏 / 此网站禁用 / 全局禁用三种粒度，悬停备注卡即可设置
- 原生体验：Chrome 风格界面，自适应明暗主题，中英双语

**隐私与安全**

- 不读取、不存储任何密码——备注只与「网站 + 用户名」关联
- 所有备注和设置保存在浏览器本地；不会将备注内容上传到服务器，也没有云同步
- 管理页面会向已保存的网站请求其 `/favicon.ico` 来显示站点图标；请求发往对应网站，不包含备注内容
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
- Central Management: Notes are grouped by site, keeping accounts of the same site together. Search, sort, tag filters, batch actions, and a live counter.
- Data Backup: One-click JSON export / import, including tags, theme, and anchors.
- Do-not-Disturb: Disable per session / per site / globally — one hover on the note card.
- Native Feel: Chrome-style UI, automatic light/dark theme, English & Chinese.

**Privacy & Security**

- Passwords are never read or stored — notes are linked only to "site + username"
- Notes and settings stay in your browser; note content is not uploaded and there is no cloud sync
- The management page requests `/favicon.ico` from a saved website to show its icon; this sends a normal request to that site without note content
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
| 权限说明 | manifest 声明 `storage` + `activeTab`；内容脚本匹配 `<all_urls>`，按实际商店权限提示完整披露网页访问范围 |
| 单一用途说明 | 为用户在网页上输入的账号提供本地文字备注的显示与管理 |
| 隐私政策（中文） | https://github.com/hjweix/account-note/blob/main/document/privacy-policy.md |
| Privacy Policy (English) | https://github.com/hjweix/account-note/blob/main/document/privacy-policy.en.md |
| 源码仓库 | https://github.com/hjweix/account-note |

## 五、上架素材清单

- [ ] 图标 128×128（现有 `icons/icon128.png`）
- [ ] 截图 1280×800 至少 3 张：登录页备注卡 / 工具栏弹窗 / 管理页（明暗各一组更佳）
- [ ] 宣传图 440×280（小图块）
- [ ] 软删除回收站演示（可作为截图第 4 张，突出差异化）

## 六、老用户升级说明（更新发布时填入商店「新变化 / What's New」）

> 从 v1.1.0 升级到 v1.2.0 时填写。核心目标：①打消数据顾虑 ②主动解释备注可见范围变化，避免被当成 bug 举报。

**中文版：**

> 本次为大版本更新，界面与引擎全面升级：
>
> ✅ **你的数据完全安全**：所有备注、标签、收藏、禁用设置原样保留，无需迁移，更新后即可正常使用；旧版导出的备份文件也能直接导入。
>
> ⚠️ **备注可见范围有变化**：现在备注跟随「网站」而非精确网址——例如在 `mail.example.com` 写的备注，登录 `example.com` 时也会显示；同级的测试/生产子域仍相互隔离。如需恢复旧行为，可在管理页「站点范围」中将该站切换为「仅本站」。
>
> 🆕 新增：评分制识别引擎（含中文识别）、手动锚定、删除进回收站 7 天可撤销、备份信封 v2、Chrome 原生风格界面。

**English:**

> A major update with a redesigned UI and a new detection engine:
>
> ✅ **Your data is safe**: all notes, tags, favorites, and settings are preserved as-is — no migration needed. Backups exported from older versions can still be imported.
>
> ⚠️ **Notes visibility changed**: notes now belong to a *site* instead of an exact URL — a note written on `mail.example.com` also shows on `example.com`; sibling subdomains (uat / dev / prod) stay isolated. You can switch any site back to "this subdomain only" in Management → Site Scope.
>
> 🆕 New: scoring-based field detection (Chinese keywords included), manual anchoring, 7-day undoable trash for deletions, backup envelope v2, native Chrome-style UI.

### 数据兼容性依据（内部参考，不对外）

- 存储 key 格式（`origin_username`）新旧版本逐字节一致，老记录的 key 在新版下依然有效
- 新版读取不解析 key，按记录内 `domain/username/note` 字段遍历匹配，对老数据格式免疫
- 管理页 `migrateAllNotes()` 仅补齐缺失字段（tags/isFavorite/key），不删不改已有数据
- 禁用站点列表、主题设置读写口径一致；备份 `parseBackupPayload()` 兼容旧版裸数组格式
- 唯一行为变化即站点作用域（见上），已在升级说明中主动告知

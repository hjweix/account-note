# 项目进度日志

## 2026-09-16（UI 原生化重设计 M3：管理页）

### 完成的功能
1. management.css token 级换皮（骨架与布局不动）：四组变量块统一为 M1/M2 同款 Chrome 原生配色（强调色 indigo→#1a73e8/#8ab4f8，页面底 #f8f9fa/#202124，卡片实心 #ffffff/#292a2d，语义色同步）
2. 定点清除玻璃拟态：全部 backdrop-filter（8 处）、头像 indigo 渐变改单色、收藏琥珀顶条保留但改实心 `var(--warning-color)`、头部点阵纹理删除、搜索框内阴影删除
3. 动效与形变归原：弹跳曲线降级为标准曲线、去掉卡片/按钮 hover 浮起（translateY/scale）、tab active 投影与收藏卡片 glow 删除
4. 圆角归一到 8px（tag-badge 芯片保留 10px 胶囊）；滚动条改中性灰
5. management.html 删除 Google Fonts 外链，字体收归 system-ui
6. **顺手修复存量 bug**：`setupAbout()` 在赋值前读取未声明的 `handleViewChangelog`/`handleReportIssue`，每次抛 ReferenceError 导致「查看更新日志」「反馈问题」链接监听器从未挂上；补 `let` 声明修复

### 验证
- 桩注入真机 16/16 断言：外链字体清除、CSS 零 blur/渐变残留、页面/头部/卡片实心、圆角 8px、头像单色、琥珀顶条保留、Tab 切换、明暗主题
- check:css / check:i18n 门禁通过；明暗双主题截图核验

## 2026-09-16（UI 原生化重设计 M2：Popup 工具栏）

### 完成的功能
1. popup.css 全量重写，与 M1 弹窗共用同一套 design token（实心表面 / 8px 圆角 / system-ui / 中性灰 + 单一蓝 / 150ms 无弹跳动效）
   - 头部去渐变、点阵纹理、backdrop blur 与多层阴影，改为纯色 + 1px 分隔线
   - 备注列表由玻璃卡片改为行式：头像（用户名首字母）+ 用户名 + 备注单行省略 + 标签 chip 内联 + 星标常驻右侧，hover 灰底
   - 行内编辑铅笔删除：点击行直接编辑（与弹窗「点击正文编辑」同一交互语言）
   - 锚定面板降为灰色窄条；拾取入口改为描边蓝字主操作；Toast 实心 + 150ms 淡入
2. popup.html：删除 Google Fonts 外链（Inter / Plus Jakarta Sans）与 preconnect，改走 system-ui——减少两个网络请求
3. popup.js：displayNotes 重写为行式 DOM；小节标签改为「当前站点 · <host>」（新增 locale key `currentSiteLabel` 中英各 1 条）；清理死代码（initI18nTexts、重复 appendChild、edit-btn）

### 验证
- 桩注入真机 16/16 断言：外链字体清除、小节标签、行式结构、实心表面、点击行编辑、Enter 落库回显、星标切换落库、暗色主题
- check:css / check:i18n 门禁通过；明暗双主题截图核验

## 2026-09-16（UI 原生化重设计 M1：备注弹窗）

### 完成的功能
1. 弹窗视觉全面原生化（对标 Chrome 密码管理器气泡，规格见 `docs/superpowers/specs/2026-09-16-native-ui-restyle.md`）
   - 弃玻璃拟态：删除全部 `backdrop-filter` / 半透明 / 渐变 / 多层阴影 / 弹跳动效
   - 统一 token：实心表面（亮 #ffffff / 暗 #292a2d）、8px 圆角、单层柔和阴影、中性灰 + 单一蓝（#1a73e8 / #8ab4f8）、收藏星标保留琥珀色、150ms 淡入 + scale(0.98→1)
2. 弹窗结构重排为三行式：头部（域名 + 收藏★ + 关闭✕）/ 正文 / 标签行
   - 「编辑」「展开」「收起」按钮全部取消：点击正文 = 唯一编辑入口（Enter/失焦保存、Esc 取消），阅读态 `line-clamp: 3`，退出编辑自动收起
   - 收藏星标进入弹窗头部；未保存备注时禁用，保存后可用
   - 「＋标签」移入标签行右端；旧 50 字截断 + measureEl 逻辑删除
3. 弹窗定位改实测：创建后先隐藏挂载、读 `offsetWidth/Height` 再计算，替代 260/270 魔数
   - 默认字段右侧（间距 8px），右侧放不下翻左侧，两侧都不行视口内夹紧，底部越界上移
   - 定位原则（老板定稿）：弹窗是辅助角色，字段正下方留给浏览器原生密码管理器
4. 顺手修复：`.disable-options-menu` 此前完全无样式（裸 div），补齐菜单样式并给「在所有网站上禁用」加危险色
5. i18n 清理死键：`toggleText` / `expand` / `collapse`（结构重排后无引用），中英各 150 条

### 遇到的错误与解决
1. `.note-text-readonly` 用 `display: -webkit-box` 实现 line-clamp，压过了 `[hidden]` 的 UA `display:none`，导致编辑态切换后阅读态仍占位——补 `.note-text-readonly[hidden] { display: none }`（与此前 textarea 同一个坑，`[hidden]` 会被任何 author 级 display 声明覆盖）
2. Chrome for Testing 153 + Playwright 1.63 下 `--load-extension` 不再注入 content script（扩展本体已注册、SW 可跑、CSS/JS 均不注入）；加 `ignoreDefaultArgs: ['--disable-extensions']` 也无效——真机验证改回桩注入法（主世界注入真实 content.js + storage/i18n 桩 + addStyleTag），与既有 84 断言同一套路
3. 验证脚本两处误判：setContent 页面 origin 是 about:blank 会被 `shouldShowNote` 拒绝（必须 goto http 页）；入场动画期间量 rect 会拿到 transform 中间态（等 250ms 再量）

### 验证
- 真机（桩注入 + 真实 dist 产物）30/30 断言全绿：三行结构 / 旧结构清除 / 实心表面无模糊 / 定位右侧 8px 与翻转 / 收藏禁用-启用-切换闭环 / 编辑态切换（点击-Esc-Enter-失焦）/ 标签增删 / 点外关闭 / line-clamp 3 行 / 暗色 #292a2d / 备注跨弹窗保留
- 明暗双主题截图确认视觉效果（/tmp/m1-overlay-light.png、m1-overlay-dark.png）
- `check:css`（63 规则块）与 `check:i18n`（中英各 150 条）门禁通过；dist 已重建

### 待办
- M2：popup 工具栏按同一 token 换皮（设计已定稿：行式列表、去渐变横幅、去外链字体）
- M3：管理页按同一 token 换皮
- CSS 死代码清理：`.account-note-btn` 的样式仍在但 content.js 已无创建逻辑（确认后删除或恢复按钮）

## 2026-09-15（补充：手动锚定「无法连接当前页面」修复）

### 完成的功能
1. 扩展弹窗按真实原因提示，不再把一切失败归为「连接失败」
   - `shouldShowNote()` 除返回布尔值外记录 `noteDisabledReason`（global-disabled / site-disabled / session-disabled / context-invalid / non-http / enabled）
   - `startFieldPicker()` 改为返回 `{ ok, reason }`；页面侧 toast 也区分「全局禁用」与「本站点禁用」
   - 弹窗按 reason 分流：禁用类 → 提示条 + 一键启用；无候选框 → 如实说明；只有消息通道真失败才提「刷新」
2. 新增一键恢复能力：`enableCurrentSite()`（消息 `enableCurrentSite`）
   - 清除 sessionStorage 会话禁用、从 `disabledSites` 移除本站点、必要时关闭 `disabledGlobal`，随后重新 bootstrap
   - 弹窗提示条提供「启用备注功能」按钮，启用成功后直接进入拾取模式，省掉用户再点一次
3. 消息监听器在扩展上下文失效时也作出响应
   - 原先静默 `return`，发送方只拿到 `undefined`，与「content script 根本没注入」表现完全一致，弹窗无从区分
4. i18n 补 5 条 key（pickerSiteDisabledHint / pickerGlobalDisabledHint / enableSiteBtn / siteEnabled / siteDisabledNote），中英各 153 条

### 遇到的问题
1. 在 GitHub 登录页点「手动指定输入框」提示「无法连接当前页面，请刷新页面后重试」，刷新后依旧
2. popup 把所有 `ok:false` 与 reject 合并成同一条文案，content script 给出的真实原因被吞掉
3. 站点被禁用时页面 toast 也错误地说成「已在所有网站上禁用备注功能」（文案张冠李戴）
4. 站点禁用 / 会话禁用两类问题刷新页面永远解决不了，提示却只说「请刷新」

### 解决方案
1. 页面侧返回结构化原因，弹窗按原因分流；先用诊断脚本复现 4 种失败场景确认根因，再动手改
2. 禁用类问题给出「启用备注功能」按钮，从「提示」到「恢复」形成闭环，不把问题转嫁给用户
3. 页面 toast 按 global / site 分开取词
4. 会话禁用只存在于当前标签页的 sessionStorage，弹窗改不到，故由 content script 侧新增消息处理（而非在弹窗里直改存储）

### 实测验证（Playwright + 真实构建产物，19/19 通过）
| 场景 | 期望 | 结果 |
|---|---|---|
| 正常站点进入拾取模式 | ok:true + 高亮覆盖层 | 通过 |
| 站点永久禁用 | reason=site-disabled，页面提示「本站点已禁用」 | 通过 |
| 站点会话禁用 | reason=session-disabled | 通过 |
| 全局禁用 | reason=global-disabled，页面提示「所有网站」 | 通过 |
| 页面无候选输入框 | reason=no-candidates | 通过 |
| 站点禁用后一键恢复 | 启用成功 + disabledSites 移除本站点 + 可进入拾取 | 通过 |
| 全局禁用后一键恢复 | disabledGlobal=false + 可进入拾取 | 通过 |
| 会话禁用后一键恢复 | sessionStorage 已清 + 启用成功 | 通过 |

### 备注
- 四类失败共用一条「请刷新」文案、其中两类刷新无效，是本次问题的本质
- 诊断脚本临时放在 /tmp，待固化进仓库 `scripts/`

## 2026-09-15

### 完成的功能
1. 账号输入框识别链路重构（修复「部分站点不弹出备注框」）
   - 用 `document` 级事件委托（`focusin` / `input`，捕获阶段）替代逐个 input 绑定事件
   - 移除 MutationObserver：不再依赖「DOM 发生变动」才扫描，SPA 渲染完就静止的页面同样生效
   - 修复首屏不扫描：按 `document.readyState` 判断，DOM 已就绪时直接初始化，否则等 `DOMContentLoaded`
   - `isUsernameField()` 扩充正向关键词（补 tel/phone/mobile/uname/uid/card/member，以及中文「账号/帐号/用户名/用户/登录/邮箱/手机/电话/学号/工号」等）
   - 新增反向关键词（password/captcha/verify/search/密码/验证码/搜索 等），避免在密码框、验证码框、搜索框上误弹
   - 新增 `<label>` 与 `aria-labelledby` 文本线索，input 自身无有效线索时兜底
   - 用 `composedPath()[0]` 取真实事件目标，可穿透 Shadow DOM
2. 降低对宿主页面的侵入
   - 不再向页面 DOM 写入 `data-has-note` 标记，页面 DOM 零污染
   - 全局 `error` / `unhandledrejection` 监听改为只接管扩展自身的错误；宿主页面自身报错不再被弹 toast、不再被打印
   - 事件委托只旁听，不调用 `preventDefault` / `stopPropagation`
   - 扩展上下文失效时统一走 `teardownListeners()` 卸载页面监听
   - `manifest.json` 显式声明 `run_at: document_idle`

### 遇到的问题
1. HZERO / choerodon-ui 这类 SPA 把登录框渲染完后 DOM 就彻底静止，MutationObserver 永不触发，字段从未被绑定
2. `initAccountFields()` 的首屏入口挂在 `DOMContentLoaded` 上，而 content script 以 `document_idle` 注入，该监听器永远不会触发
3. 旧关键词白名单只有英文，`placeholder="账号/邮箱"`、`type="tel"`（手机号登录）一律落空
4. 旧的全局 error 监听会把宿主页面自身的任何报错都弹成扩展的红色 toast，干扰网站自身提示
5. 旧的 `querySelectorAll('input[type="text"]')` 匹配不到省略 `type` 的 `<input>`

### 解决方案
1. 改为 document 级事件委托，与节点生命周期解耦；节点被重建也能命中
2. 依据 `readyState` 决定直接初始化还是等 `DOMContentLoaded`，保证首屏一定被覆盖
3. 关键词表补中文与常见英文别名，并加反向关键词做排除
4. 全局错误监听按错误来源过滤（`chrome-extension://`），只处理扩展自身错误
5. 类型判定改为读 `input.type` 的 IDL 值（省略 type 时即为 `text`），不再依赖属性选择器

### 实测验证（dcps.hwwt2.com，真实构建产物 + 页面侧探针）
| 验证项 | 结果 |
|---|---|
| 注入后直接输入账号（不制造任何 DOM 变动） | 通过：弹窗出现，260×135，位于视口内 |
| 把 input 整个替换成新节点后再输入 | 通过：仍然弹出 |
| 在密码框输入 | 通过：不弹（反向关键词生效） |
| 页面自身 focusin / input 事件 | 通过：正常到达，`defaultPrevented` / `cancelBubble` 全为 false |
| 页面 input 属性 | 通过：注入前后一致，无扩展写入 |
| body 新增节点 | 通过：仅 `DIV.account-note-suggestion`（扩展自身元素） |
| 页面自身报错 | 通过：不再弹 toast |
| 输入框 `placeholder` 消失 | 已对照排除：无扩展介入时同样消失，属 choerodon-ui 组件自身行为 |

### 已知遗留（本次未动）
1. `manifest.json` 未声明 `all_frames: true`，iframe 内的登录框不会注入脚本
2. 触发仍要求输入框已有值，未做 autofill 检测
3. 弹窗去重是全局单例，同页多账号框时第二个框可能不弹
4. `content.css` 中 `.save-btn` / `.note-input` / `.favorite-btn` 等未加前缀的类名会影响同名页面元素

### 后续：遗留风险一并收敛（同日第二轮）

#### 完成的功能
1. CSS 作用域收敛（消除对宿主页面同名元素的样式污染）
   - 21 个无前缀类名全部限定到所属容器（`.account-note-suggestion` / `.edit-note-popup` / `.account-note-toast`）
   - CSS 变量从 `:root` 移到 `:where(...)` 容器选择器，不再覆盖宿主页面的同名变量
   - 4 个 `@keyframes` 改名加前缀（原 `slideDown` / `fadeIn` / `toastSlideIn` 等属高频重名）
   - `disable-options.css` 同步收敛（`.disable-option`、`.disable-menu-close-btn`、`@keyframes fadeIn`）
2. iframe 内登录框支持
   - `manifest.json` 增加 `"all_frames": true`
   - 新增 `isNegligibleFrame()`：iframe 视口小于 200×200 直接跳过，避免给广告/埋点/像素框架白注入
   - `shouldShowNote()` 增加 origin 有效性校验，`about:blank` / `data:` 等 origin 为 `"null"` 的框架不启用
3. autofill 场景覆盖
   - 事件委托纳入 `change`，浏览器自动填充后即使没有逐字输入也能触发
   - 刻意未引入 CSS animation hack 或轮询，避免增加对页面的侵入
4. 弹窗改为按字段管理
   - 新增 `suggestionByField`（WeakMap），同页多个账号框各管各的
   - 新增 `destroySuggestion()` / `closeOtherSuggestions()`，切换字段时只收掉其他字段的弹窗
   - 修复「第二个账号框因内容相同被全局单例去重吃掉」的老问题

#### 遇到的问题
1. 原 `:root` 定义的 `--primary-500` 等变量会覆盖宿主页面同名变量
2. `@keyframes slideDown` / `fadeIn` 属高频重名，容易与页面动画互撞
3. 21 个无前缀类名（`.save-btn` / `.note-input` / `.favorite-btn` 等）会命中宿主页面同名元素
4. 全局单例去重导致同页多账号框时第二个框不弹
5. iframe 场景完全未注入（manifest 缺 `all_frames`）

#### 解决方案
1. 变量作用域限定到扩展容器（`:where()` 零特异性，句柄式收敛）；类名一律加容器限定；keyframes 统一加 `account-note-` 前缀
2. 弹窗由全局单例改为按 field 维度（WeakMap 记录归属）
3. 打开 `all_frames` 并配套「尺寸 + 来源」双重保护

#### 实测验证（真实构建产物 + 页面侧探针）
| 验证项 | 结果 |
|---|---|
| 18 个裸类名探针（容器外）注入前后 computed style | 全部零变化 |
| 阳性对照：扩展容器内的 `.note-tag` | 正常生效（display → inline-flex），说明收敛未破坏扩展自身 UI |
| 宿主页面自定义的 `--primary-500: #ff0000` | 注入前后保持一致，未被扩展覆盖 |
| 首个账号框输入 | 弹窗出现（宽 260） |
| 第二个账号框输入**完全相同的值** | 弹窗出现且挂在第二个框旁，弹窗总数恒为 1 |
| 仅派发 `change` 事件（模拟 autofill） | 弹窗出现 |
| 同源 blob iframe 320×400 | 弹窗正常 |
| 同源 blob iframe 120×120 | 不注入（尺寸保护生效） |

#### 已知遗留（本次仍未处理）
1. `showAccountNote` 的 z-index 由 JS 内联 `9999` 覆盖 CSS 的 `10001`，取值混乱（当前表现无碍）
2. `createNotePopup` / `loadExistingNote` / `.disable-menu-close-btn` 已无调用方，属死代码
3. 未在真机 MV3 环境验证 `all_frames`：ego 浏览器未安装扩展，采用主世界注入 + 同源 blob iframe 模拟

### 后续：三条遗留全部收口（同日第三轮）

#### 完成的功能
1. z-index 统一为 CSS 单一来源
   - 移除 `content.js` 中所有内联 `style.zIndex = '9999'`（`suggestion` 与编辑弹窗两处）
   - 阶梯定为：10000 悬浮按钮 < 10001 备注弹窗 < 10002 禁用菜单 < 10003 Toast，写在 `styles.css` 头部注释作为唯一事实来源
2. 死代码清理（AST 级精确删除）
   - 用 `@babel/parser` + `traverse` 删除 6 个零引用顶层函数：`loadExistingNote`、`showNotePopup`、`showEditNotePopup`、`validateNoteData`、`saveNote`、`updatePopupPosition`（后两者为传递性死代码）
   - 删除 `styles.css` 中整套 `.edit-note-popup` / `.save-btn` / `.cancel-btn` / `.note-input` 死规则（约 100 行）及 `.account-note-popup` 死类
   - 删除 `disable-options.css` 中 `.disable-menu-close-btn` 的 5 条规则
   - 复查方式：删除后按词统计引用数，确认零残留
3. 真机 MV3 端到端验证（Playwright Chromium + `--load-extension` 加载真实 `dist/`）
   - `manifest.json` 无 `background` 字段（MV3 允许），改用「扩展 popup 页可达 + content script 生效」双重证明扩展已加载
   - 验证了主文档弹窗、真实 `chrome.storage` 保存/回读往返、iframe 内生效、小 iframe 保护、就地编辑流程

#### 遇到的问题
1. playwright CDN 在本机网络下下载 20 分钟零字节（同 github 封锁同源问题），换 `cdn.npmmirror.com` 镜像后 1 分钟内完成
2. 死代码清理一度用「函数起点到下一函数起点」的文本跨度删除，吞掉了函数间的顶层代码导致语法损坏；改用 Babel AST 后精确无误
3. 发现比预期更多的死代码：`showEditNotePopup` 整个编辑弹窗子系统（含 `saveNote`）实际不可达——消息监听器 `showAddNotePopup` 调的是 `showAccountNote`，真实编辑路径是 suggestion 内 textarea 就地编辑
4. 同一文件的两个 Edit 并行发出会互相覆盖（后写覆盖先写），本轮两次踩坑，最终所有同文件修改改为单脚本原子写入

#### 解决方案
1. 下载源固定为 npmmirror 镜像（`PLAYWRIGHT_DOWNLOAD_HOST`）
2. JS 结构性删改一律走 AST，不再做文本跨度手术
3. 协作约定：同一文件的多次修改串行执行

#### 实测验证（Playwright Chromium 153，加载 dist/ 扩展）
| 验证项 | 结果 |
|---|---|
| 扩展 popup 页可达（由路径推导 ID） | 通过 |
| 主文档输入账号弹出备注框 | 通过，computed z-index 10001、无内联 z-index |
| UI 保存备注 → reload → 存储回读 | 通过：内容完整往返（真实 chrome.storage） |
| 大 iframe (320×400) 内登录框 | 通过：弹窗出现，z-index 10001（`all_frames` 真机生效） |
| 小 iframe (120×120) | 通过：不弹（尺寸保护生效） |
| z-index 阶梯 | 通过：10001 / 10002 / 10003，无 JS 内联覆盖 |
| 就地编辑（点击 textarea → 改 → Enter） | 通过 |

#### 已知遗留（本次仍未处理）
1. `styles.css` 中仍存在少量与 `content.js` 重复的旧规则段（如文末 Toggle/Empty Note 区与中段规则部分重叠），可继续做一次 CSS 去重
2. `content.js` 中 `getMessage` 的 i18n key 与 `_locales` 未逐一核对，存在默认值兜底路径

### 2026-09-15 · 第二轮：识别引擎升级为「登录表单锚定 + 多信号评分」

#### 背景
第一轮的事件委托解决了"监听不到"的问题，但识别判据本身仍是**字段级关键词匹配**（命中关键词表才算账号框）。
该判据的天花板明显：无线索的裸输入框必然漏报；关键词是硬门槛，属性撞词即误杀。
经与需求方确认后重构为评分制。

#### 完成的功能
1. 新增评分引擎（`src/content.js`）
   - `scoreAsAccountField(input)` 返回 `{ score, reasons }`，`isAccountField()` 为对外接口（替换原 `isUsernameField()`）
   - 打分表：
     - **一票否决**：不可见（`display:none` / 零尺寸 / `visibility:hidden` / `opacity:0`）、`tabindex="-1"`、`aria-hidden="true"`、`readOnly`
     - **−50**：反向关键词命中（密码 / 验证码 / 搜索…），改为重扣分而非否决，允许结构信号纠正误伤
     - **+40**：`autocomplete` 含 `username` 或为 `email`
     - **+35**：所在表单含可见密码框，且本框 DOM 序位于密码框之前（登录表单结构）
     - **+30**：`type="email"`
     - **+15**：正向关键词命中（原关键词表降级为加分项）
     - **+10**：同结构内离密码框最近的候选框
     - **+5**：有 `placeholder` 或关联 `<label>`
     - 阈值 `ACCOUNT_FIELD_THRESHOLD = 20`
2. 表单结构分析
   - `collectFormContext(scope)`：收集可见密码框、密码框之前最近的候选框
   - `getFormContext(input)`：作用域优先取 `input.form`，SPA（无 `<form>`）场景退化为文档级
   - 缓存：`WeakMap<form, context>` + 2s TTL；文档级用时间戳短缓存，避免超大页面每次事件全量查询
3. 蜜罐/装饰框防御
   - `isDecoyInput()`：`tabindex="-1"` / `aria-hidden` / `readOnly` 一票否决
   - `isVisibleInput()` 用 `getClientRects()` 判断可见性（不用 `offsetParent`——它对 `position:fixed` 元素恒为 `null`，会误杀）

#### 遇到的问题
1. **纯结构法在 choerodon-ui 上会选错框**：dcps 密码框前有反 autofill 蜜罐框（无 id/name + `tabindex="-1"`），DOM 序上比 `username` 离密码框更近，"取密码框前最近的文本框"会选中蜜罐
2. 蜜罐判定的边界：若用"无 id/name 即否决"会误杀真实裸账号框（本方案明确要救回的场景）
3. Playwright 启动的 Chromium 不继承 shell 的 `HTTP_PROXY`，真实站点验证超时

#### 解决方案
1. 改为**评分制**：蜜罐否决（`tabindex="-1"`）+ 关键词加分 + 结构信号共同兜底。蜜罐拿不到任何加分（0 分），真实账号框即便无关键词也能靠 `+35` 结构分过阈值
2. `isDecoyInput()` 只认客观特征（不可聚焦 / 只读 / 显式隐藏），不因"无标识"否决；无标识可交互框与真实裸框客观不可区分，定为**已知边界**（宁可多弹不漏弹，真蜜罐一律不可交互）
3. 真实站点验证改走 ego-browser：把评分核心代码注入扩展隔离世界，对真实 DOM 逐个 input 打分（纯计算，不挂监听、不弹窗、不污染页面）

#### 实测验证
**A. 真实站点评分（ego 浏览器，扩展隔离世界内执行评分函数）**

| 站点 / 字段 | 得分 | 判定 | 关键得分项 |
|---|---|---|---|
| GitHub `#login_field`（`autocomplete="username"`） | **105** | 弹 | +40 自动填充标注 / +35 结构 / +10 最近 / +15 关键词 / +5 label |
| GitHub 3 个隐藏 `required_field_*` | 一票否决 | 不弹 | 不可见 |
| dcps `input[name=username]` | **65** | 弹 | +35 结构 / +10 最近 / +15 关键词 / +5 placeholder |
| dcps 反 autofill 蜜罐框（`tabindex="-1"`） | **一票否决** | 不弹 | 蜜罐/装饰框特征 |

**B. 全场景 E2E（Playwright Chromium 加载 dist/，11 类场景 21 个断言）**

| 场景 | 断言 | 结果 |
|---|---|---|
| s1 GitHub 型（autocomplete + label） | 账号弹 / 密码不弹 | 通过 |
| s2 dcps 型（密码框前有不可交互蜜罐） | 账号弹 / 蜜罐不弹 / 密码不弹 | 通过 |
| s3 裸账号框（无 id/name/placeholder，仅结构信号） | 弹 | 通过 |
| s4 无 `<form>` 的 SPA 登录（文档级结构） | 账号弹 / 密码不弹 | 通过 |
| s5 搜索框（无密码框） | 不弹 | 通过 |
| s6 邮箱 OTP 登录（无密码框） | 弹 | 通过 |
| s7 手机号登录（`type=tel`，无密码框） | 弹（+15+5=20 达标，边界） | 通过 |
| s8 搜索框 + 登录表单同页 | 搜索不弹（−50 抵消结构分） / 账号弹 | 通过 |
| s9 验证码框（位于密码框之前） | 不弹 | 通过 |
| s10 注册表单（用户名 + 邮箱 + 密码 + 确认密码） | 用户名弹 / 邮箱弹 / 两个密码框不弹 | 通过 |
| s11 无标识但完全可交互的框 | 弹（已知边界，与真实裸框不可区分） | 通过 |

**合计 21/21 通过。**

#### 已知边界
1. 完全可交互、无任何标识的框，与真实裸账号框客观不可区分（s11），当前策略是接受弹窗
2. 无关键词、无结构信号（页面无密码框且无任何线索）的孤立输入框仍无法识别——需靠后续「手动锚定记忆」兜底

#### 验证脚本
- `/tmp/score-verify.js`：11 类场景 E2E（Playwright + 本地 http 服务）
- `/tmp/live-check.js`：真实站点验证（受代理限制未跑通，改用 ego-browser 隔离世界探针）

### 2026-09-15 · 第三轮：历史清单收尾（CSS 去重 / i18n / 挂载点 / 补充回归）

#### 完成的功能
1. **CSS 内部去重 + 作用域泄漏自动化检查**
   - 新增 `scripts/check-css-scope.js`：解析 `dist/content.css`，逐个选择器判定是否被扩展容器限定；输出违规清单与去重报告，异常时退出码 1
   - 判定规则：链路中含扩展容器类（`.account-note-btn` / `.account-note-toast` / `.account-note-suggestion` / `.disable-options-menu`），或主体复合选择器至少有一个类带 `account-note-` 前缀（同一元素上的多类是「与」关系，故有一个自有前缀即不会命中宿主页面）
   - 删除两处**死声明块**：中段 `.account-note-text`（紧凑版 36px/13px/8px）与 `.account-note-suggestion .toggle-text-btn`（4px 10px/11px/6px）——其全部属性均被文件后段的宽松版覆盖或重复，属历史沉积
   - 新增 npm 脚本：`npm run check:css`、`npm run check:css:dupes`
2. **i18n key 核对与补齐**
   - 新增 `scripts/check-i18n.js`：扫描 `src/*.js` 的 `getMessage('key')`，与两个 locale 双向核对，缺失即退出码 1
   - 补 `_locales/{en,zh_CN}/messages.json` 共 33 个条目（en +15，zh_CN +18），现两个 locale 各 130 条，JS 引用的 110 个 key 全部齐备
   - 中文文案直接采用代码内的兜底默认值，保证补齐前后的实际显示一致
3. **覆盖层挂载点改为 `<html>`**
   - 新增 `getOverlayRoot()`，注入宿主页面的 4 处挂载点（备注弹窗 / 禁用菜单 / Toast / 文本测量临时元素）统一改用它
   - 原因：`position:fixed` 的包含块会被祖先元素的 `transform` / `filter` / `perspective` / `will-change` 劫持，不少 SPA 会给 `<body>` 加这类属性
4. **补充三类场景回归**
   - 纯静态 SSR 页面（零 JS）、iframe 内登录框（评分制版本）、同页多账号框（含密码框不新建弹窗）、小 iframe 尺寸保护

#### 遇到的问题
1. 去重脚本自身有两处判定缺陷：`:where(...)` 内部的逗号被当作选择器分隔符（导致变量定义块被拆成 4 段、误报重复）；`account-note-text.empty-note` 被判为「裸类名」（实际 AND 语义下已锚定自有元素）；去重报告用归一化文本导致主题变体被误算重复
2. **i18n 存在一个此前未发现的真问题**：`getMessage()` 的降级链是 `chrome.i18n.getMessage(key) || getDefaultMessage(key)`，而 `getDefaultMessage()` 只认识一张 9 条的内置表，对未收录的 key **返回 key 本身**（真值）→ 调用方的 `|| '兜底文案'` 永远不生效 → 界面上会直接显示 `tagRenamed` 这类原始 key。共 18 个 key 处于此状态（管理页标签重命名/删除、全局禁用提示等）
3. 27 项 locale 条目在 JS 中无直接引用（对应未实现的批量标签、按标签筛选、通用设置等功能），属历史遗留
4. CSS 重复分析一度把 `:root` 与 `@media (prefers-color-scheme: dark)` 内的同名选择器判为重复——实际是合法的主题覆盖
5. 补充回归脚本里 `frame.keyboard` 不存在（键盘对象属于 page 而非 frame）

#### 解决方案
1. 去重脚本改用「顶层逗号分割」（按括号深度）+ 「主体至少一个类带自有前缀」+ 「去重键包含 at-rule 上下文」，三处修正后误报归零
2. i18n 按「补齐 locale」根治：JS 引用的 key 在两个 locale 中全部齐备后，降级链不再有机会返回原始 key；并建立 `npm run check:i18n` 门禁防止再次脱节
3. 历史遗留 key 记录在案、暂不清理（对应功能可能仍需恢复）
4. 去重报告口径修正为按上下文（`ctx||selector`）统计
5. iframe 场景改为在 frame 内直接派发 `input` 事件触发委托监听

#### 实测验证
| 验证项 | 结果 |
|---|---|
| 作用域检查 | 89 个选择器 / 0 违规；`npm run check:css` 通过 |
| 去重报告 | 上下文口径修正后 0 重复 |
| **视觉回归**（删除死块前后像素对比） | 4 个状态 md5 **逐一完全一致**；敏感度探针（注入 `min-height:120px`）md5 与基线**不同**，证明测试对尺寸变化敏感、比对结论有效 |
| i18n 检查 | 两个 locale 各 130 条；JS 引用的 110 个 key 全部存在；`npm run check:i18n` 通过 |
| 覆盖层挂载点·机制验证 | 滚动 500px 后：挂 `<html>` 的 fixed 探针 top=50（视口固定），挂 `<body>` 的探针 top=−450（被 transform 劫持带走）→ 证实改造有效 |
| 覆盖层挂载点·功能验证 | `body{transform}` 页面上弹窗挂载父节点 = `<HTML>`，纵向与输入框偏差 **0px** |
| 补充回归 7 断言 | 全过：静态 SSR 账号框弹/密码框不弹、iframe 内弹出（父节点 `<HTML>`）、小 iframe 不弹、多账号框 A/B 均弹、密码框不新建弹窗（距账号框 B 0px / 距密码框 96px） |
| 评分引擎回归 21 断言 | 全过（挂载点改造后无回归） |

#### 待清理（记录，暂不删除）
- `_locales/*/messages.json` 中 20 个无引用的 key：`extDesc, errorStorageAPI, errorEmptyNote, errorReadData, errorSaveData, generalSettings, generalSettingsPlaceholder, exportNotes, importNotes, keyboardTip, disableOptions, filterByTag, filterByFavorite, batchAddTag, batchRemoveTag, batchAddToFavorites, batchRemoveFromFavorites, editTag, changeTagColor, newTagName`

#### 验证脚本
- `scripts/check-css-scope.js`（门禁，`npm run check:css`）
- `scripts/check-i18n.js`（门禁，`npm run check:i18n`）
- `/tmp/visual-regression.js`（弹窗四状态截图 + 敏感度探针）
- `/tmp/overlay-root-verify.js`（挂载点机制 + 功能验证）
- `/tmp/regression-extra.js`（SSR / iframe / 多账号框补充回归）
- `/tmp/css-dupe-analyze.js`（重复规则分析，区分等价与冲突）

### 2026-09-15 · 第四轮：数据兼容性评估（二期「手动锚定记忆」升级安全）

**背景**：二期需新增 storage key（`fieldAnchors`）以持久化手动锚定特征。需求方顾虑「新增 key 会影响既有用户数据、无法平滑升级」，要求先行确认。本轮为纯评估，**未改动任何源码**。

#### 结论
新增 key 属**加字段而非改字段**，升级安全、无数据丢失，顾虑不成立。已由静态审计 + 真机实测两条证据链证实。

#### 证据一 · 静态审计
- `chrome.storage.local.get(null)` 全表读取共 **11 处**，逐处核验过滤口径，全部按备注特征谓词（`domain && note && username`）过滤。唯一未在本地过滤的 `setupSearch()`（management.js:444）在**下游 `displayNotes()`（:285）** 补过滤，同样安全。
- **无 `chrome.storage.onChanged` 监听** → 不存在「任意 storage 变更被当作备注变更」的通路。
- **无整表回写**：所有 `set()` 均为定点写入或由备注集合构建的 `updates` 映射，无 `set(整个 get 结果)` 写法。
- **既有先例**：`theme` / `disabledGlobal` / `disabledSites` 三个非备注 key 已与备注长期共存，本次只是遵循同一已证模式。
- 唯一全量删除是用户手动触发的「清除所有数据」（`storage.local.clear()`），与本次改动无关。

#### 证据二 · 真机实测（真实扩展 + 真实 chrome.storage，14/14 通过）
构造老用户混合 storage（8 个 key：老格式备注无 `tags`/`isFavorite`、更老格式缺 `key`/`createTime`、已合规备注、3 个既有非备注 key、新增 `fieldAnchors`、未知未来 key），加载 `dist/` 打开管理页触发**真实 `migrateAllNotes()` + 渲染**后核验：

- 存储 key 集合前后完全一致（无新增/丢失）✅
- 老格式备注补齐 `tags`/`isFavorite`/`favoriteTime`，**原字段一字未改**（备注文本、`createTime`/`updateTime` 逐字段保真）✅
- 更老格式备注补 `key` + `createTime` ✅
- 已合规备注**逐字段零改写**（`tags`/收藏/时间戳全部原样）✅
- `theme` / `disabledGlobal` / `disabledSites` 未被改动 ✅
- `fieldAnchors` 深度一致（未被迁移逻辑触碰）✅
- 未知未来 key 原样保留 ✅
- 备注列表只渲染 3 张卡片 → 锚定 key 未被当作备注 ✅
- 禁用网站列表未被污染 ✅
- 导出含全部 3 条备注 ✅
- 导入备份后 `fieldAnchors` / `theme` / 禁用列表均仍在（导入为合并写入，不 `clear`）✅
- 导入后备注 = 原有 3 条 + 备份新增 1 条，无覆盖丢失 ✅

迁移逻辑本身为纯增量：`migrateNoteData()` 先 `{...note}` 再仅补缺失字段，不删除不重命名。

#### ⚠️ 实测暴露的两处备份缺口（已列入待办，须随二期一并修复）
1. **导出不含锚定数据**：`exportNotes()` 用同一套备注谓词过滤，`fieldAnchors` 被排除在备份之外 → 用户「导出 → 清除 → 导入」后备注回来、锚定记录**静默消失**且无提示。
2. **「清除所有数据」会连锚定一起清除**：`storage.local.clear()` 语义如此，行为可预期，但确认文案需说明。

#### 遇到的问题
- **Playwright 无法导航到 `chrome-extension://`**：`page.goto` 与 CDP `Page.navigate` 均返回 `net::ERR_ABORTED`（Playwright 对非 http scheme 的导航限制）。且 headless / `--headless=new` 两种模式下扩展页面无法访问。
- **BSD grep 不支持 `\|` 交替**：macOS 自带 grep 下多条排查命令返回空结果，一度误判「代码里没有该符号」。实为语法问题（`\|` 是 GNU 扩展），改用 `grep -E` 后全部命中。
- **断言自身缺陷（第三次同类）**：首轮 3 项失败（已合规备注、`fieldAnchors`、未知 key）实为 `JSON.stringify` 比较了**键顺序**——`chrome.storage` 回读后对象键顺序变化导致假失败，值其实逐字段相同。

#### 解决方案
- 扩展页访问：改用**浏览器级 CDP `Target.createTarget`** 新建 target，并用 `context.on('page')` 捕获该页面对象；且必须 `headless: false`（headed 模式）才可访问扩展页。
- grep：统一改用 `grep -E`（BSD grep 的 POSIX 扩展正则）。
- 断言：改为**键序无关的规范化深比较**（递归排序对象键后序列化），修正后 14/14 全过。

#### 验证脚本
- `/tmp/data-safety-verify.js`（数据兼容性 14 断言；含导出下载捕获与导入文件注入）
- `/tmp/ext-id-probe.js` / `ext-page-probe2.js`（扩展 ID 推导 + 扩展页打开方式）

#### 经验沉淀
- **unpacked 扩展 ID 可从路径推导**：`SHA256(扩展绝对路径)` 取前 16 字节，每个 hex 位 `c` 映射为 `'a'+c`，即得 32 位 `[a-p]` ID（实测与扩展隔离世界 origin 完全一致）。无需 service worker 即可拿到 ID。
- **「加字段是否安全」这类判断，答案全在读取路径的过滤口径里**——必须逐处核验 `get(null)`，而不是看写入端。

### 2026-09-15 · 第五轮：备份链路补全（消除静默丢数据的两个缺口）

**背景**：第四轮数据兼容性评估实测暴露两处缺口——① 导出不含非备注 key（将来的锚定数据会静默丢失）；② 「清除所有数据」确认文案未说明清除范围。老板指示先处理这两处。

#### 完成的功能

**1. 导出结构升级为带版本信封（`exportNotes()`）**

从「备注数组」升级为：

```json
{
  "format": "account-note-backup",
  "version": 2,
  "exportTime": "2026-09-15T07:13:25.441Z",
  "appVersion": "1.1.0",
  "notes": [ /* 备注记录 */ ],
  "others": { /* 主题、禁用列表、锚定记录等全部非备注 key */ }
}
```

**关键设计（防止同类问题复发）**：`others` 按**通用规则**切分——凡不满足备注特征谓词的 key 全部收纳，而非逐个列举。今后新增任何 storage key 都会自动进入备份，**不需要再改导出代码**。这正是上一版漏掉锚定数据的根因（当时是按「备注数组」硬编码输出的）。

新增公共层（导出/导入共用）：
- `isNoteRecord(value)` — 备注特征判定，统一全表读取的过滤口径
- `splitStorageData(allData)` — 把整个 storage 切成 `{ notes, others }`。顺带修复一个潜在丢数据点：**早期无 `key` 字段的备注原会被导出时静默丢弃**，现按存储键补齐 `key` 后纳入
- `parseBackupPayload(raw)` — 兼容解析：裸数组（v1，仅备注）与信封对象（v2）
- `sanitizeOthers(others)` — 净化 `others`，拦掉混进来的「备注形」数据，防止构造文件绕过备注校验通道
- `refreshViewsAfterImport()` — 导入/清空后统一刷新受影响的视图

**2. 导入端兼容新旧格式并恢复设置类数据（`importNotes()`）**

保留原有备注冲突处理三分支语义，并明确设置类数据的还原边界：

| 分支 | 备注 | 设置类数据（others） |
|---|---|---|
| 无冲突 | 全部导入 | 一并还原 |
| 有冲突 + 用户选「覆盖」 | 全部覆盖 | 一并还原 |
| 有冲突 + 用户选「跳过重复」 | 只补新增 | **不动**（用户已表达"不覆盖"意图） |

其他改进：
- **旧的裸数组备份仍可用**（向后兼容），只是不含设置类数据
- 备份版本高于当前时提示 `backupFromNewerVersion`，并按可识别部分尽力恢复
- 放开「0 条备注」的硬报错：仅含设置的备份（如新用户导出）也能正常导入
- 修复导入后标签列表/筛选器不刷新的旧缺陷（导入带标签的备注后，标签筛选器原本是陈旧的）

**3. 清空数据的文案与刷新范围**
- `confirmClearAllData` 文案明确列出影响范围：备注、标签、主题设置、禁用网站列表（以及输入框锚定记录）
- 清空后改为调用 `refreshViewsAfterImport()`：原本只刷新备注列表与禁用列表，**主题与全局禁用开关的 UI 会停留在旧状态**（与存储不一致），现已一并刷新

#### 遇到的问题
- **BSD grep 的 `\|` 陷阱第三次踩中**：`grep -n "a\|b"` 在 macOS 自带 grep 下静默返回空，导致误判「替换未生效 / 文件里没这个符号」。同一轮内连续误判两次。已固化：一律 `grep -E`。
- **整块替换的空白字符匹配风险**：Edit 工具需要精确匹配（含行尾空格），而这两个函数体量大。改用 Node 脚本做正则替换（`/async function exportNotes\(\) \{[\s\S]*?\n\}\n\n\/\/ 导入备注数据/`），并注意 `String.replace` 的替换串中 `` $` ``/`$&`/`$1` 有特殊含义 —— 用占位符中转反引号后统一还原，避免模板字符串被破坏。
- **回归脚本自身过期**：上一轮的数据安全脚本按「导出 = 裸数组」写的断言，在导出结构升级后会崩（对象无 `.some()`）。已把该脚本改为格式自适应，使其继续作为有效回归资产。

#### 解决方案与验证

真机端到端验证（真实 Chromium 加载 `dist/`，`/tmp/backup-chain-verify.js`，**21 断言全过**）：

| 场景 | 断言 | 结果 |
|---|---|---|
| 1 · 导出结构 | 信封字段完整；`notes` 3 条逐字段一致；`others` 收纳全部 5 个非备注 key（含 `fieldAnchors`）；`others` 中无备注形数据 | ✅ |
| 2 · 清空→导入 | 清除后 storage 为空、主题回默认；导入后备注/锚定/主题/禁用列表/**未知未来 key** 全部恢复，且主题已应用到 `<html>`、禁用列表与全局开关 UI 已刷新 | ✅ |
| 3 · 旧格式兼容 | 裸数组备份可导入 2 条备注；不伪造出 `theme`/锚定 | ✅ |
| 4 · 冲突分支 | 选「跳过重复」→ 原备注未被覆盖且设置未被改写（主题仍 `light`、锚定未写入）；改选「覆盖」→ 备注与设置一并还原 | ✅ |
| 5 · 异常输入 | 损坏 JSON 不崩溃不写入；`others` 中的备注形数据被成功拦截 | ✅ |

回归：第四轮数据安全脚本重跑 **14/14 通过**，其中原先报「fieldAnchors 未包含」的项现为「✅ 已包含在备份中」。

门禁：`npm run check:css` / `npm run check:i18n` 均通过；`npm run build` 成功。

#### 验证脚本
- `/tmp/backup-chain-verify.js`（备份链路 21 断言，含导出下载捕获、导入文件注入、对话框策略切换、异常输入注入）
- `/tmp/data-safety-verify.js`（数据安全 14 断言，已升级为格式自适应）

#### 改动文件
- `src/management.js`（+223/−61）：备份信封公共层 + `exportNotes()` / `importNotes()` 重写 + 清空数据文案与刷新范围
- `_locales/en/messages.json` / `_locales/zh_CN/messages.json`：新增 `backupFromNewerVersion`，更新 `confirmClearAllData`

## 2026-09-16 · 第七轮：交互体验全面修复（P0/P1/P2 清账）

### 功能

基于 `document/ux-audit-2026-09-16.md` 的三端审计（4 P0 / 6 P1 / 8 P2），一次性修复全部主要问题。

**P0（功能性硬伤）**
1. **标签管理假功能移除**：删除 `addNewTag()` 虚假添加入口与「添加成功」toast；卡片改为「标签来自备注本身」说明 + 已使用标签展示（`tagsFromNotesHint`）
2. **添加备注流程打通**：`showAddNotePopup` 结构化回传 `{ok, reason}`（无可承载输入框 → `no-password-field`）；弹窗优先挂**账号框**而非密码框（备注归属用户名）；空记录正文改为引导文案 `emptyNoteHint`
3. **弹窗 ✕ 恢复关闭语义**：✕ 点击关闭（旧实现是 hover 展开禁用菜单且点击无反应）；新增 ⚙ `options-btn` 点击展开禁用菜单，点菜单外任意处关闭——键盘/触屏用户由此可达
4. **删除有后悔药**：软删除进 `trash` 键（数组，含 `deletedAt`），7 天后管理页启动时清理（`cleanupTrash()`）；toast 带「撤销」按钮（`showUndoToast`，5s）；原生 `confirm` 全部替换为自绘对话框 `showConfirmDialog`（danger 样式，写明删除目标「域名 / 账号」）

**P1**
- favicon 改用站点自身 `/favicon.ico`（google.com/s2 国内不可达），失败回退首字母头像 `domain-fallback`（`wireFaviconFallback()`）
- 长备注「更多/收起」原地展开：JS 检测 `scrollHeight > clientHeight` 真实截断后才显示按钮，短备注不打扰
- 静默失败提示：无备注记录时点标签/收藏给出「请先保存备注内容」
- toast 单例化（新顶旧）+ 三态语义（success/error/info，error 停 4s）；收藏切换去 toast（星标颜色即反馈）
- 管理页首屏骨架屏（`showSkeleton()`，4 张 shimmer 占位卡）
- 主题切换 toast 走 i18n（`themeApplied` + `themeAuto/Light/Dark`）

**P2**
- 批量删除 toast 文案修正（此前复用「导入成功」→ `deletedCount`「已删除 N 条备注」）
- 退出选择模式重置全选框；导入冲突对话框化（`importOverwrite`）
- 删除/清空/导入/标签删除等所有原生 `confirm` 对话框化

**i18n**：新增 20 个 key（en/zh_CN 各 170 条），`npm run check:i18n` 通过

### 错误与解决方案

| 问题 | 根因 | 解决 |
|---|---|---|
| `setupControls` 函数被编辑提前闭合，批量删除块成孤儿代码，构建报错 | 多段编辑后括号配对破坏 | 修复闭合位置，构建通过 |
| toast 一直透明不可见（存量 bug） | M1 重写删掉了 `fadeInOut` 关键帧，但 toast 动画名仍引用它 | 重写 toast 动画（translateX 滑入），顺带单例化 |
| content 验证脚本卡死：弹窗 ✕ 关闭后重聚焦不出现 | 测试页用 `setContent`（origin=null），`shouldShowNote` 正确拒绝 non-http——**扩展行为正确** | 脚本改本地 http 服务 + `addInitScript` 注入（再次验证「setContent 必须 goto http」经验） |
| 管理端验证首跑 store 被打平（备注字段铺在根上） | 测试数据写错：`{...NOTE_A}` 少包一层键 | 改 `{ [NOTE_A.key]: NOTE_A }`；非扩展 bug |
| showToast 不移除旧 toast，多 toast 叠加误导 | 新写 showToast 漏了单例逻辑 | 补 `existing.remove()`（popup/content 原本就有） |
| m3 回归 gradient 断言失败 | 骨架屏 shimmer 合法使用 linear-gradient | 回归脚本剔除骨架屏段落再验（断言过时，非缺陷） |

### 实测结论

六套验证 **110 断言全绿**：

| 套件 | 断言 | 覆盖 |
|---|---|---|
| uxfix-content（新增） | 19 | 结构化回传、账号框锚定、✕/⚙ 语义、菜单外点关闭、全局禁用、更多/收起、空记录引导、静默失败提示、无密码框拒绝 |
| uxfix-mgmt（新增） | 22 | 假标签入口移除、favicon 本地源+兜底、收藏无 toast、删除对话框（danger+写明目标）、软删除进 trash、撤销恢复、批量删除文案、主题 i18n、清空对话框 |
| m1-overlay | 30 | 弹窗定位/编辑/标签/暗色无回归 |
| tag-inline | 7 | 标签行内编辑无回归 |
| m2-popup | 16 | popup 换皮无回归 |
| m3-mgmt | 16 | 管理页换皮无回归（断言已适配骨架屏 shimmer） |

`npm run build` + `check:css` + `check:i18n` 全绿。

## 2026-09-15 · 第六轮：手动锚定记忆（二期主体）

### 功能

识别引擎的兜底层落地：评分引擎解决不了「既无关键词线索、又无登录表单结构信号」的孤立输入框（如多步登录第一步、密码框延迟渲染的站点），现在用户可以手动指定一次，此后该框直接命中。识别系统从「一次性猜测」升级为「可被纠正的猜测」。

**1. 存储层（content.js）**
- 新增 key `fieldAnchors`，按 `origin` 分组：`{ [origin]: [{ id, name, placeholder, type, nth, createTime }] }`
- 内存快照 `anchorList` 供事件路径零成本查询；`chrome.storage.onChanged` 监听使跨标签页锚定即时同步
- 匹配按标识强度降级：`id` 全等 → `name` 全等 → `placeholder` 全等 → 可见候选序号（仅限锚定时就完全无标识的裸框）
- **锚定优先于评分**：`isAccountField()` 先查锚定，命中即返回；但保留「可见」前提，页面把框藏起来时不再打扰

**2. 拾取模式（content.js）**
- 入口在扩展弹窗（始终可达）；页面侧高亮所有可见候选输入框（带序号角标），点击即锚定
- 顶部横幅提示 + 退出按钮；Esc 可退出；200ms 重算位置（滚动/缩放/SPA 布局动画都覆盖）
- 高亮框同时承担拦截点击的职责（`pointer-events: auto` + `stopPropagation`），拾取过程不会把焦点落进宿主输入框
- z-index 阶梯扩展：10004 拾取高亮 < 10005 拾取横幅
- 仅主框架响应（popup 侧 `frameId: 0`），避免多 iframe 页面同时弹横幅——**已知限制**：登录框在跨域 iframe 内时暂不支持手动锚定

**3. 弹窗入口（popup.js / popup.html）**
- 「本页识别不到？手动指定输入框」按钮，始终可见
- 投递指令成功才关闭弹窗；content script 不可用（页面早于扩展加载打开）时提示「请刷新页面后重试」——正是上次 GitHub 排查的教训
- 显示本页已锚定数量 + 一键清除；`chrome://` 等无法注入的页面自动隐藏入口

**4. 管理页（management.js / management.html / management.css）**
- 设置页新增「输入框锚定」卡片：按站点分组列出锚定指纹（`#id` / `name="x"` / `placeholder="x"` / `第 N 个输入框`）与创建时间
- 支持单条移除（绑错了能救回来）；某站点全部移除后整组消失并清理顶层键，不留空对象

**5. i18n**：新增 17 个 key（en/zh_CN 各 148 条），`npm run check:i18n` 门禁通过

### 错误与解决方案

| 问题 | 根因 | 解决 |
|---|---|---|
| CSS 门禁报 2 条违规（`.account-note-picker-banner-text strong/span`） | 选择器末尾是裸标签 | 改为显式类名 `.account-note-picker-title/-desc`，顺带消除对标签名的依赖 |
| 验证脚本点击高亮后未写入锚定 | 桩只支持回调式 storage API，而 `saveAnchor` 用 Promise 式 | 桩补齐双形态（真实 Chrome 两者都支持） |
| 验证脚本截图发现弹窗位置偏左 | 定位逻辑「右侧放不下就翻左侧」的既定行为（900px 视口 + 输入框贴右缘触发） | 非缺陷；顺带发现定位用硬编码 260/270 魔数与实际弹窗宽度不完全匹配，记入待办 |
| 管理页 M8 失败：全部移除后顶层 `fieldAnchors` 键残留空对象 | 移除逻辑只删 origin 子键 | 空对象时改用 `storage.local.remove` 整键清理（management 与 popup 两处） |

### 实测结论

六套回归 **84 断言全绿**：

| 套件 | 断言 | 覆盖 |
|---|---|---|
| anchor-picker（内容脚本侧） | 17 | 识别盲区确认、拾取启动/位置重合/点击写入/幂等/可撤销、SPA 重渲染后序号匹配仍命中、Esc 退出、候选范围排除密码框与隐藏框、无候选页提示 |
| anchor-popup（弹窗侧） | 9 | 入口文案、锚定数量提示、投递 `frameId:0` 并关闭、清除只删本页、最后站点清除后整键移除、content script 不可用提示、`chrome://` 隐藏入口 |
| anchor-management（管理页，真实扩展+真实 storage） | 9 | 分组渲染、指纹描述、移除同步、不影响其它设置与备注、空状态 |
| score-verify | 21 | 评分引擎原有 11 类场景无回归 |
| regression-extra | 7 | SSR/iframe/多账号框无回归 |
| backup-chain | 21 | 导出/导入/清空对 `fieldAnchors` 的完整往返无回归 |

截图核验：拾取横幅 + 高亮框视觉正常；锚定后输入即弹备注弹窗。

## 2025-03-15

### 完成的功能
1. 备注弹窗显示逻辑优化
   - 实现弹窗位置缓存机制
   - 优化弹窗定位算法
   - 解决弹窗跳动问题

### 遇到的问题
1. 备注弹窗在输入框内容变化时频繁重新定位导致视觉跳动
2. 弹窗位置计算中的小数位变化引起的轻微位置偏移

### 解决方案
1. 实现弹窗位置缓存机制，使用WeakMap存储每个输入框对应的弹窗位置
2. 使用Math.round取整避免小数位变化引起的位置偏移
3. 只在窗口大小变化时重新计算弹窗位置，减少不必要的位置更新

## 2025-03-01

### 完成的功能
1. 关闭功能实现
   - 添加会话禁用选项
   - 实现网站禁用功能
   - 完成全局禁用选项
2. 设置界面优化
   - 重新设计设置页面布局
   - 添加禁用网站列表管理功能

### 遇到的问题
1. CSS加载问题导致样式不一致
2. 禁用功能的逻辑实现复杂

### 解决方案
1. 使用webpack处理CSS，确保样式正确加载
2. 重构禁用功能逻辑，使用统一的状态管理


## 2025-02-18

### 完成的功能
1. 备注管理功能优化
- 完成备注添加和展示的核心功能
- 实现备注编辑和保存功能
- 优化存储机制，加入用户名作为Key的一部分

### 遇到的问题
1. 备注窗口的定位和样式需要调整
2. 长文本展示需要优化处理

### 解决方案
1. 调整了备注窗口的CSS样式，确保不影响表单操作
2. 计划添加展开/收起功能处理长文本


## 2025-02-19

### 完成的功能
1. 数据导入导出功能实现
- 完成备注数据的JSON格式导出功能
- 实现备注数据的导入和合并功能
- 添加数据冲突处理机制

### 遇到的问题
1. 导入功能的事件监听出现重复绑定问题
2. 数据合并时的冲突处理逻辑需要优化

### 解决方案
1. 在绑定事件前先移除已有的事件监听
2. 实现了完整的冲突处理机制，支持保留现有数据或使用新数据


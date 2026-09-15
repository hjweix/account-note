# 项目进度日志

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


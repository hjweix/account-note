# 项目状态报告

## 本次会议完成内容
1. 修复「部分站点不弹出备注框」（核心 Bug）
   - 根因定位：content script 以 `document_idle` 注入，首屏扫描入口挂在 `DOMContentLoaded` 上永不触发；唯一的实际入口 MutationObserver 在「渲染完就静止」的 SPA 页面上也不会触发
   - 改为 `document` 级事件委托（`focusin` / `input` / `change`，捕获阶段），与节点生命周期解耦
   - 移除 MutationObserver，同时消除「每次 DOM 变动都跑一次全量扫描 + 一次异步 storage 读」的性能开销
2. 提升账号框识别准确率
   - 正向关键词补中文（账号/用户名/手机/邮箱/学号/工号…）与英文别名（tel/phone/mobile/uname/uid/card/member）
   - 新增反向关键词，排除密码框、验证码框、搜索框
   - 增加 `<label>` / `aria-labelledby` 文本线索，覆盖 class 为哈希值的现代框架
3. 把「对宿主页面的侵入」压到最低
   - 不再向页面 DOM 写入任何标记属性
   - 全局错误监听只接管扩展自身错误，页面报错不再被弹 toast
   - **CSS 完成作用域收敛**：21 个无前缀类名加容器限定、变量从 `:root` 移到扩展容器、4 个 `@keyframes` 加前缀
   - 事件委托只旁听，不调用 `preventDefault` / `stopPropagation`
4. iframe 内登录框支持
   - `all_frames: true`，并配套尺寸（<200×200 跳过）与来源（`origin` 非 http/https 跳过）双重保护
5. autofill 场景覆盖
   - 委托纳入 `change` 事件，自动填充后无需聚焦也能触发
6. 弹窗改为按字段管理
   - WeakMap 记录 field → 弹窗归属，修复「同页第二个账号框不弹」

## 技术难点解决
1. 定位「时好时坏」的隐性 Bug：SPA 页面 DOM 静止后 MutationObserver 不触发，字段从未被绑定，表现随页面是否继续变动而随机
2. 用事件委托替代节点级绑定，从根本上消除 SPA 场景下的失效，节点被重建也仍然生效
3. 建立可复现的实测手段：在真实站点注入构建产物 + 页面侧探针，同时验证「功能生效」与「对页面无副作用」
4. CSS 隔离不靠 Shadow DOM 重构，改用「容器限定 + 变量收窄 + 动画名加前缀」，并用「裸类名探针 + 阳性对照」量化验证零泄漏

## 实测结论（dcps.hwwt2.com，真实构建产物）
- 输入账号 → 弹窗正常出现；输入框节点被整体替换后依然生效；密码框不误弹
- 同页第二个账号框输入**相同的值**也能弹出，且弹窗总数恒为 1
- 仅派发 `change`（模拟浏览器自动填充）也能弹出
- 页面自身的 focusin / input 事件流未被拦截，无 preventDefault / stopPropagation
- 页面 DOM 无扩展写入的标记属性，body 仅新增扩展自身的弹窗元素
- **18 个裸类名探针注入前后 computed style 零变化**；宿主自定义的 `--primary-500` 未被覆盖；扩展容器内的元素样式照常生效
- iframe：320×400 正常弹出，120×120 不注入
- 页面自身报错不再被扩展接管

## 下次会议准备内容
1. 在更多真实站点回归验证（重点是纯静态 SSR 页面、iframe 登录、同页多账号框）
2. 评估把弹窗挂载点从 `body` 换成 `documentElement`，规避 body 有 `transform` 时的定位偏移
3. `styles.css` 内部去重（文末 Toggle/Empty Note 区与中段规则部分重叠）
4. 核对 `getMessage` 的 i18n key 与 `_locales` 的一致性

## 项目进度追踪
- [x] 添加备注功能
- [x] 自动展示备注
- [x] 存储机制优化
- [x] 数据导入导出功能
- [x] 禁用功能实现
- [x] 设置界面优化
- [x] 备注弹窗显示优化
- [x] 账号输入框识别链路重构
- [x] CSS 作用域收敛（消除样式污染）
- [x] iframe 内登录框支持
- [x] autofill 场景覆盖
- [x] 同页多账号框场景修复
- [x] 死代码清理与 z-index 统一（AST 删除 6 个死函数 + 全部死 CSS；z-index 收敛为 CSS 单一来源）
- [x] 真机 MV3 验证（Playwright Chromium 加载 dist/，`all_frames` / 存储往返 / z-index 阶梯全过）
- [ ] 备注管理功能完善
- [ ] 长文本展示体验优化

## 后续工作建议
1. 在更多真实站点上回归验证（重点是纯静态 SSR 页面、iframe 登录、同页多账号框）
2. 评估弹窗挂载点改为 `documentElement`，规避 body 有 `transform` 时的定位偏移
3. `styles.css` 做一次内部去重，并给 `content.css` 增加自动化泄漏检查脚本
4. 完善备注管理页面功能与长文本展示体验

// 监听页面加载完成和DOM变化
// 扩展上下文失效标记
let isExtensionInvalidated = false;
// 页面级监听是否已注册（幂等标记，替代原先的 MutationObserver 状态）
let listenersRegistered = false;
// 当前站点是否启用了备注功能（拾取模式的前置校验，避免在禁用站点上锚定）
let noteEnabled = false;
// 未启用的具体原因。扩展弹窗据此给出「可操作」的提示，
// 而不是把所有失败都笼统归成「无法连接当前页面」。
// 'enabled' | 'context-invalid' | 'non-http' | 'global-disabled' | 'site-disabled' | 'session-disabled' | 'unknown'
let noteDisabledReason = 'unknown';
// 锚定记录的存储变更监听是否已注册
let storageListenerRegistered = false;

// 检查扩展上下文是否有效
function isExtensionContextValid() {
  try {
    return typeof chrome !== 'undefined' && chrome.runtime !== undefined && chrome.runtime.id !== undefined;
  } catch (e) {
    return false;
  }
}

// 卸载注入到页面上的所有监听，扩展上下文失效后不再打扰宿主页面
function teardownListeners() {
  if (storageListenerRegistered && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    try {
      chrome.storage.onChanged.removeListener(onAnchorStorageChanged);
    } catch (error) {
      // 上下文已失效，忽略
    }
    storageListenerRegistered = false;
  }
  exitFieldPicker();
  if (!listenersRegistered) return;
  document.removeEventListener('focusin', onDelegatedFocusIn, true);
  document.removeEventListener('input', onDelegatedInput, true);
  document.removeEventListener('change', onDelegatedInput, true);
  listenersRegistered = false;
}

// CSS样式已通过Webpack打包到content.css中，不需要动态加载

// 检查是否应该显示备注。
// 除返回布尔值外，同时把「为什么没启用」记到 noteDisabledReason，
// 供扩展弹窗区分提示——禁用类问题刷新页面无法解决，必须给出对应出路。
function shouldShowNote() {
  return new Promise(resolve => {
    if (isExtensionInvalidated || !isExtensionContextValid()) {
      isExtensionInvalidated = true;
      noteDisabledReason = 'context-invalid';
      teardownListeners();
      resolve(false);
      return;
    }
    const domain = window.location.origin;

    // about:blank、data: 等内联框架的 origin 是 "null"，没有可归属的站点
    if (!/^https?:\/\//.test(domain)) {
      noteDisabledReason = 'non-http';
      resolve(false);
      return;
    }
    try {
      chrome.storage.local.get(['disabledGlobal', 'disabledSites'], result => {
        if (chrome.runtime.lastError) {
          if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
            isExtensionInvalidated = true;
            teardownListeners();
          }
          noteDisabledReason = 'context-invalid';
          resolve(false);
          return;
        }

        // 检查全局禁用设置
        if (result.disabledGlobal) {
          noteDisabledReason = 'global-disabled';
          resolve(false);
          return;
        }

        // 检查当前网站是否在禁用列表中
        const disabledSites = result.disabledSites || [];
        if (disabledSites.includes(domain)) {
          noteDisabledReason = 'site-disabled';
          resolve(false);
          return;
        }

        // 检查会话禁用设置
        const sessionKey = `sessionDisabled_${domain}`;
        if (sessionStorage.getItem(sessionKey)) {
          noteDisabledReason = 'session-disabled';
          resolve(false);
          return;
        }
        noteDisabledReason = 'enabled';
        resolve(true);
      });
    } catch (error) {
      if (error.message?.includes('Extension context invalidated')) {
        isExtensionInvalidated = true;
        teardownListeners();
      }
      noteDisabledReason = 'context-invalid';
      resolve(false);
    }
  });
}

// 一键恢复当前站点的备注功能：清掉三类禁用（全局 / 站点 / 本会话）后重新初始化。
// 供扩展弹窗在「手动指定输入框」被禁用拦住时提供出路——
// 只提示「已禁用」而不给恢复入口，等于把问题转嫁给用户。
async function enableCurrentSite() {
  if (isExtensionInvalidated || !isExtensionContextValid()) {
    noteDisabledReason = 'context-invalid';
    return { ok: false, reason: noteDisabledReason };
  }
  const origin = window.location.origin;
  if (!/^https?:\/\//.test(origin)) {
    noteDisabledReason = 'non-http';
    return { ok: false, reason: noteDisabledReason };
  }

  // 会话禁用只存在于当前标签页，只有页面侧清得掉
  try {
    sessionStorage.removeItem(`sessionDisabled_${origin}`);
  } catch (error) {
    // 存储不可用时忽略，后续判定会反映真实状态
  }

  try {
    const result = await chrome.storage.local.get(['disabledGlobal', 'disabledSites']);
    const patch = {};
    if (result.disabledGlobal) patch.disabledGlobal = false;
    const sites = Array.isArray(result.disabledSites) ? result.disabledSites : [];
    if (sites.includes(origin)) {
      patch.disabledSites = sites.filter(item => item !== origin);
    }
    if (Object.keys(patch).length > 0) {
      await chrome.storage.local.set(patch);
    }
  } catch (error) {
    noteDisabledReason = 'context-invalid';
    return { ok: false, reason: noteDisabledReason };
  }

  noteEnabled = await shouldShowNote();
  if (noteEnabled) {
    await refreshAnchors();
    watchAnchorStorage();
    initAccountFields();
  }
  return { ok: noteEnabled, reason: noteDisabledReason };
}

// ===== 账号输入框监听 =====
// 不再逐个 input 绑定事件，改为在 document 上以捕获阶段做事件委托。
// 这样 SPA 延迟渲染、节点重建、局部替换都不会丢失监听，
// 也无需再向页面 DOM 写入任何标记属性。

// 取出事件的实际目标元素。
// composedPath()[0] 可穿透 Shadow DOM（event.target 会被重定向成宿主元素）。
function resolveEventTarget(event) {
  if (typeof event.composedPath === 'function') {
    const path = event.composedPath();
    if (path && path.length > 0) return path[0];
  }
  return event.target;
}

// 廉价的候选元素过滤，先排除掉绝大多数无关节点
function isCandidateInput(el) {
  return !!el && el.nodeType === 1 && el.tagName === 'INPUT' && typeof el.value === 'string';
}

// 聚焦账号框：已有内容时读取并展示备注
function onDelegatedFocusIn(event) {
  const field = resolveEventTarget(event);
  if (!isCandidateInput(field) || !isAccountField(field)) return;
  handleAccountFieldFocus(field);
}

// 在账号框输入：按字段防抖后读取并展示备注
function onDelegatedInput(event) {
  const field = resolveEventTarget(event);
  if (!isCandidateInput(field) || !isAccountField(field)) return;
  getFieldInputHandler(field)();
}

// 注册页面级监听（幂等）
function initAccountFields() {
  if (listenersRegistered) return;
  if (isExtensionInvalidated || !isExtensionContextValid()) {
    isExtensionInvalidated = true;
    return;
  }
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', initAccountFields, {
      once: true
    });
    return;
  }

  // 捕获阶段只做旁听：不调用 preventDefault / stopPropagation，
  // 宿主页面自身的事件流与默认行为完全不受影响。
  document.addEventListener('focusin', onDelegatedFocusIn, true);
  document.addEventListener('input', onDelegatedInput, true);
  // change 一并委托：浏览器自动填充后即便没有逐字输入也会触发，
  // 这样「已自动填好但未聚焦」的账号框也能被覆盖
  document.addEventListener('change', onDelegatedInput, true);
  listenersRegistered = true;
}

// iframe 场景：跳过尺寸过小或不可见的框架（广告、埋点、像素追踪等），
// 避免在每个小 iframe 里都白白注入一份监听
function isNegligibleFrame() {
  if (window.top === window.self) return false;
  return window.innerWidth < 200 || window.innerHeight < 200;
}

// 启动：content script 在 document_idle 注入，DOM 通常已就绪，直接初始化；
// 若仍在解析中则等 DOMContentLoaded，保证首屏一定会被扫到。
async function bootstrap() {
  if (isExtensionInvalidated || !isExtensionContextValid()) {
    isExtensionInvalidated = true;
    return;
  }
  if (isNegligibleFrame()) return;
  noteEnabled = await shouldShowNote();
  if (noteEnabled) {
    // 锚定记录先于事件监听就位，保证首个事件就能命中手动指定过的输入框
    await refreshAnchors();
    watchAnchorStorage();
    initAccountFields();
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, {
    once: true
  });
} else {
  bootstrap();
}

// 页面进入往返缓存时卸载监听，恢复时重新挂载
window.addEventListener('pagehide', teardownListeners);
window.addEventListener('pageshow', event => {
  if (event.persisted) bootstrap();
});

// 覆盖层挂载根：优先挂到 <html> 而非 <body>。
// 原因：position:fixed 的包含块会被祖先元素的 transform / filter / perspective /
// will-change 劫持——不少 SPA 会给 <body> 加这类属性（入场动画、布局技巧），
// 此时挂在 body 上的弹窗会以 body 为参照系而产生偏移。挂到 documentElement
// 可规避绝大多数此类场景（<html> 被加 transform 的情况极罕见）。
function getOverlayRoot() {
  return document.documentElement || document.body;
}

// 显示禁用选项菜单
function showDisableOptions(suggestion, field, closeBtn) {
  // 移除可能已存在的菜单
  const existingMenu = document.querySelector('.disable-options-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  const domain = window.location.origin;
  const disableMenu = document.createElement('div');
  disableMenu.className = 'disable-options-menu';
  disableMenu.innerHTML = `
    <div class="disable-option" data-action="session">
      ${getMessage('disableSession') || '在本次会话中禁用'}
    </div>
    <div class="disable-option" data-action="site">
      ${getMessage('disableSite') || '在此网站上禁用'}
    </div>
    <div class="disable-option" data-action="global">
      ${getMessage('disableGlobal') || '在所有网站上禁用'}
    </div>
  `;

  // 将菜单添加到覆盖层根而不是 body，以避免 body 带 transform 时的定位偏移
  getOverlayRoot().appendChild(disableMenu);

  // 定位菜单到关闭按钮附近
  const closeBtnRect = closeBtn.getBoundingClientRect();
  disableMenu.style.position = 'fixed';
  disableMenu.style.top = `${closeBtnRect.bottom + 5}px`;
  disableMenu.style.left = `${closeBtnRect.left}px`;

  // 确保菜单不超出视口
  const menuRect = disableMenu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  if (menuRect.right > viewportWidth) {
    disableMenu.style.left = `${viewportWidth - menuRect.width - 10}px`;
  }
  if (menuRect.bottom > viewportHeight) {
    disableMenu.style.top = `${closeBtnRect.top - menuRect.height - 5}px`;
  }

  // 添加悬停事件 - 鼠标在菜单上时保持显示
  let menuHideTimeout = null;
  disableMenu.addEventListener('mouseenter', () => {
    if (menuHideTimeout) {
      clearTimeout(menuHideTimeout);
      menuHideTimeout = null;
    }
  });
  disableMenu.addEventListener('mouseleave', () => {
    menuHideTimeout = setTimeout(() => {
      disableMenu.remove();
    }, 100);
  });

  // 添加选项点击事件
  const options = disableMenu.querySelectorAll('.disable-option');
  options.forEach(option => {
    option.addEventListener('click', () => {
      const action = option.dataset.action;
      switch (action) {
        case 'session':
          // 仅在当前会话中禁用
          sessionStorage.setItem(`sessionDisabled_${domain}`, 'true');
          showToast(getMessage('sessionDisabled') || '已在本次会话中禁用备注功能');
          break;
        case 'site':
          // 在当前网站禁用
          try {
            chrome.storage.local.get(['disabledSites'], result => {
              if (chrome.runtime.lastError) {
                if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
                  isExtensionInvalidated = true;
                  teardownListeners();
                }
                return;
              }
              const disabledSites = result.disabledSites || [];
              if (!disabledSites.includes(domain)) {
                disabledSites.push(domain);
                chrome.storage.local.set({
                  disabledSites
                }, () => {
                  if (chrome.runtime.lastError) {
                    if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
                      isExtensionInvalidated = true;
                      teardownListeners();
                    }
                    return;
                  }
                  showToast(getMessage('siteDisabled') || '已在此网站上禁用备注功能');
                });
              }
            });
          } catch (error) {
            if (error.message?.includes('Extension context invalidated')) {
              isExtensionInvalidated = true;
              teardownListeners();
            }
          }
          break;
        case 'global':
          // 全局禁用
          try {
            chrome.storage.local.set({
              disabledGlobal: true
            }, () => {
              if (chrome.runtime.lastError) {
                if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
                  isExtensionInvalidated = true;
                  teardownListeners();
                }
                return;
              }
              showToast(getMessage('globalDisabled') || '已在所有网站上禁用备注功能');
            });
          } catch (error) {
            if (error.message?.includes('Extension context invalidated')) {
              isExtensionInvalidated = true;
              teardownListeners();
            }
          }
          break;
      }

      // 移除备注弹窗和禁用选项菜单
      disableMenu.remove();
      destroySuggestion(suggestion);
    });
  });
}

// 添加防抖函数
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// 记录上一次的字段值，用于比较是否真正变化
const lastFieldValues = new WeakMap();

// 每个输入框各自持有一个防抖后的 input 处理器
const fieldInputHandlers = new WeakMap();
function getFieldInputHandler(field) {
  let handler = fieldInputHandlers.get(field);
  if (!handler) {
    handler = debounce(() => handleAccountFieldInput(field), 300);
    fieldInputHandlers.set(field, handler);
  }
  return handler;
}

// 读取备注数据并展示（统一的 storage 出口）
function loadNoteForField(field) {
  if (isExtensionInvalidated || !isExtensionContextValid()) {
    isExtensionInvalidated = true;
    return;
  }
  try {
    chrome.storage.local.get([getFieldKey(field)], result => {
      if (chrome.runtime.lastError) {
        if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
          isExtensionInvalidated = true;
          teardownListeners();
        }
        return;
      }
      // 无论是否有备注，都使用同一个展示方式
      showAccountNote(field, result[getFieldKey(field)]);
    });
  } catch (error) {
    if (error.message?.includes('Extension context invalidated')) {
      isExtensionInvalidated = true;
      teardownListeners();
    }
  }
}

// 聚焦账号框：仅当输入框已有内容时才展示备注
async function handleAccountFieldFocus(field) {
  if (isExtensionInvalidated || !isExtensionContextValid()) {
    isExtensionInvalidated = true;
    return;
  }

  // 空值时不做任何事，避免无谓的 storage 读取
  if (!field.value.trim()) return;
  if (!(await shouldShowNote())) return;
  lastFieldValues.set(field, field.value.trim());
  loadNoteForField(field);
}

// 账号框输入：值真正变化时刷新弹窗，清空时移除弹窗
async function handleAccountFieldInput(field) {
  if (isExtensionInvalidated || !isExtensionContextValid()) {
    isExtensionInvalidated = true;
    return;
  }
  const currentValue = field.value.trim();

  // 输入框被清空：只移除本字段的备注框
  if (!currentValue) {
    destroySuggestion(getSuggestionFor(field));
    lastFieldValues.delete(field);
    return;
  }

  // 值没有真正变化时不做处理
  if (currentValue === (lastFieldValues.get(field) || '')) return;
  if (!(await shouldShowNote())) return;
  lastFieldValues.set(field, currentValue);
  loadNoteForField(field);
}

// 修改其他使用 chrome.storage 的函数

// 更新弹窗位置

// 添加获取消息的辅助函数
function getMessage(key, substitutions = null) {
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n) {
      return chrome.i18n.getMessage(key, substitutions) || getDefaultMessage(key);
    }
    return getDefaultMessage(key);
  } catch (error) {
    console.error('Error getting message:', error);
    return getDefaultMessage(key);
  }
}

// 添加默认消息函数，确保即使i18n API不可用也能显示文本
function getDefaultMessage(key) {
  // 检测当前浏览器语言，默认为英文
  const browserLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
  const isChinese = browserLang.startsWith('zh');

  // 根据语言提供不同的默认消息
  const defaultMessages = isChinese ? {
    'addNote': '添加备注',
    'editNote': '编辑备注',
    'toggleText': '切换显示',
    'expand': '展开',
    'collapse': '收起',
    'errorEmptyNote': '备注内容不能为空',
    'errorEmptyUsername': '用户名不能为空',
    'errorStorageAPI': '存储API不可用',
    'errorReadData': '读取数据失败',
    'errorSaveData': '保存数据失败',
    'successNoteSaved': '备注已保存'
  } : {
    'addNote': 'Add Note',
    'editNote': 'Edit Note',
    'toggleText': 'Toggle Display',
    'expand': 'Expand',
    'collapse': 'Collapse',
    'errorEmptyNote': 'Note content cannot be empty',
    'errorEmptyUsername': 'Username cannot be empty',
    'errorStorageAPI': 'Storage API is not available',
    'errorReadData': 'Failed to read data',
    'errorSaveData': 'Failed to save data',
    'successNoteSaved': 'Note saved'
  };
  return defaultMessages[key] || key;
}


// 生成输入框的唯一标识
function getFieldKey(field) {
  const domain = window.location.origin;
  const username = field.value.trim(); // 添加 trim 以保持一致性
  console.log('[getFieldKey] 生成 key:', {
    domain,
    username,
    key: `${domain}_${username}`
  });
  return `${domain}_${username}`;
}

// 账号输入框可能使用的 type。省略 type 的 input，DOM 上读出来就是 'text'，
// 因此「不写 type」的写法天然被覆盖。
const USERNAME_INPUT_TYPES = ['text', 'email', 'tel'];

// 正向关键词：命中任意一个即加分（含中文）。不再作为硬门槛——
// 无线索的裸账号框改由「登录表单结构」信号救回。
const USERNAME_KEYWORDS = ['user', 'uname', 'login', 'signin', 'account', 'acct', 'email', 'mail', 'identifier', 'uid', 'member', 'mobile', 'phone', 'card', 'name', '账号', '帐号', '账户', '帐户', '用户名', '用户', '登录', '登陆', '邮箱', '邮件', '手机', '电话', '号码', '身份证', '证件', '学号', '工号', '会员'];

// 反向关键词：命中即重扣分（避免在密码 / 验证码 / 搜索框上误弹）。
// 用扣分而非直接否决，是为了让「属性里恰好含 search 字样」的账号框
// 仍有机会被登录表单结构信号纠正回来。
const NON_USERNAME_KEYWORDS = ['password', 'passwd', 'pwd', 'captcha', 'verification', 'verify', 'sms', 'otp', 'search', 'keyword', 'query', '密码', '验证码', '校验码', '短信', '搜索', '关键词'];

// 收集与输入框相关的文本线索：自身属性 + 显式关联的 label 文本。
// 刻意不去抓「父容器整段文本」——那会把同一表单里的密码框一并误判成账号框。
function getFieldTextHints(field) {
  const hints = [field.id, field.name, field.placeholder, field.getAttribute('aria-label'), field.getAttribute('autocomplete'), field.getAttribute('data-testid'), field.getAttribute('data-field'), field.getAttribute('title'), typeof field.className === 'string' ? field.className : ''];

  // <label for="..."> 或包裹式 <label>
  try {
    if (field.labels) {
      Array.from(field.labels).forEach(label => hints.push(label.textContent));
    }
  } catch (error) {
    // 忽略无法访问 labels 的场景
  }

  // aria-labelledby 指向元素的文本
  const labelledBy = field.getAttribute('aria-labelledby');
  if (labelledBy) {
    labelledBy.split(/\s+/).forEach(id => {
      if (!id) return;
      const el = document.getElementById(id);
      if (el) hints.push(el.textContent);
    });
  }
  return hints.filter(hint => typeof hint === 'string' && hint.trim()).map(hint => hint.toLowerCase());
}

// ===== 账号框识别：登录表单锚定 + 多信号评分 =====
// 设计依据（密码管理器同款思路）：不要孤立地看「这个框像不像账号框」，
// 而要结合「它是否位于一个登录表单中、相对密码框的位置」来判断。
// 任何单一信号都不可靠——实测证据见 document/progress.md：
//   · GitHub：autocomplete="username" 足以单独命中
//   · dcps（choerodon-ui）：密码框前有反 autofill 蜜罐框（无 id/name + tabindex=-1），
//     纯「取密码框前最近文本框」会选错，必须靠蜜罐否决 + 关键词加分共同兜底

// 判定阈值：达到即认为是账号框
const ACCOUNT_FIELD_THRESHOLD = 20;

// 表单结构缓存时长。SPA 重渲染可能后置插入密码框，
// 因此对有 form 的场景做短 TTL 缓存，兼顾性能与新鲜度。
const FORM_CONTEXT_TTL = 2000;
const formContextCache = new WeakMap();

// 元素是否真实可见（用于排除隐藏框与蜜罐框）。
// 不用 offsetParent 判断：它对 position:fixed 元素恒为 null，会误杀。
function isVisibleInput(el) {
  if (el.hidden || el.disabled) return false;
  if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) return false;
  try {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (parseFloat(style.opacity) === 0) return false;
  } catch (error) {
    // 计算样式不可用时按可见处理，避免误杀
  }
  return true;
}

// 蜜罐/装饰框识别：前端框架为对抗自动填充会插入不可聚焦的诱饵输入框。
// 这类框必须一票否决，否则会抢走「离密码框最近」的结构信号。
// 只认客观特征，不因「无 id/name」就否决——真正的裸账号框要靠结构信号救回。
function isDecoyInput(el) {
  if (el.getAttribute('tabindex') === '-1') return true;
  if (el.getAttribute('aria-hidden') === 'true') return true;
  // 只读框用户无法输入账号，不适合作为备注锚点
  if (el.readOnly) return true;
  return false;
}

// 判断 a 是否在 DOM 顺序上位于 b 之前
function isBeforeInDom(a, b) {
  if (!a || !b || a === b) return false;
  return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

// 收集表单上下文：作用域内是否存在可见密码框，以及密码框之前最靠近它的候选框。
// 作用域优先取 input 所属的 <form>；SPA 常不用 form 元素，此时退化为文档级。
function collectFormContext(scope) {
  const passwordInputs = Array.from(scope.querySelectorAll('input[type="password"]')).filter(isVisibleInput);
  const firstPassword = passwordInputs[0] || null;

  // 密码框之前最近的「有身份标识」的候选文本框，作为结构信号的锚点
  let closestCandidate = null;
  if (firstPassword) {
    const allInputs = Array.from(scope.querySelectorAll('input'));
    const boundary = allInputs.indexOf(firstPassword);
    for (let i = boundary - 1; i >= 0; i -= 1) {
      const candidate = allInputs[i];
      const candidateType = (candidate.type || 'text').toLowerCase();
      if (!USERNAME_INPUT_TYPES.includes(candidateType)) continue;
      if (!isVisibleInput(candidate) || isDecoyInput(candidate)) continue;
      closestCandidate = candidate;
      break;
    }
  }

  return {
    hasPassword: passwordInputs.length > 0,
    firstPassword,
    closestCandidate,
    cachedAt: Date.now()
  };
}

// 取（并缓存）输入框所处的表单上下文
// 文档级上下文（页面无 <form> 时）用时间戳短缓存，避免超大页面每次事件都全量查询
let documentContextCache = null;
function getFormContext(input) {
  if (input.form) {
    const cached = formContextCache.get(input.form);
    if (cached && Date.now() - cached.cachedAt < FORM_CONTEXT_TTL) return cached;
    const context = collectFormContext(input.form);
    formContextCache.set(input.form, context);
    return context;
  }

  if (documentContextCache && Date.now() - documentContextCache.cachedAt < FORM_CONTEXT_TTL) {
    return documentContextCache;
  }
  documentContextCache = collectFormContext(document);
  return documentContextCache;
}

// 打分：返回 { score, reasons }。一票否决直接返回 -Infinity。
// 分值表（与方案文档一致）：
//   一票否决  不可见 / tabindex=-1 / aria-hidden
//   −50      反向关键词（密码、验证码、搜索…）
//   +40      autocomplete 标注为 username / email（标准强信号）
//   +35      所在表单含可见密码框，且本框位于密码框之前（登录表单结构）
//   +30      type="email"
//   +15      正向关键词命中（id/name/placeholder/label/aria… 任一）
//   +10      同一结构内离密码框最近的候选
//   +5       有 placeholder 或关联 label（可交互性强）
function scoreAsAccountField(input) {
  const veto = reason => ({ score: -Infinity, reasons: [`否决：${reason}`] });

  if (!input || input.tagName !== 'INPUT') return veto('非 input 元素');
  const type = (input.type || 'text').toLowerCase();
  if (!USERNAME_INPUT_TYPES.includes(type)) return veto(`type=${type} 不在候选范围内`);
  if (!isVisibleInput(input)) return veto('不可见');
  if (isDecoyInput(input)) return veto('蜜罐/装饰框特征');
  if (input.getAttribute('aria-hidden') === 'true') return veto('aria-hidden');

  const reasons = [];
  let score = 0;

  const hints = getFieldTextHints(input);
  const joined = hints.join(' ');
  const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();

  // 反向关键词：重扣分而非直接否决，保证「误伤可被结构信号纠正」
  // （例如 class 名里恰好含 search 字样的账号框）
  const negativeHits = NON_USERNAME_KEYWORDS.filter(keyword => joined.includes(keyword));
  if (negativeHits.length > 0) {
    score -= 50;
    reasons.push(`-50 反向关键词（${negativeHits.join(', ')}）`);
  }

  if (autocomplete.indexOf('username') !== -1 || autocomplete === 'email') {
    score += 40;
    reasons.push(`+40 autocomplete=${autocomplete}`);
  }
  if (type === 'email') {
    score += 30;
    reasons.push('+30 type=email');
  }

  const context = getFormContext(input);
  if (context.hasPassword && isBeforeInDom(input, context.firstPassword)) {
    score += 35;
    reasons.push('+35 位于登录表单密码框之前');
  }
  if (context.closestCandidate === input) {
    score += 10;
    reasons.push('+10 离密码框最近的候选框');
  }

  const positiveHits = USERNAME_KEYWORDS.filter(keyword => joined.includes(keyword));
  if (positiveHits.length > 0) {
    score += 15;
    reasons.push(`+15 正向关键词（${positiveHits.slice(0, 3).join(', ')}）`);
  }

  const hasLabel = (() => {
    try {
      return !!(input.placeholder || (input.labels && input.labels.length));
    } catch (error) {
      return !!input.placeholder;
    }
  })();
  if (hasLabel) {
    score += 5;
    reasons.push('+5 有 placeholder / label');
  }

  return { score, reasons };
}

// ===== 手动锚定记忆 =====
// 评分引擎本质是「猜」：总存在既无关键词线索、又无登录表单结构信号的孤立输入框。
// 锚定记忆让用户手动指定一次，此后该框直接命中——把识别系统从
// 「一次性猜测」升级为「可被纠正的猜测」。
//
// 存储结构（key: fieldAnchors，按 origin 分组）：
//   { "https://example.com": [ { id, name, placeholder, type, nth, createTime } ] }
// 匹配按标识强度降级：id > name > placeholder > 可见候选序号（仅限完全无标识的裸框）
const ANCHOR_STORAGE_KEY = 'fieldAnchors';

// 当前 origin 的锚定记录（同步快照，供事件处理路径零成本查询）
let anchorList = [];

// 拉取当前站点的锚定记录到内存快照
function refreshAnchors() {
  const origin = window.location.origin;
  if (!isExtensionContextValid()) return Promise.resolve();
  if (!/^https?:\/\//.test(origin)) return Promise.resolve();
  return new Promise(resolve => {
    try {
      chrome.storage.local.get([ANCHOR_STORAGE_KEY], result => {
        if (chrome.runtime.lastError) {
          resolve();
          return;
        }
        const all = result ? result[ANCHOR_STORAGE_KEY] : null;
        const list = all && typeof all === 'object' ? all[origin] : null;
        anchorList = Array.isArray(list) ? list.slice() : [];
        resolve();
      });
    } catch (error) {
      resolve();
    }
  });
}

// 存储变更：其他标签页锚定/取消锚定后，本页立即同步
function onAnchorStorageChanged(changes, areaName) {
  if (areaName !== 'local' || !changes || !changes[ANCHOR_STORAGE_KEY]) return;
  refreshAnchors();
}

function watchAnchorStorage() {
  if (storageListenerRegistered) return;
  if (!isExtensionContextValid() || !chrome.storage || !chrome.storage.onChanged) return;
  try {
    chrome.storage.onChanged.addListener(onAnchorStorageChanged);
    storageListenerRegistered = true;
  } catch (error) {
    // 忽略注册失败，退化为本页内锚定即时生效
  }
}

// 作用域内的可见候选框（与评分引擎的候选范围保持一致）
function collectVisibleCandidates(scope) {
  return Array.from(scope.querySelectorAll('input')).filter(el => {
    const type = (el.type || 'text').toLowerCase();
    return USERNAME_INPUT_TYPES.includes(type) && isVisibleInput(el);
  });
}

// 候选框在可见序列中的序号——仅用于「无任何标识的裸框」的降级匹配
function getCandidateIndex(input) {
  return collectVisibleCandidates(input.form || document).indexOf(input);
}

// 锚定匹配：命中返回锚定记录，未命中返回 null。
// 锚定是用户的硬指令，但仍保留「可见」这一基础前提——页面把框藏起来时不再打扰。
function matchAnchor(input) {
  if (!anchorList || anchorList.length === 0) return null;
  if (!isVisibleInput(input)) return null;
  const type = (input.type || 'text').toLowerCase();
  if (!USERNAME_INPUT_TYPES.includes(type)) return null;

  let fallback = null;
  for (const anchor of anchorList) {
    if (!anchor || typeof anchor !== 'object') continue;
    if (anchor.id && input.id && anchor.id === input.id) return anchor;
    if (anchor.name && input.name && anchor.name === input.name) return anchor;
    if (anchor.placeholder && input.placeholder && anchor.placeholder === input.placeholder) return anchor;
    // 弱兜底：锚定时该框本身就无任何标识，只能靠序号
    if (!anchor.id && !anchor.name && !anchor.placeholder && typeof anchor.nth === 'number' && !fallback) {
      fallback = anchor;
    }
  }

  if (fallback && getCandidateIndex(input) === fallback.nth) return fallback;
  return null;
}

// 为输入框生成锚定指纹
function buildAnchorDescriptor(field) {
  const candidates = collectVisibleCandidates(field.form || document);
  return {
    id: field.id || '',
    name: field.name || '',
    placeholder: field.placeholder || '',
    type: (field.type || 'text').toLowerCase(),
    nth: candidates.indexOf(field),
    createTime: new Date().toISOString()
  };
}

// 写入一条锚定记录（同指纹幂等），并同步内存快照
async function saveAnchor(descriptor) {
  const origin = window.location.origin;
  const result = await chrome.storage.local.get([ANCHOR_STORAGE_KEY]);
  const raw = result ? result[ANCHOR_STORAGE_KEY] : null;
  const all = raw && typeof raw === 'object' ? { ...raw } : {};
  const list = Array.isArray(all[origin]) ? all[origin].slice() : [];
  const duplicated = list.some(anchor =>
    anchor &&
    anchor.id === descriptor.id &&
    anchor.name === descriptor.name &&
    anchor.placeholder === descriptor.placeholder &&
    anchor.type === descriptor.type
  );
  if (!duplicated) list.push(descriptor);
  all[origin] = list;
  await chrome.storage.local.set({ [ANCHOR_STORAGE_KEY]: all });
  anchorList = list;
  return { duplicated, count: list.length };
}

// ===== 拾取模式 =====
// 入口在扩展工具栏弹窗（始终可达）；页面侧负责高亮候选框并处理点击。
const PICKER_REPOSITION_INTERVAL = 200;
let pickerState = null;

// 进入拾取模式。返回是否成功进入（供 popup 决定是否关闭自己）。
// 进入拾取模式。返回结构化结果 { ok, reason }——
// 调用方（扩展弹窗）要据此区分「连接不上」与「页面侧拒绝」，才能给出不同出路。
function startFieldPicker() {
  if (pickerState) return { ok: true, reason: 'already-active' };
  if (isExtensionInvalidated || !isExtensionContextValid()) {
    noteDisabledReason = 'context-invalid';
    showToast(getMessage('pickerConnectFailed') || '无法连接当前页面，请刷新页面后重试', 'error');
    return { ok: false, reason: noteDisabledReason };
  }
  if (!noteEnabled) {
    // 区分「全局禁用」与「本站点禁用」：原实现把两者统一说成全局禁用，误导用户
    const isGlobal = noteDisabledReason === 'global-disabled';
    showToast(
      isGlobal
        ? getMessage('globalDisabled') || '已在所有网站上禁用备注功能'
        : getMessage('siteDisabledNote') || '本站点已禁用备注功能',
      'error'
    );
    return { ok: false, reason: noteDisabledReason };
  }

  const candidates = collectVisibleCandidates(document);
  if (candidates.length === 0) {
    showToast(getMessage('pickerNoCandidates') || '当前页面没有可锚定的输入框', 'error');
    return { ok: false, reason: 'no-candidates' };
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const themeAttr = prefersDark ? 'dark' : 'light';

  const container = document.createElement('div');
  container.className = 'account-note-picker';

  const banner = document.createElement('div');
  banner.className = 'account-note-picker-banner';
  banner.setAttribute('data-theme', themeAttr);

  const bannerText = document.createElement('div');
  bannerText.className = 'account-note-picker-banner-text';
  const bannerTitle = document.createElement('span');
  bannerTitle.className = 'account-note-picker-title';
  bannerTitle.textContent = getMessage('pickerBannerTitle') || '点击要锚定的输入框';
  const bannerDesc = document.createElement('span');
  bannerDesc.className = 'account-note-picker-desc';
  bannerDesc.textContent = getMessage('pickerBannerDesc') || '锚定后该输入框会始终显示备注弹窗，按 Esc 退出';
  bannerText.appendChild(bannerTitle);
  bannerText.appendChild(bannerDesc);

  const exitBtn = document.createElement('button');
  exitBtn.type = 'button';
  exitBtn.className = 'account-note-picker-exit';
  exitBtn.textContent = getMessage('pickerExit') || '退出';
  exitBtn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    exitFieldPicker();
  });

  banner.appendChild(bannerText);
  banner.appendChild(exitBtn);
  container.appendChild(banner);

  const highlights = candidates.map((field, index) => {
    const box = document.createElement('div');
    box.className = 'account-note-picker-highlight';
    box.setAttribute('data-theme', themeAttr);
    const badge = document.createElement('span');
    badge.className = 'account-note-picker-badge';
    badge.textContent = String(index + 1);
    box.appendChild(badge);
    box.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      handlePick(field);
    });
    container.appendChild(box);
    return box;
  });

  getOverlayRoot().appendChild(container);

  // 视口变化时重算位置：滚动、缩放、SPA 布局动画都覆盖到
  const reposition = () => {
    if (!pickerState) return;
    highlights.forEach((box, index) => {
      const field = candidates[index];
      if (!field || !field.isConnected) {
        box.style.display = 'none';
        return;
      }
      const rect = field.getBoundingClientRect();
      const offscreen =
        rect.width === 0 ||
        rect.height === 0 ||
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth;
      if (offscreen) {
        box.style.display = 'none';
        return;
      }
      box.style.display = 'block';
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
    });
  };

  const keyHandler = event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    exitFieldPicker();
  };

  document.addEventListener('keydown', keyHandler, true);
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  const repositionTimer = window.setInterval(reposition, PICKER_REPOSITION_INTERVAL);

  pickerState = { container, candidates, highlights, reposition, repositionTimer, keyHandler };
  reposition();
  return { ok: true, reason: 'started' };
}

// 退出拾取模式，彻底清理注入到宿主页面的元素与监听
function exitFieldPicker() {
  if (!pickerState) return;
  const { container, reposition, repositionTimer, keyHandler } = pickerState;
  window.clearInterval(repositionTimer);
  document.removeEventListener('keydown', keyHandler, true);
  window.removeEventListener('scroll', reposition, true);
  window.removeEventListener('resize', reposition);
  if (container && container.parentNode) container.remove();
  pickerState = null;
}

// 点击候选框：写入锚定并退出
async function handlePick(field) {
  const descriptor = buildAnchorDescriptor(field);
  exitFieldPicker();
  try {
    const { duplicated } = await saveAnchor(descriptor);
    showToast(
      duplicated
        ? getMessage('pickerAlreadyAnchored') || '该输入框已锚定'
        : getMessage('pickerSaved') || '已锚定该输入框，输入账号即可看到备注',
      'success'
    );
  } catch (error) {
    showToast(getMessage('errorSaveData') || '保存数据失败', 'error');
  }
}

// 对外接口：该输入框是否为需要展示备注的账号框。
// 锚定优先于评分——用户明确指定过的框不看分数。
function isAccountField(input) {
  if (matchAnchor(input)) return true;
  return scoreAsAccountField(input).score >= ACCOUNT_FIELD_THRESHOLD;
}
// 按字段维护弹窗：同页多个账号框各管各的，不会互相顶掉
const suggestionByField = new WeakMap();
function getSuggestionFor(field) {
  const el = suggestionByField.get(field);
  return el && el.isConnected ? el : null;
}

// 销毁一个弹窗。元素级监听随元素移除自动失效，只需解绑挂在 document 上的
function destroySuggestion(suggestion) {
  if (!suggestion) return;
  if (suggestion.outsideClickHandler) {
    document.removeEventListener('click', suggestion.outsideClickHandler);
  }
  suggestion.remove();
}

// 同一时刻只保留一个备注弹窗，收掉其他字段的
function closeOtherSuggestions(field) {
  document.querySelectorAll('.account-note-suggestion').forEach(el => {
    if (suggestionByField.get(field) === el) return;
    destroySuggestion(el);
  });
}
function showAccountNote(field, noteData) {
  const existingSuggestion = getSuggestionFor(field);

  // 本字段的弹窗已存在且内容没变：直接复用，不重建，避免闪烁
  if (existingSuggestion) {
    const existingText = existingSuggestion.querySelector('.note-text-readonly');
    const existingNote = existingText ? (existingText.dataset.fullText || '') : '';
    const newNote = noteData ? (noteData.note || '') : '';
    if (existingNote === newNote) {
      existingSuggestion.style.display = 'block';
      existingSuggestion.classList.add('show');
      return;
    }
    destroySuggestion(existingSuggestion);
  }

  // 切换到另一个账号框前，先收掉别的弹窗
  closeOtherSuggestions(field);

  // HTML 转义
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    const escaped = div.innerHTML;
    div.remove();
    return escaped;
  }

  const hasNote = !!(noteData && noteData.note);
  const note = hasNote ? noteData.note : '';
  const hostname = window.location.hostname;

  const suggestion = document.createElement('div');
  suggestion.className = 'account-note-suggestion';

  // 主题跟随系统（与 Chrome 原生 UI 口径一致，不探测站点配色）
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  suggestion.setAttribute('data-theme', prefersDark ? 'dark' : 'light');

  const favTitle = hasNote
    ? (noteData.isFavorite ? getMessage('removeFavorite') : getMessage('addFavorite'))
    : getMessage('addFavorite');

  suggestion.innerHTML = `
    <div class="note-header">
      <span class="note-domain-dot" aria-hidden="true"></span>
      <span class="note-domain">${escapeHtml(hostname)}</span>
      <button type="button" class="note-header-btn favorite-btn ${noteData?.isFavorite ? 'is-favorite' : ''}" ${hasNote ? '' : 'disabled'} title="${escapeHtml(favTitle)}">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="currentColor"/></svg>
      </button>
      <button type="button" class="note-header-btn close-btn" title="${escapeHtml(getMessage('close'))}">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>
      </button>
    </div>
    <div class="note-body">
      <div class="note-text-readonly ${hasNote ? '' : 'empty-note'}" data-full-text="${escapeHtml(note)}">${hasNote ? escapeHtml(note) : escapeHtml(getMessage('addNote'))}</div>
      <textarea class="note-text-edit" hidden rows="3" placeholder="${escapeHtml(getMessage('addNote'))}"></textarea>
    </div>
    <div class="note-tags-row">
      <div class="note-tags-container">
        ${noteData?.tags?.map(tag => `<span class="note-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}<span class="tag-remove">×</span></span>`).join('') || ''}
      </div>
      <button type="button" class="add-tag-btn" title="${escapeHtml(getMessage('addTag') || '添加标签')}">${escapeHtml(getMessage('addTag') || '+ 标签')}</button>
      <input type="text" class="note-tag-input" hidden placeholder="${escapeHtml(getMessage('addTagPlaceholder') || '添加标签，按回车确认')}" />
    </div>
  `;

  // 定位：先挂载（不可见）再实测尺寸，用真实宽高做翻转与夹紧，替代旧的 260/270 魔数。
  // 位置原则：弹窗是辅助角色，字段下方留给浏览器原生密码管理器，我们出现在右侧。
  suggestion.style.position = 'fixed';
  suggestion.style.visibility = 'hidden';
  getOverlayRoot().appendChild(suggestion);
  suggestionByField.set(field, suggestion);

  const fieldRect = field.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const popupRect = suggestion.getBoundingClientRect();
  const popupWidth = Math.ceil(popupRect.width);
  const popupHeight = Math.ceil(popupRect.height);

  // 默认字段右侧（间距 8px）；右侧放不下翻到左侧；两侧都放不下则夹紧在视口内
  let left = fieldRect.right + 8;
  if (left + popupWidth > viewportWidth - 8) {
    left = fieldRect.left - popupWidth - 8;
  }
  left = Math.max(8, Math.min(left, viewportWidth - popupWidth - 8));

  // 垂直方向：顶部与字段对齐，底部越界则整体上移夹紧
  let top = fieldRect.top;
  if (top + popupHeight > viewportHeight - 8) {
    top = viewportHeight - popupHeight - 8;
  }
  top = Math.max(8, top);

  suggestion.style.top = `${Math.round(top)}px`;
  suggestion.style.left = `${Math.round(left)}px`;
  suggestion.style.visibility = '';

  // —— 头部行：收藏 / 关闭 ——
  const favoriteBtn = suggestion.querySelector('.favorite-btn');
  favoriteBtn.addEventListener('click', async e => {
    e.stopPropagation();
    const key = getFieldKey(field);
    try {
      const result = await chrome.storage.local.get([key]);
      const currentData = result[key];
      if (!currentData) return;
      const next = !currentData.isFavorite;
      await chrome.storage.local.set({
        [key]: {
          ...currentData,
          isFavorite: next,
          favoriteTime: next ? new Date().toISOString() : null
        }
      });
      favoriteBtn.classList.toggle('is-favorite', next);
      favoriteBtn.title = next ? getMessage('removeFavorite') : getMessage('addFavorite');
      showToast(getMessage(next ? 'addedToFavorites' : 'removedFromFavorites'));
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  });

  const closeBtn = suggestion.querySelector('.close-btn');

  // —— 正文行：点击进入编辑态；Enter/失焦保存，Esc 取消 ——
  const readonlyText = suggestion.querySelector('.note-text-readonly');
  const editInput = suggestion.querySelector('.note-text-edit');
  let suppressBlurSave = false;

  function renderReadonly(text) {
    readonlyText.dataset.fullText = text;
    if (text) {
      readonlyText.textContent = text;
      readonlyText.classList.remove('empty-note');
    } else {
      readonlyText.textContent = getMessage('addNote');
      readonlyText.classList.add('empty-note');
    }
  }

  function saveNote(newNote) {
    const domain = window.location.origin;
    const username = field.value.trim();
    const key = getFieldKey(field);

    chrome.storage.local.get([key], result => {
      if (chrome.runtime.lastError) {
        if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
          isExtensionInvalidated = true;
          teardownListeners();
        }
        return;
      }
      const recordData = {
        key: key,
        note: newNote,
        createTime: result[key]?.createTime || new Date().toISOString(),
        updateTime: new Date().toISOString(),
        domain: domain,
        username: username,
        tags: result[key]?.tags || [],
        isFavorite: result[key]?.isFavorite || false,
        favoriteTime: result[key]?.favoriteTime || null
      };
      chrome.storage.local.set({ [key]: recordData }, () => {
        if (chrome.runtime.lastError) {
          if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
            isExtensionInvalidated = true;
            teardownListeners();
          }
          return;
        }
        renderReadonly(newNote);
        showToast(getMessage('successNoteSaved'));
        favoriteBtn.disabled = false;
      });
    });
  }

  function exitEdit(save) {
    if (editInput.hidden) return;
    editInput.hidden = true;
    readonlyText.hidden = false;

    const currentText = readonlyText.dataset.fullText || '';
    if (!save) {
      renderReadonly(currentText);
      return;
    }
    const newNote = editInput.value.trim();
    // 内容未变或被清空：不落库（与旧版一致，不支持清空备注，标签数据得以保留）
    if (!newNote || newNote === currentText) {
      renderReadonly(currentText);
      return;
    }
    saveNote(newNote);
  }

  readonlyText.clickHandler = () => {
    const username = field.value.trim();
    if (!username) {
      showToast(getMessage('errorEmptyUsername'));
      return;
    }
    editInput.value = readonlyText.dataset.fullText || '';
    readonlyText.hidden = true;
    editInput.hidden = false;
    editInput.focus();
    editInput.selectionStart = editInput.selectionEnd = editInput.value.length;
  };
  readonlyText.addEventListener('click', readonlyText.clickHandler);

  editInput.keydownHandler = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      exitEdit(true);
    } else if (e.key === 'Escape') {
      suppressBlurSave = true;
      exitEdit(false);
    }
  };
  editInput.addEventListener('keydown', editInput.keydownHandler);

  editInput.blurHandler = () => {
    if (!editInput.hidden && !suppressBlurSave) {
      exitEdit(true);
    }
    suppressBlurSave = false;
  };
  editInput.addEventListener('blur', editInput.blurHandler);

  // 添加关闭按钮悬停事件
  let menuHideTimeout = null;
  closeBtn.addEventListener('mouseenter', () => {
    // 清除隐藏的定时器
    if (menuHideTimeout) {
      clearTimeout(menuHideTimeout);
      menuHideTimeout = null;
    }
    showDisableOptions(suggestion, field, closeBtn);
  });
  closeBtn.addEventListener('mouseleave', e => {
    // 延迟隐藏，给用户时间移动到菜单
    menuHideTimeout = setTimeout(() => {
      const disableMenu = document.querySelector('.disable-options-menu');
      if (disableMenu && !disableMenu.matches(':hover')) {
        disableMenu.remove();
      }
    }, 150);
  });

  // 标签输入功能：＋标签按钮原地切换为行内输入框，不新增行
  const addTagBtn = suggestion.querySelector('.add-tag-btn');
  const tagInput = suggestion.querySelector('.note-tag-input');
  const tagsContainer = suggestion.querySelector('.note-tags-container');
  if (addTagBtn && tagInput) {
    const collapseTagInput = () => {
      tagInput.value = '';
      tagInput.hidden = true;
      addTagBtn.hidden = false;
    };
    addTagBtn.addEventListener('click', e => {
      e.stopPropagation();
      addTagBtn.hidden = true;
      tagInput.hidden = false;
      tagInput.focus();
    });

    // 处理标签输入
    const handleTagInput = async e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        collapseTagInput();
        return;
      }
      if (e.key === 'Enter' || e.key === ',' || e.type === 'blur') {
        e.preventDefault();
        const tag = tagInput.value.trim().replace(/,/g, '');
        if (!tag) {
          // 失焦时没输入内容：收回按钮，不打扰
          if (e.type === 'blur') collapseTagInput();
          return;
        }
        const key = getFieldKey(field);
        try {
          const result = await chrome.storage.local.get([key]);
          const currentData = result[key];
          if (!currentData) return;

          // 检查标签是否已存在
          if (currentData.tags && currentData.tags.includes(tag)) {
            showToast(getMessage('tagExists') || '标签已存在');
            tagInput.value = '';
            return;
          }
          const updatedTags = [...(currentData.tags || []), tag];
          const updatedData = {
            ...currentData,
            tags: updatedTags
          };
          await chrome.storage.local.set({
            [key]: updatedData
          });

          // 添加标签到UI
          const tagElement = document.createElement('span');
          tagElement.className = 'note-tag';
          tagElement.dataset.tag = tag;
          tagElement.innerHTML = `${escapeHtml(tag)}<span class="tag-remove">×</span>`;
          tagsContainer.appendChild(tagElement);

          // 添加删除事件
          tagElement.querySelector('.tag-remove').addEventListener('click', e => {
            e.stopPropagation();
            removeTag(key, tag, tagElement);
          });
          collapseTagInput();
          showToast(getMessage('tagAdded') || '标签已添加');
        } catch (error) {
          console.error('Add tag error:', error);
        }
      }
    };
    tagInput.addEventListener('keydown', handleTagInput);
    tagInput.addEventListener('blur', handleTagInput);
  }

  // 为已有标签添加删除事件
  tagsContainer.querySelectorAll('.tag-remove').forEach(removeBtn => {
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      const tagElement = e.target.closest('.note-tag');
      const tag = tagElement.dataset.tag;
      const key = getFieldKey(field);
      removeTag(key, tag, tagElement);
    });
  });

  // 移除标签函数
  async function removeTag(key, tag, tagElement) {
    try {
      const result = await chrome.storage.local.get([key]);
      const currentData = result[key];
      if (!currentData || !currentData.tags) return;
      const updatedTags = currentData.tags.filter(t => t !== tag);
      const updatedData = {
        ...currentData,
        tags: updatedTags
      };
      await chrome.storage.local.set({
        [key]: updatedData
      });
      tagElement.remove();
      showToast(getMessage('tagRemoved') || '标签已移除');
    } catch (error) {
      console.error('Remove tag error:', error);
    }
  }

  // 修改点击事件监听的处理方式
  suggestion.outsideClickHandler = e => {
    if (!suggestion.contains(e.target) && e.target !== field) {
      suggestion.classList.remove('show');
      // 收起动画结束后再销毁
      setTimeout(() => destroySuggestion(suggestion), 200);
    }
  };

  // 延迟添加点击事件监听，避免立即触发
  setTimeout(() => {
    document.addEventListener('click', suggestion.outsideClickHandler);
  }, 0);

  // 阻止弹窗内的点击事件冒泡
  suggestion.addEventListener('click', e => {
    e.stopPropagation();
  });

  // 确保弹窗可见（层级由 CSS 统一管理，见 styles.css 的 z-index 阶梯）
  suggestion.style.display = 'block';
  suggestion.style.opacity = '1';
  suggestion.style.visibility = 'visible';

  // 添加动画效果
  setTimeout(() => {
    suggestion.classList.add('show');
  }, 10);
}

// 显示编辑备注的弹窗

// 在 content.js 中添加消息监听
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 检查扩展上下文。
  // 这里必须应答而不是静默 return：静默会让发送方只拿到 undefined，
  // 与「content script 根本没注入」表现一致，弹窗就无从区分两者。
  if (isExtensionInvalidated || !isExtensionContextValid()) {
    isExtensionInvalidated = true;
    noteDisabledReason = 'context-invalid';
    sendResponse({ ok: false, reason: 'context-invalid' });
    return;
  }
  if (request.action === 'showAddNotePopup') {
    // 找到第一个密码框并显示添加备注弹窗
    const passwordField = document.querySelector('input[type="password"]');
    if (passwordField) {
      showAccountNote(passwordField, null);
    }
    return;
  }
  if (request.action === 'startFieldPicker') {
    // 同步返回 { ok, reason }，弹窗据此决定关闭自己、提示原因还是给出恢复入口
    sendResponse(startFieldPicker());
    return;
  }
  if (request.action === 'enableCurrentSite') {
    // 异步清理禁用配置后重新初始化，需要保持消息通道
    enableCurrentSite().then(sendResponse, () => sendResponse({ ok: false, reason: 'context-invalid' }));
    return true;
  }
});
function showToast(message, type = 'info') {
  // 移除可能已存在的toast
  const existingToast = document.querySelector('.account-note-toast');
  if (existingToast) {
    existingToast.remove();
  }
  const toast = document.createElement('div');
  toast.className = `account-note-toast ${type}`;

  // 根据类型添加不同的图标
  let icon = '';
  if (type === 'error') {
    icon = '<span class="toast-icon">⚠️</span> ';
  } else if (type === 'success') {
    icon = '<span class="toast-icon">✓</span> ';
  }
  toast.innerHTML = `${icon}${message}`;
  getOverlayRoot().appendChild(toast);

  // 添加进入动画
  toast.style.animation = 'fadeInOut 2.5s ease-in-out';

  // 自动移除
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, 2200);
}
// 只接管扩展自身抛出的错误。
// 宿主页面自身的报错一律不处理：不弹 toast、不打印日志、不阻止默认行为，
// 以免干扰网站自己的错误上报与用户提示。
function isExtensionOwnError(filename, error) {
  if (typeof filename === 'string' && filename.indexOf('chrome-extension://') === 0) return true;
  return !!error && !!error.message && error.message.includes('Extension context invalidated');
}
window.addEventListener('error', event => {
  if (!isExtensionOwnError(event.filename, event.error)) return;
  if (event.error && event.error.message && event.error.message.includes('Extension context invalidated')) {
    isExtensionInvalidated = true;
    teardownListeners();
    // 阻止控制台把「扩展上下文失效」刷成页面错误
    event.preventDefault();
  }
});
window.addEventListener('unhandledrejection', event => {
  const reason = event.reason;
  if (reason && reason.message && reason.message.includes('Extension context invalidated')) {
    isExtensionInvalidated = true;
    teardownListeners();
    event.preventDefault();
  }
});

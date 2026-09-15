// 监听页面加载完成和DOM变化
// 扩展上下文失效标记
let isExtensionInvalidated = false;
// 页面级监听是否已注册（幂等标记，替代原先的 MutationObserver 状态）
let listenersRegistered = false;

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
  if (!listenersRegistered) return;
  document.removeEventListener('focusin', onDelegatedFocusIn, true);
  document.removeEventListener('input', onDelegatedInput, true);
  document.removeEventListener('change', onDelegatedInput, true);
  listenersRegistered = false;
}

// CSS样式已通过Webpack打包到content.css中，不需要动态加载

// 检查是否应该显示备注
function shouldShowNote() {
  return new Promise(resolve => {
    if (isExtensionInvalidated || !isExtensionContextValid()) {
      isExtensionInvalidated = true;
      teardownListeners();
      resolve(false);
      return;
    }
    const domain = window.location.origin;

    // about:blank、data: 等内联框架的 origin 是 "null"，没有可归属的站点
    if (!/^https?:\/\//.test(domain)) {
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
          resolve(false);
          return;
        }

        // 检查全局禁用设置
        if (result.disabledGlobal) {
          resolve(false);
          return;
        }

        // 检查当前网站是否在禁用列表中
        const disabledSites = result.disabledSites || [];
        if (disabledSites.includes(domain)) {
          resolve(false);
          return;
        }

        // 检查会话禁用设置
        const sessionKey = `sessionDisabled_${domain}`;
        if (sessionStorage.getItem(sessionKey)) {
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch (error) {
      if (error.message?.includes('Extension context invalidated')) {
        isExtensionInvalidated = true;
        teardownListeners();
      }
      resolve(false);
    }
  });
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
  if (!isCandidateInput(field) || !isUsernameField(field)) return;
  handleAccountFieldFocus(field);
}

// 在账号框输入：按字段防抖后读取并展示备注
function onDelegatedInput(event) {
  const field = resolveEventTarget(event);
  if (!isCandidateInput(field) || !isUsernameField(field)) return;
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
  if (await shouldShowNote()) {
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

  // 将菜单添加到body而不是suggestion内部，以避免定位问题
  document.body.appendChild(disableMenu);

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

// 正向关键词：命中任意一个即认为是账号类输入框（含中文）
const USERNAME_KEYWORDS = ['user', 'uname', 'login', 'signin', 'account', 'acct', 'email', 'mail', 'identifier', 'uid', 'member', 'mobile', 'phone', 'card', 'name', '账号', '帐号', '账户', '帐户', '用户名', '用户', '登录', '登陆', '邮箱', '邮件', '手机', '电话', '号码', '身份证', '证件', '学号', '工号', '会员'];

// 反向关键词：命中任意一个即排除，避免在密码 / 验证码 / 搜索框上误弹
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

// 判断是否为用户名/账号输入框
function isUsernameField(input) {
  if (!input || !input.tagName || input.tagName !== 'INPUT') return false;
  const type = (input.type || 'text').toLowerCase();
  if (!USERNAME_INPUT_TYPES.includes(type)) return false;
  const joined = getFieldTextHints(input).join(' ');

  // 反向关键词优先：密码、验证码、搜索等一律不认
  if (NON_USERNAME_KEYWORDS.some(keyword => joined.includes(keyword))) return false;

  // 强信号：email 类型，或 autocomplete 明确标注为账号字段
  const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
  if (type === 'email') return true;
  if (autocomplete.indexOf('username') !== -1 || autocomplete === 'email') return true;
  return USERNAME_KEYWORDS.some(keyword => joined.includes(keyword));
}
// 缓存弹窗位置，避免频繁重新计算导致跳动
const popupPositionCache = new WeakMap();

// 按字段维护弹窗：同页多个账号框各管各的，不会互相顶掉
const suggestionByField = new WeakMap();
function getSuggestionFor(field) {
  const el = suggestionByField.get(field);
  return el && el.isConnected ? el : null;
}

// 销毁一个弹窗并解绑它的全部监听
function destroySuggestion(suggestion) {
  if (!suggestion) return;
  const oldToggleBtn = suggestion.querySelector('.toggle-text-btn');
  if (oldToggleBtn) {
    oldToggleBtn.removeEventListener('click', oldToggleBtn.clickHandler);
  }
  const oldNoteInput = suggestion.querySelector('.account-note-text');
  if (oldNoteInput) {
    oldNoteInput.removeEventListener('click', oldNoteInput.clickHandler);
    oldNoteInput.removeEventListener('keydown', oldNoteInput.keydownHandler);
    oldNoteInput.removeEventListener('blur', oldNoteInput.blurHandler);
  }
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
    const existingNoteInput = existingSuggestion.querySelector('.account-note-text');
    const existingNote = existingNoteInput ? existingNoteInput.dataset.fullText : '';
    const newNote = noteData ? noteData.note : '';
    if (existingNote === newNote) {
      existingSuggestion.style.display = 'block';
      existingSuggestion.classList.add('show');
      return;
    }
    destroySuggestion(existingSuggestion);
  }

  // 切换到另一个账号框前，先收掉别的弹窗
  closeOtherSuggestions(field);

  // 添加 HTML 转义函数
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    const escaped = div.innerHTML;
    div.remove(); // 清理临时DOM元素
    return escaped;
  }
  const suggestion = document.createElement('div');
  suggestion.className = 'account-note-suggestion';

  // 检测系统主题
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) {
    suggestion.setAttribute('data-theme', 'dark');
  } else {
    suggestion.setAttribute('data-theme', 'light');
  }
  const hasNote = noteData && noteData.note;
  const note = hasNote ? noteData.note : '';

  // 创建一个临时元素来测量文本宽度
  const measureEl = document.createElement('textarea');
  measureEl.className = 'account-note-text';
  measureEl.style.position = 'absolute';
  measureEl.style.visibility = 'hidden';
  measureEl.style.width = '240px';
  measureEl.style.height = '45px';
  measureEl.style.whiteSpace = 'nowrap';
  measureEl.value = note;
  document.body.appendChild(measureEl);

  // 检查是否需要展开按钮
  const isLongText = measureEl.scrollWidth > measureEl.clientWidth;
  document.body.removeChild(measureEl);

  // 根据是否需要展开来设置显示文本
  const fullText = note;
  const shortText = isLongText ? `${note.slice(0, 50)}...` : note;
  suggestion.innerHTML = `
      <div class="note-input-wrapper">
        <textarea
          class="account-note-text ${!hasNote ? 'empty-note' : ''}"
          placeholder="${!hasNote ? getMessage('addNote') : getMessage('editNote')}" data-full-text="${escapeHtml(fullText)}"
          data-short-text="${escapeHtml(shortText)}"
          data-is-expanded="false"
          readonly
        >${escapeHtml(shortText)}</textarea>
      </div>
      <div class="note-tags-container">
        ${noteData?.tags?.map(tag => `<span class="note-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}<span class="tag-remove">×</span></span>`).join('') || ''}
      </div>
      <div class="note-tag-input-container" style="display: none;">
        <input type="text" class="note-tag-input" placeholder="${getMessage('addTagPlaceholder') || '添加标签，按回车确认'}" />
      </div>
      <div class="note-footer-actions">
        ${isLongText ? `
          <button class="toggle-text-btn" title="${getMessage('toggleText')}">${getMessage('expand')}</button>
        ` : ''}
        <button class="add-tag-btn" title="${getMessage('addTag') || '添加标签'}">${getMessage('addTag') || '+ 标签'}</button>
        <button class="close-note-btn" title="${getMessage('close')}">${getMessage('close')}</button>
      </div>
  `;

  // 定位弹窗 - 使用缓存的位置信息或重新计算
  let position = popupPositionCache.get(field);

  // 如果没有缓存的位置信息，或者窗口大小发生变化，则重新计算
  if (!position || position.viewportWidth !== window.innerWidth || position.viewportHeight !== window.innerHeight) {
    const fieldRect = field.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // 计算最佳位置
    let top = Math.round(fieldRect.top); // 取整避免小数位变化
    let left = Math.round(fieldRect.right + 10);

    // 检查是否超出视口右侧
    if (left + 260 > viewportWidth) {
      left = Math.round(fieldRect.left - 270); // 放在输入框左侧
      if (left < 0) left = 10; // 如果左侧也放不下，则放在左侧边缘
    }

    // 检查是否超出视口底部
    if (top + 150 > viewportHeight) {
      top = Math.round(viewportHeight - 160);
      if (top < 0) top = 10; // 确保不会超出顶部
    }

    // 缓存计算的位置
    position = {
      top,
      left,
      viewportWidth,
      viewportHeight
    };
    popupPositionCache.set(field, position);
  }

  // 设置弹窗位置
  suggestion.style.position = 'fixed';
  suggestion.style.top = `${position.top}px`;
  suggestion.style.left = `${position.left}px`;
  document.body.appendChild(suggestion);
  suggestionByField.set(field, suggestion);

  // 获取元素
  const noteInput = suggestion.querySelector('.account-note-text');
  const toggleBtn = suggestion.querySelector('.toggle-text-btn');
  const closeBtn = suggestion.querySelector('.close-note-btn');

  // 设置初始高度
  noteInput.style.height = '45px';

  // 处理展开/收起功能
  if (toggleBtn) {
    toggleBtn.clickHandler = e => {
      e.stopPropagation();
      const isExpanded = noteInput.dataset.isExpanded === 'true';
      if (isExpanded) {
        noteInput.value = noteInput.dataset.shortText;
        toggleBtn.textContent = getMessage('expand');
        noteInput.dataset.isExpanded = 'false';
        noteInput.style.height = '45px';
      } else {
        noteInput.value = noteInput.dataset.fullText;
        toggleBtn.textContent = getMessage('collapse'); // 使用专门的'collapse'消息
        noteInput.dataset.isExpanded = 'true';
        noteInput.style.height = 'auto';
        const scrollHeight = noteInput.scrollHeight;
        noteInput.style.height = `${scrollHeight}px`;
      }
    };
    toggleBtn.addEventListener('click', toggleBtn.clickHandler);
  }

  // 点击文本框时启用编辑
  noteInput.clickHandler = () => {
    const username = field.value.trim();
    if (!username) {
      showToast(getMessage('errorEmptyUsername'));
      return;
    }
    noteInput.readOnly = false;
    noteInput.focus();
    if (!hasNote) {
      noteInput.value = '';
    }
  };
  noteInput.addEventListener('click', noteInput.clickHandler);

  // 处理编辑完成
  noteInput.keydownHandler = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newNote = noteInput.value.trim();
      if (newNote) {
        noteInput.readOnly = true;
        noteInput.blur();
        const domain = window.location.origin;
        const username = field.value.trim();
        const key = getFieldKey(field);

        // 先读取现有数据，然后在回调中构建 noteData
        chrome.storage.local.get([key], result => {
          if (chrome.runtime.lastError) {
            if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
              isExtensionInvalidated = true;
              teardownListeners();
            }
            return;
          }
          const noteData = {
            key: key,
            note: newNote,
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
            domain: domain,
            username: username,
            tags: result[key]?.tags || [],
            isFavorite: result[key]?.isFavorite || false,
            favoriteTime: result[key]?.favoriteTime || null
          };
          if (result[key]) {
            noteData.createTime = result[key].createTime;
          }
          chrome.storage.local.set({
            [key]: noteData
          }, () => {
            if (chrome.runtime.lastError) {
              if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
                isExtensionInvalidated = true;
                teardownListeners();
              }
              return;
            }
            const isLongText = newNote.length > 100;
            const displayText = isLongText ? `${newNote.slice(0, 100)}...` : newNote;
            noteInput.value = displayText;
            noteInput.dataset.fullText = newNote;
            noteInput.dataset.shortText = displayText;
            let toggleBtn = suggestion.querySelector('.toggle-text-btn');
            if (isLongText && !toggleBtn) {
              toggleBtn = document.createElement('button');
              toggleBtn.className = 'toggle-text-btn';
              toggleBtn.dataset.expanded = 'false';
              toggleBtn.textContent = getMessage('expand');
              suggestion.appendChild(toggleBtn);
              toggleBtn.clickHandler = e => {
                e.stopPropagation();
                const isExpanded = toggleBtn.dataset.expanded === 'true';
                if (isExpanded) {
                  noteInput.value = noteInput.dataset.shortText;
                  toggleBtn.textContent = getMessage('expand');
                  toggleBtn.dataset.expanded = 'false';
                } else {
                  noteInput.value = noteInput.dataset.fullText;
                  toggleBtn.textContent = getMessage('collapse'); // 使用专门的'collapse'消息
                  toggleBtn.dataset.expanded = 'true';
                }
              };
              toggleBtn.addEventListener('click', toggleBtn.clickHandler);
            } else if (!isLongText && toggleBtn) {
              toggleBtn.removeEventListener('click', toggleBtn.clickHandler);
              toggleBtn.remove();
            }
            showToast(getMessage('successNoteSaved'));
          });
        });
      }
    } else if (e.key === 'Escape') {
      noteInput.readOnly = true;
      noteInput.blur();
      noteInput.value = noteInput.dataset.fullText || '';
    }
  };
  noteInput.addEventListener('keydown', noteInput.keydownHandler);

  // 失去焦点时恢复只读
  noteInput.blurHandler = () => {
    noteInput.readOnly = true;
    if (!noteInput.value.trim() && !hasNote) {
      noteInput.value = '';
    }
  };
  noteInput.addEventListener('blur', noteInput.blurHandler);

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

  // 标签输入功能
  const addTagBtn = suggestion.querySelector('.add-tag-btn');
  const tagInputContainer = suggestion.querySelector('.note-tag-input-container');
  const tagInput = suggestion.querySelector('.note-tag-input');
  const tagsContainer = suggestion.querySelector('.note-tags-container');
  if (addTagBtn && tagInputContainer && tagInput) {
    addTagBtn.addEventListener('click', e => {
      e.stopPropagation();
      const isVisible = tagInputContainer.style.display !== 'none';
      tagInputContainer.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        tagInput.focus();
      }
    });

    // 处理标签输入
    const handleTagInput = async e => {
      if (e.key === 'Enter' || e.key === ',' || e.type === 'blur') {
        e.preventDefault();
        const tag = tagInput.value.trim().replace(/,/g, '');
        if (!tag) return;
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
          tagInput.value = '';
          tagInputContainer.style.display = 'none'; // 隐藏输入框
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
  // 检查扩展上下文
  if (isExtensionInvalidated || !isExtensionContextValid()) {
    isExtensionInvalidated = true;
    return;
  }
  if (request.action === 'showAddNotePopup') {
    // 找到第一个密码框并显示添加备注弹窗
    const passwordField = document.querySelector('input[type="password"]');
    if (passwordField) {
      showAccountNote(passwordField, null);
    }
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
  document.body.appendChild(toast);

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

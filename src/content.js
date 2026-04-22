// 监听页面加载完成和DOM变化
// 扩展上下文失效标记
let isExtensionInvalidated = false;
let observer = null;

// 检查扩展上下文是否有效
function isExtensionContextValid() {
  try {
    return typeof chrome !== 'undefined' &&
           chrome.runtime !== undefined &&
           chrome.runtime.id !== undefined;
  } catch (e) {
    return false;
  }
}

// 断开 MutationObserver
function disconnectObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// CSS样式已通过Webpack打包到content.css中，不需要动态加载

// 检查是否应该显示备注
function shouldShowNote() {
  return new Promise(resolve => {
    if (isExtensionInvalidated || !isExtensionContextValid()) {
      isExtensionInvalidated = true;
      disconnectObserver();
      resolve(false);
      return;
    }

    const domain = window.location.origin;

    try {
      chrome.storage.local.get(['disabledGlobal', 'disabledSites'], (result) => {
        if (chrome.runtime.lastError) {
          if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
            isExtensionInvalidated = true;
            disconnectObserver();
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
        disconnectObserver();
      }
      resolve(false);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (isExtensionInvalidated || !isExtensionContextValid()) {
    isExtensionInvalidated = true;
    return;
  }
  if (await shouldShowNote()) {
    initAccountFields();
  }
});

// 初始化 MutationObserver
function initObserver() {
  if (isExtensionInvalidated || !isExtensionContextValid()) {
    isExtensionInvalidated = true;
    return;
  }

  observer = new MutationObserver(async () => {
    try {
      if (isExtensionInvalidated || !isExtensionContextValid()) {
        isExtensionInvalidated = true;
        disconnectObserver();
        return;
      }
      if (await shouldShowNote()) {
        initAccountFields();
      }
    } catch (error) {
      if (error.message?.includes('Extension context invalidated')) {
        isExtensionInvalidated = true;
        disconnectObserver();
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// 启动观察器
if (document.body) {
  initObserver();
} else {
  document.addEventListener('DOMContentLoaded', initObserver);
}

// 在页面卸载时断开观察者连接
window.addEventListener('unload', () => {
  disconnectObserver();
});

// 显示禁用选项菜单
function showDisableOptions(suggestion, field) {
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
  const closeBtn = suggestion.querySelector('.close-note-btn');
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
            chrome.storage.local.get(['disabledSites'], (result) => {
              if (chrome.runtime.lastError) {
                if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
                  isExtensionInvalidated = true;
                  disconnectObserver();
                }
                return;
              }
              const disabledSites = result.disabledSites || [];
              if (!disabledSites.includes(domain)) {
                disabledSites.push(domain);
                chrome.storage.local.set({ disabledSites }, () => {
                  if (chrome.runtime.lastError) {
                    if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
                      isExtensionInvalidated = true;
                      disconnectObserver();
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
              disconnectObserver();
            }
          }
          break;

        case 'global':
          // 全局禁用
          try {
            chrome.storage.local.set({ disabledGlobal: true }, () => {
              if (chrome.runtime.lastError) {
                if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
                  isExtensionInvalidated = true;
                  disconnectObserver();
                }
                return;
              }
              showToast(getMessage('globalDisabled') || '已在所有网站上禁用备注功能');
            });
          } catch (error) {
            if (error.message?.includes('Extension context invalidated')) {
              isExtensionInvalidated = true;
              disconnectObserver();
            }
          }
          break;
      }
      
      // 移除备注弹窗和禁用选项菜单
      disableMenu.remove();
      suggestion.remove();
    });
  });
  
  // 点击其他区域关闭菜单
  const closeMenuOnOutsideClick = (e) => {
    if (!disableMenu.contains(e.target) && !closeBtn.contains(e.target)) {
      disableMenu.remove();
      document.removeEventListener('click', closeMenuOnOutsideClick);
    }
  };
  
  // 延迟添加事件监听，避免立即触发
  setTimeout(() => {
    document.addEventListener('click', closeMenuOnOutsideClick);
  }, 10);
}

// 添加防抖函数
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// 记录上一次的字段值，用于比较是否真正变化
const lastFieldValues = new WeakMap();

function initAccountFields() {
  // 检查扩展上下文是否有效
  if (isExtensionInvalidated || !isExtensionContextValid()) {
    isExtensionInvalidated = true;
    return;
  }

  // 查找所有可能的账号输入框
  const accountFields = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]');

  accountFields.forEach(field => {
    // 检查是否为账号输入框
    if (!isUsernameField(field)) return;

    // 避免重复初始化
    if (field.dataset.hasNote) return;
    field.dataset.hasNote = 'true';

    // 监听账号输入框的focus事件
    field.addEventListener('focus', async () => {
      // 检查扩展上下文
      if (isExtensionInvalidated || !isExtensionContextValid()) {
        isExtensionInvalidated = true;
        return;
      }
      // 确保 chrome.storage API 可用且输入框有内容，并且网站未被禁用
      if (field.value.trim() && await shouldShowNote()) {
        // 记录当前值
        lastFieldValues.set(field, field.value.trim());

        try {
          chrome.storage.local.get([getFieldKey(field)], (result) => {
            if (chrome.runtime.lastError) {
              if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
                isExtensionInvalidated = true;
                disconnectObserver();
              }
              return;
            }
            const noteData = result[getFieldKey(field)];
            // 无论是否有备注，都使用同一个展示方式
            showAccountNote(field, noteData);
          });
        } catch (error) {
          if (error.message?.includes('Extension context invalidated')) {
            isExtensionInvalidated = true;
            disconnectObserver();
          }
        }
      }
    });

    // 使用防抖处理input事件，300ms延迟
    const debouncedInputHandler = debounce(async () => {
      // 检查扩展上下文
      if (isExtensionInvalidated || !isExtensionContextValid()) {
        isExtensionInvalidated = true;
        return;
      }

      const currentValue = field.value.trim();
      const lastValue = lastFieldValues.get(field) || '';

      // 只有当输入框有内容且值真正变化时才处理
      if (currentValue && await shouldShowNote()) {
        // 检查值是否真正变化
        if (currentValue !== lastValue) {
          // 更新记录的值
          lastFieldValues.set(field, currentValue);

          // 获取新的备注数据
          try {
            chrome.storage.local.get([getFieldKey(field)], (result) => {
              if (chrome.runtime.lastError) {
                if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
                  isExtensionInvalidated = true;
                  disconnectObserver();
                }
                return;
              }
              const noteData = result[getFieldKey(field)];
              // 更新备注弹窗
              showAccountNote(field, noteData);
            });
          } catch (error) {
            if (error.message?.includes('Extension context invalidated')) {
              isExtensionInvalidated = true;
              disconnectObserver();
            }
          }
        }
      } else if (!currentValue) {
        // 如果输入框内容为空，移除已存在的备注框
        const existingSuggestion = document.querySelector('.account-note-suggestion');
        if (existingSuggestion) {
          existingSuggestion.remove();
        }
        // 清除记录的值
        lastFieldValues.delete(field);
      }
    }, 300);

    // 添加input事件监听
    field.addEventListener('input', debouncedInputHandler);
  });
}

// 修改其他使用 chrome.storage 的函数
function loadExistingNote(field) {
  if (isExtensionInvalidated || !isExtensionContextValid()) {
    isExtensionInvalidated = true;
    return;
  }

  try {
    chrome.storage.local.get([getFieldKey(field)], (result) => {
      if (chrome.runtime.lastError) {
        if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
          isExtensionInvalidated = true;
          disconnectObserver();
        }
        return;
      }
      const noteData = result[getFieldKey(field)];
      if (noteData) {
        field.dataset.hasStoredNote = 'true';
      }
    });
  } catch (error) {
    if (error.message?.includes('Extension context invalidated')) {
      isExtensionInvalidated = true;
      disconnectObserver();
    }
  }
}

// 更新弹窗位置
function updatePopupPosition(popup, field) {
  const fieldRect = field.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  
  // 根据可用空间决定弹窗显示位置
  if (fieldRect.right + 250 > viewportWidth) {
    // 如果右边空间不足，显示在左边
    popup.style.left = '-260px';
  } else {
    // 默认显示在右边
    popup.style.left = '30px';
  }
}

// 创建备注弹出框
function createNotePopup(field) {
  const popup = document.createElement('div');
  popup.className = 'account-note-popup';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '输入备注信息';
  
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '保存';
  saveBtn.onclick = () => saveNote(input.value, popup, field);
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.onclick = () => popup.style.display = 'none';
  
  popup.appendChild(input);
  popup.appendChild(saveBtn);
  popup.appendChild(cancelBtn);
  
  return popup;
}

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

// 修改 saveNote 函数中的错误处理
function saveNote(note, popup, field) {
  try {
    // 检查扩展上下文
    if (isExtensionInvalidated || !isExtensionContextValid()) {
      isExtensionInvalidated = true;
      showToast(getMessage('errorStorageAPI'), 'error');
      return;
    }

    if (typeof chrome === 'undefined' || !chrome.storage) {
      throw new Error(getMessage('errorStorageAPI'));
    }

    const domain = window.location.origin;
    const username = field.value.trim();

    if (!note.trim()) {
      throw new Error(getMessage('errorEmptyNote'));
    }

    if (!username) {
      throw new Error(getMessage('errorEmptyUsername'));
    }

    const key = getFieldKey(field);

    // 先读取现有数据，然后在回调中构建 noteData
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
          isExtensionInvalidated = true;
          disconnectObserver();
        }
        showToast(getMessage('errorReadData', [chrome.runtime.lastError.message]), 'error');
        return;
      }

      const noteData = {
        key: key,
        note: note.trim(),
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

      chrome.storage.local.set({ [key]: noteData }, () => {
        if (chrome.runtime.lastError) {
          if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
            isExtensionInvalidated = true;
            disconnectObserver();
          }
          showToast(getMessage('errorSaveData', [chrome.runtime.lastError.message]), 'error');
          return;
        }
        popup.style.display = 'none';
        showToast(getMessage('successNoteSaved'));
      });
    });
  } catch (error) {
    if (error.message?.includes('Extension context invalidated')) {
      isExtensionInvalidated = true;
      disconnectObserver();
    }
    showToast(error.message, 'error');
    console.error('SaveNote Error:', error);
  }
}

// 生成输入框的唯一标识
function getFieldKey(field) {
  const domain = window.location.origin;
  const username = field.value.trim();  // 添加 trim 以保持一致性
  console.log('[getFieldKey] 生成 key:', { domain, username, key: `${domain}_${username}` });
  return `${domain}_${username}`;
}


// 判断是否为用户名输入框
function isUsernameField(input) {
  if (!input || !input.type) return false;
  
  const usernameTypes = ['text', 'email', 'tel'];
  const usernameIdentifiers = ['user', 'email', 'login', 'name', 'account', 'identifier'];
  
  // 检查输入框类型
  if (!usernameTypes.includes(input.type.toLowerCase())) return false;
  
  // 检查输入框的id、name、placeholder、aria-label等属性
  const attributes = [
    input.id,
    input.name,
    input.placeholder,
    input.getAttribute('aria-label'),
    input.getAttribute('autocomplete')
  ].map(attr => (attr || '').toLowerCase());
  
  // 检查class名称
  const classNames = (input.className || '').toLowerCase().split(' ');
  attributes.push(...classNames);
  
  return attributes.some(attr => 
    usernameIdentifiers.some(identifier => attr.includes(identifier))
  );
}

function showNotePopup(popup, field) {
  // 更新弹窗位置
  updatePopupPosition(popup, field);
  popup.style.display = 'block';
  
  // 获取已存在的备注
  chrome.storage.local.get([getFieldKey(field)], (result) => {
    const note = result[getFieldKey(field)];
    if (note) {
      popup.querySelector('input').value = note;
    } else {
      popup.querySelector('input').value = ''; // 清空输入框
    }
  });
  
  // 聚焦输入框
  popup.querySelector('input').focus();
}

// 缓存弹窗位置，避免频繁重新计算导致跳动
const popupPositionCache = new WeakMap();

function showAccountNote(field, noteData) {
  // 检查是否已存在弹窗
  const existingSuggestion = document.querySelector('.account-note-suggestion');
  
  // 如果已存在弹窗且内容相同，则不重新创建
  if (existingSuggestion) {
    const existingNoteInput = existingSuggestion.querySelector('.account-note-text');
    const existingNote = existingNoteInput ? existingNoteInput.dataset.fullText : '';
    const newNote = noteData ? noteData.note : '';
    
    // 如果备注内容相同，则不需要重新创建弹窗
    if (existingNote === newNote) {
      return;
    }
    
    // 移除所有事件监听器
    const oldToggleBtn = existingSuggestion.querySelector('.toggle-text-btn');
    if (oldToggleBtn) {
      oldToggleBtn.removeEventListener('click', oldToggleBtn.clickHandler);
    }
    const oldNoteInput = existingSuggestion.querySelector('.account-note-text');
    if (oldNoteInput) {
      oldNoteInput.removeEventListener('click', oldNoteInput.clickHandler);
      oldNoteInput.removeEventListener('keydown', oldNoteInput.keydownHandler);
      oldNoteInput.removeEventListener('blur', oldNoteInput.blurHandler);
    }
    document.removeEventListener('click', existingSuggestion.outsideClickHandler);
    existingSuggestion.remove();
  }

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
        <input type="text" class="note-tag-input" placeholder="${getMessage('addTagPlaceholder') || '添加标签，按回车或逗号确认'}" />
      </div>
      <div class="note-footer-actions">
        ${isLongText ? `
          <button class="toggle-text-btn" title="${getMessage('toggleText')}">${getMessage('expand')}</button>
        ` : ''}
        <button class="add-tag-btn" title="${getMessage('addTag') || '添加标签'}">${getMessage('addTag') || '+ 标签'}</button>
        <button class="favorite-btn ${noteData?.isFavorite ? 'is-favorite' : ''}" title="${noteData?.isFavorite ? getMessage('removeFavorite') || '取消收藏' : getMessage('addFavorite') || '收藏'}">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="currentColor"/>
          </svg>
        </button>
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
    position = { top, left, viewportWidth, viewportHeight };
    popupPositionCache.set(field, position);
  }

  // 设置弹窗位置
  suggestion.style.position = 'fixed';
  suggestion.style.top = `${position.top}px`;
  suggestion.style.left = `${position.left}px`;

  document.body.appendChild(suggestion);

  // 获取元素
  const noteInput = suggestion.querySelector('.account-note-text');
  const toggleBtn = suggestion.querySelector('.toggle-text-btn');
  const closeBtn = suggestion.querySelector('.close-note-btn');

  // 设置初始高度
  noteInput.style.height = '45px';
  
  // 处理展开/收起功能
  if (toggleBtn) {
    toggleBtn.clickHandler = (e) => {
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
  noteInput.keydownHandler = (e) => {
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
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime.lastError) {
            if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
              isExtensionInvalidated = true;
              disconnectObserver();
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
                disconnectObserver();
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

              toggleBtn.clickHandler = (e) => {
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

  // 添加关闭按钮点击事件
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showDisableOptions(suggestion, field);
  });

  // 收藏按钮功能
  const favoriteBtn = suggestion.querySelector('.favorite-btn');
  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const key = getFieldKey(field);

      try {
        const result = await chrome.storage.local.get([key]);
        const currentData = result[key];
        if (!currentData) return;

        const newFavoriteStatus = !currentData.isFavorite;
        const updatedData = {
          ...currentData,
          isFavorite: newFavoriteStatus,
          favoriteTime: newFavoriteStatus ? new Date().toISOString() : null
        };

        await chrome.storage.local.set({ [key]: updatedData });

        // 更新UI
        favoriteBtn.classList.toggle('is-favorite', newFavoriteStatus);
        favoriteBtn.title = newFavoriteStatus ? (getMessage('removeFavorite') || '取消收藏') : (getMessage('addFavorite') || '收藏');

        showToast(newFavoriteStatus ? (getMessage('addedToFavorites') || '已添加到收藏') : (getMessage('removedFromFavorites') || '已取消收藏'));
      } catch (error) {
        console.error('Toggle favorite error:', error);
      }
    });
  }

  // 标签输入功能
  const addTagBtn = suggestion.querySelector('.add-tag-btn');
  const tagInputContainer = suggestion.querySelector('.note-tag-input-container');
  const tagInput = suggestion.querySelector('.note-tag-input');
  const tagsContainer = suggestion.querySelector('.note-tags-container');

  if (addTagBtn && tagInputContainer && tagInput) {
    addTagBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = tagInputContainer.style.display !== 'none';
      tagInputContainer.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        tagInput.focus();
      }
    });

    // 处理标签输入
    const handleTagInput = async (e) => {
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

          await chrome.storage.local.set({ [key]: updatedData });

          // 添加标签到UI
          const tagElement = document.createElement('span');
          tagElement.className = 'note-tag';
          tagElement.dataset.tag = tag;
          tagElement.innerHTML = `${escapeHtml(tag)}<span class="tag-remove">×</span>`;
          tagsContainer.appendChild(tagElement);

          // 添加删除事件
          tagElement.querySelector('.tag-remove').addEventListener('click', (e) => {
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
    removeBtn.addEventListener('click', (e) => {
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

      await chrome.storage.local.set({ [key]: updatedData });
      tagElement.remove();
      showToast(getMessage('tagRemoved') || '标签已移除');
    } catch (error) {
      console.error('Remove tag error:', error);
    }
  }

  // 修改点击事件监听的处理方式
  suggestion.outsideClickHandler = (e) => {
    if (!suggestion.contains(e.target) && e.target !== field) {
      suggestion.classList.remove('show');
      // 移除所有事件监听器
      if (toggleBtn) {
        toggleBtn.removeEventListener('click', toggleBtn.clickHandler);
      }
      noteInput.removeEventListener('click', noteInput.clickHandler);
      noteInput.removeEventListener('keydown', noteInput.keydownHandler);
      noteInput.removeEventListener('blur', noteInput.blurHandler);
      document.removeEventListener('click', suggestion.outsideClickHandler);
      
      setTimeout(() => {
        suggestion.remove();
      }, 200);
    }
  };

  // 延迟添加点击事件监听，避免立即触发
  setTimeout(() => {
    document.addEventListener('click', suggestion.outsideClickHandler);
  }, 0);

  // 阻止弹窗内的点击事件冒泡
  suggestion.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // 确保弹窗可见
  suggestion.style.display = 'block';
  suggestion.style.opacity = '1';
  suggestion.style.visibility = 'visible';
  suggestion.style.zIndex = '9999';

  // 添加动画效果
  setTimeout(() => {
    suggestion.classList.add('show');
  }, 10);
}

// 显示编辑备注的弹窗
function showEditNotePopup(field, currentNote = '') {
  // 检查扩展上下文
  if (isExtensionInvalidated || !isExtensionContextValid()) {
    isExtensionInvalidated = true;
    return;
  }

  const popup = document.createElement('div');
  popup.className = 'edit-note-popup';

  // 获取图标 URL，添加错误处理
  let iconUrl = '';
  try {
    iconUrl = chrome.runtime.getURL('icons/icon48.png');
  } catch (error) {
    if (error.message?.includes('Extension context invalidated')) {
      isExtensionInvalidated = true;
      disconnectObserver();
      return;
    }
  }

  popup.innerHTML = `
    <div class="edit-note-header">
      <img src="${iconUrl}" class="suggestion-icon" />
      <span>编辑备注</span>
    </div>
    <div class="edit-note-content">
      <textarea class="note-input" placeholder="输入备注信息">${currentNote}</textarea>
      <div class="edit-note-buttons">
        <button class="cancel-btn">取消</button>
        <button class="save-btn">保存</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // 定位弹窗，使用与showAccountNote相同的逻辑
  const fieldRect = field.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // 计算最佳位置
  let top = fieldRect.top;
  let left = fieldRect.right + 10;

  // 检查是否超出视口右侧
  if (left + 320 > viewportWidth) {
    left = fieldRect.left - 330; // 放在输入框左侧
    if (left < 0) left = 10; // 如果左侧也放不下，则放在左侧边缘
  }

  // 检查是否超出视口底部
  if (top + 180 > viewportHeight) {
    top = viewportHeight - 190;
    if (top < 0) top = 10; // 确保不会超出顶部
  }

  // 设置弹窗位置
  popup.style.position = 'fixed';
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
  popup.style.zIndex = '9999';
  popup.style.display = 'block';

  // 添加按钮事件
  const input = popup.querySelector('.note-input');
  const saveBtn = popup.querySelector('.save-btn');
  const cancelBtn = popup.querySelector('.cancel-btn');

  // 自动调整文本区域高度
  input.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    // 限制最大高度
    if (this.scrollHeight > 150) {
      this.style.height = '150px';
      this.style.overflowY = 'auto';
    }
  });
  
  // 初始化高度
  setTimeout(() => {
    input.style.height = 'auto';
    input.style.height = (input.scrollHeight) + 'px';
    if (input.scrollHeight > 150) {
      input.style.height = '150px';
      input.style.overflowY = 'auto';
    }
  }, 0);

  // 保存功能
  const handleSave = () => {
    const newNote = input.value.trim();
    if (newNote) {  // 只有当输入不为空时才保存
      saveNote(newNote, popup, field);
    }
  };

  // 添加回车保存功能
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      popup.remove();
    }
  });

  saveBtn.onclick = handleSave;
  cancelBtn.onclick = () => popup.remove();

  // 自动聚焦输入框
  input.focus();
  }


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

function validateNoteData(noteData) {
  const errors = [];
  
  if (!noteData.note || !noteData.note.trim()) {
    errors.push('备注内容不能为空');
  }
  
  if (!noteData.username || !noteData.username.trim()) {
    errors.push('用户名不能为空');
  }
  
  if (!noteData.domain) {
    errors.push('网站域名无效');
  }
  
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  
  return true;
} 

window.addEventListener('error', (event) => {
  if (event.error?.message?.includes('Extension context invalidated')) {
    isExtensionInvalidated = true;
    disconnectObserver();
    event.preventDefault();
    return;
  }
  console.error('Global Error:', event.error);
  showToast('操作出错，请重试', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('Extension context invalidated')) {
    isExtensionInvalidated = true;
    disconnectObserver();
    event.preventDefault();
    return;
  }
  console.error('Unhandled Promise Rejection:', event.reason);
  showToast('操作出错，请重试', 'error');
});
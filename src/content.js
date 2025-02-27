// 监听页面加载完成和DOM变化
document.addEventListener('DOMContentLoaded', initAccountFields);
const observer = new MutationObserver(initAccountFields);
observer.observe(document.body, { childList: true, subtree: true });

// 在页面卸载时断开观察者连接
window.addEventListener('unload', () => {
  observer.disconnect();
});

function initAccountFields() {
  // 查找所有可能的账号输入框
  const accountFields = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]');
  
  accountFields.forEach(field => {
    // 检查是否为账号输入框
    if (!isUsernameField(field)) return;
    
    // 避免重复初始化
    if (field.dataset.hasNote) return;
    field.dataset.hasNote = 'true';
    
    // 监听账号输入框的focus事件
    field.addEventListener('focus', () => {
      // 确保 chrome.storage API 可用且输入框有内容
      if (typeof chrome !== 'undefined' && chrome.storage && field.value.trim()) {
        chrome.storage.local.get([getFieldKey(field)], (result) => {
          const noteData = result[getFieldKey(field)];
          // 无论是否有备注，都使用同一个展示方式
          showAccountNote(field, noteData);
        });
      }
    });

    // 添加input事件监听，处理用户名变化
    field.addEventListener('input', () => {
      // 只有当输入框有内容时才显示或更新备注框
      if (field.value.trim()) {
        // 获取新的备注数据
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.get([getFieldKey(field)], (result) => {
            const noteData = result[getFieldKey(field)];
            // 更新备注弹窗
            showAccountNote(field, noteData);
          });
        }
      } else {
        // 如果输入框内容为空，移除已存在的备注框
        const existingSuggestion = document.querySelector('.account-note-suggestion');
        if (existingSuggestion) {
          existingSuggestion.remove();
        }
      }
    });
  });
}

// 修改其他使用 chrome.storage 的函数
function loadExistingNote(field) {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get([getFieldKey(field)], (result) => {
      const noteData = result[getFieldKey(field)];
      if (noteData) {
        field.dataset.hasStoredNote = 'true';
      }
    });
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
  return chrome.i18n.getMessage(key, substitutions);
}

// 修改 saveNote 函数中的错误处理
function saveNote(note, popup, field) {
  try {
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
    const noteData = {
      key: key,
      note: note.trim(),
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      domain: domain,
      username: username
    };

    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        throw new Error(getMessage('errorReadData', [chrome.runtime.lastError.message]));
      }

      if (result[key]) {
        noteData.createTime = result[key].createTime;
      }

      chrome.storage.local.set({ [key]: noteData }, () => {
        if (chrome.runtime.lastError) {
          throw new Error(getMessage('errorSaveData', [chrome.runtime.lastError.message]));
        }
        popup.style.display = 'none';
        showToast(getMessage('successNoteSaved'));
      });
    });
  } catch (error) {
    showToast(error.message, 'error');
    console.error('SaveNote Error:', error);
  }
}

// 生成输入框的唯一标识
function getFieldKey(field) {
  const domain = window.location.origin;
  const username = field.value;
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

function showAccountNote(field, noteData) {
  // 移除可能已存在的弹窗
  const existingSuggestion = document.querySelector('.account-note-suggestion');
  if (existingSuggestion) {
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
    <div class="suggestion-content">
      <textarea 
        class="account-note-text ${!hasNote ? 'empty-note' : ''}" 
        placeholder="${!hasNote ? getMessage('addNote') : getMessage('editNote')}"
        data-full-text="${escapeHtml(fullText)}"
        data-short-text="${escapeHtml(shortText)}"
        data-is-expanded="false"
        readonly
      >${escapeHtml(shortText)}</textarea>
      ${isLongText ? `
        <button class="toggle-text-btn" title="${getMessage('toggleText')}">${getMessage('expand')}</button>
      ` : ''}
    </div>
  `;
  
  // 定位弹窗
  const formRect = field.closest('form')?.getBoundingClientRect() || field.getBoundingClientRect();
  const fieldRect = field.getBoundingClientRect();
  suggestion.style.top = `${formRect.top}px`;
  suggestion.style.left = `${fieldRect.right + 10}px`;
  
  document.body.appendChild(suggestion);

  // 获取元素
  const noteInput = suggestion.querySelector('.account-note-text');
  const toggleBtn = suggestion.querySelector('.toggle-text-btn');

  // 设置初始高度
  noteInput.style.height = '45px';
  
  // 处理展开/收起功能
  if (toggleBtn) {
    toggleBtn.clickHandler = (e) => {
      e.stopPropagation();
      const isExpanded = noteInput.dataset.isExpanded === 'true';
      
      if (isExpanded) {
        noteInput.value = noteInput.dataset.shortText;
        toggleBtn.textContent = '展开';
        noteInput.dataset.isExpanded = 'false';
        noteInput.style.height = '45px';
      } else {
        noteInput.value = noteInput.dataset.fullText;
        toggleBtn.textContent = '收起';
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
        const noteData = {
          key: key,
          note: newNote,
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString(),
          domain: domain,
          username: username
        };

        chrome.storage.local.get([key], (result) => {
          if (result[key]) {
            noteData.createTime = result[key].createTime;
          }

          chrome.storage.local.set({
            [key]: noteData
          }, () => {
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
              toggleBtn.textContent = '展开';
              noteInput.parentElement.appendChild(toggleBtn);
              
              toggleBtn.clickHandler = (e) => {
                e.stopPropagation();
                const isExpanded = toggleBtn.dataset.expanded === 'true';
                
                if (isExpanded) {
                  noteInput.value = noteInput.dataset.shortText;
                  toggleBtn.textContent = '展开';
                  toggleBtn.dataset.expanded = 'false';
                } else {
                  noteInput.value = noteInput.dataset.fullText;
                  toggleBtn.textContent = '收起';
                  toggleBtn.dataset.expanded = 'true';
                }
              };
              toggleBtn.addEventListener('click', toggleBtn.clickHandler);
            } else if (!isLongText && toggleBtn) {
              toggleBtn.removeEventListener('click', toggleBtn.clickHandler);
              toggleBtn.remove();
            }
            
            showToast('备注已保存');
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

  // 添加动画效果
  setTimeout(() => {
    suggestion.classList.add('show');
  }, 10);
}

// 显示编辑备注的弹窗
function showEditNotePopup(field, currentNote = '') {
  const popup = document.createElement('div');
  popup.className = 'edit-note-popup';
  popup.innerHTML = `
    <div class="edit-note-header">
      <img src="${chrome.runtime.getURL('icons/icon48.png')}" class="suggestion-icon" />
      <span>编辑备注</span>
    </div>
    <div class="edit-note-content">
      <input type="text" class="note-input" value="${currentNote}" placeholder="输入备注信息">
      <div class="edit-note-buttons">
        <button class="cancel-btn">取消</button>
        <button class="save-btn">保存</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // 定位弹窗，与表单顶部对齐
  const formRect = field.closest('form')?.getBoundingClientRect() || field.getBoundingClientRect();
  const fieldRect = field.getBoundingClientRect();
  popup.style.top = `${formRect.top}px`;
  popup.style.left = `${fieldRect.right + 10}px`;

  // 添加按钮事件
  const input = popup.querySelector('.note-input');
  const saveBtn = popup.querySelector('.save-btn');
  const cancelBtn = popup.querySelector('.cancel-btn');

  // 保存功能
  const handleSave = () => {
    const newNote = input.value.trim();
    if (newNote) {  // 只有当输入不为空时才保存
      saveNote(newNote, popup, field);
    }
  };

  // 添加回车保存功能
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
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
  if (request.action === 'showAddNotePopup') {
    // 找到第一个密码框并显示添加备注弹窗
    const passwordField = document.querySelector('input[type="password"]');
    if (passwordField) {
      showAccountNote(passwordField, null);
    }
  }
}); 

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'account-note-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Toast 会通过 CSS 动画自动消失
  setTimeout(() => {
    toast.remove();
  }, 2000);
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
  console.error('Global Error:', event.error);
  showToast('操作出错，请重试', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
  showToast('操作出错，请重试', 'error');
});
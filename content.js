// 监听页面加载完成和DOM变化
document.addEventListener('DOMContentLoaded', initPasswordFields);
const observer = new MutationObserver(initPasswordFields);
observer.observe(document.body, { childList: true, subtree: true });

function initPasswordFields() {
  // 查找所有密码输入框
  const passwordFields = document.querySelectorAll('input[type="password"]');
  
  passwordFields.forEach(field => {
    // 避免重复初始化
    if (field.dataset.hasNote) return;
    field.dataset.hasNote = 'true';
    
    // 监听密码框的focus事件
    field.addEventListener('focus', () => {
      // 确保 chrome.storage API 可用
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([getFieldKey(field)], (result) => {
          const noteData = result[getFieldKey(field)];
          if (noteData) {
            showPasswordSuggestion(field, noteData);
          } else {
            // 如果没有备注，直接显示编辑弹窗
            showEditNotePopup(field);
          }
        });
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
  popup.className = 'password-note-popup';
  
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

// 保存备注
function saveNote(note, popup, field) {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    alert('存储API不可用');
    return;
  }

  const domain = window.location.origin;
  const usernameField = findUsernameField(field);
  const username = usernameField ? usernameField.value.trim() : '';
  
  // 验证必要数据
  if (!note.trim() || !username) {
    alert('请确保输入了备注内容，并且能够找到用户名输入框');
    return;
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
    if (result[key]) {
      noteData.createTime = result[key].createTime;
    }

    chrome.storage.local.set({
      [key]: noteData
    }, () => {
      popup.style.display = 'none';
      // 显示保存成功提示
      const toast = document.createElement('div');
      toast.className = 'password-note-toast';
      toast.textContent = '备注已保存';
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.remove();
      }, 2000);
      
      field.dataset.hasStoredNote = 'true';
    });
  });
}

// 生成输入框的唯一标识
function getFieldKey(field) {
  const domain = window.location.origin;
  // 查找用户名输入框（通常是密码框的前一个input）
  const usernameField = findUsernameField(field);
  const username = usernameField ? usernameField.value : '';
  return `${domain}_${username}`;
}

// 添加查找用户名输入框的函数
function findUsernameField(passwordField) {
  // 1. 尝试在同一表单中查找
  if (passwordField.form) {
    const inputs = Array.from(passwordField.form.getElementsByTagName('input'));
    const index = inputs.indexOf(passwordField);
    if (index > 0) {
      const prevInput = inputs[index - 1];
      if (isUsernameField(prevInput)) {
        return prevInput;
      }
    }
  }
  
  // 2. 尝试查找密码框前面的输入框
  const allInputs = Array.from(document.getElementsByTagName('input'));
  const index = allInputs.indexOf(passwordField);
  if (index > 0) {
    const prevInput = allInputs[index - 1];
    if (isUsernameField(prevInput)) {
      return prevInput;
    }
  }
  
  return null;
}

// 判断是否为用户名输入框
function isUsernameField(input) {
  if (!input || !input.type) return false;
  
  const usernameTypes = ['text', 'email', 'tel'];
  const usernameIdentifiers = ['user', 'email', 'login', 'name', 'account'];
  
  // 检查输入框类型
  if (!usernameTypes.includes(input.type.toLowerCase())) return false;
  
  // 检查输入框的id、name、placeholder等属性
  const attributes = [
    input.id,
    input.name,
    input.placeholder,
    input.getAttribute('aria-label')
  ].map(attr => (attr || '').toLowerCase());
  
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

function showPasswordSuggestion(field, noteData) {
  // 移除可能已存在的弹窗
  const existingSuggestion = document.querySelector('.password-suggestion');
  if (existingSuggestion) {
    existingSuggestion.remove();
  }

  const suggestion = document.createElement('div');
  suggestion.className = 'password-suggestion';
  
  const note = noteData.note;
  const isLongText = note.length > 100;
  const displayText = isLongText ? `${note.slice(0, 100)}...` : note;

  suggestion.innerHTML = `
    <div class="suggestion-header">
      <img src="${chrome.runtime.getURL('icons/icon48.png')}" class="suggestion-icon" />
      <span>备注信息</span>
      <button class="edit-note-btn" title="编辑备注">✏️</button>
    </div>
    <div class="suggestion-content">
      <div class="suggestion-note">
        <span class="note-text">${displayText}</span>
        ${isLongText ? `
          <button class="toggle-text-btn" data-expanded="false">
            展开
          </button>
        ` : ''}
      </div>
      <div class="suggestion-meta">
        <span class="meta-text">上次更新: ${new Date(noteData.updateTime).toLocaleString()}</span>
      </div>
    </div>
  `;
  
  // 定位在密码框右侧，与表单顶部对齐
  const formRect = field.closest('form')?.getBoundingClientRect() || field.getBoundingClientRect();
  const fieldRect = field.getBoundingClientRect();
  suggestion.style.top = `${formRect.top}px`;
  suggestion.style.left = `${fieldRect.right + 10}px`;
  
  document.body.appendChild(suggestion);
  
  // 添加编辑按钮点击事件
  const editBtn = suggestion.querySelector('.edit-note-btn');
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showEditNotePopup(field, noteData.note);
    suggestion.remove();
  });

  // 添加动画效果
  setTimeout(() => {
    suggestion.classList.add('show');
  }, 10);
  
  // 点击其他地方时关闭
  document.addEventListener('click', (e) => {
    if (!suggestion.contains(e.target) && e.target !== field) {
      suggestion.classList.remove('show');
      setTimeout(() => {
        suggestion.remove();
      }, 200);
    }
  }, { once: true });

  // 添加展开/收起功能
  if (isLongText) {
    const toggleBtn = suggestion.querySelector('.toggle-text-btn');
    const noteText = suggestion.querySelector('.note-text');
    
    toggleBtn.addEventListener('click', () => {
      const isExpanded = toggleBtn.dataset.expanded === 'true';
      if (isExpanded) {
        noteText.textContent = displayText;
        toggleBtn.textContent = '展开';
        toggleBtn.dataset.expanded = 'false';
      } else {
        noteText.textContent = note;
        toggleBtn.textContent = '收起';
        toggleBtn.dataset.expanded = 'true';
      }
    });
  }
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

function addNoteIndicator(field, note) {
  const indicator = document.createElement('div');
  indicator.className = 'note-indicator';
  indicator.innerHTML = '📝';
  indicator.title = note;
  
  // 定位在密码框右侧
  const fieldRect = field.getBoundingClientRect();
  indicator.style.top = `${fieldRect.top}px`;
  indicator.style.left = `${fieldRect.right - 24}px`;
  
  document.body.appendChild(indicator);
} 
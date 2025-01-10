// 在文件开头添加排序状态
let sortConfig = {
  field: 'updateTime',
  direction: 'desc'
};
let isSelectMode = false;

// 加载所有备注
async function loadAllNotes() {
  chrome.storage.local.get(null, (result) => {
    const notes = Object.values(result).filter(note => 
      note && note.domain && note.note && note.username && note.key
    );
    displayNotes(notes);
  });
}

// 显示备注列表
function displayNotes(notes, searchTerm = '') {
  const notesList = document.getElementById('notesList');
  
  // 过滤和排序
  const validNotes = notes.filter(note => 
    note && note.domain && note.note && note.username && note.key
  ).sort((a, b) => {
    const direction = sortConfig.direction === 'asc' ? 1 : -1;
    switch (sortConfig.field) {
      case 'updateTime':
        return direction * (new Date(b.updateTime) - new Date(a.updateTime));
      case 'username':
        return direction * a.username.localeCompare(b.username);
      case 'domain':
        return direction * a.domain.localeCompare(b.domain);
      default:
        return 0;
    }
  });

  if (validNotes.length === 0) {
    if (searchTerm) {
      // 搜索无结果状态
      notesList.innerHTML = `
        <div class="no-results">
          <h3>未找到相关备注</h3>
          <p>没有找到与 "<span class="search-term">${searchTerm}</span>" 相关的备注</p>
        </div>
      `;
    } else {
      // 空状态
      notesList.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24">
            <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" fill="currentColor"/>
            <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="currentColor"/>
          </svg>
          <h3>暂无备注信息</h3>
          <p>当您在登录页面添加备注后，备注信息会显示在这里</p>
        </div>
      `;
    }
    return;
  }

  // 修改卡片模板，添加复选框
  notesList.innerHTML = validNotes.map(note => {
    // 格式化域名显示
    const url = new URL(note.domain);
    const displayDomain = url.hostname.replace(/^www\./, '');
    const favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;

    return `
      <div class="note-card" data-key="${note.key}">
        <input type="checkbox" class="select-checkbox" aria-label="选择备注">
        <div class="note-header">
          <div class="note-domain">
            <img src="${favicon}" class="domain-icon" alt="${displayDomain}">
            <span>${displayDomain}</span>
          </div>
          <div class="note-time" title="${new Date(note.updateTime).toLocaleString()}">
            ${formatTime(note.updateTime)}
          </div>
        </div>
        <div class="note-main">
          <div class="note-username">
            <svg class="user-icon" viewBox="0 0 24 24" width="16" height="16">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
            </svg>
            ${note.username}
          </div>
          <div class="note-content" title="${note.note}">
            ${note.note.length > 50 ? note.note.slice(0, 50) + '...' : note.note}
          </div>
        </div>
        <div class="note-actions">
          <button class="action-btn edit-btn" title="编辑">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
            </svg>
          </button>
          <button class="action-btn delete-btn" title="删除">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  addNoteActions();
}

// 按域名分组备注
function groupNotesByDomain(notes) {
  return notes.reduce((groups, note) => {
    if (!groups[note.domain]) {
      groups[note.domain] = [];
    }
    groups[note.domain].push(note);
    return groups;
  }, {});
}

// 搜索功能
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  let debounceTimer;

  const performSearch = (searchTerm) => {
    chrome.storage.local.get(null, (result) => {
      const notes = Object.values(result);
      const filteredNotes = notes.filter(note => {
        if (!note || !note.domain || !note.username || !note.note) {
          return false;
        }
        
        const term = searchTerm.toLowerCase();
        return note.domain.toLowerCase().includes(term) ||
               note.username.toLowerCase().includes(term) ||
               note.note.toLowerCase().includes(term);
      });
      displayNotes(filteredNotes, searchTerm);  // 传递搜索词
    });
  };

  // 输入事件处理
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSearch(e.target.value);
    }, 300);
  });

  // 回车键处理
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch(searchInput.value);
    }
  });
}

// 添加备注操作的事件监听
function addNoteActions() {
  // 编辑按钮
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const noteCard = e.target.closest('.note-card');
      const noteContent = noteCard.querySelector('.note-content');
      const key = noteCard.dataset.key;
      
      // 添加编辑状态类名
      noteCard.classList.add('editing');
      
      // 切换到编辑模式
      noteContent.innerHTML = `
        <div class="edit-mode">
          <textarea class="edit-input" placeholder="输入备注内容">${noteContent.getAttribute('title')}</textarea>
          <div class="edit-actions">
            <button class="save-edit-btn">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="currentColor"/>
              </svg>
              保存
            </button>
            <button class="cancel-edit-btn">取消</button>
          </div>
          <div class="keyboard-tips">
            <span class="tip-item">
              <kbd>Ctrl</kbd> + <kbd>Enter</kbd> 保存
            </span>
            <span class="tip-item">
              <kbd>Esc</kbd> 取消
            </span>
          </div>
        </div>
      `;

      const editInput = noteContent.querySelector('.edit-input');
      const saveBtn = noteContent.querySelector('.save-edit-btn');
      const cancelBtn = noteContent.querySelector('.cancel-edit-btn');
      
      // 自动调整文本框高度
      editInput.style.height = 'auto';
      editInput.style.height = editInput.scrollHeight + 'px';
      
      // 聚焦输入框并将光标移到末尾
      editInput.focus();
      editInput.setSelectionRange(editInput.value.length, editInput.value.length);

      // 保存编辑
      const saveEdit = () => {
        const newNote = editInput.value.trim();
        if (!newNote) return;

        chrome.storage.local.get([key], (result) => {
          const noteData = result[key];
          noteData.note = newNote;
          noteData.updateTime = new Date().toISOString();
          
          chrome.storage.local.set({
            [key]: noteData
          }, () => {
            // 更新显示并移除编辑状态
            noteCard.classList.remove('editing');
            noteContent.innerHTML = newNote.length > 50 ? 
              `${newNote.slice(0, 50)}...` : newNote;
            noteContent.setAttribute('title', newNote);
          });
        });
      };

      // 取消编辑
      const cancelEdit = () => {
        const originalNote = noteContent.getAttribute('title');
        noteCard.classList.remove('editing');
        noteContent.innerHTML = originalNote.length > 50 ? 
          `${originalNote.slice(0, 50)}...` : originalNote;
      };

      // 绑定事件
      saveBtn.addEventListener('click', saveEdit);
      cancelBtn.addEventListener('click', cancelEdit);

      // 添加键盘事件
      editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          saveEdit();
        } else if (e.key === 'Escape') {
          cancelEdit();
        }
      });
    });
  });
  
  // 删除按钮
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const noteCard = e.target.closest('.note-card');
      const key = noteCard.dataset.key;
      
      if (confirm('确定要删除这条备注吗？')) {
        chrome.storage.local.remove(key, () => {
          noteCard.remove();
          // 如果没有备注了，显示空状态
          if (document.querySelectorAll('.note-card').length === 0) {
            document.getElementById('notesList').innerHTML = `
              <div class="empty-state">
                <p>暂无备注信息</p>
              </div>
            `;
          }
        });
      }
    });
  });
}

// 添加 Toast 提示函数
function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// 修改 setupControls 函数
function setupControls() {
  const sortSelect = document.getElementById('sortSelect');
  const sortDirection = document.getElementById('sortDirection');
  const toggleSelect = document.getElementById('toggleSelect');
  const deleteSelected = document.getElementById('deleteSelected');
  const selectAll = document.getElementById('selectAll');

  // 排序事件
  sortSelect.addEventListener('change', (e) => {
    sortConfig.field = e.target.value;
    loadAllNotes();
  });

  sortDirection.addEventListener('click', () => {
    sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    sortDirection.classList.toggle('desc', sortConfig.direction === 'desc');
    loadAllNotes();
  });

  // 批量选择事件
  toggleSelect.addEventListener('click', () => {
    isSelectMode = !isSelectMode;
    document.body.classList.toggle('select-mode', isSelectMode);
    toggleSelect.textContent = isSelectMode ? '取消' : '选择';
    deleteSelected.style.display = isSelectMode ? 'block' : 'none';
  });

  // 全选功能
  selectAll.addEventListener('change', () => {
    const checkboxes = document.querySelectorAll('.note-card .select-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = selectAll.checked;
    });
  });

  // 监听单个复选框变化，更新全选状态
  document.addEventListener('change', (e) => {
    if (e.target.matches('.note-card .select-checkbox')) {
      const checkboxes = document.querySelectorAll('.note-card .select-checkbox');
      const checkedBoxes = document.querySelectorAll('.note-card .select-checkbox:checked');
      selectAll.checked = checkboxes.length === checkedBoxes.length;
    }
  });

  // 添加数据验证函数
  async function validateKeys(keys) {
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new Error('无效的删除数据');
    }
    
    // 验证所有 key 是否存在
    const data = await chrome.storage.local.get(keys);
    const validKeys = keys.filter(key => data[key]);
    
    if (validKeys.length === 0) {
      throw new Error('未找到要删除的数据');
    }
    
    return validKeys;
  }

  // 修改删除处理函数
  async function deleteNotes(keys) {
    try {
      // 验证要删除的 keys
      const validKeys = await validateKeys(keys);
      
      // 执行删除操作
      await chrome.storage.local.remove(validKeys);
      
      // 返回成功删除的数量
      return validKeys.length;
    } catch (error) {
      console.error('删除笔记失败:', error);
      throw error;
    }
  }

  // 更新批量删除事件处理
  deleteSelected.addEventListener('click', async () => {
    const selectedNotes = document.querySelectorAll('.note-card .select-checkbox:checked');
    if (selectedNotes.length === 0) {
      showToast('请选择要删除的备注');
      return;
    }

    if (confirm(`确定要删除选中的 ${selectedNotes.length} 条备注吗？`)) {
      try {
        const keys = Array.from(selectedNotes).map(checkbox => 
          checkbox.closest('.note-card').dataset.key
        );
        
        const deletedCount = await deleteNotes(keys);
        showToast(`成功删除 ${deletedCount} 条备注`);
        
        // 重置选择状态
        isSelectMode = false;
        document.body.classList.remove('select-mode');
        document.getElementById('toggleSelect').textContent = '选择';
        document.getElementById('deleteSelected').style.display = 'none';
        
        // 重新加载数据
        await loadAllNotes();
      } catch (error) {
        showToast(error.message || '删除失败，请重试');
      }
    }
  });
}

// 添加时间格式化函数
function formatTime(timeStr) {
  const date = new Date(timeStr);
  const now = new Date();
  const diff = now - date;
  
  // 小于1分钟
  if (diff < 60000) {
    return '刚刚';
  }
  // 小于1小时
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  }
  // 小于24小时
  if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`;
  }
  // 小于7天
  if (diff < 604800000) {
    return `${Math.floor(diff / 86400000)}天前`;
  }
  // 其他情况显示具体日期
  return date.toLocaleDateString();
}

// 添加获取消息的辅助函数
function getMessage(key, substitutions = null) {
  return chrome.i18n.getMessage(key, substitutions);
}

// 修改删除确认
function confirmDelete(count = 1) {
  const message = count === 1 ? 
    getMessage('confirmDelete') : 
    getMessage('confirmDeleteMultiple', [count.toString()]);
  return confirm(message);
}

// 修改删除成功提示
function showDeleteSuccess(count = 1) {
  showToast(getMessage('successNoteDeleted'));
}

// 修改更新成功提示
function showUpdateSuccess() {
  showToast(getMessage('successNoteUpdated'));
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadAllNotes();
  setupSearch();
  setupControls();
}); 
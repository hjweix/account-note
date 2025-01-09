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
  notesList.innerHTML = validNotes.map(note => `
    <div class="note-card" data-key="${note.key}">
      <input type="checkbox" class="select-checkbox">
      <div class="note-domain">${note.domain}</div>
      <div class="note-main">
        <div class="note-username">用户名: ${note.username}</div>
        <div class="note-content" title="${note.note}">
          ${note.note.length > 50 ? note.note.slice(0, 50) + '...' : note.note}
        </div>
      </div>
      <div class="note-actions">
        <button class="action-btn edit-btn">编辑</button>
        <button class="action-btn delete-btn">删除</button>
      </div>
    </div>
  `).join('');

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
          <div class="keyboard-tips">
            <span class="tip-item">
              <kbd>Ctrl</kbd> + <kbd>Enter</kbd> 保存
            </span>
            <span class="tip-item">
              <kbd>Esc</kbd> 取消
            </span>
          </div>
        </div>
        <div class="edit-actions">
          <button class="action-btn save-edit-btn">保存</button>
          <button class="action-btn cancel-edit-btn">取消</button>
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

// 添加排序和批量操作的事件处理
function setupControls() {
  const sortSelect = document.getElementById('sortSelect');
  const sortDirection = document.getElementById('sortDirection');
  const toggleSelect = document.getElementById('toggleSelect');
  const deleteSelected = document.getElementById('deleteSelected');

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

  // 批量删除事件
  deleteSelected.addEventListener('click', () => {
    const selectedCards = document.querySelectorAll('.note-card input:checked');
    if (selectedCards.length === 0) {
      alert('请选择要删除的备注');
      return;
    }

    if (confirm(`确定要删除选中的 ${selectedCards.length} 条备注吗？`)) {
      const keys = Array.from(selectedCards).map(checkbox => 
        checkbox.closest('.note-card').dataset.key
      );

      chrome.storage.local.get(null, (result) => {
        keys.forEach(key => {
          delete result[key];
        });

        chrome.storage.local.set(result, () => {
          loadAllNotes();
          isSelectMode = false;
          document.body.classList.remove('select-mode');
          toggleSelect.textContent = '选择';
          deleteSelected.style.display = 'none';
        });
      });
    }
  });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadAllNotes();
  setupSearch();
  setupControls();
}); 
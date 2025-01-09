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
function displayNotes(notes) {
  const notesList = document.getElementById('notesList');
  
  // 过滤掉无效数据
  const validNotes = notes.filter(note => 
    note && note.domain && note.note && note.username && note.key
  );
  
  if (validNotes.length === 0) {
    notesList.innerHTML = `
      <div class="empty-state">
        <p>暂无备注信息</p>
      </div>
    `;
    return;
  }

  // 按域名分组
  const groupedNotes = groupNotesByDomain(validNotes);
  
  notesList.innerHTML = Object.entries(groupedNotes).map(([domain, domainNotes]) => 
    domainNotes.map(note => `
      <div class="note-card" data-key="${note.key}">
        <div class="note-domain">${domain}</div>
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
    `).join('')
  ).join('');

  // 添加事件监听
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
        // 首先确保note是有效的
        if (!note || !note.domain || !note.username || !note.note) {
          return false;
        }
        
        // 转换为小写进行搜索
        const term = searchTerm.toLowerCase();
        return note.domain.toLowerCase().includes(term) ||
               note.username.toLowerCase().includes(term) ||
               note.note.toLowerCase().includes(term);
      });
      displayNotes(filteredNotes);
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
      
      // 切换到编辑模式，使用 textarea
      noteContent.innerHTML = `
        <div class="edit-mode">
          <textarea class="edit-input" placeholder="输入备注内容">${noteContent.getAttribute('title')}</textarea>
          <div class="edit-actions">
            <button class="save-edit-btn">保存</button>
            <button class="cancel-edit-btn">取消</button>
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
            // 更新显示
            noteContent.innerHTML = newNote.length > 50 ? 
              `${newNote.slice(0, 50)}...` : newNote;
            noteContent.setAttribute('title', newNote);
          });
        });
      };

      // 取消编辑
      const cancelEdit = () => {
        const originalNote = noteContent.getAttribute('title');
        noteContent.innerHTML = originalNote.length > 50 ? 
          `${originalNote.slice(0, 50)}...` : originalNote;
      };

      // 绑定事件
      saveBtn.addEventListener('click', saveEdit);
      cancelBtn.addEventListener('click', cancelEdit);

      // 添加键盘事件
      editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
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

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadAllNotes();
  setupSearch();
}); 
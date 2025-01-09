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
        <div class="note-content">${note.note}</div>
        <div class="note-meta">
          <div class="note-info">
            <span>用户名: ${note.username}</span>
            <span>·</span>
            <span>更新于 ${new Date(note.updateTime).toLocaleString()}</span>
          </div>
          <div class="note-actions">
            <button class="action-btn edit-btn">编辑</button>
            <button class="action-btn delete-btn">删除</button>
          </div>
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
      const noteCard = e.target.closest('.note-card');
      const key = noteCard.dataset.key;
      
      // 获取备注数据
      chrome.storage.local.get([key], (result) => {
        const noteData = result[key];
        showEditDialog(noteCard, noteData);
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

// 显示编辑对话框
function showEditDialog(noteCard, noteData) {
  // 创建编辑对话框
  const dialog = document.createElement('div');
  dialog.className = 'edit-dialog';
  dialog.innerHTML = `
    <div class="edit-dialog-content">
      <div class="edit-header">
        <h3>编辑备注</h3>
        <button class="close-btn">×</button>
      </div>
      <div class="edit-body">
        <input type="text" class="edit-input" value="${noteData.note}" placeholder="输入备注内容">
      </div>
      <div class="edit-footer">
        <button class="cancel-btn">取消</button>
        <button class="save-btn">保存</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // 获取元素
  const input = dialog.querySelector('.edit-input');
  const closeBtn = dialog.querySelector('.close-btn');
  const cancelBtn = dialog.querySelector('.cancel-btn');
  const saveBtn = dialog.querySelector('.save-btn');
  
  // 聚焦输入框
  input.focus();
  
  // 绑定事件
  const closeDialog = () => {
    dialog.remove();
  };
  
  closeBtn.onclick = closeDialog;
  cancelBtn.onclick = closeDialog;
  
  // 保存功能
  saveBtn.onclick = () => {
    const newNote = input.value.trim();
    if (!newNote) return;
    
    // 更新数据
    noteData.note = newNote;
    noteData.updateTime = new Date().toISOString();
    
    chrome.storage.local.set({
      [noteData.key]: noteData
    }, () => {
      // 更新显示
      noteCard.querySelector('.note-content').textContent = newNote;
      noteCard.querySelector('.note-info').innerHTML = `
        <span>用户名: ${noteData.username}</span>
        <span>·</span>
        <span>更新于 ${new Date(noteData.updateTime).toLocaleString()}</span>
      `;
      closeDialog();
    });
  };
  
  // 添加回车保存功能
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBtn.click();
    } else if (e.key === 'Escape') {
      closeDialog();
    }
  });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadAllNotes();
  setupSearch();
}); 
document.addEventListener('DOMContentLoaded', async () => {
  // 获取当前标签页信息
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = new URL(tab.url).origin;

  // 加载当前网站的备注
  loadSiteNotes(domain);

  // 添加管理按钮点击事件
  document.getElementById('openManagement').addEventListener('click', () => {
    chrome.tabs.create({ url: 'management.html' });
  });
});

// 加载当前网站的备注
async function loadSiteNotes(domain) {
  const notesList = document.getElementById('notesList');
  
  chrome.storage.local.get(null, (result) => {
    // 过滤出当前网站的备注
    const notes = Object.values(result).filter(note => 
      note && note.domain === domain && note.username && note.note
    );

    if (notes.length === 0) {
      // 保持原有的空状态显示
      showEmptyState(notesList);
      
      // 添加新备注按钮事件
      const addBtn = notesList.querySelector('.add-note-btn');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          chrome.tabs.sendMessage(tab.id, { action: 'showAddNotePopup' });
        });
      }
    } else {
      // 清空列表
      notesList.innerHTML = '';
      // 使用 displayNotes 显示备注
      displayNotes(notes);
    }
  });
}

// 修改 displayNotes 函数
function displayNotes(notes) {
  const notesList = document.getElementById('notesList');
  
  notes.forEach(note => {
    const noteElement = document.createElement('div');
    noteElement.className = 'note-item';
    noteElement.dataset.key = note.key;
    
    // 用户名部分
    const username = document.createElement('div');
    username.className = 'note-username';
    username.textContent = note.username;
    
    // 备注内容部分
    const noteContent = document.createElement('div');
    noteContent.className = 'note-content';
    
    // 备注文本容器
    const noteText = document.createElement('div');
    noteText.className = 'note-text';
    noteText.textContent = note.note;
    noteText.title = note.note;
    
    // 编辑按钮
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
      </svg>
    `;
    editBtn.title = '编辑';
    
    noteContent.appendChild(noteText);
    noteContent.appendChild(editBtn);
    
    // 添加编辑功能
    editBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!noteText.isEditing) {
        noteText.isEditing = true;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'note-edit-input';
        input.value = note.note;
        
        // 处理保存
        const saveEdit = () => {
          const newNote = input.value.trim();
          if (newNote && newNote !== note.note) {
            chrome.storage.local.get(note.key, (result) => {
              const noteData = result[note.key];
              noteData.note = newNote;
              noteData.updateTime = new Date().toISOString();
              
              chrome.storage.local.set({
                [note.key]: noteData
              }, () => {
                noteText.textContent = newNote;
                noteText.title = newNote;
                showToast(getMessage('successNoteUpdated'));
              });
            });
          }
          noteText.isEditing = false;
          noteText.style.display = 'block';
          editBtn.style.display = 'block';
          input.remove();
        };
        
        // 处理取消
        const cancelEdit = () => {
          noteText.isEditing = false;
          noteText.style.display = 'block';
          editBtn.style.display = 'block';
          input.remove();
        };
        
        // 添加键盘事件
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
          } else if (e.key === 'Escape') {
            cancelEdit();
          }
        });
        
        // 处理失去焦点
        input.addEventListener('blur', () => {
          setTimeout(() => {
            if (noteText.isEditing) {
              saveEdit();
            }
          }, 200);
        });
        
        // 隐藏原文本和编辑按钮，插入输入框
        noteText.style.display = 'none';
        editBtn.style.display = 'none';
        noteContent.insertBefore(input, noteText);
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
    
    noteElement.appendChild(username);
    noteElement.appendChild(noteContent);
    notesList.appendChild(noteElement);
  });
}

// 添加 Toast 提示函数
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 2000);
}

// 修改空状态显示
function showEmptyState(notesList) {
  notesList.innerHTML = `
    <div class="empty-state">
      <p>${getMessage('emptyStateTitle')}</p>
      <button class="add-note-btn">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/>
        </svg>
        ${getMessage('addNote')}
      </button>
    </div>
  `;
}

// 添加获取消息的辅助函数
function getMessage(key, substitutions = null) {
  return chrome.i18n.getMessage(key, substitutions);
} 
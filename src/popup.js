document.addEventListener('DOMContentLoaded', async () => {
  // 初始化主题
  initTheme();

  // 初始化国际化文本
  document.getElementById('extTitle').textContent = getMessage('extName');
  document.getElementById('currentSiteNotes').textContent = getMessage('notes');
  document.getElementById('openManagement').title = getMessage('manage') || '管理所有备注';
  document.getElementById('pickFieldText').textContent = getMessage('pickFieldBtn') || '本页识别不到？手动指定输入框';
  document.getElementById('clearAnchorText').textContent = getMessage('clearAnchorsForSite') || '清除';

  // 获取当前标签页信息
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let domain = '';
  try {
    domain = new URL(tab.url).origin;
  } catch (error) {
    domain = '';
  }

  // 浏览器内置页面（chrome://、扩展页等）注入不了 content script，隐藏锚定入口
  if (!/^https?:\/\//.test(domain)) {
    document.getElementById('pickFieldBtn').hidden = true;
    document.getElementById('anchorPanel').hidden = true;
  }

  // 加载当前网站的备注
  loadSiteNotes(domain);

  // 加载当前网站的锚定记录
  loadAnchorInfo(domain);

  // 添加管理按钮点击事件
  document.getElementById('openManagement').addEventListener('click', () => {
    chrome.tabs.create({ url: 'management.html' });
  });

  // 初始化手动锚定
  setupFieldPicker(tab, domain);
});

// ===== 手动锚定 =====

// 读取当前站点的锚定记录并更新提示条
function loadAnchorInfo(domain) {
  if (!domain) return;
  chrome.storage.local.get(['fieldAnchors'], (result) => {
    const all = result.fieldAnchors;
    const list = all && typeof all === 'object' && Array.isArray(all[domain]) ? all[domain] : [];
    document.getElementById('anchorPanel').hidden = list.length === 0;
    document.getElementById('anchorCountText').textContent =
      getMessage('anchoredCount', [String(list.length)]) || `本页已锚定 ${list.length} 个输入框`;
  });
}

// 拾取入口：向主框架投递指令，由 content script 在页面内完成高亮与绑定
function setupFieldPicker(tab, domain) {
  const pickBtn = document.getElementById('pickFieldBtn');

  pickBtn.addEventListener('click', async () => {
    pickBtn.disabled = true;
    let ok = false;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'startFieldPicker' }, { frameId: 0 });
      ok = !!(response && response.ok);
    } catch (error) {
      // 页面在扩展（重）加载之前就已打开时，content script 不会回溯注入
      ok = false;
    }
    pickBtn.disabled = false;

    if (ok) {
      window.close();
    } else {
      showToast(getMessage('pickerConnectFailed') || '无法连接当前页面，请刷新页面后重试');
    }
  });

  document.getElementById('clearAnchorBtn').addEventListener('click', () => {
    if (!domain) return;
    chrome.storage.local.get(['fieldAnchors'], (result) => {
      const all = result.fieldAnchors;
      if (!all || typeof all !== 'object' || !all[domain]) return;
      const next = { ...all };
      delete next[domain];

      const done = () => {
        loadAnchorInfo(domain);
        showToast(getMessage('anchorsCleared') || '已清除本页锚定记录');
      };

      // 最后一个站点被清掉后连同顶层键一起移除，不留下空对象
      if (Object.keys(next).length === 0) {
        chrome.storage.local.remove('fieldAnchors', done);
      } else {
        chrome.storage.local.set({ fieldAnchors: next }, done);
      }
    });
  });
}

// 初始化主题
async function initTheme() {
  try {
    const result = await chrome.storage.local.get('theme');
    const theme = result.theme || 'auto';

    if (theme === 'auto') {
      // 跟随系统，不设置 data-theme，让 CSS 媒体查询生效
      document.body.removeAttribute('data-theme');
    } else {
      // 手动设置浅色或深色
      document.body.setAttribute('data-theme', theme);
    }
  } catch (error) {
    console.error('Failed to initialize theme:', error);
  }
}

// 加载当前网站的备注
async function loadSiteNotes(domain) {
  const notesList = document.getElementById('notesList');
  
  // 获取当前标签页，用于后续发送消息
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
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

    // 收藏按钮
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = `favorite-btn ${note.isFavorite ? 'is-favorite' : ''}`;
    favoriteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="currentColor"/>
      </svg>
    `;
    favoriteBtn.title = note.isFavorite ? getMessage('removeFavorite') : getMessage('addFavorite');
    favoriteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const result = await chrome.storage.local.get([note.key]);
        const noteData = result[note.key];
        if (!noteData) return;

        const newFavoriteStatus = !noteData.isFavorite;
        const updatedData = {
          ...noteData,
          isFavorite: newFavoriteStatus,
          favoriteTime: newFavoriteStatus ? new Date().toISOString() : null
        };

        await chrome.storage.local.set({ [note.key]: updatedData });

        // 更新UI
        favoriteBtn.classList.toggle('is-favorite', newFavoriteStatus);
        favoriteBtn.title = newFavoriteStatus ? getMessage('removeFavorite') : getMessage('addFavorite');

        showToast(newFavoriteStatus ? getMessage('addedToFavorites') : getMessage('removedFromFavorites'));
      } catch (error) {
        console.error('Toggle favorite error:', error);
      }
    });

    // 用户名部分
    const username = document.createElement('div');
    username.className = 'note-username';
    username.textContent = note.username;

    // 备注内容部分
    const noteContent = document.createElement('div');
    noteContent.className = 'note-content';

    // 备注文本容器
    const noteText = document.createElement('div');
    noteText.className = 'account-note-text';
    noteText.textContent = note.note;
    noteText.title = note.note;

    // 标签容器
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'note-tags';
    if (note.tags && note.tags.length > 0) {
      note.tags.forEach(tag => {
        const tagBadge = document.createElement('span');
        tagBadge.className = 'tag-badge';
        tagBadge.textContent = tag;
        tagsContainer.appendChild(tagBadge);
      });
    }

    // 编辑按钮
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
      </svg>
    `;
    editBtn.title = getMessage('editNote');
    
    noteContent.appendChild(noteText);
    noteContent.appendChild(editBtn);
    
    // 添加编辑功能
    const handleEditClick = function(e) {
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
    };
    editBtn.addEventListener('click', handleEditClick);

    noteContent.appendChild(noteText);
    noteContent.appendChild(editBtn);

    noteElement.appendChild(favoriteBtn);
    noteElement.appendChild(username);
    noteElement.appendChild(noteContent);
    noteElement.appendChild(tagsContainer);
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
      <p>${getMessage('emptyStateDesc')}</p>
    </div>
  `;
}

// 添加获取消息的辅助函数
function getMessage(key, substitutions = null) {
  return chrome.i18n.getMessage(key, substitutions);
}

// 初始化国际化文本
function initI18nTexts() {
  // 设置扩展标题
  document.getElementById('extTitle').textContent = getMessage('extName');
  
  // 设置当前网站备注标题
  document.getElementById('currentSiteNotes').textContent = getMessage('notes');
  
  // 设置管理按钮提示文本
  document.getElementById('openManagement').title = getMessage('manage') || '管理所有备注';
}
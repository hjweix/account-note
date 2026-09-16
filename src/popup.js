document.addEventListener('DOMContentLoaded', async () => {
  // 初始化主题
  initTheme();

  // 初始化国际化文本
  document.getElementById('extTitle').textContent = getMessage('extName');
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

  // 小节标签：「当前站点 · github.com」，显示 host 比完整 origin 更易读
  let host = domain;
  try {
    host = new URL(tab.url).host || domain;
  } catch (error) {
    host = domain;
  }
  document.getElementById('currentSiteNotes').textContent = host
    ? `${getMessage('currentSiteLabel') || '当前站点'} · ${host}`
    : getMessage('notes');

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

// 拾取入口：向主框架投递指令，由 content script 在页面内完成高亮与绑定。
// 失败时按页面侧回传的 reason 分流——禁用类问题给恢复入口、无候选框如实说明，
// 只有真正的消息通道失败才提「刷新」。把所有失败都说成「请刷新」是误导：
// 站点被禁用时刷新多少次都没用。
function setupFieldPicker(tab, domain) {
  const pickBtn = document.getElementById('pickFieldBtn');
  const hint = document.getElementById('pickerHint');
  const hintText = document.getElementById('pickerHintText');
  const hintBtn = document.getElementById('pickerHintBtn');

  const hideHint = () => {
    hint.hidden = true;
    hintBtn.hidden = true;
  };

  // 请求进入拾取模式；无响应（content script 未注入或已失效）时返回 null
  const tryStart = async () => {
    try {
      return (await chrome.tabs.sendMessage(tab.id, { action: 'startFieldPicker' }, { frameId: 0 })) || null;
    } catch (error) {
      return null;
    }
  };

  // 站点被停用：给出去路，而不是让用户反复刷新
  const showDisabledHint = reason => {
    const isGlobal = reason === 'global-disabled';
    hintText.textContent = isGlobal
      ? getMessage('pickerGlobalDisabledHint') || '备注功能已在所有网站上停用，无法锚定输入框。'
      : getMessage('pickerSiteDisabledHint') || '本站点的备注功能已停用，无法锚定输入框。';
    hintBtn.textContent = getMessage('enableSiteBtn') || '启用备注功能';
    hint.hidden = false;
    hintBtn.hidden = false;
  };

  pickBtn.addEventListener('click', async () => {
    pickBtn.disabled = true;
    hideHint();
    const response = await tryStart();
    pickBtn.disabled = false;

    // 已进入拾取模式，弹窗让位给页面上的高亮
    if (response && response.ok) {
      window.close();
      return;
    }

    const reason = (response && response.reason) || 'context-invalid';

    if (reason === 'global-disabled' || reason === 'site-disabled' || reason === 'session-disabled') {
      showDisabledHint(reason);
      return;
    }
    if (reason === 'no-candidates') {
      showToast(getMessage('pickerNoCandidates') || '当前页面没有可锚定的输入框');
      return;
    }
    // context-invalid / non-http / 无任何响应：确实连不上页面
    showToast(getMessage('pickerConnectFailed') || '无法连接当前页面，请刷新页面后重试');
  });

  hintBtn.addEventListener('click', async () => {
    hintBtn.disabled = true;
    let enabled = null;
    try {
      enabled = (await chrome.tabs.sendMessage(tab.id, { action: 'enableCurrentSite' }, { frameId: 0 })) || null;
    } catch (error) {
      enabled = null;
    }
    hintBtn.disabled = false;

    if (enabled && enabled.ok) {
      // 启用成功就直接进入拾取，省掉用户再点一次
      const started = await tryStart();
      if (started && started.ok) {
        window.close();
        return;
      }
      hideHint();
      showToast(getMessage('siteEnabled') || '已启用本站点的备注功能');
      loadSiteNotes(domain);
      loadAnchorInfo(domain);
      return;
    }
    showToast(getMessage('pickerConnectFailed') || '无法连接当前页面，请刷新页面后重试');
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
      // 空状态 + 「去页面添加备注」入口（chrome:// 等不可注入页面除外）
      const canInject = /^https?:\/\//.test(domain);
      showEmptyState(notesList, canInject);

      const addBtn = notesList.querySelector('.add-note-btn');
      if (addBtn) {
        addBtn.addEventListener('click', async () => {
          addBtn.disabled = true;
          let response = null;
          try {
            response = await chrome.tabs.sendMessage(tab.id, { action: 'showAddNotePopup' }) || null;
          } catch (error) {
            response = null;
          }
          addBtn.disabled = false;

          if (response && response.ok) {
            // 弹窗已在页面上打开，popup 让位
            window.close();
            return;
          }
          if (response && response.reason === 'no-password-field') {
            showToast(getMessage('noLoginForm'));
            return;
          }
          // content script 未注入或已失效：确实连不上页面
          showToast(getMessage('pickerConnectFailed'));
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

// 修改 displayNotes 函数：行式布局（头像 + 用户名/备注/标签 + 星标），点击行进入编辑
function displayNotes(notes) {
  const notesList = document.getElementById('notesList');

  notes.forEach(note => {
    const noteElement = document.createElement('div');
    noteElement.className = 'note-item';
    noteElement.dataset.key = note.key;

    // 头像：用户名首字母
    const avatar = document.createElement('div');
    avatar.className = 'note-avatar';
    avatar.textContent = (note.username.trim()[0] || '?').toUpperCase();

    // 主列：用户名 + （备注 / 标签行）
    const main = document.createElement('div');
    main.className = 'note-main';

    const username = document.createElement('div');
    username.className = 'note-username';
    username.textContent = note.username;
    username.title = note.username;

    // 备注内容部分
    const noteContent = document.createElement('div');
    noteContent.className = 'note-meta';

    // 备注文本
    const noteText = document.createElement('span');
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

    noteContent.appendChild(noteText);
    noteContent.appendChild(tagsContainer);

    main.appendChild(username);
    main.appendChild(noteContent);

    // 收藏按钮（常驻右侧）
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = `favorite-btn ${note.isFavorite ? 'is-favorite' : ''}`;
    favoriteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="15" height="15">
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

        // 更新UI。星标颜色本身就是即时反馈，高频微操作不再弹 toast
        favoriteBtn.classList.toggle('is-favorite', newFavoriteStatus);
        favoriteBtn.title = newFavoriteStatus ? getMessage('removeFavorite') : getMessage('addFavorite');
      } catch (error) {
        console.error('Toggle favorite error:', error);
        showToast(getMessage('operationFailed') || '操作失败，请重试', 'error');
      }
    });

    // 点击行直接进入编辑（与页面弹窗「点击正文编辑」同一交互语言）
    const handleEditClick = function(e) {
      if (noteText.isEditing) return;
      noteText.isEditing = true;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'note-edit-input';
      input.value = note.note;
      input.setAttribute('aria-label', getMessage('editNote'));

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
        noteText.style.display = '';
        input.remove();
      };

      // 处理取消
      const cancelEdit = () => {
        noteText.isEditing = false;
        noteText.style.display = '';
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

      // 处理失去焦点。200ms 缓冲让点击事件的冒泡先走完；
      // 若焦点移到了本行的星标按钮，让位给收藏点击并重新聚焦输入框，
      // 避免保存动作与收藏切换撞在同一时刻
      input.addEventListener('blur', () => {
        setTimeout(() => {
          if (!noteText.isEditing) return;
          if (document.activeElement === favoriteBtn) {
            input.focus();
            return;
          }
          saveEdit();
        }, 200);
      });

      // 点击输入框本身不触发行点击
      input.addEventListener('click', (e) => e.stopPropagation());

      // 隐藏原文本，插入输入框
      noteText.style.display = 'none';
      noteContent.insertBefore(input, noteText);
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    };
    noteElement.addEventListener('click', handleEditClick);

    // 键盘可达：行可聚焦，Enter / Space 触发编辑
    noteElement.tabIndex = 0;
    noteElement.setAttribute('role', 'button');
    noteElement.setAttribute('aria-label', `${note.username}：${note.note}`);
    noteElement.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleEditClick(e);
      }
    });

    noteElement.appendChild(avatar);
    noteElement.appendChild(main);
    noteElement.appendChild(favoriteBtn);
    notesList.appendChild(noteElement);
  });
}

// Toast：type 决定左侧状态色条（success/error/info），错误停留 4s 保证可读
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  const duration = type === 'error' ? 4000 : 2000;
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

// 空状态显示。canInject 为 false（chrome:// 等内置页面）时不显示添加入口，
// 因为那些页面连不上 content script，点了也只会失败
function showEmptyState(notesList, canInject) {
  notesList.innerHTML = `
    <div class="empty-state">
      <p>${getMessage('emptyStateTitle')}</p>
      <p>${getMessage('emptyStateDesc')}</p>
    </div>
    ${canInject ? `
    <button type="button" class="add-note-btn">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/>
      </svg>
      <span>${getMessage('addNoteOnPage')}</span>
    </button>` : ''}
  `;
}

// 添加获取消息的辅助函数
function getMessage(key, substitutions = null) {
  return chrome.i18n.getMessage(key, substitutions);
}
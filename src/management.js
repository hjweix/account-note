// 在文件开头添加排序状态
let sortConfig = {
  field: 'updateTime',
  direction: 'desc'
};
let isSelectMode = false;
let currentTheme = 'auto'; // 添加主题状态
let activeTab = 'notes'; // 添加当前标签页状态
let currentFilter = {
  tags: [],
  isFavorite: false,
  searchTerm: ''
};

/**
 * 迁移单个备注数据到最新格式
 * 补充缺失的 tags、isFavorite、favoriteTime 字段
 */
function migrateNoteData(note, key) {
  const migratedNote = { ...note };
  const needsMigration = [];

  // 检查并补充 tags 字段
  if (!Array.isArray(migratedNote.tags)) {
    migratedNote.tags = [];
    needsMigration.push('tags');
  }

  // 检查并补充 isFavorite 字段
  if (typeof migratedNote.isFavorite !== 'boolean') {
    migratedNote.isFavorite = false;
    needsMigration.push('isFavorite');
  }

  // 检查并补充 favoriteTime 字段
  if (migratedNote.isFavorite && !migratedNote.favoriteTime) {
    migratedNote.favoriteTime = migratedNote.updateTime || new Date().toISOString();
    needsMigration.push('favoriteTime');
  } else if (!migratedNote.isFavorite && migratedNote.favoriteTime !== null) {
    migratedNote.favoriteTime = null;
    needsMigration.push('favoriteTime');
  } else if (migratedNote.favoriteTime === undefined) {
    migratedNote.favoriteTime = null;
    needsMigration.push('favoriteTime');
  }

  // 确保 key 字段存在（兼容旧格式）
  if (!migratedNote.key) {
    migratedNote.key = key;
    needsMigration.push('key');
  }

  // 确保必要字段存在
  if (!migratedNote.createTime) {
    migratedNote.createTime = migratedNote.updateTime || new Date().toISOString();
    needsMigration.push('createTime');
  }

  if (!migratedNote.updateTime) {
    migratedNote.updateTime = new Date().toISOString();
    needsMigration.push('updateTime');
  }

  return {
    note: migratedNote,
    needsMigration,
    isMigrated: needsMigration.length > 0
  };
}

/**
 * 批量迁移所有备注数据
 */
async function migrateAllNotes() {
  console.log('[Migration] 开始检查数据迁移...');

  try {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(null, resolve);
    });

    const migrationUpdates = {};
    let migratedCount = 0;
    let totalCount = 0;

    Object.entries(result).forEach(([key, note]) => {
      if (note && note.domain && note.note && note.username) {
        totalCount++;
        const { note: migratedNote, isMigrated } = migrateNoteData(note, key);

        if (isMigrated) {
          migrationUpdates[key] = migratedNote;
          migratedCount++;
          console.log(`[Migration] 迁移备注: ${key}`, {
            updatedFields: migrateNoteData(note, key).needsMigration
          });
        }
      }
    });

    if (migratedCount > 0) {
      console.log(`[Migration] 需迁移 ${migratedCount}/${totalCount} 条备注，开始写入...`);
      await new Promise((resolve) => {
        chrome.storage.local.set(migrationUpdates, resolve);
      });
      console.log(`[Migration] 数据迁移完成，成功迁移 ${migratedCount} 条备注`);

      if (typeof showToast === 'function') {
        showToast(`数据升级完成（${migratedCount}条备注已优化）`, 'success');
      }
    } else {
      console.log(`[Migration] 所有 ${totalCount} 条数据已是最新格式，无需迁移`);
    }

    return { migratedCount, totalCount };
  } catch (error) {
    console.error('[Migration] 数据迁移失败:', error);
    return { migratedCount: 0, totalCount: 0, error: error.message };
  }
}

/**
 * 安全获取备注的 tags
 */
function getNoteTags(note) {
  if (!note) return [];
  return Array.isArray(note.tags) ? note.tags : [];
}

/**
 * 安全获取备注的收藏状态
 */
function getNoteIsFavorite(note) {
  if (!note) return false;
  return typeof note.isFavorite === 'boolean' ? note.isFavorite : false;
}

/**
 * 安全获取备注的收藏时间
 */
function getNoteFavoriteTime(note) {
  if (!note) return null;
  return note.favoriteTime || null;
}

/**
 * 检查备注是否有指定标签
 */
function noteHasTag(note, tag) {
  return getNoteTags(note).includes(tag);
}

/**
 * 规范化备注数据
 */
function normalizeNoteData(note, key) {
  if (!note) return null;

  return {
    key: note.key || key,
    domain: note.domain || '',
    username: note.username || '',
    note: note.note || '',
    createTime: note.createTime || note.updateTime || new Date().toISOString(),
    updateTime: note.updateTime || new Date().toISOString(),
    tags: getNoteTags(note),
    isFavorite: getNoteIsFavorite(note),
    favoriteTime: getNoteFavoriteTime(note)
  };
}

// 等待 DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 初始化主题
  initTheme();

  // 初始化国际化文本
  initI18nTexts();
  loadAllNotes();
  setupSearch();
  setupControls();
  setupFilters(); // 添加筛选功能
  setupTabs(); // 添加标签页切换功能初始化
  setupSettingsSidebar(); // 初始化设置页面
});

// 初始化国际化文本
function initI18nTexts() {
  // 设置页面标题
  document.getElementById('pageTitle').textContent = getMessage('pageTitle');
  
  // 设置标签页文本
  document.getElementById('notesTab').textContent = getMessage('notes');
  document.getElementById('settingsTab').textContent = getMessage('settings');
  
  // 设置搜索框占位符
  document.getElementById('searchInput').placeholder = getMessage('searchPlaceholder');
  
  // 设置排序选项
  document.getElementById('sortByTime').textContent = getMessage('sortByTime');
  document.getElementById('sortByUsername').textContent = getMessage('sortByUsername');
  document.getElementById('sortByDomain').textContent = getMessage('sortByDomain');
  
  // 设置排序方向按钮提示
  document.getElementById('sortDirection').title = getMessage('sortDirectionTitle');
  
  // 设置全选标签
  document.getElementById('selectAllLabel').textContent = getMessage('selectAll');
  
  // 设置选择按钮
  document.getElementById('toggleSelect').textContent = getMessage('select');
  
  // 设置删除所选按钮
  document.getElementById('deleteSelected').textContent = getMessage('deleteSelected');
  
  // 设置全局禁用备注文本
  if (document.getElementById('globalDisableText')) {
    document.getElementById('globalDisableText').textContent = getMessage('disableGlobal') || '全局禁用备注';
  }
  
  // 设置全局禁用描述文本
  if (document.getElementById('globalDisableDesc')) {
    document.getElementById('globalDisableDesc').textContent = getMessage('globalDisableDesc') || '启用此选项将在所有网站上禁用备注弹窗';
  }
  
  // 设置卡片标题
  if (document.getElementById('disabledSitesTitle')) {
    document.getElementById('disabledSitesTitle').textContent = getMessage('disabledSites') || '已禁用网站';
  }
  if (document.getElementById('dataManagementTitle')) {
    document.getElementById('dataManagementTitle').textContent = getMessage('dataManagement') || '数据管理';
  }
  if (document.getElementById('aboutTitle')) {
    document.getElementById('aboutTitle').textContent = getMessage('about') || '关于';
  }
}

// 加载所有备注
async function loadAllNotes() {
  console.log('[LoadAllNotes] 开始加载备注');

  // 第一步：执行数据迁移
  await migrateAllNotes();

  // 第二步：加载所有数据（此时已都是最新格式）
  chrome.storage.local.get(null, (result) => {
    console.log('[LoadAllNotes] 原始数据:', Object.keys(result));

    const notes = Object.entries(result)
      .filter(([key, note]) =>
        note && note.domain && note.note && note.username
      )
      .map(([key, note]) => {
        const finalKey = note.key || key;
        console.log(`[LoadAllNotes] 处理备注: 存储key=${key}, note.key=${note.key}, 最终key=${finalKey}`);

        // 确保返回的数据结构完整
        return {
          key: finalKey,
          domain: note.domain,
          username: note.username,
          note: note.note,
          createTime: note.createTime || new Date().toISOString(),
          updateTime: note.updateTime || new Date().toISOString(),
          tags: getNoteTags(note),
          isFavorite: getNoteIsFavorite(note),
          favoriteTime: getNoteFavoriteTime(note)
        };
      });

    console.log('[LoadAllNotes] 过滤后的备注数:', notes.length);
    console.log('[LoadAllNotes] 第一个备注的tags:', notes[0]?.tags);
    console.log('[LoadAllNotes] 第一个备注的isFavorite:', notes[0]?.isFavorite);

    displayNotes(notes, currentFilter.searchTerm);
  });
}

// 显示备注列表
function displayNotes(notes, searchTerm = '') {
  const notesList = document.getElementById('notesList');

  // 应用筛选
  let filteredNotes = notes.filter(note =>
    note && note.domain && note.note && note.username && note.key
  );

  // 按标签筛选（使用安全访问）
  if (currentFilter.tags && currentFilter.tags.length > 0) {
    filteredNotes = filteredNotes.filter(note =>
      getNoteTags(note).some(tag => currentFilter.tags.includes(tag))
    );
  }

  // 按收藏筛选（使用安全访问）
  if (currentFilter.isFavorite) {
    filteredNotes = filteredNotes.filter(note => getNoteIsFavorite(note));
  }

  // 按搜索词筛选
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredNotes = filteredNotes.filter(note =>
      note.domain.toLowerCase().includes(term) ||
      note.username.toLowerCase().includes(term) ||
      note.note.toLowerCase().includes(term) ||
      (getNoteTags(note).some(tag => tag.toLowerCase().includes(term)))
    );
  }

  // 排序
  const validNotes = filteredNotes.sort((a, b) => {
    const direction = sortConfig.direction === 'asc' ? 1 : -1;

    // 收藏优先
    if (currentFilter.isFavorite) {
      if (a.isFavorite && !b.isFavorite) return -1 * direction;
      if (!a.isFavorite && b.isFavorite) return 1 * direction;
    }

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
    if (searchTerm || currentFilter.tags.length > 0 || currentFilter.isFavorite) {
      // 搜索无结果状态
      notesList.innerHTML = `
        <div class="no-results">
          <h3>${getMessage('noResults')}</h3>
          <p>${getMessage('noResultsDesc', [searchTerm || getMessage('currentFilter') || '当前筛选条件'])}</p>
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
          <h3>${getMessage('emptyStateManagement')}</h3>
          <p>${getMessage('emptyStateManagementDesc')}</p>
        </div>
      `;
    }
    return;
  }

  // 修改卡片模板，添加头像和紧凑布局
  notesList.innerHTML = validNotes.map(note => {
    // 格式化域名显示
    const url = new URL(note.domain);
    const displayDomain = url.hostname.replace(/^www\./, '');
    const favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;

    // 生成标签HTML
    const tagsHtml = note.tags && note.tags.length > 0
      ? `<div class="note-tags">${note.tags.map(tag =>
          `<span class="tag-badge">${escapeHtml(tag)}</span>`
        ).join('')}</div>`
      : '';

    // 生成头像字母（用户名首字母大写）
    const avatarLetter = note.username.charAt(0).toUpperCase();

    return `
      <div class="note-card ${note.isFavorite ? 'is-favorite' : ''}" data-key="${note.key}">
        <input type="checkbox" class="select-checkbox" aria-label="${escapeHtml(getMessage('select'))}">
        <div class="note-header">
          <div class="note-domain">
            <img src="${favicon}" class="domain-icon" alt="${displayDomain}">
            <span>${displayDomain}</span>
          </div>
          <button class="favorite-btn ${note.isFavorite ? 'is-favorite' : ''}" title="${note.isFavorite ? escapeHtml(getMessage('removeFavorite')) : escapeHtml(getMessage('addFavorite'))}">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <div class="note-body">
          <div class="note-avatar">${avatarLetter}</div>
          <div class="note-info">
            <div class="note-username">${escapeHtml(note.username)}</div>
            <div class="note-content" title="${escapeHtml(note.note)}">
              ${note.note.length > 60 ? escapeHtml(note.note.slice(0, 60)) + '...' : escapeHtml(note.note)}
            </div>
          </div>
        </div>
        ${tagsHtml}
        <div class="note-footer">
          <div class="note-time" title="${new Date(note.updateTime).toLocaleString()}">
            ${formatTime(note.updateTime)}
          </div>
          <div class="note-actions">
            <button class="action-btn edit-btn" title="${escapeHtml(getMessage('editNote'))}">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
              </svg>
            </button>
            <button class="action-btn delete-btn" title="${escapeHtml(getMessage('confirmDelete'))}">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  console.log('[DisplayNotes] 共渲染', validNotes.length, '个卡片');

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
    currentFilter.searchTerm = searchTerm;
    chrome.storage.local.get(null, (result) => {
      const notes = Object.values(result);
      displayNotes(notes, searchTerm);
    });
  };

  // 清除之前的事件监听器
  searchInput.removeEventListener('input', handleInput);
  searchInput.removeEventListener('keydown', handleKeydown);

  // 输入事件处理
  function handleInput(e) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSearch(e.target.value);
    }, 300);
  }

  // 回车键处理
  function handleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimer); // 清除定时器
      performSearch(searchInput.value);
    }
  }

  searchInput.addEventListener('input', handleInput);
  searchInput.addEventListener('keydown', handleKeydown);

  // 在页面卸载时清理
  window.addEventListener('unload', () => {
    clearTimeout(debounceTimer);
    searchInput.removeEventListener('input', handleInput);
    searchInput.removeEventListener('keydown', handleKeydown);
  });
}

// 设置选项卡切换
function setupTabs() {
  const notesTab = document.getElementById('notesTab');
  const settingsTab = document.getElementById('settingsTab');
  const notesContent = document.getElementById('notesContent');
  const settingsContent = document.getElementById('settingsContent');
  let settingsInitialized = false; // 添加标记，记录设置页面是否已初始化
  
  notesTab.addEventListener('click', () => {
    notesTab.classList.add('active');
    settingsTab.classList.remove('active');
    notesContent.classList.add('active');
    settingsContent.classList.remove('active');
    activeTab = 'notes';
  });
  
  settingsTab.addEventListener('click', () => {
    settingsTab.classList.add('active');
    notesTab.classList.remove('active');
    settingsContent.classList.add('active');
    notesContent.classList.remove('active');
    activeTab = 'settings';
    
    // 只在第一次切换到设置页面时初始化
    if (!settingsInitialized) {
      console.log('首次初始化设置页面');
      loadDisabledSites();
      setupSettingsSidebar();
      settingsInitialized = true;
    } else {
      console.log('设置页面已初始化，仅更新禁用网站列表');
      loadDisabledSites(); // 仍然需要更新禁用网站列表
    }
  });
}

// 设置卡片布局
function setupSettingsSidebar() {
  // 设置卡片标题国际化文本
  document.getElementById('disabledSitesTitle').textContent = getMessage('disabledSites');
  document.getElementById('dataManagementTitle').textContent = getMessage('dataManagement') || '数据管理';
  document.getElementById('aboutTitle').textContent = getMessage('about') || '关于';
  document.getElementById('tagManagementTitle').textContent = getMessage('tagManagement') || '标签管理';

  // 添加网站表单国际化
  const newSiteInput = document.getElementById('newSiteInput');
  newSiteInput.placeholder = getMessage('newSiteInputPlaceholder') || '输入网站域名，如 example.com';
  const addSiteBtn = document.getElementById('addSiteBtn');
  addSiteBtn.textContent = getMessage('addSite') || '添加';

  // 标签管理国际化
  const newTagInput = document.getElementById('newTagInput');
  newTagInput.placeholder = getMessage('newTagInputPlaceholder') || '输入标签名称，如 工作';
  const addTagBtn = document.getElementById('addTagBtn');
  addTagBtn.textContent = getMessage('addTag') || '添加';

  // 添加标签管理功能
  setupTagManagement();

  // 数据管理卡片国际化
  document.getElementById('settingsExportText').textContent = getMessage('exportAllData') || '导出所有数据';
  document.getElementById('settingsImportText').textContent = getMessage('importData') || '导入数据';
  document.getElementById('clearDataTitle').textContent = getMessage('clearAllData') || '清除所有数据';
  document.getElementById('clearDataText').textContent = getMessage('clear') || '清除';
  
  // 关于卡片国际化
  document.getElementById('versionLabel').textContent = getMessage('version') || '版本:';
  document.getElementById('developerLabel').textContent = getMessage('developer') || '开发者:';
  document.getElementById('viewChangelogLink').textContent = getMessage('viewChangelog') || '查看更新日志';
  document.getElementById('reportIssueLink').textContent = getMessage('reportIssue') || '反馈问题';
  
  // 添加禁用网站功能
  setupAddDisabledSite();
  
  // 添加数据管理功能
  setupDataManagement();
  
  // 添加关于功能
  setupAbout();
}

// 设置添加禁用网站功能
function setupAddDisabledSite() {
  const newSiteInput = document.getElementById('newSiteInput');
  const addSiteBtn = document.getElementById('addSiteBtn');
  const globalDisableToggle = document.getElementById('globalDisableToggle');
  
  // 初始化全局禁用开关状态
  chrome.storage.local.get(['disabledGlobal'], (result) => {
    globalDisableToggle.checked = result.disabledGlobal === true;
  });
  
  // 添加全局禁用开关事件
  globalDisableToggle.addEventListener('change', () => {
    chrome.storage.local.set({ disabledGlobal: globalDisableToggle.checked }, () => {
      if (globalDisableToggle.checked) {
        showToast(getMessage('globalDisableEnabled') || '已全局禁用备注功能');
      } else {
        showToast(getMessage('globalDisableDisabled') || '已启用备注功能');
      }
    });
  });
  
  addSiteBtn.addEventListener('click', () => {
    addDisabledSite();
  });
  
  newSiteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addDisabledSite();
    }
  });
  
  function addDisabledSite() {
    let site = newSiteInput.value.trim();
    if (!site) return;
    
    // 确保输入的是有效URL
    if (!site.startsWith('http://') && !site.startsWith('https://')) {
      site = 'https://' + site;
    }
    
    try {
      const url = new URL(site);
      const domain = url.origin;
      
      chrome.storage.local.get(['disabledSites'], (result) => {
        let disabledSites = result.disabledSites || [];
        
        // 检查是否已存在
        if (disabledSites.includes(domain)) {
          showToast(getMessage('siteAlreadyDisabled') || '该网站已在禁用列表中');
          return;
        }
        
        disabledSites.push(domain);
        chrome.storage.local.set({ disabledSites }, () => {
          newSiteInput.value = '';
          loadDisabledSites();
          showToast(getMessage('siteDisabled') || '网站已禁用');
        });
      });
    } catch (error) {
      showToast(getMessage('invalidUrl') || '无效的URL格式');
    }
  }
}

// 加载禁用网站列表
function loadDisabledSites() {
  const disabledSitesList = document.getElementById('disabledSitesList');
  
  chrome.storage.local.get(['disabledSites'], (result) => {
    const disabledSites = result.disabledSites || [];
    
    if (disabledSites.length === 0) {
      disabledSitesList.innerHTML = `
        <div class="empty-state">
          <p>${getMessage('noDisabledSites') || '没有禁用的网站'}</p>
        </div>
      `;
      return;
    }
    
    disabledSitesList.innerHTML = '';
    
    disabledSites.forEach(site => {
      try {
        const url = new URL(site);
        const displayDomain = url.hostname.replace(/^www\./, '');
        const favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
        
        const siteItem = document.createElement('div');
        siteItem.className = 'disabled-site-item';
        siteItem.innerHTML = `
          <div class="site-info">
            <img src="${favicon}" class="site-icon" alt="${escapeHtml(displayDomain)}">
            <span>${escapeHtml(displayDomain)}</span>
          </div>
          <button class="enable-site-btn" data-site="${site}">${getMessage('enableSite')}</button>
        `;
        
        disabledSitesList.appendChild(siteItem);
      } catch (error) {
        console.error('Invalid URL:', site);
      }
    });
    
    // 添加启用网站按钮事件
    const enableButtons = disabledSitesList.querySelectorAll('.enable-site-btn');
    enableButtons.forEach(button => {
      button.addEventListener('click', () => {
        const site = button.dataset.site;
        enableSite(site);
      });
    });
  });
}

// 启用网站
function enableSite(site) {
  chrome.storage.local.get(['disabledSites'], (result) => {
    let disabledSites = result.disabledSites || [];
    disabledSites = disabledSites.filter(s => s !== site);
    
    chrome.storage.local.set({ disabledSites }, () => {
      loadDisabledSites(); // 重新加载禁用网站列表
    });
  });
}

// 添加备注操作的事件监听
function addNoteActions() {
  console.log('[addNoteActions] 开始绑定事件');
  // 移除之前的事件监听器
  document.querySelectorAll('.edit-btn').forEach(btn => {
    const oldHandler = btn.onclick;
    if (oldHandler) {
      btn.removeEventListener('click', oldHandler);
    }
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    const oldHandler = btn.onclick;
    if (oldHandler) {
      btn.removeEventListener('click', oldHandler);
    }
  });

  // 编辑按钮
  document.querySelectorAll('.edit-btn').forEach(btn => {
    const handleClick = (e) => {
      e.stopPropagation();
      const noteCard = e.target.closest('.note-card');
      const noteContent = noteCard.querySelector('.note-content');
      const key = noteCard.dataset.key;
      
      // 添加编辑状态类名
      noteCard.classList.add('editing');
      
      // 切换到编辑模式
      noteContent.innerHTML = `
        <div class="edit-mode">
          <textarea class="edit-input" placeholder="${getMessage('noteInputPlaceholder')}">${escapeHtml(noteContent.getAttribute('title'))}</textarea>
          <div class="edit-actions-container">
            <div class="edit-actions">
              <button class="save-edit-btn">
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="currentColor"/>
                </svg>
                ${getMessage('save')}
              </button>
              <button class="cancel-edit-btn">${getMessage('cancel')}</button>
            </div>
            <div class="keyboard-tips">
              <span class="tip-item">
                <kbd>Ctrl</kbd> + <kbd>Enter</kbd> ${getMessage('saveShortcut')}
              </span>
              <span class="tip-item">
                <kbd>Esc</kbd> ${getMessage('cancelShortcut')}
              </span>
            </div>
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
              escapeHtml(newNote.slice(0, 50)) + '...' : escapeHtml(newNote);
            noteContent.setAttribute('title', newNote);

            // 显示成功提示
            showToast(getMessage('successNoteUpdated'));

            // 移除事件监听器
            saveBtn.removeEventListener('click', saveEdit);
            cancelBtn.removeEventListener('click', cancelEdit);
            editInput.removeEventListener('keydown', handleKeydown);
          });
        });
      };

      // 取消编辑
      const cancelEdit = () => {
        const originalNote = noteContent.getAttribute('title');
        noteCard.classList.remove('editing');
        noteContent.innerHTML = originalNote.length > 50 ?
          escapeHtml(originalNote.slice(0, 50)) + '...' : escapeHtml(originalNote);

        // 移除事件监听器
        saveBtn.removeEventListener('click', saveEdit);
        cancelBtn.removeEventListener('click', cancelEdit);
        editInput.removeEventListener('keydown', handleKeydown);
      };

      // 键盘事件处理
      const handleKeydown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          saveEdit();
        } else if (e.key === 'Escape') {
          cancelEdit();
        }
      };

      // 绑定事件
      saveBtn.addEventListener('click', saveEdit);
      cancelBtn.addEventListener('click', cancelEdit);
      editInput.addEventListener('keydown', handleKeydown);
    };

    btn.addEventListener('click', handleClick);
    // 存储事件处理函数引用以便后续移除
    btn.onclick = handleClick;
  });
  
  // 删除按钮
  document.querySelectorAll('.delete-btn').forEach(btn => {
    const handleClick = (e) => {
      const noteCard = e.target.closest('.note-card');
      const key = noteCard.dataset.key;
      
      if (confirmDelete()) {
        chrome.storage.local.remove(key, () => {
          noteCard.remove();
          // 如果没有备注了，显示空状态
          if (document.querySelectorAll('.note-card').length === 0) {
            const notesList = document.getElementById('notesList');
            if (notesList) {
              notesList.innerHTML = `
                <div class="empty-state">
                  <p>${getMessage('emptyStateManagement')}</p>
                </div>
              `;
            }
          }
        });
      }
    };

    btn.addEventListener('click', handleClick);
  });

  // 收藏按钮事件处理 - 移到 addNoteActions 中以便每次重新渲染时重新绑定
  const favoriteBtns = document.querySelectorAll('.favorite-btn');
  console.log('[Favorite] 找到', favoriteBtns.length, '个收藏按钮');

  favoriteBtns.forEach((btn, index) => {
    console.log('[Favorite] 绑定按钮', index, 'data-key:', btn.closest('.note-card')?.dataset.key);

    // 如果已经绑定过，先移除旧的事件监听器
    if (btn._favoriteHandler) {
      btn.removeEventListener('click', btn._favoriteHandler);
    }

    // 定义新的事件处理函数
    const handler = async (e) => {
      e.stopPropagation();
      console.log('[Favorite] 点击星标按钮');

      // 保存按钮引用，避免异步操作后 e.currentTarget 失效
      const button = e.currentTarget;
      if (!button) {
        console.error('[Favorite] 无法获取按钮元素');
        showToast('操作失败，请重试', 'error');
        return;
      }

      const noteCard = button.closest('.note-card');
      console.log('[Favorite] noteCard:', noteCard);

      if (!noteCard) {
        console.error('[Favorite] 找不到 note-card 元素');
        showToast('找不到备注卡片', 'error');
        return;
      }

      const key = noteCard.dataset.key;
      console.log('[Favorite] key:', key);

      if (!key) {
        console.error('[Favorite] 备注标识缺失，dataset:', noteCard.dataset);
        showToast('备注标识缺失', 'error');
        return;
      }

      try {
        console.log('[Favorite] 正在查询存储，key:', key);

        // 先获取所有存储的 key 用于调试
        const allData = await chrome.storage.local.get(null);
        console.log('[Favorite] 当前存储的所有 key:', Object.keys(allData));
        console.log('[Favorite] 目标 key 是否存在:', Object.keys(allData).includes(key));

        const result = await chrome.storage.local.get([key]);
        console.log('[Favorite] 查询结果:', result);
        console.log('[Favorite] result[key] 的值:', result[key]);

        const noteData = result[key];
        if (!noteData) {
          console.error('[Favorite] 备注数据不存在，key:', key);
          console.error('[Favorite] 尝试用其他方式查找...');

          // 尝试用 domain + username 组合查找
          const domainEl = noteCard.querySelector('.note-domain span');
          const usernameEl = noteCard.querySelector('.note-username');
          console.log('[Favorite] DOM 中的域名:', domainEl?.textContent);
          console.log('[Favorite] DOM 中的用户名:', usernameEl?.textContent?.trim());

          showToast(getMessage('noteNotFound') || '备注数据不存在', 'error');
          return;
        }

        console.log('[Favorite] 当前收藏状态:', noteData.isFavorite);
        const newFavoriteStatus = !noteData.isFavorite;
        console.log('[Favorite] 新收藏状态:', newFavoriteStatus);

        const updatedData = {
          ...noteData,
          isFavorite: newFavoriteStatus,
          favoriteTime: newFavoriteStatus ? new Date().toISOString() : null
        };

        console.log('[Favorite] 正在保存数据...');
        await chrome.storage.local.set({ [key]: updatedData });
        console.log('[Favorite] 保存成功');

        // 更新UI
        button.classList.toggle('is-favorite', newFavoriteStatus);
        noteCard.classList.toggle('is-favorite', newFavoriteStatus);
        button.title = newFavoriteStatus ? getMessage('removeFavorite') : getMessage('addFavorite');

        showToast(newFavoriteStatus ? getMessage('addedToFavorites') : getMessage('removedFromFavorites'));
        console.log('[Favorite] 操作完成');
      } catch (error) {
        console.error('[Favorite] 错误:', error);
        showToast(getMessage('operationFailed') || '操作失败，请重试', 'error');
      }
    };

    // 存储处理函数引用以便后续移除
    btn._favoriteHandler = handler;
    btn.addEventListener('click', handler);
  });
}

// 添加 Toast 提示函数
function showToast(message, type = null, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'toast' + (type ? ' ' + type : '');
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
  // 移除之前的事件监听器
  const elements = [sortSelect, sortDirection, toggleSelect, deleteSelected, selectAll];
  elements.forEach(el => {
    const oldHandler = el.onclick;
    if (oldHandler) {
      el.removeEventListener('click', oldHandler);
    }
  });

  // 排序事件
  const handleSortChange = (e) => {
    sortConfig.field = e.target.value;
    loadAllNotes();
  };

  const handleDirectionClick = () => {
    sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    sortDirection.classList.toggle('desc', sortConfig.direction === 'desc');
    loadAllNotes();
  };

  sortSelect.addEventListener('change', handleSortChange);
  sortDirection.addEventListener('click', handleDirectionClick);

  // 批量选择事件
  const handleToggleSelect = () => {
    isSelectMode = !isSelectMode;
    document.body.classList.toggle('select-mode', isSelectMode);
    toggleSelect.textContent = isSelectMode ? getMessage('cancel') : getMessage('select');
    deleteSelected.style.display = isSelectMode ? 'block' : 'none';
  };

  toggleSelect.addEventListener('click', handleToggleSelect);

  // 全选功能
  const handleSelectAll = () => {
    const checkboxes = document.querySelectorAll('.note-card .select-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = selectAll.checked;
    });
  };

  selectAll.addEventListener('change', handleSelectAll);

  // 监听单个复选框变化
  const handleCheckboxChange = (e) => {
    if (e.target.matches('.note-card .select-checkbox')) {
      const checkboxes = document.querySelectorAll('.note-card .select-checkbox');
      const checkedBoxes = document.querySelectorAll('.note-card .select-checkbox:checked');
      selectAll.checked = checkboxes.length === checkedBoxes.length;
    }
  };

  document.removeEventListener('change', handleCheckboxChange);
  document.addEventListener('change', handleCheckboxChange);



  // 在页面卸载时清理事件监听器
  window.addEventListener('unload', () => {
    sortSelect.removeEventListener('change', handleSortChange);
    sortDirection.removeEventListener('click', handleDirectionClick);
    toggleSelect.removeEventListener('click', handleToggleSelect);
    selectAll.removeEventListener('change', handleSelectAll);
    document.removeEventListener('change', handleCheckboxChange);
  });

  // 添加数据验证函数
  async function validateKeys(keys) {
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new Error(getMessage('invalidDeleteData'));
    }
    
    // 验证所有 key 是否存在
    const data = await chrome.storage.local.get(keys);
    const validKeys = keys.filter(key => data[key]);
    
    if (validKeys.length === 0) {
      throw new Error(getMessage('noNotesToDelete'));
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
      showToast(getMessage('pleaseSelectNotes'));
      return;
    }

    if (confirmDelete(selectedNotes.length)) {
      try {
        const keys = Array.from(selectedNotes).map(checkbox =>
          checkbox.closest('.note-card').dataset.key
        );

        const deletedCount = await deleteNotes(keys);
        showToast(getMessage('importSuccess', [deletedCount.toString()]));

        // 重置选择状态
        isSelectMode = false;
        document.body.classList.remove('select-mode');
        document.getElementById('toggleSelect').textContent = getMessage('select');
        document.getElementById('deleteSelected').style.display = 'none';

        // 重新加载数据
        await loadAllNotes();
      } catch (error) {
        showToast(error.message || getMessage('deleteFailure'));
      }
    }
  });
}

// 获取所有标签
async function getAllTags() {
  const result = await chrome.storage.local.get(null);
  const notes = Object.values(result).filter(note =>
    note && note.domain && note.note && note.username && note.key
  );
  const tagsSet = new Set();
  notes.forEach(note => {
    getNoteTags(note).forEach(tag => tagsSet.add(tag));
  });
  return Array.from(tagsSet).sort();
}

// 设置筛选
function setupFilters() {
  const filterContainer = document.getElementById('filterContainer');
  if (!filterContainer) return;

  // 收藏筛选按钮
  const favoriteFilterBtn = document.getElementById('favoriteFilter');
  if (favoriteFilterBtn) {
    favoriteFilterBtn.addEventListener('click', () => {
      currentFilter.isFavorite = !currentFilter.isFavorite;
      favoriteFilterBtn.classList.toggle('active', currentFilter.isFavorite);
      loadAllNotes();
    });
  }

  // 标签筛选
  const tagFilterSelect = document.getElementById('tagFilter');
  if (tagFilterSelect) {
    // 加载标签选项
    getAllTags().then(tags => {
      tagFilterSelect.innerHTML = `<option value="">${getMessage('allTags')}</option>` +
        tags.map(tag => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');
    });

    tagFilterSelect.addEventListener('change', (e) => {
      const selectedTag = e.target.value;
      if (selectedTag) {
        if (!currentFilter.tags.includes(selectedTag)) {
          currentFilter.tags.push(selectedTag);
        }
      } else {
        currentFilter.tags = [];
      }
      loadAllNotes();
    });
  }
}

// HTML转义函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 添加时间格式化函数
function formatTime(timeStr) {
  const date = new Date(timeStr);
  const now = new Date();
  const diff = now - date;
  
  // 小于1分钟
  if (diff < 60000) {
    return getMessage('justNow');
  }
  // 小于1小时
  if (diff < 3600000) {
    return getMessage('minutesAgo', [Math.floor(diff / 60000).toString()]);
  }
  // 小于24小时
  if (diff < 86400000) {
    return getMessage('hoursAgo', [Math.floor(diff / 3600000).toString()]);
  }
  // 小于7天
  if (diff < 604800000) {
    return getMessage('daysAgo', [Math.floor(diff / 86400000).toString()]);
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

// 导出备注数据
async function exportNotes() {
  try {
    // 从本地存储获取所有备注数据
    chrome.storage.local.get(null, (result) => {
      const notes = Object.values(result).filter(note => 
        note && note.domain && note.note && note.username && note.key
      );

      // 创建带时间戳的文件名
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `accountNote_backup_${timestamp}.json`;

      // 创建Blob对象
      const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // 创建下载链接并触发下载
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // 清理
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);

      // 显示成功提示
      showToast(getMessage('exportSuccess'));
    });
  } catch (error) {
    console.error('导出备注失败:', error);
    showToast(getMessage('exportFailed'));
  }
}

// 导入备注数据
async function importNotes(file) {
  try {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        // 解析JSON数据
        const importedNotes = JSON.parse(event.target.result);
        
        // 验证数据格式
        if (!Array.isArray(importedNotes)) {
          throw new Error(getMessage('invalidDataFormat'));
        }
        
        // 验证每条数据的结构
        const validNotes = importedNotes.filter(note => 
          note && 
          typeof note === 'object' &&
          note.domain &&
          note.note &&
          note.username &&
          note.key
        );
        
        if (validNotes.length === 0) {
          throw new Error(getMessage('noValidNotes'));
        }
        
        // 获取现有数据
        const existingData = await new Promise(resolve => {
          chrome.storage.local.get(null, resolve);
        });
        
        // 检查是否有冲突数据
        const conflicts = validNotes.filter(note => existingData[note.key]);
        
        // 如果有冲突数据，询问用户如何处理
        if (conflicts.length > 0) {
          if (!confirm(getMessage('conflictPrompt', [conflicts.length.toString()]))) {
            // 用户选择跳过重复数据
            const newNotes = validNotes.filter(note => !existingData[note.key]);
            if (newNotes.length === 0) {
              showToast(getMessage('noNewNotes'));
              return;
            }
            // 只导入新数据
            const importData = newNotes.reduce((acc, note) => {
              acc[note.key] = note;
              return acc;
            }, {});
            
            await chrome.storage.local.set(importData);
            showToast(getMessage('importSuccess', [newNotes.length.toString()]));
          } else {
            // 用户选择覆盖所有数据
            const importData = validNotes.reduce((acc, note) => {
              acc[note.key] = note;
              return acc;
            }, {});
            
            await chrome.storage.local.set(importData);
            showToast(getMessage('importSuccess', [validNotes.length.toString()]));
          }
        } else {
          // 没有冲突，直接导入所有数据
          const importData = validNotes.reduce((acc, note) => {
            acc[note.key] = note;
            return acc;
          }, {});
          
          await chrome.storage.local.set(importData);
          showToast(getMessage('importSuccess', [validNotes.length.toString()]));
        }
        
        // 重新加载显示
        await loadAllNotes();
        
      } catch (error) {
        console.error('导入数据处理失败:', error);
        showToast(error.message || getMessage('importFailed'));
      }
    };
    
    reader.onerror = () => {
      showToast(getMessage('importFailed'));
    };
    
    // 开始读取文件
    reader.readAsText(file);
    
  } catch (error) {
    console.error('导入备注失败:', error);
    showToast(getMessage('importFailed'));
  }
}

// 设置数据管理功能
function setupDataManagement() {
  // 防止重复初始化 - 如果已经初始化过则直接返回
  if (setupDataManagement.initialized) {
    console.log('[DataManagement] 已经初始化过，跳过重复初始化');
    return;
  }

  console.log('[DataManagement] 初始化数据管理功能');

  const settingsExportBtn = document.getElementById('settingsExportBtn');
  const settingsImportBtn = document.getElementById('settingsImportBtn');
  const settingsImportFileInput = document.getElementById('settingsImportFileInput');
  const clearAllDataBtn = document.getElementById('clearAllDataBtn');

  // 导出按钮点击事件
  settingsExportBtn.addEventListener('click', exportNotes);

  // 导入按钮点击事件
  settingsImportBtn.addEventListener('click', () => {
    settingsImportFileInput.click();
  });

  // 文件选择处理
  settingsImportFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/json') {
        showToast(getMessage('selectFileType'));
        return;
      }
      importNotes(file);
      settingsImportFileInput.value = ''; // 重置文件选择器
    }
  });

  // 清除所有数据按钮点击事件
  clearAllDataBtn.addEventListener('click', () => {
    if (confirm(getMessage('confirmClearAllData') || '确定要清除所有数据吗？这将无法恢复。')) {
      chrome.storage.local.clear(() => {
        showToast(getMessage('dataCleared') || '所有数据已清除');
        loadAllNotes(); // 重新加载（空）备注列表
        loadDisabledSites(); // 重新加载（空）禁用网站列表
      });
    }
  });

  // 标记为已初始化
  setupDataManagement.initialized = true;
}

// 初始化标志
setupDataManagement.initialized = false;
// 设置关于功能
function setupAbout() {
  const viewChangelogLink = document.getElementById('viewChangelogLink');
  const reportIssueLink = document.getElementById('reportIssueLink');
  
  console.log('setupAbout 被调用，准备设置事件监听');
  
  // 移除旧的事件监听器（如果存在）
  console.log('尝试移除旧的事件监听器');
  if (handleViewChangelog) {
    viewChangelogLink.removeEventListener('click', handleViewChangelog);
    console.log('已移除旧的更新日志事件监听器');
  }
  
  if (handleReportIssue) {
    reportIssueLink.removeEventListener('click', handleReportIssue);
    console.log('已移除旧的反馈问题事件监听器');
  }
  
  // 重新定义事件处理函数
  handleViewChangelog = function(e) {
    e.preventDefault();
    console.log('查看更新日志链接被点击');
    chrome.tabs.create({ url: 'https://github.com/hjweix/account-note/blob/main/document/changelog.md' });
  };
  
  handleReportIssue = function(e) {
    e.preventDefault();
    console.log('反馈问题链接被点击');
    chrome.tabs.create({ url: 'https://github.com/hjweix/account-note/issues' });
  };
  
  // 添加新的事件监听器
  console.log('添加新的事件监听器');
  viewChangelogLink.addEventListener('click', handleViewChangelog);
  reportIssueLink.addEventListener('click', handleReportIssue);
}

// ==================== Theme Management ====================

// 初始化主题
function initTheme() {
  // 从存储中加载主题设置
  chrome.storage.local.get(['theme'], (result) => {
    currentTheme = result.theme || 'auto';
    applyTheme(currentTheme);
    updateThemeSelector(currentTheme);
  });

  // 监听系统主题变化
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    if (currentTheme === 'auto') {
      applyTheme('auto');
    }
  });

  // 设置主题选择器事件
  setupThemeSelector();
}

// 应用主题
function applyTheme(theme) {
  const html = document.documentElement;

  // 移除所有主题类
  html.removeAttribute('data-theme');

  if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    html.setAttribute('data-theme', 'light');
  }
  // 'auto' 不设置属性，使用 CSS 媒体查询
}

// 设置主题选择器事件
function setupThemeSelector() {
  const themeOptions = document.querySelectorAll('.theme-option');

  themeOptions.forEach(option => {
    option.addEventListener('click', () => {
      const theme = option.dataset.theme;
      setTheme(theme);
    });
  });
}

// 设置主题
function setTheme(theme) {
  currentTheme = theme;
  applyTheme(theme);
  updateThemeSelector(theme);

  // 保存到存储
  chrome.storage.local.set({ theme }, () => {
    showToast(getThemeLabel(theme) + '主题已应用');
  });
}

// 更新主题选择器 UI
function updateThemeSelector(theme) {
  const themeOptions = document.querySelectorAll('.theme-option');

  themeOptions.forEach(option => {
    if (option.dataset.theme === theme) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
}

// 获取主题标签
function getThemeLabel(theme) {
  const labels = {
    auto: '跟随系统',
    light: '浅色',
    dark: '深色'
  };
  return labels[theme] || theme;
}

// ==================== Tag Management ====================

// 设置标签管理功能
function setupTagManagement() {
  const newTagInput = document.getElementById('newTagInput');
  const addTagBtn = document.getElementById('addTagBtn');

  if (!newTagInput || !addTagBtn) return;

  // 添加标签按钮事件
  addTagBtn.addEventListener('click', () => {
    addNewTag();
  });

  // 回车键添加标签
  newTagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNewTag();
    }
  });

  // 加载标签列表
  loadTagsList();
}

// 添加新标签
async function addNewTag() {
  const newTagInput = document.getElementById('newTagInput');
  const tagName = newTagInput.value.trim();

  if (!tagName) {
    showToast(getMessage('tagNameEmpty') || '请输入标签名称');
    return;
  }

  // 检查标签是否已存在
  const existingTags = await getAllTags();
  if (existingTags.includes(tagName)) {
    showToast(getMessage('tagAlreadyExists') || '标签已存在');
    return;
  }

  // 标签只是存储在备注中的字符串，所以我们只需提示添加成功
  // 实际创建标签需要在编辑备注时添加
  showToast(getMessage('tagAdded') || '标签添加成功');
  newTagInput.value = '';

  // 刷新标签列表（虽然新标签还没有被任何备注使用）
  loadTagsList();
}

// 加载标签列表
async function loadTagsList() {
  const tagsList = document.getElementById('tagsList');
  if (!tagsList) return;

  // 获取所有标签及其使用统计
  const tagStats = await getTagStats();

  if (tagStats.length === 0) {
    tagsList.innerHTML = `
      <div class="empty-state" style="padding: var(--space-6);">
        <p>${getMessage('noTags') || '暂无标签'}</p>
        <p style="font-size: 12px; margin-top: var(--space-2);">${getMessage('createTagHint') || '在编辑备注时添加标签'}</p>
      </div>
    `;
    return;
  }

  tagsList.innerHTML = '';

  tagStats.forEach(({ tag, count }) => {
    const tagItem = document.createElement('div');
    tagItem.className = 'tag-item';
    tagItem.dataset.tag = tag;

    tagItem.innerHTML = `
      <div class="tag-item-info">
        <span class="tag-item-name">${escapeHtml(tag)}</span>
        <span class="tag-item-count">${count} ${getMessage('notesCount') || '个备注'}</span>
      </div>
      <div class="tag-item-actions">
        <button class="tag-action-btn rename" title="${escapeHtml(getMessage('renameTag') || '重命名')}">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
          </svg>
        </button>
        <button class="tag-action-btn delete" title="${escapeHtml(getMessage('deleteTag') || '删除标签')}">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    `;

    // 重命名按钮事件
    const renameBtn = tagItem.querySelector('.tag-action-btn.rename');
    renameBtn.addEventListener('click', () => {
      enterTagEditMode(tagItem, tag);
    });

    // 删除按钮事件
    const deleteBtn = tagItem.querySelector('.tag-action-btn.delete');
    deleteBtn.addEventListener('click', () => {
      deleteTag(tag);
    });

    tagsList.appendChild(tagItem);
  });
}

// 进入标签编辑模式
function enterTagEditMode(tagItem, oldTagName) {
  tagItem.classList.add('editing');

  tagItem.innerHTML = `
    <div class="tag-item-info" style="flex: 1;">
      <input type="text" class="tag-edit-input" value="${escapeHtml(oldTagName)}" />
    </div>
    <div class="tag-edit-actions">
      <button class="tag-edit-btn save">${getMessage('save') || '保存'}</button>
      <button class="tag-edit-btn cancel">${getMessage('cancel') || '取消'}</button>
    </div>
  `;

  const input = tagItem.querySelector('.tag-edit-input');
  const saveBtn = tagItem.querySelector('.tag-edit-btn.save');
  const cancelBtn = tagItem.querySelector('.tag-edit-btn.cancel');

  input.focus();
  input.select();

  // 保存按钮事件
  saveBtn.addEventListener('click', () => {
    const newTagName = input.value.trim();
    if (newTagName && newTagName !== oldTagName) {
      renameTag(oldTagName, newTagName);
    } else {
      loadTagsList(); // 取消编辑，重新加载列表
    }
  });

  // 取消按钮事件
  cancelBtn.addEventListener('click', () => {
    loadTagsList(); // 重新加载列表，退出编辑模式
  });

  // 键盘事件
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const newTagName = input.value.trim();
      if (newTagName && newTagName !== oldTagName) {
        renameTag(oldTagName, newTagName);
      }
    } else if (e.key === 'Escape') {
      loadTagsList();
    }
  });

  // 失去焦点时保存（有延迟，避免点击按钮时的问题）
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (tagItem.classList.contains('editing')) {
        const newTagName = input.value.trim();
        if (newTagName && newTagName !== oldTagName) {
          renameTag(oldTagName, newTagName);
        } else if (!newTagName) {
          loadTagsList();
        }
      }
    }, 200);
  });
}

// 重命名标签
async function renameTag(oldTagName, newTagName) {
  try {
    // 检查新标签名是否已存在
    const existingTags = await getAllTags();
    if (existingTags.includes(newTagName)) {
      showToast(getMessage('tagAlreadyExists') || '标签已存在');
      loadTagsList();
      return;
    }

    // 获取所有包含该标签的备注
    const result = await chrome.storage.local.get(null);
    const notes = Object.values(result).filter(note =>
      note && note.domain && note.note && note.username && note.key
    );

    const updates = {};
    let updateCount = 0;

    notes.forEach(note => {
      if (note.tags && note.tags.includes(oldTagName)) {
        // 替换标签
        note.tags = note.tags.map(tag => tag === oldTagName ? newTagName : tag);
        updates[note.key] = note;
        updateCount++;
      }
    });

    if (updateCount > 0) {
      await chrome.storage.local.set(updates);
      showToast(getMessage('tagRenamed', [updateCount.toString()]) || `标签已重命名，影响 ${updateCount} 个备注`);
    } else {
      showToast(getMessage('tagRenamedNoNotes') || '标签已重命名');
    }

    // 刷新标签列表和筛选器
    loadTagsList();
    setupFilters();

    // 如果在 Notes 页面，刷新备注显示
    if (activeTab === 'notes') {
      loadAllNotes();
    }
  } catch (error) {
    console.error('重命名标签失败:', error);
    showToast(getMessage('tagRenameFailed') || '标签重命名失败');
    loadTagsList();
  }
}

// 删除标签
async function deleteTag(tagName) {
  if (!confirm(getMessage('confirmDeleteTag', [tagName]) || `确定要删除标签 "${tagName}" 吗？`)) {
    return;
  }

  try {
    // 获取所有包含该标签的备注
    const result = await chrome.storage.local.get(null);
    const notes = Object.values(result).filter(note =>
      note && note.domain && note.note && note.username && note.key
    );

    const updates = {};
    let updateCount = 0;

    notes.forEach(note => {
      if (note.tags && note.tags.includes(tagName)) {
        // 移除标签
        note.tags = note.tags.filter(tag => tag !== tagName);
        updates[note.key] = note;
        updateCount++;
      }
    });

    if (updateCount > 0) {
      await chrome.storage.local.set(updates);
      showToast(getMessage('tagDeleted', [updateCount.toString()]) || `标签已删除，影响 ${updateCount} 个备注`);
    } else {
      showToast(getMessage('tagDeletedNoNotes') || '标签已删除');
    }

    // 刷新标签列表和筛选器
    loadTagsList();
    setupFilters();

    // 如果在 Notes 页面，刷新备注显示
    if (activeTab === 'notes') {
      loadAllNotes();
    }
  } catch (error) {
    console.error('删除标签失败:', error);
    showToast(getMessage('tagDeleteFailed') || '标签删除失败');
  }
}

// 获取标签统计信息
async function getTagStats() {
  const result = await chrome.storage.local.get(null);
  const notes = Object.values(result).filter(note =>
    note && note.domain && note.note && note.username && note.key
  );

  const tagCount = {};

  notes.forEach(note => {
    if (note.tags) {
      note.tags.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    }
  });

  // 转换为数组并排序（按使用次数降序，然后按名称升序）
  return Object.entries(tagCount)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.tag.localeCompare(b.tag);
    });
}

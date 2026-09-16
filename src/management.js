// 在文件开头添加排序状态
import {
  SCOPE_STORAGE_KEY,
  SCOPE_EXACT,
  SCOPE_INHERIT,
  hostOf,
  normalizeOverrides
} from './site-scope.js';

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
  // 骨架占位 + 回收站超期清理（异步，不阻塞加载）
  showSkeleton();
  cleanupTrash();

  // 第一步：执行数据迁移
  await migrateAllNotes();

  // 第二步：加载所有数据（此时已都是最新格式）
  chrome.storage.local.get(null, (result) => {
    const notes = Object.entries(result)
      .filter(([key, note]) =>
        note && note.domain && note.note && note.username
      )
      .map(([key, note]) => {
        // 确保返回的数据结构完整
        return {
          key: note.key || key,
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
    // 直接取站点自身 /favicon.ico：第三方 favicon 服务（google.com/s2）在国内不可达
    const favicon = `${url.origin}/favicon.ico`;

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
              ${note.note.length > NOTE_PREVIEW_LEN ? escapeHtml(note.note.slice(0, NOTE_PREVIEW_LEN)) + '...' : escapeHtml(note.note)}
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

  wireFaviconFallback(notesList);

  addNoteActions();
}

// 备注预览截断长度（初始渲染与编辑保存后共用，避免同卡片前后不一致）
const NOTE_PREVIEW_LEN = 60;

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

  // 输入框锚定卡片国际化
  document.getElementById('fieldAnchorsTitle').textContent = getMessage('fieldAnchorsTitle') || '输入框锚定';
  document.getElementById('fieldAnchorsDesc').textContent = getMessage('fieldAnchorsDesc') || '手动指定过的输入框会始终显示备注弹窗。识别不准时，可在扩展弹窗里重新指定。';

  // 站点范围卡片国际化
  const siteScopeTitle = document.getElementById('siteScopeTitle');
  if (siteScopeTitle) siteScopeTitle.textContent = getMessage('siteScopeTitle') || '站点范围';
  const siteScopeDesc = document.getElementById('siteScopeDesc');
  if (siteScopeDesc) {
    siteScopeDesc.textContent = getMessage('siteScopeDesc')
      || '同一网站的上下级入口共用备注（登录域写的，主站也看得到）；平级子域各记各的。想让某个站点彻底分开，把它设为「仅本站」。';
  }

  // 添加网站表单国际化
  const newSiteInput = document.getElementById('newSiteInput');
  newSiteInput.placeholder = getMessage('newSiteInputPlaceholder') || '输入网站域名，如 example.com';
  const addSiteBtn = document.getElementById('addSiteBtn');
  addSiteBtn.textContent = getMessage('addSite') || '添加';

  // 标签管理卡片：来源说明（标签依附于备注，独立添加表单是假功能已移除）
  const tagsHint = document.getElementById('tagsFromNotesHint');
  if (tagsHint) {
    tagsHint.textContent = getMessage('tagsFromNotes') || '标签来自备注本身，在页面弹窗或编辑备注时添加。';
  }

  // 加载标签列表（只读展示使用统计）
  loadTagsList();

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

  // 输入框锚定记录列表
  loadFieldAnchors();

  // 站点范围设置
  loadSiteScopes();
  
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
        // 站点自身 /favicon.ico，失败回退首字母（不依赖国内不可达的第三方服务）
        const favicon = `${url.origin}/favicon.ico`;

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

    wireFaviconFallback(disabledSitesList);
    
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

// ===== 输入框锚定记录 =====
// 用户在页面上手动指定过的输入框（识别引擎的兜底层）。content.js 侧按 origin 分组写入，
// 这里只做只读展示与移除——绑错了要能救回来。
const ANCHOR_STORAGE_KEY = 'fieldAnchors';

// 把锚定指纹转成人类可读的一行描述（纯文本，由 textContent 写入，无需转义）
function describeAnchor(anchor) {
  if (!anchor || typeof anchor !== 'object') return '—';
  if (anchor.id) return `#${anchor.id}`;
  if (anchor.name) return `name="${anchor.name}"`;
  if (anchor.placeholder) return `placeholder="${anchor.placeholder}"`;
  if (typeof anchor.nth === 'number') {
    return getMessage('anchorIndexLabel', [String(anchor.nth + 1)]) || `第 ${anchor.nth + 1} 个输入框`;
  }
  return '—';
}

// 单条锚定记录
function buildAnchorItem(origin, anchor, index) {
  const item = document.createElement('div');
  item.className = 'field-anchor-item';

  const main = document.createElement('div');
  main.className = 'field-anchor-main';

  const signature = document.createElement('span');
  signature.className = 'field-anchor-signature';
  signature.textContent = describeAnchor(anchor);
  main.appendChild(signature);

  const meta = document.createElement('span');
  meta.className = 'field-anchor-meta';
  meta.textContent = anchor && anchor.createTime ? formatTime(anchor.createTime) : '';
  main.appendChild(meta);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'field-anchor-remove';
  removeBtn.textContent = getMessage('removeAnchor') || '移除';
  removeBtn.addEventListener('click', () => removeFieldAnchor(origin, index));

  item.appendChild(main);
  item.appendChild(removeBtn);
  return item;
}

// 加载全部锚定记录，按站点分组展示
function loadFieldAnchors() {
  const list = document.getElementById('fieldAnchorsList');
  if (!list) return;

  chrome.storage.local.get([ANCHOR_STORAGE_KEY], (result) => {
    const all = result[ANCHOR_STORAGE_KEY];
    const origins = all && typeof all === 'object'
      ? Object.keys(all).filter(origin => Array.isArray(all[origin]) && all[origin].length > 0)
      : [];

    if (origins.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <p>${getMessage('noFieldAnchors') || '暂无锚定记录'}</p>
        </div>
      `;
      return;
    }

    list.innerHTML = '';
    origins.sort().forEach(origin => {
      const group = document.createElement('div');
      group.className = 'field-anchor-group';

      const header = document.createElement('div');
      header.className = 'field-anchor-origin';
      header.textContent = origin;
      group.appendChild(header);

      all[origin].forEach((anchor, index) => {
        group.appendChild(buildAnchorItem(origin, anchor, index));
      });

      list.appendChild(group);
    });
  });
}

// ===== 站点范围（备注按「网站」而不是整串 origin 归属）=====
//
// 默认：上下级域名互通（api.x.com ↔ x.com），平级子域隔离（ipsdev ↔ ipsprod 各记各的）。
// 例外：把某个站点设为「仅本站」即从上下级链上摘掉，只认自己的备注。
// 备注数据本身不动，改的只是「能看到哪些」，因此随时可改回来、不会丢记录。

function loadSiteScopes() {
  const list = document.getElementById('siteScopeList');
  if (!list) return;

  chrome.storage.local.get(null, (result) => {
    const overrides = normalizeOverrides(result && result[SCOPE_STORAGE_KEY]);

    // 只列出真正有备注的站点，避免出现一堆空壳设置项
    const hosts = new Set();
    Object.values(result || {}).forEach(value => {
      if (value && value.domain && value.note && value.username) {
        const host = hostOf(value.domain);
        if (host) hosts.add(host);
      }
    });

    if (hosts.size === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <p>${getMessage('noSiteScopes') || '还没有任何站点记录'}</p>
        </div>
      `;
      return;
    }

    const sorted = Array.from(hosts).sort();
    list.innerHTML = '';

    sorted.forEach(host => {
      const row = document.createElement('div');
      row.className = 'site-scope-item';

      const info = document.createElement('div');
      info.className = 'site-scope-info';

      const name = document.createElement('span');
      name.className = 'site-scope-host';
      name.textContent = host;
      name.title = host;
      info.appendChild(name);

      const select = document.createElement('select');
      select.className = 'site-scope-select';
      select.dataset.host = host;
      select.setAttribute('aria-label', host);

      const options = [
        { value: SCOPE_INHERIT, label: getMessage('siteScopeInherit') || '跟随上下级' },
        { value: SCOPE_EXACT, label: getMessage('siteScopeExact') || '仅本站' }
      ];
      options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      });
      select.value = overrides[host] ? overrides[host].level : SCOPE_INHERIT;

      select.addEventListener('change', () => {
        setSiteScope(host, select.value);
      });

      row.appendChild(info);
      row.appendChild(select);
      list.appendChild(row);
    });
  });
}

// 写入站点范围设置。跟随上下级是默认态，直接删键，不留冗余配置
function setSiteScope(host, level) {
  chrome.storage.local.get([SCOPE_STORAGE_KEY], (result) => {
    const all = normalizeOverrides(result[SCOPE_STORAGE_KEY]);
    if (level === SCOPE_EXACT) {
      all[host] = { level: SCOPE_EXACT };
    } else {
      delete all[host];
    }

    const done = () => {
      loadSiteScopes();
      showToast(getMessage('siteScopeSaved') || '站点范围已更新');
    };

    if (Object.keys(all).length === 0) {
      chrome.storage.local.remove(SCOPE_STORAGE_KEY, done);
    } else {
      chrome.storage.local.set({ [SCOPE_STORAGE_KEY]: all }, done);
    }
  });
}

// 移除一条锚定记录，移除后该输入框回落到评分引擎的判断
function removeFieldAnchor(origin, index) {
  chrome.storage.local.get([ANCHOR_STORAGE_KEY], (result) => {
    const all = result[ANCHOR_STORAGE_KEY];
    if (!all || typeof all !== 'object' || !Array.isArray(all[origin])) return;

    const next = { ...all };
    const list = next[origin].slice();
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);

    if (list.length === 0) {
      delete next[origin];
    } else {
      next[origin] = list;
    }

    const done = () => {
      loadFieldAnchors();
      showToast(getMessage('anchorRemoved') || '已移除锚定记录');
    };

    // 最后一条记录被移除后连同顶层键一起清掉，避免存储里留下空对象
    if (Object.keys(next).length === 0) {
      chrome.storage.local.remove(ANCHOR_STORAGE_KEY, done);
    } else {
      chrome.storage.local.set({ [ANCHOR_STORAGE_KEY]: next }, done);
    }
  });
}

// 添加备注操作的事件监听
function addNoteActions() {
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
            noteContent.innerHTML = newNote.length > NOTE_PREVIEW_LEN ?
              escapeHtml(newNote.slice(0, NOTE_PREVIEW_LEN)) + '...' : escapeHtml(newNote);
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
        noteContent.innerHTML = originalNote.length > NOTE_PREVIEW_LEN ?
          escapeHtml(originalNote.slice(0, NOTE_PREVIEW_LEN)) + '...' : escapeHtml(originalNote);

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
  
  // 删除按钮：自绘对话框确认（写明删除目标）→ 软删除进回收站 → toast 提供撤销
  document.querySelectorAll('.delete-btn').forEach(btn => {
    const handleClick = async (e) => {
      const noteCard = e.target.closest('.note-card');
      const key = noteCard.dataset.key;
      const domainText = noteCard.querySelector('.note-domain span')?.textContent || '';
      const usernameText = noteCard.querySelector('.note-username')?.textContent || '';

      const ok = await showConfirmDialog({
        title: getMessage('dialogDeleteTitle') || '删除备注',
        message: getMessage('deleteNoteFor', [domainText, usernameText]) ||
          `确定删除 ${domainText} / ${usernameText} 的备注吗？删除后 7 天内可撤销。`,
        confirmText: getMessage('deleteBtn') || '删除',
        danger: true
      });
      if (!ok) return;

      try {
        const entries = await softDeleteNotes([key]);
        noteCard.remove();
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
        if (entries.length > 0) {
          showUndoToast(getMessage('deletedCount', [String(entries.length)]), async () => {
            await restoreFromTrash(entries);
            await loadAllNotes();
          });
        }
      } catch (error) {
        showToast(getMessage('deleteFailure') || '删除失败', 'error');
      }
    };

    btn.addEventListener('click', handleClick);
  });

  // 收藏按钮事件处理 - 移到 addNoteActions 中以便每次重新渲染时重新绑定。
  // 星标颜色变化本身就是即时反馈，高频微操作不再弹 toast
  const favoriteBtns = document.querySelectorAll('.favorite-btn');

  favoriteBtns.forEach((btn) => {
    // 如果已经绑定过，先移除旧的事件监听器
    if (btn._favoriteHandler) {
      btn.removeEventListener('click', btn._favoriteHandler);
    }

    // 定义新的事件处理函数
    const handler = async (e) => {
      e.stopPropagation();

      // 保存按钮引用，避免异步操作后 e.currentTarget 失效
      const button = e.currentTarget;
      if (!button) {
        showToast(getMessage('operationFailed') || '操作失败，请重试', 'error');
        return;
      }

      const noteCard = button.closest('.note-card');
      if (!noteCard) {
        showToast(getMessage('operationFailed') || '操作失败，请重试', 'error');
        return;
      }

      const key = noteCard.dataset.key;
      if (!key) {
        showToast(getMessage('noteNotFound') || '备注数据不存在', 'error');
        return;
      }

      try {
        const result = await chrome.storage.local.get([key]);
        const noteData = result[key];
        if (!noteData) {
          showToast(getMessage('noteNotFound') || '备注数据不存在', 'error');
          return;
        }

        const newFavoriteStatus = !noteData.isFavorite;

        const updatedData = {
          ...noteData,
          isFavorite: newFavoriteStatus,
          favoriteTime: newFavoriteStatus ? new Date().toISOString() : null
        };

        await chrome.storage.local.set({ [key]: updatedData });

        // 更新UI
        button.classList.toggle('is-favorite', newFavoriteStatus);
        noteCard.classList.toggle('is-favorite', newFavoriteStatus);
        button.title = newFavoriteStatus ? getMessage('removeFavorite') : getMessage('addFavorite');
      } catch (error) {
        showToast(getMessage('operationFailed') || '操作失败，请重试', 'error');
      }
    };

    // 存储处理函数引用以便后续移除
    btn._favoriteHandler = handler;
    btn.addEventListener('click', handler);
  });
}

// 添加 Toast 提示函数
// type 决定左侧状态色条（success/error/info）；错误默认停留 4s，其余 2s
function showToast(message, type = 'info', duration = null) {
  // 单例：新 toast 顶掉旧 toast，避免叠加残留误导后续反馈
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast' + (type ? ' ' + type : '');
  toast.textContent = message;
  document.body.appendChild(toast);

  const stay = duration || (type === 'error' ? 4000 : 2000);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 100%)';
    setTimeout(() => toast.remove(), 300);
  }, stay);
}

// 带撤销按钮的 toast：删除类操作的数据安全网
function showUndoToast(message, onUndo, duration = 5000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast info';

  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  const undoBtn = document.createElement('button');
  undoBtn.type = 'button';
  undoBtn.className = 'toast-undo-btn';
  undoBtn.textContent = getMessage('undo') || '撤销';
  toast.appendChild(undoBtn);

  document.body.appendChild(toast);

  let timer = null;
  undoBtn.addEventListener('click', async () => {
    if (timer) clearTimeout(timer);
    toast.remove();
    try {
      await onUndo();
      showToast(getMessage('restored') || '备注已恢复', 'success');
    } catch (error) {
      showToast(getMessage('operationFailed') || '操作失败，请重试', 'error');
    }
  });
  timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// 自绘确认对话框：替代原生 confirm，与整体视觉语言一致。
// Esc / 点击遮罩 / 取消 = false；确认按钮 = true
function showConfirmDialog({ title, message, confirmText, danger = true }) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.innerHTML = `
      <div class="confirm-dialog" role="alertdialog" aria-modal="true">
        <h3 class="dialog-title"></h3>
        <p class="dialog-message"></p>
        <div class="dialog-actions">
          <button type="button" class="dialog-btn cancel"></button>
          <button type="button" class="dialog-btn confirm${danger ? ' danger' : ''}"></button>
        </div>
      </div>
    `;
    backdrop.querySelector('.dialog-title').textContent = title || '';
    backdrop.querySelector('.dialog-message').textContent = message || '';
    const cancelBtn = backdrop.querySelector('.dialog-btn.cancel');
    const confirmBtn = backdrop.querySelector('.dialog-btn.confirm');
    cancelBtn.textContent = getMessage('cancel') || '取消';
    confirmBtn.textContent = confirmText || getMessage('deleteBtn') || '删除';

    const close = result => {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(result);
    };
    const onKey = e => {
      if (e.key === 'Escape') close(false);
    };
    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close(false);
    });
    document.addEventListener('keydown', onKey);

    document.body.appendChild(backdrop);
    confirmBtn.focus();
  });
}

// ===== 软删除（回收站）=====
// 删除的备注先移入 trash 键保留 7 天，toast 提供「撤销」；超期条目在管理页启动时清理。
// 备份切分按 isNoteRecord 口径，trash（数组）自动落入 others、随备份走，无需改导出代码。
const TRASH_STORAGE_KEY = 'trash';
const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// 清理超期条目。无 deletedAt 的异常条目保留，宁可多留不误删
async function cleanupTrash() {
  try {
    const result = await chrome.storage.local.get([TRASH_STORAGE_KEY]);
    const trash = result[TRASH_STORAGE_KEY];
    if (!Array.isArray(trash) || trash.length === 0) return;
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    const kept = trash.filter(item =>
      !(item && typeof item.deletedAt === 'string' && new Date(item.deletedAt).getTime() <= cutoff)
    );
    if (kept.length === trash.length) return;
    if (kept.length === 0) {
      await chrome.storage.local.remove(TRASH_STORAGE_KEY);
    } else {
      await chrome.storage.local.set({ [TRASH_STORAGE_KEY]: kept });
    }
  } catch (error) {
    // 回收站清理失败不影响正常功能
  }
}

// 软删除：把备注移入回收站并从主存储摘除，返回移入的记录（供撤销用）
async function softDeleteNotes(keys) {
  const result = await chrome.storage.local.get(keys);
  const entries = [];
  keys.forEach(key => {
    const note = result[key];
    if (!note) return;
    entries.push(Object.assign({}, note, { key, deletedAt: new Date().toISOString() }));
  });
  if (entries.length === 0) return [];

  const trashResult = await chrome.storage.local.get([TRASH_STORAGE_KEY]);
  const trash = Array.isArray(trashResult[TRASH_STORAGE_KEY]) ? trashResult[TRASH_STORAGE_KEY] : [];
  await chrome.storage.local.set({ [TRASH_STORAGE_KEY]: [...trash, ...entries] });
  await chrome.storage.local.remove(keys);
  return entries;
}

// 撤销：把回收站记录还原回主存储
async function restoreFromTrash(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return;

  const patch = {};
  entries.forEach(entry => {
    const { deletedAt, ...note } = entry;
    patch[entry.key] = note;
  });
  await chrome.storage.local.set(patch);

  const trashResult = await chrome.storage.local.get([TRASH_STORAGE_KEY]);
  const trash = Array.isArray(trashResult[TRASH_STORAGE_KEY]) ? trashResult[TRASH_STORAGE_KEY] : [];
  const restoredKeys = new Set(entries.map(e => e.key));
  const remaining = trash.filter(item => !item || !restoredKeys.has(item.key));
  if (remaining.length === 0) {
    await chrome.storage.local.remove(TRASH_STORAGE_KEY);
  } else {
    await chrome.storage.local.set({ [TRASH_STORAGE_KEY]: remaining });
  }
}

// 首屏骨架：数据加载/迁移期间给占位卡片，避免「闪空状态」被误读成数据丢失
function showSkeleton() {
  const notesList = document.getElementById('notesList');
  if (!notesList) return;
  notesList.innerHTML = Array.from({ length: 4 }).map(() => `
    <div class="note-card skeleton" aria-hidden="true">
      <div class="sk-row"><span class="sk-circle"></span><span class="sk-line sk-w40"></span></div>
      <span class="sk-line sk-w80"></span>
      <span class="sk-line sk-w60"></span>
    </div>
  `).join('');
}

// favicon 加载失败时回退为首字母头像（站点自身 /favicon.ico 为唯一来源，
// 不依赖任何第三方 favicon 服务——google.com/s2 在国内环境必然失败）
function wireFaviconFallback(container) {
  container.querySelectorAll('img.domain-icon, img.site-icon').forEach(img => {
    img.addEventListener('error', () => {
      const fallback = document.createElement('span');
      fallback.className = `${img.className} domain-fallback`;
      fallback.textContent = (img.alt || '?').charAt(0).toUpperCase();
      img.replaceWith(fallback);
    });
  });
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
    // 退出选择模式时清掉所有勾选，避免残留状态
    if (!isSelectMode) {
      selectAll.checked = false;
      document.querySelectorAll('.note-card .select-checkbox').forEach(checkbox => {
        checkbox.checked = false;
      });
    }
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

  // 更新批量删除事件处理：自绘对话框确认 → 软删除 → 可撤销
  deleteSelected.addEventListener('click', async () => {
    const selectedNotes = document.querySelectorAll('.note-card .select-checkbox:checked');
    if (selectedNotes.length === 0) {
      showToast(getMessage('pleaseSelectNotes'));
      return;
    }

    const ok = await showConfirmDialog({
      title: getMessage('dialogDeleteTitle') || '删除备注',
      message: getMessage('confirmDeleteMultiple', [selectedNotes.length.toString()]),
      confirmText: getMessage('deleteBtn') || '删除',
      danger: true
    });
    if (!ok) return;

    try {
      const keys = Array.from(selectedNotes).map(checkbox =>
        checkbox.closest('.note-card').dataset.key
      );

      const entries = await softDeleteNotes(keys);

      // 退出选择模式并重置勾选状态
      isSelectMode = false;
      document.body.classList.remove('select-mode');
      document.getElementById('toggleSelect').textContent = getMessage('select');
      document.getElementById('deleteSelected').style.display = 'none';
      selectAll.checked = false;

      if (entries.length > 0) {
        showUndoToast(getMessage('deletedCount', [String(entries.length)]), async () => {
          await restoreFromTrash(entries);
          await loadAllNotes();
        });
      }

      // 重新加载数据
      await loadAllNotes();
    } catch (error) {
      showToast(error.message || getMessage('deleteFailure'), 'error');
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

// ==================== 备份信封（导出 / 导入共用的数据切分与校验） ====================
// 备份格式版本：
//   1（隐式）—— 历史遗留的「裸数组」备份，只含备注；导入端只读兼容，不再产出
//   2（当前）—— 带信封的对象：{ format, version, exportTime, appVersion, notes, others }
// 设计要点：others 收纳「非备注」的全部 key（主题、全局禁用、禁用网站列表，
// 以及将来新增的锚定记录等）。按通用规则切分而非逐个列举 —— 今后新增任何 storage key
// 都会自动进入备份，不需要再改导出代码（这正是上一版漏掉锚定数据的根因）。
// 若将来出现「不应进入备份」的临时/缓存类 key，在 splitStorageData 里加一份排除名单即可。
const BACKUP_FORMAT = 'account-note-backup';
const BACKUP_VERSION = 2;

// 是否为一条备注记录。全表读取的过滤口径统一以此为准。
function isNoteRecord(value) {
  return !!(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.domain &&
    value.note &&
    value.username
  );
}

// 把整个 storage 切成「备注」与「其余 key」两堆
function splitStorageData(allData) {
  const notes = [];
  const others = {};

  Object.entries(allData || {}).forEach(([key, value]) => {
    if (isNoteRecord(value)) {
      // 补齐缺失的 key 字段（早期数据可能没有），避免这类备注在备份里被静默丢弃
      notes.push(value.key ? value : Object.assign({}, value, { key }));
    } else {
      others[key] = value;
    }
  });

  return { notes, others };
}

// 解析备份文件内容，兼容新旧两种格式
// 返回 { notes, others, legacy, version }；无法识别时返回 null
function parseBackupPayload(raw) {
  // 旧格式：裸数组，只有备注，不含设置类数据
  if (Array.isArray(raw)) {
    return { notes: raw, others: {}, legacy: true, version: 1 };
  }

  // 新格式：带信封对象
  if (raw && typeof raw === 'object' && Array.isArray(raw.notes)) {
    const others =
      raw.others && typeof raw.others === 'object' && !Array.isArray(raw.others)
        ? raw.others
        : {};
    return {
      notes: raw.notes,
      others,
      legacy: false,
      version: Number(raw.version) || BACKUP_VERSION
    };
  }

  return null;
}

// 净化 others：只接受普通 key-value，并拦掉混进来的「备注形」数据，
// 防止有人构造文件绕过备注校验通道写入未校验内容
function sanitizeOthers(others) {
  const safe = {};

  Object.entries(others || {}).forEach(([key, value]) => {
    if (typeof key !== 'string' || !key) return;
    if (isNoteRecord(value)) return;
    safe[key] = value;
  });

  return safe;
}

// 导入后把受影响的视图全部刷新（备注 / 标签 / 筛选器 / 禁用列表 / 全局开关 / 主题）
async function refreshViewsAfterImport() {
  await loadAllNotes();

  // 导入的备注可能带来新标签，标签列表与筛选器需要同步
  if (typeof loadTagsList === 'function') loadTagsList();
  if (typeof setupFilters === 'function') setupFilters();

  if (typeof loadDisabledSites === 'function') loadDisabledSites();

  // 导入的备份可能带来锚定记录（others 会一并还原）
  if (typeof loadFieldAnchors === 'function') loadFieldAnchors();

  // 导入的备份可能带来站点范围设置（同样在 others 里）
  if (typeof loadSiteScopes === 'function') loadSiteScopes();

  // 全局禁用开关
  const globalToggle = document.getElementById('globalDisableToggle');
  if (globalToggle) {
    const { disabledGlobal } = await chrome.storage.local.get(['disabledGlobal']);
    globalToggle.checked = disabledGlobal === true;
  }

  // 主题
  const { theme } = await chrome.storage.local.get(['theme']);
  currentTheme = theme || 'auto';
  applyTheme(currentTheme);
  updateThemeSelector(currentTheme);
}

// 导出备注数据
async function exportNotes() {
  try {
    // 从本地存储获取全部数据，按「备注 / 非备注」二分
    chrome.storage.local.get(null, (result) => {
      const { notes, others } = splitStorageData(result);

      // 带版本信封：notes 是备注数组，others 收纳主题、禁用列表、锚定记录等非备注 key
      const payload = {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportTime: new Date().toISOString(),
        appVersion: chrome.runtime.getManifest().version,
        notes,
        others
      };

      // 创建带时间戳的文件名
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `accountNote_backup_${timestamp}.json`;

      // 创建Blob对象
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
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
        // 解析备份文件（兼容旧版裸数组与新版信封格式）
        const raw = JSON.parse(event.target.result);
        const parsed = parseBackupPayload(raw);

        if (!parsed) {
          throw new Error(getMessage('invalidDataFormat'));
        }

        // 备份来自更新版本时提示用户，仍按当前能识别的部分尽力恢复
        if (!parsed.legacy && parsed.version > BACKUP_VERSION) {
          showToast(getMessage('backupFromNewerVersion') || '备份文件来自更新的版本，部分数据可能无法恢复');
        }

        // 校验备注结构
        const validNotes = parsed.notes.filter(note =>
          note &&
          typeof note === 'object' &&
          note.domain &&
          note.note &&
          note.username &&
          note.key
        );

        // 设置类数据（主题、禁用列表，以及将来的锚定记录等）
        const safeOthers = sanitizeOthers(parsed.others);

        if (validNotes.length === 0 && Object.keys(safeOthers).length === 0) {
          throw new Error(getMessage('noValidNotes'));
        }

        if (parsed.legacy) {
          console.log('[Import] 检测到旧格式备份（裸数组），仅含备注数据，不含设置类数据');
        }

        // 获取现有数据，用于冲突检测
        const existingData = await new Promise(resolve => {
          chrome.storage.local.get(null, resolve);
        });

        // 备注键 -> 备注 的映射
        const toMap = (list) =>
          list.reduce((acc, note) => {
            acc[note.key] = note;
            return acc;
          }, {});

        const conflicts = validNotes.filter(note => existingData[note.key]);

        if (conflicts.length > 0) {
          // 自绘对话框：确认 = 覆盖，取消 = 跳过重复
          const overwrite = await showConfirmDialog({
            title: getMessage('importData') || '导入数据',
            message: getMessage('conflictPrompt', [conflicts.length.toString()]),
            confirmText: getMessage('importOverwrite') || '覆盖导入',
            danger: false
          });
          if (!overwrite) {
            // 用户选择跳过重复：只补新增备注，不动任何既有设置
            const newNotes = validNotes.filter(note => !existingData[note.key]);
            if (newNotes.length === 0) {
              showToast(getMessage('noNewNotes'));
              return;
            }

            await chrome.storage.local.set(toMap(newNotes));
            showToast(getMessage('importSuccess', [newNotes.length.toString()]), 'success');
          } else {
            // 用户选择覆盖：备注与设置类数据一并还原
            await chrome.storage.local.set(Object.assign({}, toMap(validNotes), safeOthers));
            showToast(getMessage('importSuccess', [validNotes.length.toString()]), 'success');
          }
        } else {
          // 没有冲突，完整还原
          await chrome.storage.local.set(Object.assign({}, toMap(validNotes), safeOthers));
          showToast(getMessage('importSuccess', [validNotes.length.toString()]), 'success');
        }

        // 重新加载所有受影响的视图（备注 / 标签 / 筛选器 / 禁用列表 / 全局开关 / 主题）
        await refreshViewsAfterImport();

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

  // 文件选择处理：按扩展名判断（部分系统对 .json 的 MIME 标注为空或 text/plain，
  // 用 file.type 判断会误拒；真正的格式错误由 JSON.parse 兜底）
  settingsImportFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.json')) {
        showToast(getMessage('selectFileType'), 'error');
        return;
      }
      importNotes(file);
      settingsImportFileInput.value = ''; // 重置文件选择器
    }
  });

  // 清除所有数据：自绘对话框二次确认，写明后果
  clearAllDataBtn.addEventListener('click', async () => {
    const ok = await showConfirmDialog({
      title: getMessage('clearAllData') || '清除所有数据',
      message: getMessage('confirmClearAllData') || '确定要清除所有数据吗？备注、标签、主题设置、禁用网站列表（以及输入框锚定记录）都将被删除，此操作无法恢复。',
      confirmText: getMessage('clear') || '清除',
      danger: true
    });
    if (!ok) return;
    chrome.storage.local.clear(() => {
      showToast(getMessage('dataCleared') || '所有数据已清除', 'success');
      // 备注、标签、筛选器、禁用列表、全局开关、主题一并刷新（清空后应回到默认态）
      refreshViewsAfterImport();
    });
  });

  // 标记为已初始化
  setupDataManagement.initialized = true;
}

// 初始化标志
setupDataManagement.initialized = false;
// 设置关于功能
// 注意：这两个句柄必须先声明再读取——setupAbout 可能被多次调用以重绑监听器，
// 未声明时 `if (handleViewChangelog)` 直接抛 ReferenceError，导致链接监听器永远挂不上
let handleViewChangelog = null;
let handleReportIssue = null;
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
    showToast(getMessage('themeApplied', [getThemeLabel(theme)]) || `${getThemeLabel(theme)}主题已应用`, 'success');
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

// 获取主题标签（走 i18n，两语言同步；缺失时回落中文文案）
function getThemeLabel(theme) {
  const labels = {
    auto: getMessage('themeAuto') || '跟随系统',
    light: getMessage('themeLight') || '浅色',
    dark: getMessage('themeDark') || '深色'
  };
  return labels[theme] || theme;
}

// ==================== Tag Management ====================
// 标签依附于备注记录，管理页只做只读展示（含使用计数）与重命名/删除。
// 独立的「添加标签」表单已被移除：它从不创建任何数据，只会弹出虚假的成功提示。

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

// 删除标签：自绘对话框确认，写明影响的备注范围
async function deleteTag(tagName) {
  const ok = await showConfirmDialog({
    title: getMessage('deleteTag') || '删除标签',
    message: getMessage('confirmDeleteTag', [tagName]) || `确定要删除标签 "${tagName}" 吗？`,
    confirmText: getMessage('deleteBtn') || '删除',
    danger: true
  });
  if (!ok) return;

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

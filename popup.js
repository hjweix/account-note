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
      notesList.innerHTML = `
        <div class="empty-state">
          <p>当前网站暂无备注</p>
          <button class="add-note-btn">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/>
            </svg>
            添加备注
          </button>
        </div>
      `;
      
      // 添加新备注按钮事件
      const addBtn = notesList.querySelector('.add-note-btn');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          chrome.tabs.sendMessage(tab.id, { action: 'showAddNotePopup' });
        });
      }
    } else {
      // 显示备注列表
      notesList.innerHTML = notes.map(note => `
        <div class="note-item" data-key="${note.key}">
          <div class="note-username">${note.username}</div>
          <div class="note-content" title="${note.note}">
            ${note.note.length > 50 ? note.note.slice(0, 50) + '...' : note.note}
          </div>
        </div>
      `).join('');

      // 添加点击事件，点击备注项时聚焦对应的密码框
      document.querySelectorAll('.note-item').forEach(item => {
        item.addEventListener('click', () => {
          const key = item.dataset.key;
          chrome.tabs.sendMessage(tab.id, { 
            action: 'focusPasswordField',
            key: key
          });
        });
      });
    }
  });
} 
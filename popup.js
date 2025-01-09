// 获取当前标签页的URL
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// 显示当前网站的备注
async function showCurrentSiteNotes() {
  const tab = await getCurrentTab();
  const domain = new URL(tab.url).origin;
  
  // 获取所有备注
  chrome.storage.local.get(null, (result) => {
    const notesContainer = document.getElementById('current-notes');
    const currentSiteNotes = Object.values(result).filter(note => note.domain === domain);
    
    if (currentSiteNotes.length === 0) {
      notesContainer.innerHTML = `
        <div class="empty-state">
          当前网站暂无备注
        </div>
      `;
      return;
    }
    
    notesContainer.innerHTML = currentSiteNotes.map(note => `
      <div class="note-item" data-key="${note.key}">
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
    `).join('');
    
    // 添加编辑和删除事件监听
    addNoteActions();
  });
}

// 添加备注操作的事件监听
function addNoteActions() {
  // 编辑按钮
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const noteItem = e.target.closest('.note-item');
      const key = noteItem.dataset.key;
      // TODO: 实现编辑功能
    });
  });
  
  // 删除按钮
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const noteItem = e.target.closest('.note-item');
      const key = noteItem.dataset.key;
      
      if (confirm('确定要删除这条备注吗？')) {
        chrome.storage.local.remove(key, () => {
          noteItem.remove();
          // 如果没有备注了，显示空状态
          if (document.querySelectorAll('.note-item').length === 0) {
            document.getElementById('current-notes').innerHTML = `
              <div class="empty-state">
                当前网站暂无备注
              </div>
            `;
          }
        });
      }
    });
  });
}

// 查看所有备注
document.getElementById('showAllNotes').addEventListener('click', () => {
  // TODO: 实现查看所有备注的功能
  chrome.tabs.create({ url: 'management.html' });
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  showCurrentSiteNotes();
}); 
# Account Note 卡片紧凑设计实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 management.html 中的备注卡片从当前宽松的 480px 宽设计改造为紧凑精致的 320px 设计，添加用户头像，优化信息层级，提升空间利用率。

**Architecture:** 通过修改 CSS 和 JS 实现卡片重构：CSS 负责视觉样式和布局，JS 负责 DOM 结构（特别是添加头像元素）。保持原有功能不变，仅优化视觉效果。

**Tech Stack:** Chrome Extension (Manifest V3), Vanilla CSS, Vanilla JavaScript

---

## 文件结构

| 文件 | 用途 | 变更类型 |
|------|------|---------|
| `src/management.css` | 卡片样式、Grid布局、响应式设计 | 修改 |
| `src/management.js` | 卡片渲染逻辑，添加头像元素 | 修改 |

---

## Task 1: 更新卡片容器样式

**Files:**
- Modify: `src/management.css:477-510`

- [ ] **Step 1: 修改 note-card 基础样式**

将以下 CSS 代码替换原有 `.note-card` 样式（第477行开始）：

```css
/* Note Card - Compact Design */
.note-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.3s var(--ease-standard);
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  overflow: hidden;
}

.note-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--glass-shadow), 0 12px 40px rgba(0, 0, 0, 0.12);
  border-color: rgba(99, 102, 241, 0.2);
}

/* 卡片顶部渐变线 - 收藏状态 */
.note-card.is-favorite {
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.note-card.is-favorite::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
  border-radius: 12px 12px 0 0;
}

/* 移除旧的收藏状态样式 */
.note-card.is-favorite::before {
  /* 新的样式在上面定义 */
}
```

- [ ] **Step 2: Commit**

```bash
git add src/management.css
git commit -m "style: update card container to compact design"
```

---

## Task 2: 更新卡片头部样式

**Files:**
- Modify: `src/management.css:508-530`

- [ ] **Step 1: 修改 note-header 样式**

替换原有 `.note-header` 样式（第508行开始）：

```css
.note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0; /* 移除底部间距 */
}

.note-domain {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--primary-500);
  font-size: 13px;
  font-weight: 600;
  font-family: "Outfit", "DM Sans", sans-serif;
}

.domain-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/management.css
git commit -m "style: compact card header styles"
```

---

## Task 3: 添加卡片主体信息区样式

**Files:**
- Modify: `src/management.css:536-570`

- [ ] **Step 1: 在 note-header 后添加新的 note-body 样式**

在 `.note-header` 样式块后插入以下 CSS（大约在第530行）：

```css
/* Note Body - 主体信息区（新增） */
.note-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

/* 用户头像 - 新增元素 */
.note-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 12px;
  color: white;
  flex-shrink: 0;
  text-transform: uppercase;
}

.note-info {
  flex: 1;
  min-width: 0; /* 防止flex item溢出 */
}

.note-username {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  font-family: "Outfit", "DM Sans", sans-serif;
}

.note-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* 移除旧的 user-icon SVG 样式（如有） */
```

- [ ] **Step 2: Commit**

```bash
git add src/management.css
git commit -m "style: add compact card body with avatar"
```

---

## Task 4: 更新收藏按钮样式

**Files:**
- Modify: `src/management.css:1329-1372`

- [ ] **Step 1: 修改 favorite-btn 样式**

替换原有 `.favorite-btn` 样式（第1329行开始）：

```css
/* Favorite Button - Compact */
.favorite-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--text-tertiary);
  transition: all 0.2s var(--ease-standard);
  display: flex;
  align-items: center;
  justify-content: center;
}

.favorite-btn:hover {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  transform: scale(1.1);
}

.favorite-btn.is-favorite {
  color: #f59e0b;
}

.favorite-btn.is-favorite:hover {
  color: #d97706;
}

/* Remove old favorite styles */
```

- [ ] **Step 2: Commit**

```bash
git add src/management.css
git commit -m "style: compact favorite button"
```

---

## Task 5: 更新底部元信息区样式

**Files:**
- Modify: `src/management.css:1468-1500` 和 `src/management.css:1380-1420`

- [ ] **Step 1: 修改 note-footer 和 note-tags 样式**

首先更新 `.note-footer`（第1468行附近）：

```css
/* Note Footer - Compact */
.note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid var(--glass-border);
}

/* Note Tags - Compact */
.note-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-badge {
  padding: 3px 8px;
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary-600);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s var(--ease-standard);
  border: none; /* 移除边框 */
}

.tag-badge:hover {
  background: rgba(99, 102, 241, 0.2);
  transform: translateY(-1px);
}

/* Note Time - Compact */
.note-time {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 500;
}

/* Note Actions - Compact */
.note-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-tertiary);
  font-size: 14px;
  transition: all 0.2s var(--ease-standard);
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.edit-btn:hover {
  color: var(--primary-500);
}

.delete-btn:hover {
  color: var(--danger-color);
  background: rgba(239, 68, 68, 0.1);
}

/* 移除旧的 note-actions-top */
```

- [ ] **Step 2: Commit**

```bash
git add src/management.css
git commit -m "style: compact footer, tags and action buttons"
```

---

## Task 6: 更新 Grid 布局

**Files:**
- Modify: `src/management.css:470-474`

- [ ] **Step 1: 修改 notes-grid 样式**

替换原有 `.notes-grid` 样式（第470行）：

```css
.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}
```

- [ ] **Step 2: 更新响应式断点**

修改响应式断点中的 grid 设置（第1237-1280行附近）：

```css
/* Responsive Design */
@media (max-width: 1400px) {
  .header-content {
    padding: 0 24px;
  }

  .main-content {
    padding: 24px 32px;
  }

  .notes-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }
}

@media (max-width: 1024px) {
  .notes-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: var(--space-4);
    padding: 0 var(--space-4);
  }

  .search-box {
    width: 100%;
  }

  .main-content {
    padding: var(--space-4);
  }

  .notes-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  /* ... 其余保持不变 */
}
```

- [ ] **Step 3: Commit**

```bash
git add src/management.css
git commit -m "style: update grid to support compact cards (320px min)"
```

---

## Task 7: 更新卡片渲染逻辑 - 添加头像

**Files:**
- Modify: `src/management.js:183-246`

- [ ] **Step 1: 修改卡片模板添加 note-body 和头像**

找到 `displayNotes` 函数中的卡片模板（约第183-246行），替换为：

```javascript
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
```

**注意关键变化：**
- 添加 `<div class="note-avatar">${avatarLetter}</div>`
- 使用 `<div class="note-body">` 包裹头像和用户信息
- 移除 `note-main` 和 `note-actions-top` 容器
- 标签和底部 footer 保持同级
- 备注内容截断长度从 50 改为 60 字符

- [ ] **Step 2: Commit**

```bash
git add src/management.js
git commit -m "feat: update card template with avatar and compact layout"
```

---

## Task 8: 更新编辑模式样式适配

**Files:**
- Modify: `src/management.css:610-695`

- [ ] **Step 1: 调整编辑模式的样式**

找到 `.edit-mode` 和 `.edit-input` 样式，添加编辑模式下隐藏头像的样式：

```css
/* Edit Mode - Compact Adaptation */
.edit-mode {
  margin: 0;
  padding: 0;
  width: 100%;
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* 编辑模式下隐藏头像 */
.note-card.editing .note-body .note-avatar {
  display: none;
}

/* 编辑模式下让 note-info 占满宽度 */
.note-card.editing .note-body {
  display: block;
}

.edit-input {
  width: 100%;
  box-sizing: border-box;
  min-height: 80px; /* 减小最小高度 */
  padding: var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: 12px; /* 更小的圆角 */
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  background: var(--bg-secondary);
  font-family: inherit;
  color: var(--text-primary);
  transition: all 0.2s;
  backdrop-filter: blur(8px);
}

.edit-input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.edit-actions {
  display: none;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

/* ... 其余编辑按钮样式保持不变 ... */
```

- [ ] **Step 2: Commit**

```bash
git add src/management.css
git commit -m "style: adapt edit mode for compact cards"
```

---

## Task 9: 清理旧样式代码

**Files:**
- Modify: `src/management.css`

- [ ] **Step 1: 检查并移除不再使用的样式**

需要检查并移除或注释掉的旧样式：
1. `.note-actions-top` - 不再需要
2. `.note-main` - 不再需要
3. 旧的 `.note-username` 中的 SVG user-icon 样式

搜索并删除：

```css
/* 删除：Note Actions Top */
.note-actions-top {
  display: flex;
  gap: var(--space-2);
}

/* 删除：Note Main */
.note-main {
  flex: 1;
}

/* 删除：user-icon SVG 样式（如有单独定义） */
```

- [ ] **Step 2: Commit**

```bash
git add src/management.css
git commit -m "chore: remove obsolete card styles"
```

---

## Task 10: 构建和测试

**Files:**
- Run: `npm run build`
- Test: Chrome Extension

- [ ] **Step 1: 运行构建命令**

```bash
npm run build
```

**Expected output:**
- 构建成功，无错误
- dist/management.css 和 dist/management.js 已更新

- [ ] **Step 2: 验证构建产物**

```bash
ls -la dist/management.css dist/management.js
```

**Expected:** 文件存在且时间戳更新

- [ ] **Step 3: 在 Chrome 中测试**

1. 打开 Chrome 扩展管理页面 (chrome://extensions/)
2. 刷新 Account Note 扩展
3. 打开 management.html
4. 验证：
   - [ ] 卡片宽度约为 320px
   - [ ] 显示用户头像（首字母）
   - [ ] 布局紧凑，无多余留白
   - [ ] 收藏按钮工作正常
   - [ ] 编辑按钮工作正常
   - [ ] 删除按钮工作正常
   - [ ] 响应式布局在 768px/1024px/1400px 断点正常

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "build: compact card design implementation complete"
```

---

## 自检清单

完成所有任务后，验证以下项目：

- [ ] 所有 CSS 代码都已正确替换，无重复定义
- [ ] JS 中的卡片模板正确生成头像元素
- [ ] Grid 布局最小宽度为 320px
- [ ] 收藏状态顶部渐变线显示正确
- [ ] 响应式断点工作正常
- [ ] 编辑模式下布局正确（头像隐藏）
- [ ] 构建成功，无错误
- [ ] 所有交互功能（收藏、编辑、删除）正常工作

---

## 已知问题和注意事项

1. **头像颜色**: 当前使用固定渐变色，未来可以考虑根据用户名哈希生成不同颜色
2. **备注截断**: 从 50 字符增加到 60 字符，因为卡片变窄但高度也减小
3. **旧数据兼容**: 不需要修改，渲染逻辑向后兼容
4. **浅色主题**: 颜色变量已通过 CSS 变量自动适配，无需额外修改

---

**Plan written by:** Claude Code  
**Date:** 2026-04-22  
**Based on spec:** docs/superpowers/specs/2026-04-22-card-compact-design.md

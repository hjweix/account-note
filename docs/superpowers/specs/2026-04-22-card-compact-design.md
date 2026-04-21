# Account Note 卡片紧凑设计规范

**设计日期**: 2026-04-22  
**设计版本**: 1.0  
**设计主题**: 紧凑精致卡片布局

## 1. 设计概述

### 1.1 设计目标
- 减小卡片尺寸，提升空间利用率
- 提高信息密度，减少视觉留白
- 保持现代感，同时更加精致紧凑

### 1.2 核心变化
| 元素 | 当前设计 | 新设计 |
|------|---------|--------|
| 卡片宽度 | min 480px | min 320px |
| 卡片 padding | 24px | 16px |
| 内部 gap | 16px | 10px |
| 圆角 | 20px | 12px |
| 信息层级 | 分散垂直 | 头像+信息组合 |

## 2. 视觉规格

### 2.1 卡片容器
```css
.note-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  transition: all 0.3s ease;
}

.note-card:hover {
  border-color: rgba(99, 102, 241, 0.3);
  transform: translateY(-2px);
}
```

### 2.2 收藏状态
```css
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
```

### 2.3 头部区域
```css
.note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.note-domain {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #818cf8;
  font-size: 13px;
  font-weight: 600;
}

.domain-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

### 2.4 收藏按钮
```css
.favorite-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  font-size: 16px;
  padding: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
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
```

### 2.5 主体信息区（新布局）
```css
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
}

.note-info {
  flex: 1;
  min-width: 0; /* 防止flex item溢出 */
}

.note-username {
  font-size: 15px;
  font-weight: 600;
  color: #f8fafc;
  margin-bottom: 4px;
}

.note-content {
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.5;
}
```

### 2.6 底部元信息区
```css
.note-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.note-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-badge {
  padding: 3px 8px;
  background: rgba(99, 102, 241, 0.1);
  color: #818cf8;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.tag-badge:hover {
  background: rgba(99, 102, 241, 0.2);
  transform: translateY(-1px);
}

.note-time {
  font-size: 11px;
  color: #64748b;
}

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
  color: #64748b;
  font-size: 14px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.edit-btn:hover {
  color: #818cf8;
}

.delete-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}
```

## 3. Grid 布局调整

### 3.1 网格系统
```css
.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}
```

### 3.2 响应式断点
```css
@media (max-width: 1400px) {
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
  .notes-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
```

## 4. 颜色方案

### 4.1 深色主题（默认）
| 元素 | 颜色值 |
|------|--------|
| 卡片背景 | rgba(30, 41, 59, 0.7) |
| 边框 | rgba(255, 255, 255, 0.08) |
| 主文本 | #f8fafc |
| 次级文本 | #94a3b8 |
| 时间文本 | #64748b |
| 域名/标签 | #818cf8 |
| 收藏色 | #f59e0b |
| 删除色 | #ef4444 |

### 4.2 浅色主题
| 元素 | 颜色值 |
|------|--------|
| 卡片背景 | rgba(255, 255, 255, 0.7) |
| 边框 | rgba(0, 0, 0, 0.08) |
| 主文本 | #1e293b |
| 次级文本 | #64748b |
| 时间文本 | #94a3b8 |
| 域名/标签 | #3b82f6 |
| 收藏色 | #f59e0b |
| 删除色 | #ef4444 |

## 5. 交互状态

### 5.1 悬停效果
- 卡片整体: `translateY(-2px)` + 边框高亮
- 按钮: 背景色变化 + 缩放 `scale(1.1)`
- 标签: 背景加深 + 微上移 `translateY(-1px)`

### 5.2 点击反馈
- 按钮: 缩放 `scale(0.95)` 后恢复
- 卡片: 轻微阴影加深

## 6. 头像生成规则

头像使用用户名首字母（大写），背景使用渐变色：
```css
background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
```

可选：根据用户名哈希值生成不同渐变色组合，增加视觉区分度。

## 7. 实施检查清单

- [ ] 更新 `management.css` 中的卡片样式
- [ ] 修改 Grid 布局的最小宽度为 320px
- [ ] 在 `management.js` 中添加头像元素生成逻辑
- [ ] 调整编辑模式下的布局适配
- [ ] 验证深色/浅色主题切换
- [ ] 测试响应式布局在各断点下的表现
- [ ] 验证收藏状态的视觉反馈

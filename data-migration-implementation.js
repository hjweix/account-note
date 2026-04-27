
// ============================================================================
// DATA MIGRATION IMPLEMENTATION
// File: data-migration-implementation.js
// Purpose: Provide concrete code changes for data migration fix
// ============================================================================

// ============================================================================
// PART 1: Migration Utility Functions
// Location: src/management.js (add at the top, after variable declarations)
// ============================================================================

/**
 * 迁移单个备注数据到最新格式
 * 补充缺失的 tags、isFavorite、favoriteTime 字段
 *
 * @param {Object} note - 原始备注数据
 * @param {string} key - 存储键名
 * @returns {Object} 包含迁移后的note和迁移信息
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
    // 如果标记为收藏但没有收藏时间，使用更新时间
    migratedNote.favoriteTime = migratedNote.updateTime || new Date().toISOString();
    needsMigration.push('favoriteTime');
  } else if (!migratedNote.isFavorite && migratedNote.favoriteTime !== null) {
    // 如果未收藏但有收藏时间，清除
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
 * 在 loadAllNotes 中调用
 */
async function migrateAllNotes() {
  console.log('[Migration] 开始检查数据迁移...');

  try {
    // 获取所有数据
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(null, resolve);
    });

    const migrationUpdates = {};
    let migratedCount = 0;
    let totalCount = 0;

    // 遍历所有数据项
    Object.entries(result).forEach(([key, note]) => {
      // 只处理有效的备注数据
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

    // 如果有需要更新的数据，批量写入
    if (migratedCount > 0) {
      console.log(`[Migration] 需迁移 ${migratedCount}/${totalCount} 条备注，开始写入...`);
      await new Promise((resolve) => {
        chrome.storage.local.set(migrationUpdates, resolve);
      });
      console.log(`[Migration] 数据迁移完成，成功迁移 ${migratedCount} 条备注`);

      // 显示通知
      if (typeof showToast === 'function') {
        showToast(`数据升级完成（${migratedCount}条备注已优化）`, 'success');
      }
    } else {
      console.log(`[Migration] 所有 ${totalCount} 条数据已是最新格式，无需迁移`);
    }

    return { migratedCount, totalCount };
  } catch (error) {
    console.error('[Migration] 数据迁移失败:', error);
    if (typeof showToast === 'function') {
      showToast('数据检查完成', 'info');
    }
    return { migratedCount: 0, totalCount: 0, error: error.message };
  }
}

// ============================================================================
// PART 2: Safe Access Functions
// Location: src/management.js (add near other utility functions)
// ============================================================================

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
 * 确保返回的数据结构完整
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

// ============================================================================
// PART 3: Enhanced Filtering Logic
// Location: src/management.js (replace existing filter logic in displayNotes)
// ============================================================================

/**
 * 应用标签筛选
 */
function filterByTags(notes, filterTags) {
  if (!filterTags || filterTags.length === 0) return notes;

  return notes.filter(note => {
    const noteTags = getNoteTags(note);
    return filterTags.some(tag => noteTags.includes(tag));
  });
}

/**
 * 应用收藏筛选
 */
function filterByFavorite(notes, isFavoriteOnly) {
  if (!isFavoriteOnly) return notes;

  return notes.filter(note => getNoteIsFavorite(note));
}

/**
 * 应用搜索筛选
 */
function filterBySearchTerm(notes, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) return notes;

  const term = searchTerm.toLowerCase().trim();

  return notes.filter(note =>
    note.domain.toLowerCase().includes(term) ||
    note.username.toLowerCase().includes(term) ||
    note.note.toLowerCase().includes(term) ||
    getNoteTags(note).some(tag => tag.toLowerCase().includes(term))
  );
}

// ============================================================================
// PART 4: Enhanced Save Logic
// Location: src/management.js (in saveNote function)
// ============================================================================

/**
 * 保存备注时保留现有数据
 * 替换原有的 saveNote 中的构建逻辑
 */
function buildNoteData(key, noteText, field, existingNote = null) {
  const domain = window.location.origin;
  const username = field.value.trim();
  const now = new Date().toISOString();

  // 构建基础数据
  const noteData = {
    key: key,
    note: noteText.trim(),
    domain: domain,
    username: username,
    updateTime: now
  };

  // 如果是现有备注，保留重要元数据
  if (existingNote) {
    noteData.createTime = existingNote.createTime || now;
    noteData.tags = Array.isArray(existingNote.tags) ?
      [...existingNote.tags] : [];
    noteData.isFavorite = typeof existingNote.isFavorite === 'boolean' ?
      existingNote.isFavorite : false;
    noteData.favoriteTime = existingNote.isFavorite ?
      (existingNote.favoriteTime || now) : null;
  } else {
    // 新备注
    noteData.createTime = now;
    noteData.tags = [];
    noteData.isFavorite = false;
    noteData.favoriteTime = null;
  }

  return noteData;
}

// ============================================================================
// PART 5: Enhanced Tag Management
// Location: src/management.js (update tag-related functions)
// ============================================================================

/**
 * 获取所有标签（安全版本）
 */
async function getAllTagsSafe() {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(null, resolve);
    });

    const notes = Object.values(result).filter(note =>
      note && note.domain && note.note && note.username && note.key
    );

    const tags = new Set();
    notes.forEach(note => {
      const noteTags = getNoteTags(note);
      noteTags.forEach(tag => {
        if (typeof tag === 'string' && tag.trim()) {
          tags.add(tag.trim());
        }
      });
    });

    return Array.from(totes).sort();
  } catch (error) {
    console.error('获取标签失败:', error);
    return [];
  }
}

/**
 * 更新备注的标签（安全版本）
 */
function updateNoteTags(key, newTags) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      const existingNote = result[key];
      if (!existingNote) {
        reject(new Error('Note not found'));
        return;
      }

      const updatedNote = {
        ...existingNote,
        tags: Array.isArray(newTags) ? newTags : [],
        updateTime: new Date().toISOString()
      };

      chrome.storage.local.set({ [key]: updatedNote }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(updatedNote);
        }
      });
    });
  });
}

// ============================================================================
// PART 6: Usage Instructions
// ============================================================================

/*
HOW TO IMPLEMENT:

1. Add the Migration Functions:
   - Copy PART 1 code to src/management.js (after line 12, after variable declarations)

2. Update loadAllNotes function:
   - Replace the current implementation (line ~68) with the new version in PART 2
   - Or add the migration call at the beginning:

     async function loadAllNotes() {
       console.log('[LoadAllNotes] 开始加载备注');

       // ADD THIS LINE:
       await migrateAllNotes();

       chrome.storage.local.get(null, (result) => {
         // ... rest of existing code
       });
     }

3. Add Safe Access Functions:
   - Copy PART 2 code to src/management.js (near other utility functions, around line 200)

4. Update Filtering Logic:
   - In displayNotes function, replace the tag filtering section with:

     // 按标签筛选
     if (currentFilter.tags && currentFilter.tags.length > 0) {
       filteredNotes = filterByTags(filteredNotes, currentFilter.tags);
     }

     // 按收藏筛选
     if (currentFilter.isFavorite) {
       filteredNotes = filterByFavorite(filteredNotes, currentFilter.isFavorite);
     }

5. Update saveNote function:
   - Replace the noteData construction (around line ~390 in content.js and ~410 in management.js)
   - Use the buildNoteData function from PART 4

6. Update getAllTags function:
   - Replace with getAllTagsSafe() from PART 5

7. Test Thoroughly:
   - Test with old data format
   - Test with new data format
   - Test mixed data
   - Test edge cases

EXPECTED BEHAVIOR:
- First load after upgrade: automatic migration happens
- Subsequent loads: no migration needed (data already updated)
- All features work immediately after upgrade
- No user intervention required
*/


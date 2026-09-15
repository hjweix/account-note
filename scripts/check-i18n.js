#!/usr/bin/env node
/**
 * i18n key 一致性检查
 *
 * 背景：`getMessage(key)` 的降级链是
 *   chrome.i18n.getMessage(key) || getDefaultMessage(key)
 * 而 getDefaultMessage() 只认识一张小的内置表；对未收录的 key 它会**返回 key 本身**，
 * 于是调用方的 `|| '兜底文案'` 永远不会生效，界面上会直接显示 "tagRenamed" 这样的原始 key。
 * 因此「JS 用到的 key 必须在 locale 文件里齐全」是硬要求。
 *
 * 检查项：
 *   1. src/*.js 中 getMessage('key') 用到的 key，在 en / zh_CN 中是否都存在（缺失 = 错误）
 *   2. 每个条目是否具备 message 字段
 *   3. locale 中定义但 JS 未直接引用的 key（仅提示，不报错）
 *   4. 仅单一语言存在的 key（缺失 = 错误）
 *
 * 用法：node scripts/check-i18n.js
 * 退出码：0 = 通过，1 = 存在缺失
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JS_FILES = ['src/content.js', 'src/popup.js', 'src/management.js'];
const LOCALES = ['en', 'zh_CN'];

function collectUsedKeys() {
  const used = new Map();
  for (const rel of JS_FILES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const re = /getMessage\(\s*['"]([A-Za-z0-9_]+)['"]/g;
    let m;
    while ((m = re.exec(src))) {
      if (!used.has(m[1])) used.set(m[1], new Set());
      used.get(m[1]).add(rel.replace('src/', ''));
    }
  }
  return used;
}

function loadLocale(name) {
  const file = path.join(ROOT, '_locales', name, 'messages.json');
  if (!fs.existsSync(file)) throw new Error(`找不到 locale 文件：${file}`);
  return { path: file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

const used = collectUsedKeys();
const locales = Object.fromEntries(LOCALES.map(n => [n, loadLocale(n)]));

const missing = {}; // locale → [key]
const noMessage = {};
for (const name of LOCALES) {
  const data = locales[name].data;
  missing[name] = [...used.keys()].filter(k => !data[k]);
  noMessage[name] = Object.keys(data).filter(k => !data[k].message);
}

const orphan = {};
for (const name of LOCALES) {
  orphan[name] = Object.keys(locales[name].data).filter(k => !used.has(k));
}

const onlyIn = {};
const allKeys = new Set(LOCALES.flatMap(n => Object.keys(locales[n].data)));
for (const name of LOCALES) {
  onlyIn[name] = [...allKeys].filter(k => locales[name].data[k] && LOCALES.some(o => o !== name && !locales[o].data[k]));
}

console.log(`JS 中使用的 key：${used.size} 个`);
LOCALES.forEach(n => console.log(`  _locales/${n}/messages.json：${Object.keys(locales[n].data).length} 个条目`));
console.log('');

let failed = false;

for (const name of LOCALES) {
  if (missing[name].length) {
    failed = true;
    console.log(`❌ ${name} 缺失 ${missing[name].length} 个「JS 已引用」的 key：`);
    missing[name].forEach(k => console.log(`     ${k}   （用于 ${[...used.get(k)].join(', ')}）`));
  } else {
    console.log(`✅ ${name}：JS 引用的 key 全部存在`);
  }
}

for (const name of LOCALES) {
  if (onlyIn[name].length) {
    failed = true;
    console.log(`❌ 仅 ${name} 存在（另一语言缺失）的 key：${onlyIn[name].join(', ')}`);
  }
}

for (const name of LOCALES) {
  if (noMessage[name].length) {
    failed = true;
    console.log(`❌ ${name} 中存在缺少 message 字段的条目：${noMessage[name].join(', ')}`);
  }
}

for (const name of LOCALES) {
  if (orphan[name].length) {
    console.log(`⚠ ${name}：定义但 JS 未直接引用 ${orphan[name].length} 个（可能由 HTML/构建流程使用，暂不清理）：`);
    console.log(`     ${orphan[name].join(', ')}`);
  }
}

console.log('');
if (failed) {
  console.log('❌ i18n 检查未通过');
  process.exit(1);
}
console.log('✅ i18n 检查通过');

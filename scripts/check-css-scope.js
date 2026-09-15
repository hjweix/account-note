#!/usr/bin/env node
/**
 * CSS 作用域泄漏检查
 *
 * 目的：content script 注入宿主页面的 CSS（styles.css / disable-options.css）
 * 绝不能出现「裸类名」选择器，否则会污染网站自身样式。
 * 本脚本解析构建产物 dist/content.css，逐个选择器判定其是否被扩展容器限定。
 *
 * 判定规则（任一满足即合规）：
 *   1. 选择器链路中含扩展容器类：.account-note-btn / .account-note-toast /
 *      .account-note-suggestion / .disable-options-menu
 *   2. 选择器主体（最右侧复合选择器）的类名全部带 `account-note` 前缀
 *
 * 违规示例：`.favorite-btn { ... }`（裸类名，会匹配宿主页面的同名元素）
 * 合规示例：`.account-note-suggestion .favorite-btn { ... }`
 *          `.account-note-toast .toast-icon { ... }`
 *          `.account-note-text { ... }`（自带 account-note 前缀）
 *
 * 用法：
 *   node scripts/check-css-scope.js            # 检查 dist/content.css
 *   node scripts/check-css-scope.js --dupes    # 附带给出去重报告
 *
 * 退出码：0 = 全部合规，1 = 存在违规
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'dist', 'content.css');
const SHOW_DUPES = process.argv.includes('--dupes');

// 扩展容器类：出现即视为已限定作用域
const CONTAINER_CLASSES = [
  'account-note-suggestion',
  'account-note-toast',
  'account-note-btn',
  'disable-options-menu',
];

// 允许的前缀
const OWN_PREFIX = 'account-note';

function loadPostcss() {
  try {
    return require('postcss');
  } catch (error) {
    return null;
  }
}

/** 归一化单个选择器：去掉伪类/伪元素/属性选择器，便于提取类名 */
function normalizeSelector(selector) {
  return selector
    .replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, '') // 伪类 / 伪元素（含 :not(...) / :where(...) 内容整体去掉）
    .replace(/\[[^\]]*\]/g, '') // 属性选择器
    .replace(/\s*[>+~]\s*/g, ' ') // 组合符统一为空格
    .trim();
}

/** 规则所处的 at-rule 上下文（如 @media (prefers-color-scheme: dark)） */
function contextOf(rule) {
  const stack = [];
  let p = rule.parent;
  while (p && p.type === 'atrule') {
    stack.unshift('@' + p.name + ' ' + p.params);
    p = p.parent;
  }
  return stack.join(' > ') || 'root';
}

/** 按顶层逗号切分选择器列表（忽略 :where(...) / :not(...) 内部的逗号） */
function splitTopLevel(selectorList) {
  const result = [];
  let depth = 0;
  let current = '';
  for (const ch of selectorList) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) result.push(current.trim());
  return result.filter(Boolean);
}

function extractClasses(selector) {
  const matches = selector.match(/\.[a-zA-Z0-9_-]+/g) || [];
  return matches.map(c => c.slice(1));
}

/** 取选择器的主体（最右侧的复合选择器）。注意保留 :where(...) 内部内容以提取类名 */
function mainPart(selector) {
  const parts = normalizeSelector(selector).split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

/** 主体复合选择器（不剥离伪类，用于 :where 场景的类名提取） */
function mainPartRaw(selector) {
  // 按顶层空格切分，取最后一段
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of selector.replace(/\s*([>+~])\s*/g, ' $1 ')) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (/\s/.test(ch) && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  // 去掉组合符残段
  const cleaned = parts.filter(p => !/^[>+~]$/.test(p));
  return cleaned.length ? cleaned[cleaned.length - 1] : '';
}

function checkSelector(selector) {
  const classes = extractClasses(selector);
  const mainClasses = extractClasses(mainPartRaw(selector) || mainPart(selector));

  // 无类名的裸标签选择器（html / body / * / input 等）一律不合规
  if (classes.length === 0) {
    return { ok: false, reason: '裸标签/通配选择器（无类名限定）' };
  }

  // 规则 1：链路中含扩展容器类
  const hasContainer = classes.some(c => CONTAINER_CLASSES.includes(c));
  if (hasContainer) return { ok: true, reason: '容器类限定' };

  // 规则 2：主体类名中至少一个带 account-note 前缀。
  // CSS 选择器对同一元素上的多个类是「与」关系，只要有一个自有前缀类，
  // 该选择器就不可能命中宿主页面的元素（如 .account-note-text.empty-note）。
  const hasOwnPrefix = mainClasses.some(c => c.startsWith(OWN_PREFIX));
  if (hasOwnPrefix) return { ok: true, reason: '自有前缀' };

  const offending = mainClasses.filter(c => !c.startsWith(OWN_PREFIX));
  return { ok: false, reason: `裸类名：${offending.join(', ')}` };
}

function main() {
  if (!fs.existsSync(TARGET)) {
    console.error(`✗ 找不到构建产物：${TARGET}\n  请先执行 npm run build`);
    process.exit(1);
  }
  const css = fs.readFileSync(TARGET, 'utf8');
  const postcss = loadPostcss();
  if (!postcss) {
    console.error('✗ 需要 postcss（通常随 css-loader 一起安装）。请在项目根目录执行 npm install。');
    process.exit(1);
  }

  const root = postcss.parse(css);
  const violations = [];
  const selectorCount = { total: 0, rules: 0 };
  const seen = new Map(); // 选择器 → 出现次数（用于去重报告）

  root.walkRules(rule => {
    // 跳过 @keyframes 内的关键帧规则（0% { ... }），它们不是选择器
    const parent = rule.parent;
    if (parent && parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return;

    selectorCount.rules += 1;
    const selectors = splitTopLevel(rule.selector);
    const ctx = contextOf(rule);
    selectors.forEach(sel => {
      selectorCount.total += 1;
      // 去重报告的键必须包含 at-rule 上下文：
      // 同一选择器出现在 :root 与 @media (prefers-color-scheme: dark) 内
      // 是合法的主题覆盖，不是重复。
      const raw = `${ctx}||${sel.replace(/\s+/g, ' ').trim()}`;
      seen.set(raw, (seen.get(raw) || 0) + 1);

      const result = checkSelector(sel);
      if (!result.ok) {
        violations.push({ selector: sel, line: rule.source && rule.source.start ? rule.source.start.line : '?', reason: result.reason });
      }
    });
  });

  console.log(`检查目标：dist/content.css（${Math.round(css.length / 1024)} KB）`);
  console.log(`规则块 ${selectorCount.rules} 个 / 选择器 ${selectorCount.total} 条\n`);

  if (violations.length === 0) {
    console.log('✅ 作用域检查通过：未发现裸类名或裸标签选择器');
  } else {
    console.log(`❌ 发现 ${violations.length} 条未限定作用域的选择器：\n`);
    violations.forEach(v => {
      console.log(`  第 ${String(v.line).padStart(4)} 行  ${v.selector}\n              → ${v.reason}`);
    });
  }

  if (SHOW_DUPES) {
    const dupes = [...seen.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]);
    console.log(`\n— 去重报告：重复出现的选择器 ${dupes.length} 个 —`);
    if (dupes.length === 0) console.log('  无重复');
    dupes.forEach(([sel, count]) => console.log(`  ×${count}  ${sel}`));
  }

  process.exit(violations.length === 0 ? 0 : 1);
}

main();

// ===== 站点作用域（site scope）=====
//
// 备注按「站点」归属，但判定标准不是整串 origin，而是域名的上下级关系：
//   - 同一个域名，或互为上下级（api.x.com ↔ x.com）→ 同一个站点，备注互通
//   - 平级兄弟（ipsuat.x.com ↔ ipsdev.x.com）→ 互不相通，各记各的
// 于是「登录子域写的备注，登录后的主域看得到」，而「同域下的多套环境互不串号」。
//
// 比较只看 hostname，忽略协议与端口：http→https 跳转、同域不同端口都算同一站。
//
// 刻意不依赖公共后缀表（PSL）：父子关系只需判断域名后缀，
// 因此无需内嵌、也无需长期维护一份后缀清单（.com.cn / .co.uk 这类无需特判）。

export const SCOPE_STORAGE_KEY = 'siteScopeOverrides';

// 默认档：跟随上下级（父子域互通）
export const SCOPE_INHERIT = 'inherit';
// 例外档：仅本站（把自己从上下级链上摘掉，只认自己的备注）
export const SCOPE_EXACT = 'exact';

// 从 origin / url / 裸域名里取 hostname；取不到返回 ''
export function hostOf(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  try {
    const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? new URL(raw) : new URL(`http://${raw}`);
    return (url.hostname || '').toLowerCase().replace(/\.$/, '');
  } catch (error) {
    return '';
  }
}

// ancestor 是否为 host 的上级域名（严格上级，不含相等）
export function isAncestorHost(ancestor, host) {
  if (!ancestor || !host || ancestor === host) return false;
  // 前置点号保证是完整的一段标签，`evilchoerodon.com.cn` 不会被误判为 `choerodon.com.cn` 的下级
  return host.endsWith(`.${ancestor}`);
}

// 纯域名层面的上下级判定（不含用户覆盖）
export function sameHostScope(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return isAncestorHost(a, b) || isAncestorHost(b, a);
}

// 清洗用户覆盖表：只保留「仅本站」这类非默认值，其余键一律丢弃（跟随上下级是默认态，不落盘）
export function normalizeOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const host = hostOf(key);
    if (host && value && value.level === SCOPE_EXACT) {
      out[host] = { level: SCOPE_EXACT };
    }
  }
  return out;
}

export function isExactScope(host, overrides) {
  return !!(host && overrides && overrides[host] && overrides[host].level === SCOPE_EXACT);
}

// 两个 host 是否属于同一个可互通的站点（含用户覆盖判定）
export function inSameScope(hostA, hostB, overrides) {
  if (!hostA || !hostB) return false;
  if (hostA === hostB) return true;
  // 任一侧被设为「仅本站」，就断开它与上下级的互通
  if (isExactScope(hostA, overrides) || isExactScope(hostB, overrides)) return false;
  return sameHostScope(hostA, hostB);
}

// 某站点相对参考站点的层级：0 = 同站，1 = 上级域，2 = 下级域
export function scopeRank(referenceHost, host) {
  if (!referenceHost || !host) return 3;
  if (referenceHost === host) return 0;
  if (isAncestorHost(host, referenceHost)) return 1;
  if (isAncestorHost(referenceHost, host)) return 2;
  return 3;
}

// 取参考站点所属的「组代表」：在一组互相可见的 host 里，选出最靠上的那个（无上级者为代表）
export function scopeRepresentative(host, allHosts) {
  if (!host) return '';
  let candidate = host;
  for (const other of allHosts || []) {
    if (!other || other === candidate) continue;
    if (isAncestorHost(other, candidate)) candidate = other;
  }
  return candidate;
}

// 在备注全表里按「同 scope + 同用户名」查找，返回按优先度排序的候选
// 排序：同站 → 上级域 → 下级域；同层优先精确 key；再按更新时间新→旧
export function collectNoteCandidates(all, referenceHost, username, overrides, exactKey) {
  if (!all || typeof all !== 'object' || !referenceHost || !username) return [];
  const matches = [];
  for (const [key, value] of Object.entries(all)) {
    if (!value || typeof value !== 'object') continue;
    if (!value.domain || !value.note || !value.username) continue;
    if (value.username !== username) continue;
    const noteHost = hostOf(value.domain);
    if (!inSameScope(noteHost, referenceHost, overrides)) continue;
    matches.push({ key: value.key || key, note: value, noteHost });
  }
  matches.sort((a, b) => {
    const byRank = scopeRank(referenceHost, a.noteHost) - scopeRank(referenceHost, b.noteHost);
    if (byRank !== 0) return byRank;
    if (exactKey) {
      if (a.key === exactKey) return -1;
      if (b.key === exactKey) return 1;
    }
    return String(b.note.updateTime || '').localeCompare(String(a.note.updateTime || ''));
  });
  return matches;
}

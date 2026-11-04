/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ART VERSE AI — HỆ THỐNG TÌM KIẾM ĐỒNG BỘ TOÀN HỆ THỐNG (Search Engine & Vietnamese Normalizer)
 *
 * Đặc tả kỹ thuật:
 * - Không phân biệt chữ hoa / chữ thường.
 * - Hỗ trợ tiếng Việt có dấu và không dấu (ví dụ: "Cọ Nhỏ" <-> "co nho", "Mĩ thuật" <-> "mi thuat").
 * - Loại bỏ khoảng trắng thừa.
 * - Sinh trường chuẩn hóa `searchNormalized` và mảng `searchTokens` phục vụ truy vấn chỉ mục Firestore (`array-contains`).
 * - Hỗ trợ phân trang (`page`, `pageSize`, `hasMore`) và gợi ý từ khóa thông minh.
 * - Tuyệt đối không lộ `fullName`, `studentCode`, `pinHash`, `email` trong kết quả công khai.
 */

export function normalizeVietnameseSearch(input?: string | null): string {
  if (!input) return '';
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeKeepAccents(input?: string | null): string {
  if (!input) return '';
  return String(input)
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates indexed search tokens (words + 2..12 char prefixes) for Firestore `array-contains` queries
 * while keeping array size bounded (<= 45 tokens) to control Firestore index storage & write costs.
 */
export function buildFirestoreSearchTokens(fields: Array<string | undefined | null>): string[] {
  const tokenSet = new Set<string>();
  for (const field of fields) {
    const norm = normalizeVietnameseSearch(field);
    if (!norm) continue;
    const words = norm.split(' ').filter((w) => w.length >= 2);
    for (const w of words) {
      tokenSet.add(w);
      const maxPrefix = Math.min(w.length, 10);
      for (let len = 2; len <= maxPrefix; len++) {
        tokenSet.add(w.slice(0, len));
      }
      if (tokenSet.size >= 45) break;
    }
    if (tokenSet.size >= 45) break;
  }
  return Array.from(tokenSet).slice(0, 45);
}

/**
 * Computes relevance score for a candidate item against a user query.
 * Returns 0 if the item does not match the query.
 * Supports multi-word queries, accented priority, and unaccented fallback.
 */
export function computeSearchRelevance(
  query: string,
  primaryFields: Array<string | undefined | null>,
  secondaryFields: Array<string | undefined | null> = []
): number {
  const cleanQueryAccented = normalizeKeepAccents(query);
  const cleanQueryUnaccented = normalizeVietnameseSearch(query);
  if (!cleanQueryUnaccented) return 1;

  const queryWords = cleanQueryUnaccented.split(' ').filter(Boolean);
  if (queryWords.length === 0) return 1;

  const primaryAccented = primaryFields.map(normalizeKeepAccents).filter(Boolean).join(' | ');
  const primaryUnaccented = primaryFields
    .map(normalizeVietnameseSearch)
    .filter(Boolean)
    .join(' | ');
  const secondaryUnaccented = secondaryFields
    .map(normalizeVietnameseSearch)
    .filter(Boolean)
    .join(' | ');

  const combinedUnaccented = `${primaryUnaccented} | ${secondaryUnaccented}`;

  // Every word in the query must appear in at least one primary or secondary field
  const allWordsMatch = queryWords.every((word) => combinedUnaccented.includes(word));
  if (!allWordsMatch) return 0;

  let score = 10;

  // Exact or prefix match on primary fields (title, author alias, code)
  if (primaryAccented.includes(cleanQueryAccented)) {
    score += 50;
  }
  if (primaryUnaccented.includes(cleanQueryUnaccented)) {
    score += 35;
  }
  for (const pf of primaryFields) {
    const normPf = normalizeVietnameseSearch(pf);
    if (normPf === cleanQueryUnaccented) {
      score += 60;
    } else if (normPf.startsWith(cleanQueryUnaccented)) {
      score += 30;
    }
  }

  // Secondary fields match bonus
  if (secondaryUnaccented.includes(cleanQueryUnaccented)) {
    score += 15;
  }

  return score;
}

export interface SearchFieldGroups {
  primary?: Array<string | undefined | null>;
  secondary?: Array<string | undefined | null>;
  tertiary?: Array<string | undefined | null>;
}

export function matchesSearchQuery(
  query: string,
  primaryOrGroups: Array<string | undefined | null> | SearchFieldGroups,
  secondaryFields: Array<string | undefined | null> = []
): boolean {
  if (!query || !query.trim()) return true;
  if (Array.isArray(primaryOrGroups)) {
    return computeSearchRelevance(query, primaryOrGroups, secondaryFields) > 0;
  }
  const primary = primaryOrGroups.primary || [];
  const secondary = [
    ...(primaryOrGroups.secondary || []),
    ...(primaryOrGroups.tertiary || []),
  ];
  return computeSearchRelevance(query, primary, secondary) > 0;
}

export function isWithinDateFilter(
  dateStr: string | undefined,
  timeFilter: 'all' | 'today' | '7d' | '30d' | '90d' | 'week' | 'month'
): boolean {
  if (!timeFilter || timeFilter === 'all') return true;
  if (!dateStr) return true;
  const nowMs = Date.now();
  let parsedMs = Date.parse(dateStr);

  // Support Vietnamese DD/MM/YYYY format
  if (Number.isNaN(parsedMs) && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) {
    const [d, m, y] = dateStr.split(/[\/\s]/);
    parsedMs = new Date(Number(y), Number(m) - 1, Number(d)).getTime();
  }

  if (Number.isNaN(parsedMs)) return true;
  const diffMs = nowMs - parsedMs;
  if (timeFilter === 'today') return diffMs <= 24 * 3600 * 1000;
  if (timeFilter === '7d' || timeFilter === 'week') return diffMs <= 7 * 24 * 3600 * 1000;
  if (timeFilter === '30d' || timeFilter === 'month') return diffMs <= 30 * 24 * 3600 * 1000;
  if (timeFilter === '90d') return diffMs <= 90 * 24 * 3600 * 1000;
  return true;
}

export interface GlobalSearchGroupItem {
  id: string;
  group: 'artwork' | 'author' | 'short' | 'story' | 'gdpt';
  title: string;
  subtitle: string;
  badge?: string;
  thumbnailUrl?: string;
  mediaType?: 'image' | 'video' | 'slide' | 'author' | 'story';
  gradeLabel?: string;
  educationLevel?: 'TIEU_HOC' | 'THCS';
  resourceCategory?: 'slide' | 'video';
  createdAt?: string;
  score: number;
}

export interface GlobalSearchResponse {
  query: string;
  normalizedQuery: string;
  totalMatches: number;
  groups: {
    artworks: GlobalSearchGroupItem[];
    authors: GlobalSearchGroupItem[];
    shorts: GlobalSearchGroupItem[];
    stories: GlobalSearchGroupItem[];
    gdptResources: GlobalSearchGroupItem[];
  };
  suggestions: string[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Dịch vụ Đồng bộ Trình chiếu Trực tiếp (Live Presentation Service)
 * Đồng bộ thời gian thực qua Firebase Firestore (/livePresentations/{sessionCode}) + Express Backend
 * Bảo mật:
 * - Chỉ Giáo viên chủ phiên hoặc Admin mới được tạo, điều khiển và kết thúc phiên.
 * - Người xem (Học sinh / Màn hình TV / Máy chiếu phụ) chỉ có quyền xem (Read-Only).
 * - Không bao giờ đưa token xác thực, email hay mã học sinh vào URL hoặc mã phiên.
 */

import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getApiUrl } from '../lib/platform';
import {
  CommunityArtwork,
  LivePresentationBackdrop,
  LivePresentationInterval,
  LivePresentationMode,
  LivePresentationSession,
} from '../types/communityArt';
import { doesArtworkMatchGradeFilter } from '../utils/gradeUtils';

const LIVE_PRESENTATIONS_COLLECTION = 'livePresentations';

export const ALLOWED_PRESENTATION_INTERVALS: LivePresentationInterval[] = [5, 10, 15, 20, 30];

/**
 * Chuẩn hóa mã phiên (6 ký tự chữ hoa & số, không chứa ký tự dễ nhầm O/0/I/1)
 */
export function normalizeSessionCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 16);
}

/**
 * Tạo mã phiên 6 ký tự ngẫu nhiên, an toàn, không chứa thông tin xác thực Firebase
 */
export function generateLiveSessionCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  const randomBytes = new Uint8Array(6);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(randomBytes);
    for (let i = 0; i < 6; i++) {
      code += alphabet[randomBytes[i] % alphabet.length];
    }
  } else {
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return code;
}

/**
 * Lọc danh sách tác phẩm trình chiếu theo đúng Bộ sưu tập đã chọn:
 * - Chỉ lấy tác phẩm đã duyệt & cho phép chia sẻ công khai (status === 'approved' && shareStatus === 'shared').
 * - Nếu người dùng đã tích chọn danh sách cụ thể (selectedArtworkIds.length > 0),
 *   CHỈ lấy đúng những tác phẩm đó theo thứ tự đã chọn, tuyệt đối không tự ý trộn tác phẩm ngoài bộ lọc.
 * - Ngược lại, lọc theo Lớp chuẩn hóa (Lớp 1 - Lớp 9), Lớp học cụ thể và Bài học/Chủ đề.
 */
export function filterArtworksForPresentation(
  allArtworks: CommunityArtwork[],
  options: {
    filterGrade?: string;
    filterClassId?: string;
    filterLessonId?: string;
    selectedArtworkIds?: string[];
  }
): CommunityArtwork[] {
  // Chỉ lấy tác phẩm được phép công khai
  const publicApproved = allArtworks.filter(
    (art) => art.status === 'approved' && art.shareStatus === 'shared'
  );

  const selectedIds = options.selectedArtworkIds || [];
  if (selectedIds.length > 0) {
    const mapById = new Map(publicApproved.map((a) => [a.id, a]));
    const ordered: CommunityArtwork[] = [];
    for (const id of selectedIds) {
      const found = mapById.get(id);
      if (found) ordered.push(found);
    }
    return ordered;
  }

  return publicApproved.filter((art) => {
    // 1. Lọc theo Lớp 1 -> Lớp 9
    if (options.filterGrade && options.filterGrade !== 'all') {
      if (!doesArtworkMatchGradeFilter(art, options.filterGrade)) {
        return false;
      }
    }

    // 2. Lọc theo Lớp học cụ thể (nếu khác 'all')
    if (options.filterClassId && options.filterClassId !== 'all') {
      const matchesSpecificClass =
        art.classGroupId === options.filterClassId ||
        doesArtworkMatchGradeFilter(art, options.filterClassId);
      if (!matchesSpecificClass) {
        return false;
      }
    }

    // 3. Lọc theo Chủ đề / Bài học
    if (options.filterLessonId && options.filterLessonId !== 'all') {
      if (art.lessonId !== options.filterLessonId) {
        return false;
      }
    }

    return true;
  });
}

function serializeFirestoreSession(session: LivePresentationSession): Record<string, unknown> {
  return {
    sessionCode: session.sessionCode,
    title: session.title.slice(0, 200),
    hostUid: session.hostUid,
    hostDisplayName: session.hostDisplayName.slice(0, 120),
    status: session.status,
    mode: session.mode,
    currentIndex: Math.max(0, Math.floor(session.currentIndex || 0)),
    isPlaying: Boolean(session.isPlaying),
    intervalSeconds: ALLOWED_PRESENTATION_INTERVALS.includes(session.intervalSeconds)
      ? session.intervalSeconds
      : 10,
    showArtworkInfo: Boolean(session.showArtworkInfo),
    showAuthorInfo: session.showAuthorInfo !== false,
    showArtworkStory: session.showArtworkStory !== false,
    pureArtworkOnly: Boolean(session.pureArtworkOnly),
    backdropTheme: session.backdropTheme === 'museum_stone' ? 'museum_stone' : 'obsidian',
    filterGrade: session.filterGrade || 'all',
    filterClassId: session.filterClassId || 'all',
    filterLessonId: session.filterLessonId || 'all',
    selectedArtworkIds: JSON.stringify(session.selectedArtworkIds || []).slice(0, 8000),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function deserializeFirestoreSession(
  raw: Record<string, any> | undefined,
  fallbackCode: string
): LivePresentationSession | null {
  if (!raw) return null;
  let parsedIds: string[] = [];
  if (Array.isArray(raw.selectedArtworkIds)) {
    parsedIds = raw.selectedArtworkIds.map(String);
  } else if (typeof raw.selectedArtworkIds === 'string' && raw.selectedArtworkIds.trim()) {
    try {
      const parsed = JSON.parse(raw.selectedArtworkIds);
      if (Array.isArray(parsed)) parsedIds = parsed.map(String);
    } catch {
      parsedIds = [];
    }
  }

  const rawInterval = Number(raw.intervalSeconds);
  const intervalSeconds: LivePresentationInterval = ALLOWED_PRESENTATION_INTERVALS.includes(
    rawInterval as LivePresentationInterval
  )
    ? (rawInterval as LivePresentationInterval)
    : 10;

  return {
    sessionCode: normalizeSessionCode(raw.sessionCode || fallbackCode),
    title: String(raw.title || 'Phiên Trình chiếu Triển lãm ARTVERSE AI'),
    hostUid: String(raw.hostUid || ''),
    hostDisplayName: String(raw.hostDisplayName || 'Giáo viên Mĩ thuật'),
    status: raw.status === 'ended' ? 'ended' : 'active',
    mode:
      raw.mode === 'manual' || raw.mode === 'collection'
        ? (raw.mode as LivePresentationMode)
        : 'auto',
    currentIndex: Math.max(0, Number(raw.currentIndex) || 0),
    isPlaying: Boolean(raw.isPlaying),
    intervalSeconds,
    showArtworkInfo: raw.showArtworkInfo !== false,
    showAuthorInfo: raw.showAuthorInfo !== false,
    showArtworkStory: raw.showArtworkStory !== false,
    pureArtworkOnly: Boolean(raw.pureArtworkOnly),
    backdropTheme: (raw.backdropTheme === 'museum_stone'
      ? 'museum_stone'
      : 'obsidian') as LivePresentationBackdrop,
    filterGrade: String(raw.filterGrade || 'all'),
    filterClassId: String(raw.filterClassId || 'all'),
    filterLessonId: String(raw.filterLessonId || 'all'),
    selectedArtworkIds: parsedIds,
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

/**
 * Tạo phiên trình chiếu trực tiếp mới (Chỉ Giáo viên hoặc Admin mới được phép tạo)
 */
export async function createLivePresentationSession(params: {
  title?: string;
  hostUid: string;
  hostDisplayName: string;
  mode: LivePresentationMode;
  currentIndex: number;
  isPlaying: boolean;
  intervalSeconds: LivePresentationInterval;
  showArtworkInfo: boolean;
  showAuthorInfo?: boolean;
  showArtworkStory?: boolean;
  pureArtworkOnly: boolean;
  backdropTheme: LivePresentationBackdrop;
  filterGrade: string;
  filterClassId: string;
  filterLessonId: string;
  selectedArtworkIds: string[];
  bearerToken?: string | null;
}): Promise<LivePresentationSession> {
  const sessionCode = generateLiveSessionCode();
  const nowIso = new Date().toISOString();

  const session: LivePresentationSession = {
    sessionCode,
    title: params.title?.trim() || 'Triển lãm Nghệ thuật Trực tiếp ARTVERSE AI',
    hostUid: params.hostUid,
    hostDisplayName: params.hostDisplayName || 'Giáo viên Mĩ thuật',
    status: 'active',
    mode: params.mode,
    currentIndex: Math.max(0, params.currentIndex),
    isPlaying: params.isPlaying,
    intervalSeconds: params.intervalSeconds,
    showArtworkInfo: params.showArtworkInfo,
    showAuthorInfo: params.showAuthorInfo !== false,
    showArtworkStory: params.showArtworkStory !== false,
    pureArtworkOnly: params.pureArtworkOnly,
    backdropTheme: params.backdropTheme,
    filterGrade: params.filterGrade || 'all',
    filterClassId: params.filterClassId || 'all',
    filterLessonId: params.filterLessonId || 'all',
    selectedArtworkIds: params.selectedArtworkIds || [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // 1. Lưu trực tiếp lên Firebase Firestore để đồng bộ realtime qua onSnapshot
  try {
    const ref = doc(db, LIVE_PRESENTATIONS_COLLECTION, sessionCode);
    await setDoc(ref, serializeFirestoreSession(session));
  } catch (err) {
    console.warn('Firestore createLivePresentationSession fallback to backend API:', err);
  }

  // 2. Đồng bộ song song với Backend Express API
  if (params.bearerToken) {
    try {
      await fetch(getApiUrl('/api/live-presentations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.bearerToken}`,
        },
        body: JSON.stringify(session),
      });
    } catch {
      // Non-fatal if offline or using Firestore directly
    }
  }

  return session;
}

/**
 * Cập nhật trạng thái phiên trình chiếu (Chỉ Giáo viên chủ phiên hoặc Admin mới được phép gọi)
 */
export async function updateLivePresentationState(
  sessionCode: string,
  updates: Partial<
    Pick<
      LivePresentationSession,
      | 'status'
      | 'mode'
      | 'currentIndex'
      | 'isPlaying'
      | 'intervalSeconds'
      | 'showArtworkInfo'
      | 'showAuthorInfo'
      | 'showArtworkStory'
      | 'pureArtworkOnly'
      | 'backdropTheme'
      | 'filterGrade'
      | 'filterClassId'
      | 'filterLessonId'
      | 'selectedArtworkIds'
    >
  >,
  currentSession: LivePresentationSession,
  bearerToken?: string | null
): Promise<LivePresentationSession> {
  const code = normalizeSessionCode(sessionCode);
  const updated: LivePresentationSession = {
    ...currentSession,
    ...updates,
    sessionCode: code,
    updatedAt: new Date().toISOString(),
  };

  try {
    const ref = doc(db, LIVE_PRESENTATIONS_COLLECTION, code);
    await setDoc(ref, serializeFirestoreSession(updated), { merge: true });
  } catch (err) {
    console.warn('Firestore updateLivePresentationState fallback:', err);
  }

  if (bearerToken) {
    try {
      await fetch(getApiUrl(`/api/live-presentations/${encodeURIComponent(code)}/state`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify(updates),
      });
    } catch {
      // Ignore network hiccup; Firestore onSnapshot handles primary sync
    }
  }

  return updated;
}

/**
 * Tải thông tin 1 phiên trình chiếu theo mã phiên
 */
export async function fetchLivePresentationSession(
  rawCode: string
): Promise<LivePresentationSession | null> {
  const code = normalizeSessionCode(rawCode);
  if (!code) return null;

  try {
    const ref = doc(db, LIVE_PRESENTATIONS_COLLECTION, code);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const parsed = deserializeFirestoreSession(snap.data(), code);
      if (parsed) return parsed;
    }
  } catch {
    // Fallback to API
  }

  try {
    const res = await fetch(getApiUrl(`/api/live-presentations/${encodeURIComponent(code)}`));
    if (res.ok) {
      const data = await res.json();
      if (data?.session) {
        return deserializeFirestoreSession(data.session, code);
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Lắng nghe đồng bộ thời gian thực phiên trình chiếu từ Firebase Firestore + Polling dự phòng khi rớt mạng
 */
export function subscribeLivePresentationSession(
  rawCode: string,
  onUpdate: (session: LivePresentationSession) => void,
  onConnectionChange?: (isConnected: boolean) => void
): () => void {
  const code = normalizeSessionCode(rawCode);
  if (!code) return () => {};

  let unsubFirestore: Unsubscribe | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  try {
    const ref = doc(db, LIVE_PRESENTATIONS_COLLECTION, code);
    unsubFirestore = onSnapshot(
      ref,
      (snap) => {
        if (onConnectionChange) onConnectionChange(true);
        if (snap.exists()) {
          const parsed = deserializeFirestoreSession(snap.data(), code);
          if (parsed) {
            onUpdate(parsed);
          }
        }
      },
      () => {
        if (onConnectionChange) onConnectionChange(navigator.onLine);
      }
    );
  } catch {
    // Fallback to API polling
  }

  // Đồng bộ dự phòng định kỳ mỗi 2.5 giây qua API để đảm bảo hoạt động ngay cả khi mạng trường học chặn WebSocket
  pollTimer = setInterval(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (onConnectionChange) onConnectionChange(false);
      return;
    }
    try {
      const res = await fetch(getApiUrl(`/api/live-presentations/${encodeURIComponent(code)}`));
      if (res.ok) {
        if (onConnectionChange) onConnectionChange(true);
        const data = await res.json();
        if (data?.session) {
          const parsed = deserializeFirestoreSession(data.session, code);
          if (parsed) onUpdate(parsed);
        }
      }
    } catch {
      // Keep current state without freezing UI
    }
  }, 2500);

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (pollTimer) clearInterval(pollTimer);
  };
}

/**
 * Tạo đường dẫn chia sẻ phiên trình chiếu an toàn (Tuyệt đối KHÔNG chứa token xác thực Firebase)
 */
export function buildSafeLivePresentationUrl(sessionCode: string): string {
  const cleanCode = normalizeSessionCode(sessionCode);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://artverseai.vn';
  return `${origin}/gallery?liveSession=${encodeURIComponent(cleanCode)}`;
}

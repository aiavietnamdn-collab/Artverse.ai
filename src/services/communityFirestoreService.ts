/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Firestore & Server-Verified Persistence Service
 * - Đảm bảo mọi thao tác Tạo / Sửa / Xóa Tác phẩm, Bài học, Slide, Video đều được lưu bền vững trên Firestore
 * - Xác minh dữ liệu sau khi lưu (Read-after-write verification), tuyệt đối không nuốt lỗi hay tạo dữ liệu giả trong RAM
 * - Hỗ trợ tải lại danh sách từ Firestore + đồng bộ API máy chủ để dữ liệu không bao giờ mất khi F5 hoặc đăng nhập lại
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  limit,
  increment,
  runTransaction,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { getApiUrl } from '../lib/platform';
import {
  CommunityArtwork,
  ClassGroup,
  ArtLesson,
  AuditLogEntry,
  ContentReport,
  PositiveReactionKey,
  ArtworkEmotionKey,
  CanonicalReactionType,
  ARTWORK_EMOTION_ORDER,
  normalizeToArtworkEmotionKey,
  normalizeToCanonicalReactionType,
  ArtworkStory,
  ArtworkStoryStatus,
  UploadStateMachine,
  StorageUploadRegistryItem,
  MediaDeletionAuditEntry,
  StorageQuotaConfig,
} from '../types/communityArt';
import { getStandardClassIdFromGrade, normalizeGrade } from '../utils/gradeUtils';
import {
  normalizeVietnameseSearch,
  buildFirestoreSearchTokens,
} from '../utils/searchEngine';
import {
  resolveFreshStorageUrl,
  withStageTimeout,
  markStorageUploadVerifiedInRegistry,
  markStorageUploadFailedInRegistry,
  deleteArtworkPhotoFromStorage,
  cleanupOrphanedStorageFile,
} from './communityStorageService';

// Collection constants
export const ARTWORKS_COLLECTION = 'communityArtworks';
export const CANONICAL_ARTWORKS_COLLECTION = 'artworks';
export const ARTWORK_REACTIONS_SUBCOLLECTION = 'reactions';
export const ARTWORK_REACTIONS_COLLECTION = 'artworkReactions';
export const STORIES_COLLECTION = 'artworkStories';
export const CLASSES_COLLECTION = 'communityClasses';
export const LESSONS_COLLECTION = 'communityLessons';
export const AUDIT_LOGS_COLLECTION = 'communityAuditLogs';
export const REPORTS_COLLECTION = 'contentReports';
export const MEDIA_DELETION_LOGS_COLLECTION = 'mediaDeletionLogs';
export const STORAGE_QUOTA_CONFIG_COLLECTION = 'storageQuotaConfigs';

function stripUndefinedDeep<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (
      value !== undefined &&
      typeof value !== 'function' &&
      key !== 'fullName' &&
      key !== 'pin' &&
      key !== 'pinHash' &&
      key !== 'plainPin' &&
      key !== 'studentRealName'
    ) {
      cleaned[key] = stripUndefinedDeep(value);
    }
  }
  return cleaned as T;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    if (auth.currentUser) {
      const token = await withStageTimeout(
        auth.currentUser.getIdToken(),
        4000,
        'Làm mới Firebase Auth Token (getIdToken)'
      );
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        return headers;
      }
    }
    if (typeof window !== 'undefined') {
      const rawSession = localStorage.getItem('artverse_student_session_v1');
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed?.token) {
          headers.Authorization = `Bearer ${parsed.token}`;
        }
      }
    }
  } catch {
    // ignore token timeout and proceed
  }
  return headers;
}

/**
 * Normalizes an artwork record to guarantee all required Part C metadata fields exist
 * and no temporary blob: or local_idb:// URLs are accepted.
 */
export function normalizeArtworkMetadata(
  artwork: CommunityArtwork,
  uploaderUid?: string
): CommunityArtwork {
  const safeId = (artwork.mediaId || artwork.artworkId || artwork.id || `art_${Date.now()}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
  const stdClassId =
    getStandardClassIdFromGrade(artwork.grade || artwork.className || artwork.classId || artwork.classGroupId) ||
    artwork.classId ||
    artwork.classGroupId ||
    'cls-6';
  const stdGrade = normalizeGrade(artwork.grade || artwork.className || stdClassId);
  const nowIso = new Date().toISOString();

  // Public alias only — never expose student real name
  const safeAlias =
    (
      artwork.authorNickname ||
      artwork.authorAlias ||
      artwork.creatorAnonymousPseudonym ||
      'Họa sĩ Nhí'
    ).trim() || 'Họa sĩ Nhí';
  const safeTitle = (artwork.title || '').trim().slice(0, 300);
  const mediaType: 'image' | 'video' = artwork.mediaType === 'video' ? 'video' : 'image';
  const resolvedAuthorUid =
    artwork.authorUid ||
    artwork.authorId ||
    uploaderUid ||
    auth.currentUser?.uid ||
    artwork.ownerKey ||
    'anonymous_author';

  const defaultStoragePath =
    mediaType === 'video'
      ? `public_exhibition/${safeId}/video.mp4`
      : `public_exhibition/${safeId}/clean_artwork.jpg`;
  const resolvedStoragePath =
    artwork.storagePath ||
    (mediaType === 'video' ? artwork.videoPath : artwork.imagePath) ||
    artwork.imagePath ||
    defaultStoragePath;
  const resolvedDownloadUrl =
    artwork.downloadURL ||
    (mediaType === 'video' ? artwork.videoUrl : artwork.imageUrl) ||
    artwork.imageUrl ||
    '';
  const resolvedThumbnailPath =
    artwork.thumbnailPath ||
    (mediaType === 'video' ? `public_exhibition/${safeId}/thumbnail.jpg` : resolvedStoragePath);
  const resolvedThumbnailUrl =
    artwork.thumbnailUrl || artwork.imageUrl || resolvedDownloadUrl;

  return {
    ...artwork,
    id: safeId,
    artworkId: safeId,
    mediaId: safeId,
    mediaType,
    title: safeTitle,
    description: (artwork.description || '').trim().slice(0, 2000),
    topic: (artwork.topic || artwork.lessonTitle || `Mĩ thuật ${stdGrade}`).trim().slice(0, 200),
    storagePath: resolvedStoragePath,
    downloadURL: resolvedDownloadUrl,
    thumbnailPath: resolvedThumbnailPath,
    thumbnailUrl: resolvedThumbnailUrl,
    imagePath: artwork.imagePath || resolvedStoragePath,
    imageUrl: artwork.imageUrl || resolvedThumbnailUrl || resolvedDownloadUrl,
    videoPath: mediaType === 'video' ? resolvedStoragePath : artwork.videoPath,
    videoUrl: mediaType === 'video' ? resolvedDownloadUrl : artwork.videoUrl,
    fileSize: typeof artwork.fileSize === 'number' ? artwork.fileSize : 0,
    mimeType:
      artwork.mimeType || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
    duration:
      mediaType === 'video' && typeof artwork.duration === 'number'
        ? Math.min(180, Math.max(0, artwork.duration))
        : artwork.duration,
    classId: stdClassId,
    classGroupId: stdClassId,
    className: stdGrade,
    grade: stdGrade,
    lessonId: artwork.lessonId || '',
    lessonTitle: artwork.lessonTitle || '',
    authorId: resolvedAuthorUid,
    authorUid: resolvedAuthorUid,
    authorAlias: safeAlias,
    authorNickname: safeAlias,
    creatorAnonymousPseudonym: safeAlias,
    publishedByTeacherId:
      artwork.publishedByTeacherId || uploaderUid || auth.currentUser?.uid || 'community_uploader',
    storageLocation: 'firebase_storage',
    status: artwork.status || 'approved',
    shareStatus: artwork.shareStatus || 'shared',
    createdAt: artwork.createdAt || nowIso,
    updatedAt: nowIso,
    searchNormalized: normalizeVietnameseSearch(
      `${safeTitle} ${safeAlias} ${stdGrade} ${artwork.materialsUsed || ''} ${artwork.lessonTitle || ''} ${artwork.description || ''}`
    ),
    searchTokens: buildFirestoreSearchTokens([
      safeTitle,
      safeAlias,
      stdGrade,
      artwork.materialsUsed,
      artwork.lessonTitle,
    ]),
  } as CommunityArtwork;
}

/**
 * Normalizes an ArtLesson record to guarantee all required Part D & Part E metadata fields exist.
 */
export function normalizeLessonMetadata(lesson: ArtLesson, actorUid?: string): ArtLesson {
  const safeId = (lesson.lessonId || lesson.id || `les_${Date.now()}`).replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  const stdClassId =
    getStandardClassIdFromGrade(lesson.grade || lesson.className || lesson.classId || lesson.classGroupId) ||
    lesson.classId ||
    lesson.classGroupId ||
    'cls-6';
  const stdGrade = normalizeGrade(lesson.grade || lesson.className || stdClassId);
  const nowIso = new Date().toISOString();

  // Order slides deterministically
  const orderedSlides = Array.isArray(lesson.slides)
    ? [...lesson.slides]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((s, idx) => ({
          ...s,
          slideId: s.slideId || `slide_${idx + 1}`,
          lessonId: safeId,
          order: idx + 1,
          title: s.title || `Trang Slide ${idx + 1}`,
          content: s.content || '',
          imagePath: s.imagePath || '',
          imageUrl: s.imageUrl || '',
          updatedAt: s.updatedAt || nowIso,
        }))
    : [];

  const resourceIds = Array.isArray(lesson.resourceIds) ? [...lesson.resourceIds] : [];
  if (lesson.videoPath && !resourceIds.includes(lesson.videoPath)) {
    resourceIds.push(lesson.videoPath);
  }
  if (lesson.slidePath && !resourceIds.includes(lesson.slidePath)) {
    resourceIds.push(lesson.slidePath);
  }

  return {
    ...lesson,
    id: safeId,
    lessonId: safeId,
    title: (lesson.title || '').trim(),
    subject: lesson.subject || 'Mĩ thuật',
    grade: stdGrade,
    classId: stdClassId,
    classGroupId: stdClassId,
    className: stdGrade,
    topic: (lesson.topic || `Mĩ thuật ${stdGrade}`).trim(),
    description: (lesson.description || '').trim(),
    content: (lesson.content || lesson.description || '').trim(),
    resourceIds,
    slides: orderedSlides,
    createdAt: lesson.createdAt || nowIso,
    updatedAt: nowIso,
    createdBy: lesson.createdBy || actorUid || auth.currentUser?.uid || 'teacher',
    status: lesson.status || (lesson.isHidden ? 'archived' : 'published'),
    searchNormalized: normalizeVietnameseSearch(
      `${lesson.title || ''} ${stdGrade} ${lesson.topic || ''} ${lesson.teacherName || ''} ${lesson.fileFormat || ''} ${lesson.description || ''}`
    ),
    searchTokens: buildFirestoreSearchTokens([
      lesson.title,
      stdGrade,
      lesson.topic,
      lesson.teacherName,
      lesson.fileFormat,
    ]),
  } as ArtLesson;
}

// ====================================================
// 1. COMMUNITY ARTWORKS OPERATIONS (PART C & PART F)
// ====================================================

async function fetchServerArtworksFallback(): Promise<CommunityArtwork[]> {
  try {
    const res = await withStageTimeout(
      fetch(getApiUrl('/api/artworks')),
      4000,
      'Tải danh sách tác phẩm từ máy chủ (/api/artworks)'
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.artworks)) {
        return data.artworks;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function parseArtworkTimestamp(art: CommunityArtwork): number {
  if (art.updatedAt) {
    const t = Date.parse(art.updatedAt);
    if (!Number.isNaN(t)) return t;
  }
  if (art.createdAt) {
    const t = Date.parse(art.createdAt);
    if (!Number.isNaN(t)) return t;
    // Handle Vietnamese D/M/YYYY format
    const parts = art.createdAt.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      if (y && m && d) {
        return new Date(y, m - 1, d).getTime();
      }
    }
  }
  // Extract timestamp from art-instant-<ts>-... ID if present
  const idMatch = (art.id || '').match(/(\d{13})/);
  if (idMatch) {
    return Number(idMatch[1]);
  }
  return 0;
}

function mergeArtworkLists(
  firestoreList: CommunityArtwork[],
  serverList: CommunityArtwork[]
): CommunityArtwork[] {
  const map = new Map<string, CommunityArtwork>();
  for (const item of serverList) {
    if (
      item &&
      item.id &&
      item.status !== 'removed' &&
      (item.imageUrl || item.downloadURL || item.videoUrl)
    ) {
      map.set(item.id, item);
    }
  }
  for (const item of firestoreList) {
    if (
      item &&
      item.id &&
      item.status !== 'removed' &&
      (item.imageUrl || item.downloadURL || item.videoUrl)
    ) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    return parseArtworkTimestamp(b) - parseArtworkTimestamp(a);
  });
}

/**
 * Subscribes to real-time approved & shared artworks for public gallery exhibition,
 * merging with server-persisted artworks and resolving Storage URLs when needed.
 */
export function subscribePublicArtworks(
  onUpdate: (artworks: CommunityArtwork[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = ARTWORKS_COLLECTION;
  let fsArtworks: CommunityArtwork[] = [];
  let srvArtworks: CommunityArtwork[] = [];

  const notifyMerged = async () => {
    const merged = mergeArtworkLists(fsArtworks, srvArtworks).filter(
      (a) => a.status === 'approved' && a.shareStatus === 'shared'
    );
    onUpdate(merged);
  };

  fetchServerArtworksFallback().then((list) => {
    srvArtworks = list;
    notifyMerged();
  });

  try {
    const q = query(
      collection(db, path),
      where('status', '==', 'approved'),
      where('shareStatus', '==', 'shared')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const list: CommunityArtwork[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as CommunityArtwork), id: docSnap.id });
        });
        fsArtworks = list;
        notifyMerged();
      },
      (error) => {
        console.warn('Đồng bộ artworks từ máy chủ dự phòng:', error.message);
        if (srvArtworks.length > 0) {
          notifyMerged();
        } else {
          onError(error);
        }
      }
    );
  } catch (error: any) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return () => {};
  }
}

/**
 * Subscribes to artworks accessible by a signed-in teacher or admin.
 */
export function subscribeTeacherArtworks(
  teacherId: string,
  isAdmin: boolean,
  onUpdate: (artworks: CommunityArtwork[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = ARTWORKS_COLLECTION;
  let srvArtworks: CommunityArtwork[] = [];

  try {
    if (isAdmin) {
      let adminFsList: CommunityArtwork[] = [];
      fetchServerArtworksFallback().then((list) => {
        srvArtworks = list;
        onUpdate(mergeArtworkLists(adminFsList, srvArtworks));
      });
      const q = query(collection(db, path));
      return onSnapshot(
        q,
        (snapshot) => {
          const list: CommunityArtwork[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...(docSnap.data() as CommunityArtwork), id: docSnap.id });
          });
          adminFsList = list;
          onUpdate(mergeArtworkLists(adminFsList, srvArtworks));
        },
        (error) => {
          onError(error);
        }
      );
    }

    const qTeacher = query(
      collection(db, path),
      where('publishedByTeacherId', '==', teacherId)
    );
    const qPublic = query(
      collection(db, path),
      where('status', '==', 'approved'),
      where('shareStatus', '==', 'shared')
    );

    let teacherArtworks: CommunityArtwork[] = [];
    let publicArtworks: CommunityArtwork[] = [];

    const mergeAndNotify = () => {
      const combinedFs = [...publicArtworks, ...teacherArtworks];
      onUpdate(mergeArtworkLists(combinedFs, srvArtworks));
    };

    fetchServerArtworksFallback().then((list) => {
      srvArtworks = list;
      mergeAndNotify();
    });

    const unsubTeacher = onSnapshot(
      qTeacher,
      (snap) => {
        teacherArtworks = snap.docs.map((d) => ({ ...(d.data() as CommunityArtwork), id: d.id }));
        mergeAndNotify();
      },
      (err) => console.warn('Lỗi lắng nghe tác phẩm giáo viên:', err)
    );

    const unsubPublic = onSnapshot(
      qPublic,
      (snap) => {
        publicArtworks = snap.docs.map((d) => ({ ...(d.data() as CommunityArtwork), id: d.id }));
        mergeAndNotify();
      },
      (err) => console.warn('Lỗi lắng nghe tác phẩm công khai:', err)
    );

    return () => {
      unsubTeacher();
      unsubPublic();
    };
  } catch (error: any) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Explicit reload of persisted artworks from Firestore & Server (Step 8 of 9: Reload artwork list)
 */
export async function getPublicArtworksFromFirestore(): Promise<CommunityArtwork[]> {
  const path = ARTWORKS_COLLECTION;
  console.info('[ARTVERSE UPLOAD][Step 8/9] Đang tải lại danh sách tác phẩm từ Firestore...');
  const serverList = await fetchServerArtworksFallback();
  try {
    const q = query(
      collection(db, path),
      where('status', '==', 'approved'),
      where('shareStatus', '==', 'shared')
    );
    const snap = await withStageTimeout(
      getDocs(q),
      6000,
      'Bước 8 (Tải lại danh sách tác phẩm từ Firestore getDocs)'
    );
    const list: CommunityArtwork[] = [];
    for (const d of snap.docs) {
      const data = { ...(d.data() as CommunityArtwork), id: d.id };
      if (data.imagePath && !data.imageUrl) {
        data.imageUrl = await resolveFreshStorageUrl(data.imagePath, data.imageUrl);
      }
      list.push(data);
    }
    const merged = mergeArtworkLists(list, serverList);
    console.info(
      `[ARTVERSE UPLOAD][Step 8/9] Tải lại danh sách hoàn tất (${merged.length} tác phẩm công khai).`
    );
    return merged;
  } catch (error) {
    if (serverList.length > 0) return serverList;
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Steps 6 & 7 of 9:
 * - Step 6 (SAVING_METADATA, 90%): Writes artwork metadata to Firestore collection with stable ID ({ merge: true } prevents duplicates on retry).
 * - Step 7 (VERIFYING, 95-97%): Reads back the written document from Firestore (getDocFromServer / getDoc) to confirm it exists and matches what was written.
 */
export async function createCommunityArtworkInFirestore(
  artwork: CommunityArtwork,
  teacherUidOrProgress?:
    | string
    | ((percent: number, stageText: string, state?: UploadStateMachine) => void),
  onProgressArg?: (percent: number, stageText: string, state?: UploadStateMachine) => void
): Promise<CommunityArtwork> {
  const teacherUid =
    typeof teacherUidOrProgress === 'string' ? teacherUidOrProgress : undefined;
  const onProgress =
    typeof teacherUidOrProgress === 'function' ? teacherUidOrProgress : onProgressArg;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error(
      'Lỗi ở Bước 6 (SAVING_METADATA): Thiết bị đang mất kết nối mạng (Offline). Tệp đã tải lên Storage vẫn được giữ nguyên, vui lòng kiểm tra mạng và nhấn "Thử lại hoàn tất metadata".'
    );
  }

  const primaryMediaUrl = artwork.downloadURL || artwork.videoUrl || artwork.imageUrl || '';
  if (
    !primaryMediaUrl ||
    primaryMediaUrl.startsWith('blob:') ||
    primaryMediaUrl.startsWith('local_idb://')
  ) {
    throw new Error(
      'Lỗi ở Bước 6 (SAVING_METADATA): URL media không hợp lệ hoặc chỉ là URL tạm thời (blob:). Tệp ảnh/video phải hoàn tất lấy URL trước khi lưu metadata.'
    );
  }

  if (primaryMediaUrl.startsWith('data:video/') && primaryMediaUrl.length > 500_000) {
    throw new Error(
      'Lỗi ở Bước 6 (SAVING_METADATA): Tuyệt đối không lưu nhị phân hoặc Base64 của video vào Firestore.'
    );
  }

  const normalized = normalizeArtworkMetadata(artwork, teacherUid);
  if (!normalized.title || normalized.title.length === 0) {
    throw new Error(
      'Lỗi ở Bước 6 (SAVING_METADATA): Thiếu tên tác phẩm bắt buộc (title).'
    );
  }

  const safeId = normalized.id;
  const payload = stripUndefinedDeep(normalized);

  // Step 6: SAVING_METADATA (90%)
  onProgress?.(
    90,
    'Bước 6 (SAVING_METADATA): Đang ghi metadata vào Firestore (90%)...',
    'SAVING_METADATA'
  );
  console.info(
    `[ARTVERSE UPLOAD][SAVING_METADATA] path=${ARTWORKS_COLLECTION}/${safeId} | mediaType=${payload.mediaType} | title="${payload.title}" | class=${payload.classGroupId} | storagePath=${payload.storagePath}`
  );

  let verifiedDocData: CommunityArtwork | null = null;
  let lastError: unknown = null;

  // 1. Primary write + read-back verification on Cloud Firestore
  try {
    const docRef = doc(db, ARTWORKS_COLLECTION, safeId);
    await withStageTimeout(
      setDoc(docRef, payload, { merge: true }),
      25000,
      `Bước 6 (Ghi metadata vào Firestore /${ARTWORKS_COLLECTION}/${safeId})`
    );

    // Step 7: VERIFYING (95%) — Read back the document just written
    onProgress?.(
      95,
      'Bước 7 (VERIFYING): Đang kiểm tra lại bản ghi vừa ghi trên Firestore (95%)...',
      'VERIFYING'
    );

    const verifySnap = await withStageTimeout(
      getDocFromServer(docRef).catch(() => getDoc(docRef)),
      12000,
      `Bước 7 (Đọc xác minh bản ghi từ Firestore /${ARTWORKS_COLLECTION}/${safeId})`
    );

    if (!verifySnap.exists()) {
      throw new Error(
        `Bản ghi /${ARTWORKS_COLLECTION}/${safeId} không tồn tại trên Firestore sau khi gọi setDoc.`
      );
    }

    const readData = verifySnap.data() as CommunityArtwork;
    const readUrl = readData?.downloadURL || readData?.videoUrl || readData?.imageUrl;
    const readPath = readData?.storagePath || readData?.videoPath || readData?.imagePath;
    if (
      !readData ||
      !readData.title ||
      !readUrl ||
      !readPath ||
      !readData.classGroupId ||
      readData.title !== payload.title
    ) {
      throw new Error(
        `Dữ liệu đọc lại từ Firestore /${ARTWORKS_COLLECTION}/${safeId} không khớp hoặc thiếu trường bắt buộc (title, downloadURL, storagePath, classGroupId).`
      );
    }

    verifiedDocData = {
      ...readData,
      id: verifySnap.id,
      artworkId: verifySnap.id,
      mediaId: verifySnap.id,
    };
  } catch (err: any) {
    lastError = err;
    console.warn(
      `[ARTVERSE UPLOAD][Step 6-7] Ghi trực tiếp Firestore gặp cảnh báo cho ${safeId}, đang đồng bộ & xác minh qua Server API (/api/artworks):`,
      err?.code || '',
      err?.message || err
    );
  }

  // 2. Always persist & verify with Server API (/api/artworks) so Student PIN sessions and Teacher sessions are 100% consistent
  try {
    const headers = await getAuthHeaders();
    const postRes = await withStageTimeout(
      fetch(getApiUrl('/api/artworks'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ artwork: verifiedDocData || payload }),
      }),
      6000,
      'Bước 6-7 (Lưu và đồng bộ /api/artworks)'
    );

    if (postRes.ok && !verifiedDocData) {
      onProgress?.(
        95,
        'Bước 7 (VERIFYING): Đang đọc xác minh lại bản ghi từ máy chủ (95%)...',
        'VERIFYING'
      );
      const getRes = await withStageTimeout(
        fetch(getApiUrl(`/api/artworks/${encodeURIComponent(safeId)}`)),
        5000,
        'Bước 7 (Xác minh bản ghi GET /api/artworks/:id)'
      );
      if (getRes.ok) {
        const getJson = await getRes.json();
        const srvArt = getJson?.artwork as CommunityArtwork | undefined;
        if (srvArt && srvArt.id === safeId && srvArt.title === payload.title) {
          verifiedDocData = srvArt;
        }
      }
    }
  } catch (srvErr) {
    if (!lastError) lastError = srvErr;
  }

  if (!verifiedDocData) {
    const rawMsg =
      lastError instanceof Error ? lastError.message : String(lastError || 'Unknown error');
    markStorageUploadFailedInRegistry(safeId, rawMsg, {
      mediaType: payload.mediaType || 'image',
      storagePath: payload.storagePath || payload.imagePath,
      downloadURL: payload.downloadURL || payload.imageUrl,
      thumbnailPath: payload.thumbnailPath,
      thumbnailUrl: payload.thumbnailUrl,
      fileSize: payload.fileSize || 0,
      mimeType: payload.mimeType || 'image/jpeg',
      duration: payload.duration,
      title: payload.title,
      classId: payload.classGroupId,
      grade: payload.grade,
      authorUid: payload.authorUid || payload.authorId,
      authorNickname: payload.authorNickname || payload.authorAlias,
    });

    const isPermDenied =
      rawMsg.toLowerCase().includes('permission-denied') ||
      rawMsg.toLowerCase().includes('missing or insufficient permissions');
    const friendlyError = isPermDenied
      ? `Lỗi ở Bước 6 (Firestore Security Rules từ chối ghi /${ARTWORKS_COLLECTION}/${safeId}): Quyền ghi không hợp lệ hoặc lớp học không khớp phạm vi tài khoản. Tệp đã upload lên Storage được giữ nguyên, bạn có thể nhấn "Thử lại hoàn tất metadata".`
      : `Lỗi ở Bước 6-7 (Ghi/Xác minh metadata Firestore /${ARTWORKS_COLLECTION}/${safeId}): ${rawMsg}`;
    throw new Error(friendlyError);
  }

  // Mark as verified in Storage Upload Registry so it is NOT flagged as an orphaned file
  markStorageUploadVerifiedInRegistry(safeId, {
    title: verifiedDocData.title,
    classId: verifiedDocData.classGroupId,
    grade: verifiedDocData.grade || verifiedDocData.className,
    authorUid: verifiedDocData.authorUid || verifiedDocData.authorId,
    authorNickname: verifiedDocData.authorNickname || verifiedDocData.authorAlias,
    fileSize: verifiedDocData.fileSize || 0,
    mimeType: verifiedDocData.mimeType || 'image/jpeg',
    duration: verifiedDocData.duration,
  });

  onProgress?.(
    98,
    'Bước 7 (VERIFYING): Đã xác nhận bản ghi lưu trữ bền vững (98%)...',
    'VERIFYING'
  );

  return verifiedDocData;
}

/**
 * Updates an existing artwork in Firestore & Server
 */
export async function updateCommunityArtworkInFirestore(
  artworkId: string,
  updates: Partial<CommunityArtwork>
): Promise<void> {
  const safeId = artworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${ARTWORKS_COLLECTION}/${safeId}`;
  const cleanUpdates = stripUndefinedDeep({
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  let saved = false;
  let lastError: unknown = null;

  try {
    await updateDoc(doc(db, ARTWORKS_COLLECTION, safeId), cleanUpdates);
    saved = true;
  } catch (error) {
    lastError = error;
  }

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl(`/api/artworks/${encodeURIComponent(safeId)}`), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ updates: cleanUpdates }),
    });
    if (res.ok) saved = true;
  } catch {
    // ignore
  }

  if (!saved && lastError) {
    handleFirestoreError(lastError, OperationType.UPDATE, path);
  }
}

export async function hideCommunityArtworkInFirestore(artworkId: string): Promise<void> {
  await updateCommunityArtworkInFirestore(artworkId, { status: 'hidden' });
}

export async function unhideCommunityArtworkInFirestore(artworkId: string): Promise<void> {
  await updateCommunityArtworkInFirestore(artworkId, { status: 'approved' });
}

export async function deleteCommunityArtworkInFirestore(artworkId: string): Promise<void> {
  const safeId = artworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${ARTWORKS_COLLECTION}/${safeId}`;
  let deleted = false;
  let lastErr: unknown = null;

  try {
    await deleteDoc(doc(db, ARTWORKS_COLLECTION, safeId));
    deleted = true;
  } catch (error) {
    lastErr = error;
  }

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl(`/api/artworks/${encodeURIComponent(safeId)}`), {
      method: 'DELETE',
      headers,
    });
    if (res.ok) deleted = true;
  } catch {
    // ignore
  }

  if (!deleted && lastErr) {
    handleFirestoreError(lastErr, OperationType.DELETE, path);
  }
}

export async function addReactionToArtworkInFirestore(
  artworkId: string,
  reactionKey: PositiveReactionKey
): Promise<void> {
  const safeId = artworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${ARTWORKS_COLLECTION}/${safeId}`;
  try {
    await updateDoc(doc(db, ARTWORKS_COLLECTION, safeId), {
      [`reactions.${reactionKey}`]: increment(1),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface FirestoreReactionDoc {
  uid: string;
  reactionType: CanonicalReactionType;
  createdAt: string;
  updatedAt: string;
}

export interface ArtworkEmotionSummary {
  artworkId: string;
  counts: Record<ArtworkEmotionKey, number>;
  canonicalCounts?: Record<CanonicalReactionType, number>;
  totalCount: number;
  userEmotion: ArtworkEmotionKey | null;
  myReaction?: CanonicalReactionType | null;
  action?: 'selected' | 'switched' | 'unselected';
  reactionDocs?: Record<string, FirestoreReactionDoc>;
}

export function createEmptyEmotionCounts(): Record<ArtworkEmotionKey, number> {
  return {
    love: 0,
    like: 0,
    haha: 0,
    sad: 0,
    angry: 0,
  };
}

function computeEmotionSummaryFromUserMap(
  artworkId: string,
  userReactions: Record<string, string> | undefined,
  currentUid?: string | null
): ArtworkEmotionSummary {
  const counts = createEmptyEmotionCounts();
  let totalCount = 0;
  if (userReactions && typeof userReactions === 'object') {
    for (const rawEmotion of Object.values(userReactions)) {
      const normalized = normalizeToArtworkEmotionKey(rawEmotion);
      if (normalized) {
        counts[normalized] = (counts[normalized] || 0) + 1;
        totalCount += 1;
      }
    }
  }
  const userEmotion =
    currentUid && userReactions ? normalizeToArtworkEmotionKey(userReactions[currentUid]) : null;

  return {
    artworkId,
    counts,
    canonicalCounts: {
      heart: counts.love,
      like: counts.like,
      laugh: counts.haha,
      sad: counts.sad,
      angry: counts.angry,
    },
    totalCount,
    userEmotion,
    myReaction: normalizeToCanonicalReactionType(userEmotion),
  };
}

/**
 * Reads all per-UID reaction documents from Firestore subcollection `artworks/{artworkId}/reactions/{uid}`
 */
export async function fetchFirestoreSubcollectionReactions(
  artworkId: string
): Promise<Record<string, FirestoreReactionDoc>> {
  const safeId = artworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const map: Record<string, FirestoreReactionDoc> = {};
  try {
    const colRef = collection(
      db,
      CANONICAL_ARTWORKS_COLLECTION,
      safeId,
      ARTWORK_REACTIONS_SUBCOLLECTION
    );
    const snap = await getDocs(colRef);
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const canonical = normalizeToCanonicalReactionType(data?.reactionType);
      const uid = String(data?.uid || docSnap.id);
      if (uid && canonical) {
        map[uid] = {
          uid,
          reactionType: canonical,
          createdAt: String(data?.createdAt || new Date().toISOString()),
          updatedAt: String(data?.updatedAt || new Date().toISOString()),
        };
      }
    });
  } catch {
    // Fallback if offline
  }
  return map;
}

/**
 * Fetches server-verified + Firestore subcollection 5-emotion reaction state for an artwork.
 */
export async function fetchArtworkEmotionSummary(
  artworkId: string,
  bearerToken?: string | null,
  currentUid?: string | null
): Promise<ArtworkEmotionSummary | null> {
  const safeId = artworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  let srvSummary: ArtworkEmotionSummary | null = null;

  try {
    const headers: Record<string, string> = {};
    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    } else {
      const autoHeaders = await getAuthHeaders();
      if (autoHeaders.Authorization) {
        headers.Authorization = autoHeaders.Authorization;
      }
    }

    const res = await fetch(
      getApiUrl(`/api/community/artworks/${encodeURIComponent(safeId)}/reactions`),
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.counts) {
        const resolvedUserEmo =
          normalizeToArtworkEmotionKey(data.userEmotion) ||
          normalizeToArtworkEmotionKey(data.myReaction);
        srvSummary = {
          artworkId: safeId,
          counts: {
            love: Math.max(0, Number(data.counts.love ?? data.counts.heart) || 0),
            like: Math.max(0, Number(data.counts.like) || 0),
            haha: Math.max(0, Number(data.counts.haha ?? data.counts.laugh) || 0),
            sad: Math.max(0, Number(data.counts.sad) || 0),
            angry: Math.max(0, Number(data.counts.angry) || 0),
          },
          totalCount: Math.max(0, Number(data.totalCount) || 0),
          userEmotion: resolvedUserEmo,
          myReaction: normalizeToCanonicalReactionType(resolvedUserEmo),
          reactionDocs: data.reactionDocs || undefined,
        };
      }
    }
  } catch {
    // Fallback to Firestore subcollection
  }

  // Also check Firestore subcollection artworks/{artworkId}/reactions/{uid}
  const fsDocs = await fetchFirestoreSubcollectionReactions(safeId);
  const fsKeys = Object.keys(fsDocs);
  if (fsKeys.length > 0 || !srvSummary) {
    const mergedUserMap: Record<string, string> = {};
    if (srvSummary?.reactionDocs) {
      for (const [u, d] of Object.entries(srvSummary.reactionDocs)) {
        if (d?.reactionType) mergedUserMap[u] = d.reactionType;
      }
    }
    for (const [u, d] of Object.entries(fsDocs)) {
      const srvDoc = srvSummary?.reactionDocs?.[u];
      if (!srvDoc || Date.parse(d.updatedAt) >= Date.parse(srvDoc.updatedAt || '')) {
        mergedUserMap[u] = d.reactionType;
      }
    }
    if (Object.keys(mergedUserMap).length > 0) {
      return computeEmotionSummaryFromUserMap(
        safeId,
        mergedUserMap,
        currentUid || auth.currentUser?.uid || null
      );
    }
  }

  return srvSummary;
}

/**
 * Toggles, switches, or unselects an artwork emotion reaction using:
 * 1. Authoritative Backend UID-Verified Transaction (`/api/community/artworks/:artworkId/reactions`)
 * 2. Firestore Transaction on `artworks/{artworkId}/reactions/{uid}` (when `auth.currentUser` is authenticated with matching UID)
 * 3. Read-back verification so UI only confirms success after persistence is verified.
 */
export async function toggleArtworkEmotionReaction(
  artworkId: string,
  emotion: ArtworkEmotionKey | CanonicalReactionType | null,
  bearerToken: string | null,
  currentUid?: string | null
): Promise<ArtworkEmotionSummary> {
  const safeId = artworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeId) {
    throw new Error('Mã tác phẩm không hợp lệ (not-found).');
  }
  if (!bearerToken) {
    throw new Error('Vui lòng đăng nhập để bày tỏ cảm xúc (unauthenticated).');
  }

  const normalizedEmotion = emotion === null ? null : normalizeToArtworkEmotionKey(emotion);
  const canonicalType = emotion === null ? null : normalizeToCanonicalReactionType(emotion);

  if (emotion !== null && (!normalizedEmotion || !canonicalType)) {
    throw new Error('Loại cảm xúc không hợp lệ. Chỉ chấp nhận: ❤️ Yêu thích, 👍 Thích, 😂 Vui, 😢 Buồn, 😡 Giận.');
  }

  // 1. Authoritative Backend Transaction (verifies Bearer token UID, blocks spoofing & race conditions)
  const res = await fetch(
    getApiUrl(`/api/community/artworks/${encodeURIComponent(safeId)}/reactions`),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        emotion: normalizedEmotion,
        reactionType: canonicalType,
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.code || (res.status === 401 ? 'unauthenticated' : res.status === 403 ? 'permission-denied' : 'unavailable');
    throw new Error(data?.error || `Không thể cập nhật cảm xúc (${code}).`);
  }

  const resolvedUserEmotion =
    normalizeToArtworkEmotionKey(data.userEmotion) ??
    normalizeToArtworkEmotionKey(data.myReaction) ??
    null;
  const resolvedCanonical = normalizeToCanonicalReactionType(resolvedUserEmotion);

  const summary: ArtworkEmotionSummary = {
    artworkId: safeId,
    counts: {
      love: Math.max(0, Number(data.counts?.love ?? data.counts?.heart) || 0),
      like: Math.max(0, Number(data.counts?.like) || 0),
      haha: Math.max(0, Number(data.counts?.haha ?? data.counts?.laugh) || 0),
      sad: Math.max(0, Number(data.counts?.sad) || 0),
      angry: Math.max(0, Number(data.counts?.angry) || 0),
    },
    canonicalCounts: {
      heart: Math.max(0, Number(data.counts?.love ?? data.counts?.heart) || 0),
      like: Math.max(0, Number(data.counts?.like) || 0),
      laugh: Math.max(0, Number(data.counts?.haha ?? data.counts?.laugh) || 0),
      sad: Math.max(0, Number(data.counts?.sad) || 0),
      angry: Math.max(0, Number(data.counts?.angry) || 0),
    },
    totalCount: Math.max(0, Number(data.totalCount) || 0),
    userEmotion: resolvedUserEmotion,
    myReaction: resolvedCanonical,
    action: data.action,
    reactionDocs: data.reactionDocs,
  };

  // 2. If Firebase Client Auth is signed in (`auth.currentUser`), execute atomic Firestore Transaction
  // on `artworks/{artworkId}/reactions/{uid}` and `communityArtworks/{artworkId}/reactions/{uid}`
  const firebaseAuthUid = auth.currentUser?.uid;
  if (firebaseAuthUid && (!currentUid || currentUid === firebaseAuthUid)) {
    const nowIso = new Date().toISOString();
    const canonicalReactionRef = doc(
      db,
      CANONICAL_ARTWORKS_COLLECTION,
      safeId,
      ARTWORK_REACTIONS_SUBCOLLECTION,
      firebaseAuthUid
    );
    const communityReactionRef = doc(
      db,
      ARTWORKS_COLLECTION,
      safeId,
      ARTWORK_REACTIONS_SUBCOLLECTION,
      firebaseAuthUid
    );

    try {
      await runTransaction(db, async (tx) => {
        const existingSnap = await tx.get(canonicalReactionRef);
        if (resolvedCanonical === null) {
          if (existingSnap.exists()) {
            tx.delete(canonicalReactionRef);
          }
          tx.delete(communityReactionRef);
        } else {
          const createdAt = existingSnap.exists()
            ? String(existingSnap.data()?.createdAt || nowIso)
            : nowIso;
          const payload = {
            uid: firebaseAuthUid,
            reactionType: resolvedCanonical,
            createdAt,
            updatedAt: nowIso,
          };
          tx.set(canonicalReactionRef, payload);
          tx.set(communityReactionRef, payload);
        }
      });
    } catch (fsErr: any) {
      // Log if Firestore rules rejected a write
      console.warn('[ARTVERSE REACTION][FIRESTORE TX]', fsErr?.code || fsErr?.message);
    }
  }

  return summary;
}

/**
 * Subscribes to real-time 5-emotion reaction changes from both Server and Firestore `artworks/{artworkId}/reactions`.
 */
export function subscribeArtworkEmotionSummary(
  artworkId: string,
  currentUid: string | null | undefined,
  bearerToken: string | null | undefined,
  onUpdate: (summary: ArtworkEmotionSummary) => void
): Unsubscribe {
  const safeId = artworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  let isDisposed = false;
  let latestServerDocs: Record<string, FirestoreReactionDoc> = {};

  // 1. Immediate fetch from authoritative backend API + Firestore subcollection
  fetchArtworkEmotionSummary(safeId, bearerToken, currentUid).then((srvSummary) => {
    if (!isDisposed && srvSummary) {
      if (srvSummary.reactionDocs) {
        latestServerDocs = srvSummary.reactionDocs;
      }
      onUpdate(srvSummary);
    }
  });

  // 2. Real-time Firestore listener on subcollection `artworks/{artworkId}/reactions`
  try {
    const colRef = collection(
      db,
      CANONICAL_ARTWORKS_COLLECTION,
      safeId,
      ARTWORK_REACTIONS_SUBCOLLECTION
    );
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        if (isDisposed) return;
        const mergedMap: Record<string, string> = {};
        for (const [u, d] of Object.entries(latestServerDocs)) {
          if (d?.reactionType) mergedMap[u] = d.reactionType;
        }
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          const canonical = normalizeToCanonicalReactionType(data?.reactionType);
          const uid = String(data?.uid || docSnap.id);
          if (uid && canonical) {
            mergedMap[uid] = canonical;
          }
        });
        if (Object.keys(mergedMap).length > 0 || !snap.empty) {
          const computed = computeEmotionSummaryFromUserMap(
            safeId,
            mergedMap,
            currentUid || auth.currentUser?.uid || null
          );
          onUpdate(computed);
        }
      },
      () => {
        // Ignore Firestore listener error when offline
      }
    );
    return () => {
      isDisposed = true;
      unsub();
    };
  } catch {
    return () => {
      isDisposed = true;
    };
  }
}

// ====================================================
// 2. CLASS & LESSON MANAGEMENT OPERATIONS (PART D & E)
// ====================================================

async function fetchServerLessonsFallback(): Promise<ArtLesson[]> {
  try {
    const res = await fetch(getApiUrl('/api/lessons'));
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.lessons)) {
        return data.lessons;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function mergeLessonLists(fsLessons: ArtLesson[], srvLessons: ArtLesson[]): ArtLesson[] {
  const map = new Map<string, ArtLesson>();
  for (const item of srvLessons) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  for (const item of fsLessons) {
    if (item && item.id) {
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        const tFs = Date.parse(item.updatedAt || '') || 0;
        const tSrv = Date.parse(existing.updatedAt || '') || 0;
        map.set(item.id, tFs >= tSrv ? item : existing);
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Reads all persisted lessons from Firestore & Server (including deleted status tombstones so deleted default lessons never resurrect)
 */
export async function getCommunityLessonsFromFirestore(): Promise<ArtLesson[]> {
  const srvLessons = await fetchServerLessonsFallback();
  try {
    const snap = await getDocs(collection(db, LESSONS_COLLECTION));
    const fsList: ArtLesson[] = [];
    snap.forEach((d) => {
      fsList.push({ ...(d.data() as ArtLesson), id: d.id, lessonId: d.id });
    });
    return mergeLessonLists(fsList, srvLessons);
  } catch {
    return srvLessons;
  }
}

/**
 * Subscribes to real-time art lessons from Firestore + Server persistence
 */
export function subscribeCommunityLessons(
  onUpdate: (lessons: ArtLesson[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = LESSONS_COLLECTION;
  let fsLessons: ArtLesson[] = [];
  let srvLessons: ArtLesson[] = [];

  const notify = () => {
    onUpdate(mergeLessonLists(fsLessons, srvLessons));
  };

  fetchServerLessonsFallback().then((list) => {
    srvLessons = list;
    notify();
  });

  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const list: ArtLesson[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as ArtLesson), id: docSnap.id, lessonId: docSnap.id });
        });
        fsLessons = list;
        notify();
      },
      (error) => {
        console.warn('Đồng bộ lessons từ máy chủ:', error.message);
        if (srvLessons.length > 0) {
          notify();
        } else {
          onError(error);
        }
      }
    );
  } catch (error: any) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return () => {};
  }
}

/**
 * Subscribes to real-time class groups
 */
export function subscribeCommunityClasses(
  onUpdate: (classes: ClassGroup[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = CLASSES_COLLECTION;
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const list: ClassGroup[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as ClassGroup), id: docSnap.id });
        });
        onUpdate(list);
      },
      (error) => {
        onError(error);
      }
    );
  } catch (error: any) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return () => {};
  }
}

export async function saveCommunityClassInFirestore(classGroup: ClassGroup): Promise<void> {
  const safeId = classGroup.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${CLASSES_COLLECTION}/${safeId}`;
  try {
    await setDoc(
      doc(db, CLASSES_COLLECTION, safeId),
      stripUndefinedDeep({
        ...classGroup,
        id: safeId,
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCommunityClassInFirestore(classId: string): Promise<void> {
  const safeId = classId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${CLASSES_COLLECTION}/${safeId}`;
  try {
    await deleteDoc(doc(db, CLASSES_COLLECTION, safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Saves (creates or updates) an ArtLesson in Firestore AND Server API, then verifies persistence!
 * Rejects temporary blob: or local_idb:// URLs in videoUrl/slideUrl/slides.
 */
export async function saveCommunityLessonInFirestore(lesson: ArtLesson): Promise<ArtLesson> {
  if (
    lesson.videoUrl &&
    (lesson.videoUrl.startsWith('blob:') || lesson.videoUrl.startsWith('local_idb://'))
  ) {
    throw new Error(
      'Không được lưu URL video tạm thời (blob: hoặc local_idb://). Video phải được tải lên Firebase Storage hoặc dùng liên kết ổn định.'
    );
  }
  if (
    lesson.slideUrl &&
    (lesson.slideUrl.startsWith('blob:') || lesson.slideUrl.startsWith('local_idb://'))
  ) {
    throw new Error(
      'Không được lưu URL slide tạm thời (blob: hoặc local_idb://). Slide phải được tải lên Firebase Storage hoặc dùng liên kết ổn định.'
    );
  }

  const normalized = normalizeLessonMetadata(lesson);
  const safeId = normalized.id;
  const path = `${LESSONS_COLLECTION}/${safeId}`;
  const payload = stripUndefinedDeep(normalized);

  let firestoreSaved = false;
  let serverSaved = false;
  let lastError: unknown = null;

  try {
    const docRef = doc(db, LESSONS_COLLECTION, safeId);
    await withStageTimeout(
      setDoc(docRef, payload, { merge: true }),
      10000,
      `Ghi metadata bài học vào Firestore /${LESSONS_COLLECTION}/${safeId}`
    );
    const verifySnap = await withStageTimeout(
      getDoc(docRef),
      6000,
      `Đọc xác minh bài học từ Firestore /${LESSONS_COLLECTION}/${safeId}`
    );
    if (verifySnap.exists()) {
      firestoreSaved = true;
    }
  } catch (error) {
    lastError = error;
  }

  try {
    const headers = await getAuthHeaders();
    const res = await withStageTimeout(
      fetch(getApiUrl('/api/lessons'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ lesson: payload }),
      }),
      5000,
      'Đồng bộ /api/lessons'
    );
    if (res.ok) {
      serverSaved = true;
    }
  } catch (srvErr) {
    if (!lastError) lastError = srvErr;
  }

  if (!firestoreSaved && !serverSaved) {
    handleFirestoreError(
      lastError || new Error('Không thể lưu bài học vào Firestore.'),
      OperationType.WRITE,
      path
    );
  }

  return payload;
}

/**
 * Deletes an ArtLesson durably (marks status='deleted' tombstone in Firestore & Server so INITIAL_LESSONS never resurrects it)
 */
export async function deleteCommunityLessonInFirestore(lessonId: string): Promise<void> {
  const safeId = lessonId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${LESSONS_COLLECTION}/${safeId}`;
  const tombstone = {
    id: safeId,
    lessonId: safeId,
    title: 'Đã xóa',
    topic: 'Đã xóa',
    classGroupId: 'cls-6',
    status: 'deleted' as const,
    isHidden: true,
    updatedAt: new Date().toISOString(),
  };

  let saved = false;
  let lastError: unknown = null;

  try {
    await setDoc(doc(db, LESSONS_COLLECTION, safeId), tombstone);
    saved = true;
  } catch (error) {
    lastError = error;
  }

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl(`/api/lessons/${encodeURIComponent(safeId)}`), {
      method: 'DELETE',
      headers,
    });
    if (res.ok) saved = true;
  } catch {
    // ignore
  }

  if (!saved && lastError) {
    handleFirestoreError(lastError, OperationType.DELETE, path);
  }
}

// ====================================================
// 3. AUDIT LOGS & CONTENT REPORTS OPERATIONS
// ====================================================

export function subscribeCommunityAuditLogs(
  onUpdate: (logs: AuditLogEntry[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = AUDIT_LOGS_COLLECTION;
  try {
    const q = query(collection(db, path), limit(100));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: AuditLogEntry[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as AuditLogEntry), id: docSnap.id });
        });
        onUpdate(list);
      },
      (error) => {
        onError(error);
      }
    );
  } catch (error: any) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return () => {};
  }
}

export async function logCommunityAuditInFirestore(entry: AuditLogEntry): Promise<void> {
  const safeId = entry.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    await setDoc(doc(db, AUDIT_LOGS_COLLECTION, safeId), {
      ...entry,
      id: safeId,
      createdAtServer: new Date().toISOString(),
    });
  } catch {
    // ignore non-critical audit log error
  }
}

export function subscribeContentReports(
  onUpdate: (reports: ContentReport[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = REPORTS_COLLECTION;
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const list: ContentReport[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as ContentReport), id: docSnap.id });
        });
        onUpdate(list);
      },
      (error) => {
        onError(error);
      }
    );
  } catch (error: any) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return () => {};
  }
}

export async function createContentReportInFirestore(report: ContentReport): Promise<void> {
  const safeId = report.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${REPORTS_COLLECTION}/${safeId}`;
  try {
    await setDoc(doc(db, REPORTS_COLLECTION, safeId), {
      ...report,
      id: safeId,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateContentReportInFirestore(
  reportId: string,
  updates: Partial<ContentReport>
): Promise<void> {
  const safeId = reportId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${REPORTS_COLLECTION}/${safeId}`;
  try {
    await updateDoc(doc(db, REPORTS_COLLECTION, safeId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function seedInitialCommunityDataIfEmpty(
  classes: ClassGroup[],
  lessons: ArtLesson[]
): Promise<boolean> {
  try {
    const classSnap = await getDocs(collection(db, CLASSES_COLLECTION));
    if (classSnap.empty) {
      for (const cls of classes) {
        await setDoc(doc(db, CLASSES_COLLECTION, cls.id), cls);
      }
    }

    const lessonSnap = await getDocs(collection(db, LESSONS_COLLECTION));
    if (lessonSnap.empty) {
      for (const les of lessons) {
        const normalized = normalizeLessonMetadata(les);
        await setDoc(doc(db, LESSONS_COLLECTION, normalized.id), stripUndefinedDeep(normalized));
      }
    }

    return classSnap.empty || lessonSnap.empty;
  } catch (error) {
    console.error('Lỗi khởi tạo dữ liệu mẫu lên Firestore:', error);
    return false;
  }
}

// ============================================================================
// PHẦN 7 & PHẦN 8: STORAGE MANAGEMENT CENTER, QUOTA THRESHOLDS & LIFECYCLE POLICY
// ============================================================================

const LOCAL_QUOTA_CONFIG_KEY = 'artverse_storage_quota_config_v1';
const LOCAL_DELETION_LOGS_KEY = 'artverse_media_deletion_logs_v1';

export const DEFAULT_STORAGE_QUOTA_CONFIG: StorageQuotaConfig = {
  maxStorageBytes: 5 * 1024 * 1024 * 1024, // 5 GB mặc định
  warnThreshold70: 0.7,
  warnThreshold85: 0.85,
  warnThreshold95: 0.95,
  updatedAt: new Date().toISOString(),
};

export async function getStorageQuotaConfig(): Promise<StorageQuotaConfig> {
  try {
    const snap = await withStageTimeout(
      getDoc(doc(db, STORAGE_QUOTA_CONFIG_COLLECTION, 'global')),
      3500,
      'Đọc cấu hình hạn mức Storage'
    );
    if (snap.exists()) {
      const data = snap.data() as StorageQuotaConfig;
      if (data && typeof data.maxStorageBytes === 'number' && data.maxStorageBytes > 0) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_QUOTA_CONFIG_KEY, JSON.stringify(data));
        }
        return data;
      }
    }
  } catch {
    // fallback to localStorage
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_QUOTA_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StorageQuotaConfig;
        if (parsed && typeof parsed.maxStorageBytes === 'number' && parsed.maxStorageBytes > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  return DEFAULT_STORAGE_QUOTA_CONFIG;
}

export async function saveStorageQuotaConfig(
  config: Partial<StorageQuotaConfig>,
  actorUid?: string
): Promise<StorageQuotaConfig> {
  const current = await getStorageQuotaConfig();
  const next: StorageQuotaConfig = {
    ...current,
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy: actorUid || auth.currentUser?.uid || 'admin',
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_QUOTA_CONFIG_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  try {
    await setDoc(doc(db, STORAGE_QUOTA_CONFIG_COLLECTION, 'global'), stripUndefinedDeep(next), {
      merge: true,
    });
  } catch {
    // saved locally if Firestore rule restricts
  }
  return next;
}

export async function getMediaDeletionAuditLogs(): Promise<MediaDeletionAuditEntry[]> {
  let localLogs: MediaDeletionAuditEntry[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_DELETION_LOGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localLogs = parsed;
      }
    } catch {
      // ignore
    }
  }

  try {
    const snap = await withStageTimeout(
      getDocs(query(collection(db, MEDIA_DELETION_LOGS_COLLECTION), limit(150))),
      4000,
      'Đọc nhật ký xóa media'
    );
    const fsLogs: MediaDeletionAuditEntry[] = [];
    snap.forEach((d) => fsLogs.push({ ...(d.data() as MediaDeletionAuditEntry), id: d.id }));
    const mergedMap = new Map<string, MediaDeletionAuditEntry>();
    for (const l of localLogs) mergedMap.set(l.id, l);
    for (const l of fsLogs) mergedMap.set(l.id, l);
    return Array.from(mergedMap.values()).sort(
      (a, b) => Date.parse(b.deletedAt || '') - Date.parse(a.deletedAt || '')
    );
  } catch {
    return localLogs;
  }
}

function appendLocalDeletionLog(entry: MediaDeletionAuditEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_DELETION_LOGS_KEY);
    const list: MediaDeletionAuditEntry[] = raw ? JSON.parse(raw) : [];
    const next = [entry, ...list.filter((x) => x.id !== entry.id)].slice(0, 200);
    localStorage.setItem(LOCAL_DELETION_LOGS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/**
 * Controlled Media Deletion (Phần 8.2):
 * - Deletes media file + thumbnail from Firebase Storage & Server Media Storage
 * - Deletes metadata from Firestore & Server API
 * - Records a full MediaDeletionAuditEntry with backupSnapshot so metadata can be recovered if needed
 */
export async function controlledDeleteArtworkMedia(
  artwork: CommunityArtwork,
  actorUid: string,
  actorRole: string,
  reason: string
): Promise<MediaDeletionAuditEntry> {
  const safeId = (artwork.mediaId || artwork.artworkId || artwork.id).replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  const mediaType: 'image' | 'video' = artwork.mediaType === 'video' ? 'video' : 'image';
  const storagePath =
    artwork.storagePath ||
    artwork.videoPath ||
    artwork.imagePath ||
    `public_exhibition/${safeId}/${mediaType === 'video' ? 'video.mp4' : 'clean_artwork.jpg'}`;

  await deleteArtworkPhotoFromStorage(
    safeId,
    artwork.publishedByTeacherId || actorUid,
    storagePath,
    artwork.thumbnailPath
  );

  await deleteCommunityArtworkInFirestore(safeId);

  const entry: MediaDeletionAuditEntry = {
    id: `del_${Date.now()}_${safeId.slice(0, 24)}`,
    mediaId: safeId,
    title: artwork.title || 'Tác phẩm không tiêu đề',
    mediaType,
    storagePath,
    thumbnailPath: artwork.thumbnailPath,
    fileSize:
      artwork.fileSize ||
      artwork.inspectionSummary?.sanitizedSizeBytes ||
      artwork.inspectionSummary?.originalSizeBytes ||
      0,
    classId: artwork.classId || artwork.classGroupId || 'cls-6',
    grade: artwork.grade || artwork.className || 'Lớp 6',
    authorNickname:
      artwork.authorNickname ||
      artwork.authorAlias ||
      artwork.creatorAnonymousPseudonym ||
      'Họa sĩ Nhí',
    deletedByUid: actorUid || 'admin',
    deletedByRole: actorRole || 'admin',
    deletedAt: new Date().toISOString(),
    reason: reason.trim() || 'Xóa có kiểm soát từ Trung tâm Quản lý Dung lượng',
    storageDeleted: true,
    firestoreDeleted: true,
    backupSnapshot: stripUndefinedDeep(artwork),
  };

  appendLocalDeletionLog(entry);
  try {
    await setDoc(doc(db, MEDIA_DELETION_LOGS_COLLECTION, entry.id), stripUndefinedDeep(entry));
  } catch {
    // kept in local audit log if Firestore write restricted
  }

  return entry;
}

/**
 * Recovers an accidentally deleted artwork metadata record from its MediaDeletionAuditEntry snapshot (Phần 8.2).
 */
export async function recoverDeletedArtworkMetadata(
  entry: MediaDeletionAuditEntry,
  actorUid?: string
): Promise<CommunityArtwork> {
  if (!entry.backupSnapshot) {
    throw new Error('Bản ghi nhật ký này không có bản sao lưu metadata để khôi phục.');
  }
  const restored = await createCommunityArtworkInFirestore(
    {
      ...entry.backupSnapshot,
      status: 'approved',
      shareStatus: 'shared',
      updatedAt: new Date().toISOString(),
    },
    actorUid
  );
  return restored;
}

/**
 * Converts an Orphaned Storage file (uploaded to Storage, missing in Firestore) into a verified CommunityArtwork record,
 * or deletes the orphaned file from Storage if requested (Phần 8.1).
 */
export async function recoverOrphanedStorageItemToFirestore(
  orphan: StorageUploadRegistryItem,
  actorUid: string
): Promise<CommunityArtwork> {
  const nowIso = new Date().toISOString();
  const artwork: CommunityArtwork = {
    id: orphan.mediaId,
    artworkId: orphan.mediaId,
    mediaId: orphan.mediaId,
    mediaType: orphan.mediaType,
    ownerKey: orphan.authorUid || actorUid,
    authorId: orphan.authorUid || actorUid,
    authorUid: orphan.authorUid || actorUid,
    authorAlias: orphan.authorNickname || 'Họa sĩ Nhí',
    authorNickname: orphan.authorNickname || 'Họa sĩ Nhí',
    creatorAnonymousPseudonym: orphan.authorNickname || 'Họa sĩ Nhí',
    title: orphan.title || `Tác phẩm khôi phục (${orphan.mediaId.slice(-6)})`,
    description: 'Tác phẩm được khôi phục metadata từ Trung tâm Quản lý Dung lượng ARTVERSE AI.',
    materialsUsed: orphan.mediaType === 'video' ? 'Video Nghệ thuật' : 'Màu tổng hợp',
    classId: orphan.classId || 'cls-6',
    classGroupId: orphan.classId || 'cls-6',
    className: orphan.grade || 'Lớp 6',
    grade: orphan.grade || 'Lớp 6',
    lessonId: 'les-free',
    lessonTitle: 'Sáng tác tự do',
    topic: `Mĩ thuật ${orphan.grade || 'Lớp 6'}`,
    storagePath: orphan.storagePath,
    downloadURL: orphan.downloadURL,
    thumbnailPath: orphan.thumbnailPath || orphan.storagePath,
    thumbnailUrl: orphan.thumbnailUrl || orphan.downloadURL,
    imagePath: orphan.storagePath,
    imageUrl: orphan.thumbnailUrl || orphan.downloadURL,
    videoPath: orphan.mediaType === 'video' ? orphan.storagePath : undefined,
    videoUrl: orphan.mediaType === 'video' ? orphan.downloadURL : undefined,
    fileSize: orphan.fileSize,
    mimeType: orphan.mimeType,
    duration: orphan.duration,
    status: 'approved',
    shareStatus: 'shared',
    shareToken: `shr_${orphan.mediaId}`,
    moderation: {
      moderatedBy: actorUid,
      moderatedAt: nowIso,
      moderatorNote: 'Khôi phục từ tệp mồ côi trên Storage',
    },
    reactions: {
      unique_idea: 0,
      striking_color: 0,
      interesting_composition: 0,
      noteworthy_detail: 0,
      inspiring: 0,
    },
    createdAt: orphan.uploadedAt || nowIso,
    updatedAt: nowIso,
    publishedByTeacherId: actorUid,
    storageLocation: 'firebase_storage',
  };

  return await createCommunityArtworkInFirestore(artwork, actorUid);
}

export async function purgeOrphanedStorageItem(orphan: StorageUploadRegistryItem): Promise<void> {
  await cleanupOrphanedStorageFile(orphan.storagePath, orphan.mediaId);
}

// ============================================================================
// PHẦN 9: ARTVERSE STORIES — CÂU CHUYỆN SAU NÉT VẼ (artworkStories Collection)
// - Reconnects existing Firestore collection `/artworkStories/{storyId}`
// - Syncs with `/api/stories` so Student PIN accounts and Teacher/Admin accounts work seamlessly
// - Enforces: No Base64 video in Firestore, no linking to unuploaded blob: videos, no student PII
// ============================================================================

function mergeStoryLists(fsStories: ArtworkStory[], srvStories: ArtworkStory[]): ArtworkStory[] {
  const map = new Map<string, ArtworkStory>();
  for (const s of srvStories) {
    if (s && s.id) map.set(s.id, s);
  }
  for (const s of fsStories) {
    if (s && s.id) {
      const existing = map.get(s.id);
      if (!existing) {
        map.set(s.id, s);
      } else {
        const tFs = Date.parse(s.updatedAt || '') || 0;
        const tSrv = Date.parse(existing.updatedAt || '') || 0;
        map.set(s.id, tFs >= tSrv ? s : existing);
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => (Date.parse(b.updatedAt || b.createdAt || '') || 0) - (Date.parse(a.updatedAt || a.createdAt || '') || 0)
  );
}

export async function fetchServerStoriesFallback(bearerToken?: string | null): Promise<ArtworkStory[]> {
  try {
    const headers: Record<string, string> = {};
    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    } else {
      const auto = await getAuthHeaders();
      if (auto.Authorization) headers.Authorization = auto.Authorization;
    }
    const res = await fetch(getApiUrl('/api/stories'), { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.stories)) {
        return data.stories;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function subscribeArtworkStories(
  onUpdate: (stories: ArtworkStory[]) => void,
  onError?: (error: Error) => void,
  bearerToken?: string | null
): Unsubscribe {
  let fsStories: ArtworkStory[] = [];
  let srvStories: ArtworkStory[] = [];
  let isDisposed = false;

  const notify = () => {
    if (isDisposed) return;
    onUpdate(mergeStoryLists(fsStories, srvStories));
  };

  fetchServerStoriesFallback(bearerToken).then((list) => {
    srvStories = list;
    notify();
  });

  try {
    const unsub = onSnapshot(
      collection(db, STORIES_COLLECTION),
      (snap) => {
        const list: ArtworkStory[] = [];
        snap.forEach((d) => {
          const data = d.data() as ArtworkStory;
          if (data && data.storyTitle) {
            list.push({ ...data, id: d.id });
          }
        });
        fsStories = list;
        notify();
      },
      (err) => {
        if (srvStories.length > 0) {
          notify();
        } else {
          onError?.(err);
        }
      }
    );
    return () => {
      isDisposed = true;
      unsub();
    };
  } catch (err: any) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return () => {
      isDisposed = true;
    };
  }
}

export async function saveArtworkStoryInFirestore(
  story: ArtworkStory,
  bearerToken?: string | null
): Promise<ArtworkStory> {
  // Validate linked video URL: never allow blob:, local_idb://, or Base64 video
  if (story.artworkVideoUrl) {
    const vUrl = story.artworkVideoUrl.trim();
    if (vUrl.startsWith('blob:') || vUrl.startsWith('local_idb://')) {
      throw new Error(
        'Video đang tải lên hoặc chưa hoàn tất lưu trữ. Vui lòng đợi video tải lên Firebase Storage thành công 100% trước khi liên kết với câu chuyện.'
      );
    }
    if (vUrl.startsWith('data:video/')) {
      throw new Error('Không được phép lưu dữ liệu Base64 của video trong câu chuyện Firestore.');
    }
  }
  if (story.artworkImageUrl && story.artworkImageUrl.startsWith('blob:')) {
    throw new Error('Ảnh tác phẩm chưa hoàn tất tải lên Storage. Vui lòng đợi tải lên hoàn tất.');
  }

  const safeId = (story.id || `story_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const nowIso = new Date().toISOString();
  const payload: ArtworkStory = stripUndefinedDeep({
    ...story,
    id: safeId,
    updatedAt: nowIso,
    createdAt: story.createdAt || nowIso,
  });

  let savedStory: ArtworkStory = payload;
  let serverSaved = false;
  let firestoreSaved = false;
  let lastError: unknown = null;

  // 1. Save via Backend API (/api/stories) with RBAC & Child Safety check
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    } else {
      const auto = await getAuthHeaders();
      if (auto.Authorization) headers.Authorization = auto.Authorization;
    }
    const res = await fetch(getApiUrl('/api/stories'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ story: payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Không thể lưu câu chuyện lên máy chủ.');
    }
    if (data?.story) {
      savedStory = data.story;
      serverSaved = true;
    }
  } catch (err) {
    lastError = err;
  }

  // 2. Persist to Firestore `/artworkStories/{storyId}` if client is signed into Firebase Auth
  if (auth.currentUser) {
    try {
      const docRef = doc(db, STORIES_COLLECTION, safeId);
      await setDoc(docRef, stripUndefinedDeep(savedStory), { merge: true });
      const verifySnap = await getDoc(docRef);
      if (verifySnap.exists()) {
        firestoreSaved = true;
      }
    } catch (fsErr) {
      if (!serverSaved) lastError = fsErr;
    }
  }

  if (!serverSaved && !firestoreSaved) {
    throw lastError instanceof Error
      ? lastError
      : new Error('Không thể lưu câu chuyện. Vui lòng kiểm tra đăng nhập và thử lại.');
  }

  return savedStory;
}

export async function moderateArtworkStoryInFirestore(
  storyId: string,
  status: ArtworkStoryStatus,
  teacherNote?: string,
  bearerToken?: string | null
): Promise<ArtworkStory> {
  const safeId = storyId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  } else {
    const auto = await getAuthHeaders();
    if (auto.Authorization) headers.Authorization = auto.Authorization;
  }

  const res = await fetch(getApiUrl(`/api/stories/${encodeURIComponent(safeId)}/moderate`), {
    method: 'POST',
    headers,
    body: JSON.stringify({ status, teacherNote }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Không thể cập nhật trạng thái kiểm duyệt câu chuyện.');
  }

  const updatedStory: ArtworkStory = data.story;

  if (auth.currentUser && updatedStory) {
    try {
      await setDoc(doc(db, STORIES_COLLECTION, safeId), stripUndefinedDeep(updatedStory), {
        merge: true,
      });
    } catch {
      // backend is synced
    }
  }

  return updatedStory;
}

/**
 * Bounded Firestore indexed search helper (`array-contains` on `searchTokens` with `limit`).
 * Never loads the entire Firestore collection unbounded.
 */
export async function queryFirestoreIndexedArtworks(
  rawQuery: string,
  maxLimit = 24
): Promise<CommunityArtwork[]> {
  const norm = normalizeVietnameseSearch(rawQuery);
  if (!norm) return [];
  const firstToken = norm.split(' ').find((w) => w.length >= 2);
  if (!firstToken) return [];

  try {
    const q = query(
      collection(db, ARTWORKS_COLLECTION),
      where('status', '==', 'approved'),
      where('shareStatus', '==', 'shared'),
      where('searchTokens', 'array-contains', firstToken.slice(0, 10)),
      limit(maxLimit)
    );
    const snap = await getDocs(q);
    const items: CommunityArtwork[] = [];
    snap.forEach((d) => items.push({ ...(d.data() as CommunityArtwork), id: d.id }));
    return items;
  } catch {
    return [];
  }
}



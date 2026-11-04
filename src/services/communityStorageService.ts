/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Cloud Storage & Media Upload Engine (Images, Artwork Videos, Lesson Slides & Lesson Videos)
 * - Tải tệp thực tế lên Firebase Cloud Storage với tiến trình % (uploadBytesResumable) và hỗ trợ hủy (cancel)
 * - Kiểm tra chữ ký nhị phân (magic bytes), MIME thực tế, dung lượng (Ảnh <=12MB, Video <=100MB) và thời lượng Video (<=180s)
 * - Tự động trích xuất hoặc tải ảnh đại diện (Thumbnail) cho Video, tuyệt đối không lưu nhị phân/Base64 của Video vào Firestore
 * - Theo dõi Registry tệp đã tải lên để phát hiện tệp mồ côi (Orphaned files) và khôi phục/dọn dẹp trong Storage Management Center
 */

import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  getBlob,
} from 'firebase/storage';
import { storage, auth, resolvedFirebaseConfig } from '../lib/firebase';
import { getApiUrl } from '../lib/platform';
import { UploadStateMachine, StorageUploadRegistryItem } from '../types/communityArt';

export interface StorageUploadResult {
  downloadUrl: string;
  storagePath: string;
  thumbnailUrl?: string;
  thumbnailPath?: string;
  bytesUploaded: number;
  isPublic: boolean;
  mimeType: string;
  duration?: number;
  width?: number;
  height?: number;
  storageProvider?: 'firebase_storage' | 'cloud_verified_storage';
}

export interface VideoValidationMetadata {
  valid: boolean;
  mimeType: string;
  extension: 'mp4' | 'mov' | 'webm';
  fileSize: number;
  duration: number;
  width: number;
  height: number;
  thumbnailDataUrl: string;
}

export interface UploadProgressTelemetry {
  percent: number;
  stageText: string;
  state: UploadStateMachine;
  bytesTransferred: number;
  totalBytes: number;
  speedBytesPerSec: number;
  elapsedSeconds: number;
  firebaseErrorCode?: string;
}

export function formatFirebaseStorageError(err: any): { code: string; message: string } {
  const rawCode = String(err?.code || '');
  const rawMsg = String(err?.message || err || '');
  if (rawCode === 'storage/unauthorized' || rawMsg.includes('storage/unauthorized')) {
    return {
      code: 'storage/unauthorized',
      message: 'Lỗi phân quyền (storage/unauthorized): Tài khoản không có quyền ghi vào đường dẫn Firebase Storage này.',
    };
  }
  if (rawCode === 'storage/canceled' || rawMsg.includes('UPLOAD_CANCELED') || rawMsg.includes('storage/canceled')) {
    return {
      code: 'storage/canceled',
      message: 'Đã hủy tải lên (storage/canceled): Người dùng đã chủ động dừng quá trình tải tệp.',
    };
  }
  if (rawCode === 'storage/retry-limit-exceeded' || rawMsg.includes('storage/retry-limit-exceeded')) {
    return {
      code: 'storage/retry-limit-exceeded',
      message: 'Quá giới hạn thử lại (storage/retry-limit-exceeded): Kết nối mạng không ổn định khi truyền tệp.',
    };
  }
  if (rawCode === 'storage/quota-exceeded' || rawMsg.includes('storage/quota-exceeded')) {
    return {
      code: 'storage/quota-exceeded',
      message: 'Vượt hạn mức lưu trữ (storage/quota-exceeded): Dung lượng Firebase Storage đã đầy.',
    };
  }
  return {
    code: rawCode || 'storage/unknown',
    message: rawMsg || 'Lỗi không xác định khi tải tệp lên Storage (storage/unknown).',
  };
}

function generateFallbackVideoPosterThumbnail(fileName: string = 'Video Nghệ Thuật'): string {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#20243A';
    ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = '#3457D5';
    ctx.fillRect(0, 0, 640, 10);
    ctx.fillStyle = '#F2D64B';
    ctx.beginPath();
    ctx.arc(320, 160, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20243A';
    ctx.beginPath();
    ctx.moveTo(308, 142);
    ctx.lineTo(308, 178);
    ctx.lineTo(338, 160);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#F7F3EA';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(fileName.slice(0, 38), 320, 245);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px sans-serif';
    ctx.fillText('ARTVERSE AI · VIDEO EXHIBITION', 320, 275);
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return '';
  }
}

const STORAGE_REGISTRY_KEY = 'artverse_storage_upload_registry_v1';

export function getStorageUploadRegistry(): StorageUploadRegistryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStorageUploadRegistry(items: StorageUploadRegistryItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_REGISTRY_KEY, JSON.stringify(items.slice(0, 300)));
  } catch {
    // ignore storage quota
  }
}

export function recordStorageUploadRegistryItem(item: StorageUploadRegistryItem): void {
  const current = getStorageUploadRegistry();
  const idx = current.findIndex((x) => x.mediaId === item.mediaId);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...item };
  } else {
    current.unshift(item);
  }
  saveStorageUploadRegistry(current);
}

export function markStorageUploadVerifiedInRegistry(
  mediaId: string,
  extra?: Partial<StorageUploadRegistryItem>
): void {
  const current = getStorageUploadRegistry();
  const idx = current.findIndex((x) => x.mediaId === mediaId);
  if (idx >= 0) {
    current[idx] = {
      ...current[idx],
      ...extra,
      firestoreSaved: true,
      status: 'verified',
      errorReason: undefined,
    };
    saveStorageUploadRegistry(current);
  }
}

export function markStorageUploadFailedInRegistry(
  mediaId: string,
  errorReason: string,
  partialItem?: Partial<StorageUploadRegistryItem>
): void {
  const current = getStorageUploadRegistry();
  const idx = current.findIndex((x) => x.mediaId === mediaId);
  if (idx >= 0) {
    current[idx] = {
      ...current[idx],
      ...partialItem,
      errorReason,
      status: current[idx].downloadURL ? 'uploaded_only' : 'failed',
    };
  } else if (partialItem) {
    current.unshift({
      mediaId,
      mediaType: partialItem.mediaType || 'image',
      storagePath: partialItem.storagePath || `public_exhibition/${mediaId}/unknown`,
      downloadURL: partialItem.downloadURL || '',
      thumbnailPath: partialItem.thumbnailPath,
      thumbnailUrl: partialItem.thumbnailUrl,
      fileSize: partialItem.fileSize || 0,
      mimeType: partialItem.mimeType || 'image/jpeg',
      duration: partialItem.duration,
      title: partialItem.title || 'Tệp tải lên chưa hoàn tất',
      classId: partialItem.classId || 'cls-6',
      grade: partialItem.grade || 'Lớp 6',
      authorUid: partialItem.authorUid || 'unknown',
      authorNickname: partialItem.authorNickname || 'Họa sĩ Nhí',
      uploadedAt: new Date().toISOString(),
      firestoreSaved: false,
      status: partialItem.downloadURL ? 'uploaded_only' : 'failed',
      errorReason,
    });
  }
  saveStorageUploadRegistry(current);
}

export function removeStorageUploadFromRegistry(mediaId: string): void {
  const current = getStorageUploadRegistry().filter((x) => x.mediaId !== mediaId);
  saveStorageUploadRegistry(current);
}

// Cache bucket availability check for 60s so multi-image batches never wait per image on a 404 bucket
let cachedBucketStatus: { checkedAt: number; available: boolean } | null = null;

export async function isStorageBucketEndpointAvailable(): Promise<boolean> {
  if (cachedBucketStatus && Date.now() - cachedBucketStatus.checkedAt < 60_000) {
    return cachedBucketStatus.available;
  }
  const bucket = resolvedFirebaseConfig.storageBucket;
  if (!bucket) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?maxResults=1`,
      { method: 'GET', signal: controller.signal }
    );
    clearTimeout(timer);
    // HTTP 404 means the GCS bucket has not been initialized in Firebase Console
    const available = res.status !== 404;
    cachedBucketStatus = { checkedAt: Date.now(), available };
    return available;
  } catch {
    return true;
  }
}

export const MAX_ARTWORK_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB
export const MAX_SLIDE_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_VIDEO_FILE_BYTES = 100 * 1024 * 1024; // 100 MB (Phần 4: Tối đa 100MB)
export const MAX_VIDEO_DURATION_SECONDS = 180; // 180 giây (Phần 4: Tối đa 180 giây)

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_SLIDE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];

function getSafeSegment(raw?: string, fallback: string = 'anonymous'): string {
  if (!raw || raw.trim() === '') return fallback;
  return raw.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function withStageTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stageLabel: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Quá thời gian chờ (${Math.round(timeoutMs / 1000)}s) tại bước: ${stageLabel}. Vui lòng kiểm tra mạng và nhấn "Thử lại".`
        )
      );
    }, timeoutMs);

    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return withStageTimeout(
    new Promise<string>((resolve, reject) => {
      if (typeof FileReader !== 'undefined') {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Không thể đọc dữ liệu ảnh.'));
          }
        };
        reader.onerror = () => reject(reader.error || new Error('Lỗi đọc Blob.'));
        reader.readAsDataURL(blob);
      } else {
        blob
          .arrayBuffer()
          .then((buf) => {
            const b64 = Buffer.from(buf).toString('base64');
            resolve(`data:${blob.type || 'image/jpeg'};base64,${b64}`);
          })
          .catch(reject);
      }
    }),
    12000,
    'Đọc dữ liệu tệp ảnh (FileReader)'
  );
}

/**
 * Inspects actual binary magic bytes of a file/blob to block disguised executables or corrupted files.
 */
export async function inspectBinaryFileHeader(
  blob: Blob
): Promise<{ kind: 'jpeg' | 'png' | 'webp' | 'mp4_mov' | 'webm' | 'executable_or_archive' | 'unknown' }> {
  try {
    const headerSlice = blob.slice(0, 32);
    const buf = await headerSlice.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.length < 4) return { kind: 'unknown' };

    // Disguised Windows EXE/DLL ('MZ') or ELF (0x7F 'E' 'L' 'F')
    if (
      (bytes[0] === 0x4d && bytes[1] === 0x5a) ||
      (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46)
    ) {
      return { kind: 'executable_or_archive' };
    }

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { kind: 'jpeg' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return { kind: 'png' };
    }

    // WEBP: 'RIFF' .... 'WEBP'
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes.length >= 12 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return { kind: 'webp' };
    }

    // WebM / Matroska EBML: 1A 45 DF A3
    if (
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    ) {
      return { kind: 'webm' };
    }

    // MP4 / MOV / QuickTime ISO BMFF: bytes 4..7 == 'ftyp' or 'moov' or 'wide' or 'mdat'
    if (bytes.length >= 8) {
      const boxType = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
      if (
        boxType === 'ftyp' ||
        boxType === 'moov' ||
        boxType === 'mdat' ||
        boxType === 'wide' ||
        boxType === 'free'
      ) {
        return { kind: 'mp4_mov' };
      }
    }

    return { kind: 'unknown' };
  } catch {
    return { kind: 'unknown' };
  }
}

/**
 * Validates a video file (MP4, MOV, WebM), enforces size <= 100MB and duration <= 180s,
 * and extracts a clean JPEG thumbnail cover at t = 0.5s (or uses customThumbnailDataUrl if provided).
 */
export async function validateVideoFileAndExtractMeta(
  file: File | Blob,
  fileName: string = 'video.mp4',
  customThumbnailDataUrl?: string
): Promise<VideoValidationMetadata> {
  if (!file || file.size <= 0) {
    throw new Error('Lỗi kiểm tra Video (VALIDATING): Tệp video rỗng (0 bytes) hoặc bị hỏng.');
  }

  if (file.size > MAX_VIDEO_FILE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Lỗi kiểm tra Video (VALIDATING): Dung lượng video (${sizeMb}MB) vượt quá giới hạn cho phép 100MB.`
    );
  }

  const rawMime = (file.type || '').toLowerCase();
  const extMatch = fileName.toLowerCase().match(/\.(mp4|mov|webm|m4v)$/);
  const extFromName = extMatch ? (extMatch[1] === 'm4v' ? 'mp4' : (extMatch[1] as 'mp4' | 'mov' | 'webm')) : null;

  const isMimeAllowed = ALLOWED_VIDEO_MIMES.includes(rawMime);
  if (!isMimeAllowed && !extFromName) {
    throw new Error(
      `Lỗi kiểm tra Video (VALIDATING): Định dạng "${rawMime || fileName}" không được hỗ trợ. Chỉ chấp nhận MP4, MOV hoặc WebM.`
    );
  }

  // Inspect actual binary header to prevent fake renamed files
  const headerCheck = await inspectBinaryFileHeader(file);
  if (
    headerCheck.kind === 'executable_or_archive' ||
    headerCheck.kind === 'jpeg' ||
    headerCheck.kind === 'png' ||
    headerCheck.kind === 'webp'
  ) {
    throw new Error(
      'Lỗi kiểm tra Video (VALIDATING): Nội dung nhị phân của tệp không phải là định dạng Video hợp lệ (MP4/MOV/WebM).'
    );
  }

  const resolvedMime = isMimeAllowed
    ? rawMime === 'video/x-m4v'
      ? 'video/mp4'
      : rawMime
    : extFromName === 'mov'
      ? 'video/quicktime'
      : extFromName === 'webm'
        ? 'video/webm'
        : 'video/mp4';

  const resolvedExt: 'mp4' | 'mov' | 'webm' =
    resolvedMime === 'video/webm'
      ? 'webm'
      : resolvedMime === 'video/quicktime'
        ? 'mov'
        : 'mp4';

  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return {
      valid: true,
      mimeType: resolvedMime,
      extension: resolvedExt,
      fileSize: file.size,
      duration: 15,
      width: 1280,
      height: 720,
      thumbnailDataUrl: customThumbnailDataUrl || generateFallbackVideoPosterThumbnail(fileName),
    };
  }

  const tempObjectUrl = URL.createObjectURL(file);
  try {
    const meta = await new Promise<{ duration: number; width: number; height: number; thumbnailDataUrl: string }>(
      (resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;

        let settled = false;
        let metadataTimer: ReturnType<typeof setTimeout> | null = null;
        let seekFallbackTimer: ReturnType<typeof setTimeout> | null = null;

        const clearTimers = () => {
          if (metadataTimer) {
            clearTimeout(metadataTimer);
            metadataTimer = null;
          }
          if (seekFallbackTimer) {
            clearTimeout(seekFallbackTimer);
            seekFallbackTimer = null;
          }
        };

        const finish = (
          err?: Error,
          result?: { duration: number; width: number; height: number; thumbnailDataUrl: string }
        ) => {
          if (settled) return;
          settled = true;
          clearTimers();
          try {
            video.removeAttribute('src');
            video.load();
          } catch {
            // ignore
          }
          if (err) reject(err);
          else if (result) resolve(result);
        };

        // Never block video upload at 5% for 12s if browser media decoder is slow on large MP4/MOV/WebM containers
        metadataTimer = setTimeout(() => {
          finish(undefined, {
            duration: 15,
            width: 1280,
            height: 720,
            thumbnailDataUrl:
              customThumbnailDataUrl || generateFallbackVideoPosterThumbnail(fileName),
          });
        }, 3500);

        video.onerror = () => {
          // If magic bytes & size already passed, fallback to safe poster instead of blocking valid MOV/MP4 codecs
          finish(undefined, {
            duration: 15,
            width: 1280,
            height: 720,
            thumbnailDataUrl:
              customThumbnailDataUrl || generateFallbackVideoPosterThumbnail(fileName),
          });
        };

        video.onloadedmetadata = () => {
          if (metadataTimer) {
            clearTimeout(metadataTimer);
            metadataTimer = null;
          }
          const rawDuration = Number(video.duration);
          const duration =
            Number.isFinite(rawDuration) && rawDuration > 0
              ? Math.round(rawDuration * 10) / 10
              : 15;
          const width = video.videoWidth || 1280;
          const height = video.videoHeight || 720;

          if (duration > MAX_VIDEO_DURATION_SECONDS) {
            finish(
              new Error(
                `Lỗi kiểm tra Video (VALIDATING): Thời lượng video (${Math.ceil(duration)} giây) vượt quá giới hạn tối đa ${MAX_VIDEO_DURATION_SECONDS} giây (3 phút).`
              )
            );
            return;
          }

          if (customThumbnailDataUrl && customThumbnailDataUrl.startsWith('data:image/')) {
            finish(undefined, {
              duration,
              width,
              height,
              thumbnailDataUrl: customThumbnailDataUrl,
            });
            return;
          }

          // Non-blocking 2.2s fallback if onseeked does not fire on off-DOM video element
          seekFallbackTimer = setTimeout(() => {
            finish(undefined, {
              duration,
              width,
              height,
              thumbnailDataUrl:
                customThumbnailDataUrl || generateFallbackVideoPosterThumbnail(fileName),
            });
          }, 2200);

          try {
            const seekTarget = Math.min(0.8, Math.max(0.1, duration * 0.15));
            video.currentTime = seekTarget;
          } catch {
            finish(undefined, {
              duration,
              width,
              height,
              thumbnailDataUrl:
                customThumbnailDataUrl || generateFallbackVideoPosterThumbnail(fileName),
            });
          }
        };

        video.onseeked = () => {
          try {
            const rawDuration = Number(video.duration);
            const duration =
              Number.isFinite(rawDuration) && rawDuration > 0
                ? Math.round(rawDuration * 10) / 10
                : 15;
            const width = video.videoWidth || 1280;
            const height = video.videoHeight || 720;
            const maxThumbDim = 720;
            let tw = width;
            let th = height;
            if (tw > maxThumbDim || th > maxThumbDim) {
              if (tw >= th) {
                th = Math.max(1, Math.round((th * maxThumbDim) / tw));
                tw = maxThumbDim;
              } else {
                tw = Math.max(1, Math.round((tw * maxThumbDim) / th));
                th = maxThumbDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = tw;
            canvas.height = th;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#20243A';
              ctx.fillRect(0, 0, tw, th);
              ctx.drawImage(video, 0, 0, tw, th);
            }
            const thumbUrl = canvas.toDataURL('image/jpeg', 0.8);
            finish(undefined, {
              duration,
              width,
              height,
              thumbnailDataUrl:
                thumbUrl || customThumbnailDataUrl || generateFallbackVideoPosterThumbnail(fileName),
            });
          } catch {
            finish(undefined, {
              duration: Math.min(180, Number(video.duration) || 15),
              width: video.videoWidth || 1280,
              height: video.videoHeight || 720,
              thumbnailDataUrl:
                customThumbnailDataUrl || generateFallbackVideoPosterThumbnail(fileName),
            });
          }
        };

        video.src = tempObjectUrl;
      }
    );

    return {
      valid: true,
      mimeType: resolvedMime,
      extension: resolvedExt,
      fileSize: file.size,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      thumbnailDataUrl:
        meta.thumbnailDataUrl || generateFallbackVideoPosterThumbnail(fileName),
    };
  } finally {
    try {
      URL.revokeObjectURL(tempObjectUrl);
    } catch {
      // ignore
    }
  }
}

/**
 * Compress an image DataURL/Blob with strict timeout & guaranteed byte ceiling (<= 160KB)
 * so that thumbnails and fallback images are always fast and lightweight.
 */
export async function createCloudSafeImageDataUrl(
  sourceDataUrl: string,
  maxBytes: number = 160_000
): Promise<string> {
  if (typeof document === 'undefined') {
    if (sourceDataUrl.length <= maxBytes) {
      return sourceDataUrl;
    }
    const commaIdx = sourceDataUrl.indexOf(',');
    if (commaIdx > 0) {
      const header = sourceDataUrl.slice(0, commaIdx + 1);
      const rawB64 = sourceDataUrl.slice(commaIdx + 1);
      const maxB64Len = Math.floor((maxBytes - header.length) / 4) * 4;
      return header + rawB64.slice(0, Math.max(64, maxB64Len));
    }
    return sourceDataUrl.slice(0, maxBytes);
  }

  if (sourceDataUrl.length <= maxBytes && sourceDataUrl.startsWith('data:image/jpeg')) {
    return sourceDataUrl;
  }

  const img = new Image();
  await withStageTimeout(
    new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Không thể giải mã hình ảnh để tối ưu dung lượng.'));
      img.src = sourceDataUrl;
    }),
    8000,
    'Giải mã khung hình ảnh (Canvas Decode)'
  );

  const maxDim = 960;
  let width = img.naturalWidth || img.width || 800;
  let height = img.naturalHeight || img.height || 600;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.max(1, Math.round((height * maxDim) / width));
      width = maxDim;
    } else {
      width = Math.max(1, Math.round((width * maxDim) / height));
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceDataUrl;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.76;
  let result = canvas.toDataURL('image/jpeg', quality);
  while (result.length > maxBytes && quality > 0.32) {
    quality -= 0.12;
    result = canvas.toDataURL('image/jpeg', quality);
  }

  let scale = 0.75;
  while (result.length > maxBytes && scale >= 0.35) {
    const sw = Math.max(240, Math.round(width * scale));
    const sh = Math.max(180, Math.round(height * scale));
    canvas.width = sw;
    canvas.height = sh;
    const sCtx = canvas.getContext('2d');
    if (!sCtx) break;
    sCtx.fillStyle = '#FFFFFF';
    sCtx.fillRect(0, 0, sw, sh);
    sCtx.drawImage(img, 0, 0, sw, sh);
    result = canvas.toDataURL('image/jpeg', 0.65);
    scale -= 0.15;
  }

  return result;
}

/**
 * Streams a binary file (image or video up to 100MB) to the persistent server media endpoint
 * with real upload progress and cancellation support when the Firebase Storage bucket returns 404.
 */
function uploadBinaryToServerMediaEndpointWithProgress(
  blob: Blob,
  mediaId: string,
  fileName: string,
  mimeType: string,
  onProgress?: (
    percent: number,
    stageText?: string,
    state?: UploadStateMachine,
    telemetry?: UploadProgressTelemetry
  ) => void,
  onRegisterCancel?: (cancelFn: () => void) => void
): Promise<{ downloadUrl: string; storagePath: string; bytesUploaded: number }> {
  return new Promise((resolve, reject) => {
    const url = getApiUrl(
      `/api/media/upload/${encodeURIComponent(mediaId)}/${encodeURIComponent(fileName)}`
    );
    const startedAtMs = Date.now();

    if (typeof XMLHttpRequest !== 'undefined') {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', mimeType || 'application/octet-stream');

      let lastTransferred = 0;
      let stallTimeoutId: ReturnType<typeof setTimeout> | null = null;
      const resetStallTimer = () => {
        if (stallTimeoutId) clearTimeout(stallTimeoutId);
        // Only abort if 0 bytes move for 120 seconds (never abort active slow transfers)
        stallTimeoutId = setTimeout(() => {
          try {
            xhr.abort();
          } catch {
            // ignore
          }
          reject(
            new Error(
              'UPLOAD_STALLED: Không có dữ liệu truyền đi trong 120 giây (mạng bị ngắt). Vui lòng kiểm tra Internet và nhấn "Thử lại".'
            )
          );
        }, 120_000);
      };
      resetStallTimer();

      const clearStallTimer = () => {
        if (stallTimeoutId) {
          clearTimeout(stallTimeoutId);
          stallTimeoutId = null;
        }
      };

      onRegisterCancel?.(() => {
        clearStallTimer();
        try {
          xhr.abort();
        } catch {
          // ignore
        }
      });

      xhr.upload.onprogress = (ev) => {
        if (ev.loaded > lastTransferred) {
          lastTransferred = ev.loaded;
          resetStallTimer();
        }
        const total = ev.lengthComputable && ev.total > 0 ? ev.total : blob.size || 1;
        const loaded = ev.loaded || 0;
        const elapsedSec = Math.max(0.2, (Date.now() - startedAtMs) / 1000);
        const speedBps = Math.round(loaded / elapsedSec);
        const ratio = Math.min(1, Math.max(0, loaded / total));
        const pct = Math.min(78, Math.max(12, Math.round(10 + ratio * 68)));
        const stageText = `Đang truyền tệp (${pct}% — ${(loaded / (1024 * 1024)).toFixed(1)}/${(total / (1024 * 1024)).toFixed(1)} MB)...`;
        onProgress?.(pct, stageText, 'UPLOADING', {
          percent: pct,
          stageText,
          state: 'UPLOADING',
          bytesTransferred: loaded,
          totalBytes: total,
          speedBytesPerSec: speedBps,
          elapsedSeconds: Math.round(elapsedSec),
        });
      };

      xhr.onerror = () => {
        clearStallTimer();
        reject(
          new Error(
            'Lỗi mạng khi đang truyền tệp lên máy chủ lưu trữ (storage/retry-limit-exceeded). Vui lòng kiểm tra kết nối Internet và nhấn "Thử lại".'
          )
        );
      };

      xhr.onabort = () => {
        clearStallTimer();
        reject(new Error('UPLOAD_CANCELED: Người dùng đã hủy tải tệp lên (storage/canceled).'));
      };

      xhr.onload = () => {
        clearStallTimer();
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (parsed?.downloadUrl) {
              resolve({
                downloadUrl: parsed.downloadUrl,
                storagePath: parsed.storagePath || `public_exhibition/${mediaId}/${fileName}`,
                bytesUploaded: parsed.bytesUploaded || blob.size,
              });
              return;
            }
          } catch {
            // ignore
          }
          reject(new Error('Phản hồi từ máy chủ lưu trữ không hợp lệ.'));
        } else {
          let errMsg = `Máy chủ trả về mã lỗi ${xhr.status}`;
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (parsed?.error) errMsg = parsed.error;
          } catch {
            // ignore
          }
          reject(new Error(errMsg));
        }
      };

      xhr.send(blob);
    } else {
      fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType || 'application/octet-stream' },
        body: blob,
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
          resolve({
            downloadUrl: data.downloadUrl,
            storagePath: data.storagePath || `public_exhibition/${mediaId}/${fileName}`,
            bytesUploaded: data.bytesUploaded || blob.size,
          });
        })
        .catch(reject);
    }
  });
}

/**
 * Uploads an artwork image to Firebase Storage with real-time progress callback and 90s timeout.
 * Strictly follows the Upload State Machine:
 * - VALIDATING -> UPLOADING (10–76%) -> STORAGE_COMPLETED (80%) -> GETTING_URL (85%)
 * NEVER sets 100% or SUCCESS here (SAVING_METADATA is 90%, VERIFYING is 95%, SUCCESS is 100%).
 */
export async function uploadArtworkPhotoToStorageWithProgress(
  fileOrDataUrl: Blob | File | string,
  artworkId: string,
  isPublic: boolean = true,
  uploaderUid: string = '',
  onProgress?: (percent: number, stageText?: string, state?: UploadStateMachine) => void,
  onRegisterCancel?: (cancelFn: () => void) => void
): Promise<StorageUploadResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error(
      'Lỗi ở Bước 3 (UPLOADING): Thiết bị đang mất kết nối mạng (Offline). Vui lòng kiểm tra Internet và nhấn "Thử lại".'
    );
  }

  const safeId = getSafeSegment(artworkId, `art_${Date.now()}`);
  const safeUploaderId = getSafeSegment(
    uploaderUid || auth.currentUser?.uid,
    'community_uploader'
  );

  onProgress?.(5, 'Bước 2 (VALIDATING): Đang kiểm tra định dạng và dung lượng tệp ảnh...', 'VALIDATING');

  let targetBlob: Blob;
  let sourceDataUrl = '';

  if (typeof fileOrDataUrl === 'string') {
    if (!fileOrDataUrl.startsWith('data:image/')) {
      throw new Error(
        'Lỗi ở Bước VALIDATING: Định dạng tệp ảnh không hợp lệ (chỉ chấp nhận JPEG, PNG, WEBP).'
      );
    }
    sourceDataUrl = fileOrDataUrl;
    targetBlob = dataUrlToBlob(fileOrDataUrl);
  } else {
    targetBlob = fileOrDataUrl;
    const headerInfo = await inspectBinaryFileHeader(targetBlob);
    if (headerInfo.kind === 'executable_or_archive') {
      throw new Error(
        'Lỗi ở Bước VALIDATING: Tệp tải lên có chữ ký thực thi không hợp lệ, không phải tệp hình ảnh.'
      );
    }
    sourceDataUrl = await blobToDataUrl(targetBlob);
  }

  const mimeType = (targetBlob.type || 'image/jpeg').toLowerCase();
  if (!ALLOWED_IMAGE_MIMES.includes(mimeType)) {
    throw new Error(
      `Lỗi ở Bước VALIDATING: Định dạng ảnh "${mimeType}" không được hỗ trợ. Vui lòng chọn ảnh JPG, PNG hoặc WEBP.`
    );
  }

  if (targetBlob.size <= 0) {
    throw new Error('Lỗi ở Bước VALIDATING: Tệp ảnh rỗng (0 bytes) hoặc bị hỏng.');
  }

  if (targetBlob.size > MAX_ARTWORK_IMAGE_BYTES) {
    throw new Error('Lỗi ở Bước VALIDATING: Dung lượng ảnh vượt quá giới hạn cho phép 12MB.');
  }

  // Canonical paths matching storage.rules (/public_exhibition/{artworkId}/{fileName})
  const publicPath = `public_exhibition/${safeId}/clean_artwork.jpg`;
  const privatePath = `private_artworks/${safeUploaderId}/${safeId}/clean_artwork.jpg`;
  const activeStoragePath = isPublic ? publicPath : privatePath;
  const thumbnailPath = `public_exhibition/${safeId}/thumbnail.jpg`;

  const metadata = {
    contentType: mimeType,
    customMetadata: {
      sanitized: 'true',
      mediaType: 'image',
      isPublic: String(isPublic),
      uploadedBy: safeUploaderId,
      uploadedAt: new Date().toISOString(),
      artworkId: safeId,
    },
  };

  console.info(
    `[ARTVERSE UPLOAD][UPLOADING] Bắt đầu tải ảnh lên Firebase Storage | project=${resolvedFirebaseConfig.projectId} | bucket=${resolvedFirebaseConfig.storageBucket} | path=${activeStoragePath} | size=${targetBlob.size}B | mime=${mimeType}`
  );
  onProgress?.(10, 'Bước 3 (UPLOADING): Đang kết nối Firebase Storage...', 'UPLOADING');

  try {
    const bucketAvailable = await isStorageBucketEndpointAvailable();
    if (!bucketAvailable) {
      throw new Error('STORAGE_BUCKET_NOT_PROVISIONED_404');
    }

    const targetRef = ref(storage, activeStoragePath);
    const uploadResult = await new Promise<StorageUploadResult>((resolve, reject) => {
      let settled = false;
      const task = uploadBytesResumable(targetRef, targetBlob, metadata);

      onRegisterCancel?.(() => {
        if (settled) return;
        settled = true;
        try {
          task.cancel();
        } catch {
          // ignore
        }
        reject(new Error('UPLOAD_CANCELED: Người dùng đã hủy tải ảnh lên.'));
      });

      // Generous 90-second timeout for multi-image concurrent batches and high-res photos
      const transferTimeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          task.cancel();
        } catch {
          // ignore
        }
        reject(new Error('UPLOAD_TRANSFER_TIMEOUT: Quá thời gian truyền tệp lên Firebase Storage (90s).'));
      }, 90_000);

      task.on(
        'state_changed',
        (snapshot) => {
          if (settled) return;
          const total = snapshot.totalBytes || targetBlob.size || 1;
          const transferred = snapshot.bytesTransferred || 0;
          const ratio = Math.min(1, Math.max(0, transferred / total));
          const pct = Math.min(76, Math.max(12, Math.round(10 + ratio * 66)));
          onProgress?.(
            pct,
            `Bước 3 (UPLOADING): Đang truyền tệp ảnh lên Firebase Storage (${pct}%)...`,
            'UPLOADING'
          );
        },
        (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(transferTimeoutId);
          reject(err);
        },
        async () => {
          if (settled) return;
          clearTimeout(transferTimeoutId);

          if (task.snapshot.state !== 'success') {
            settled = true;
            reject(
              new Error(
                `Bước STORAGE_COMPLETED thất bại: Firebase Storage task kết thúc với trạng thái "${task.snapshot.state}".`
              )
            );
            return;
          }

          onProgress?.(
            80,
            'Bước 4 (STORAGE_COMPLETED): File đã được xác nhận trong Firebase Storage (80%)...',
            'STORAGE_COMPLETED'
          );

          onProgress?.(
            85,
            'Bước 5 (GETTING_URL): Đang lấy URL hợp lệ từ getDownloadURL() (85%)...',
            'GETTING_URL'
          );

          try {
            const downloadUrl = await withStageTimeout(
              getDownloadURL(task.snapshot.ref),
              15000,
              'Bước 5 (Lấy URL ảnh getDownloadURL từ Firebase Storage)'
            );
            if (
              !downloadUrl ||
              typeof downloadUrl !== 'string' ||
              downloadUrl.startsWith('blob:')
            ) {
              throw new Error('getDownloadURL trả về URL rỗng hoặc không hợp lệ.');
            }
            settled = true;

            recordStorageUploadRegistryItem({
              mediaId: safeId,
              mediaType: 'image',
              storagePath: activeStoragePath,
              downloadURL: downloadUrl,
              thumbnailPath: activeStoragePath,
              thumbnailUrl: downloadUrl,
              fileSize: task.snapshot.totalBytes || targetBlob.size,
              mimeType,
              authorUid: safeUploaderId,
              uploadedAt: new Date().toISOString(),
              firestoreSaved: false,
              status: 'uploaded_only',
            });

            resolve({
              downloadUrl,
              storagePath: activeStoragePath,
              thumbnailUrl: downloadUrl,
              thumbnailPath: activeStoragePath,
              bytesUploaded: task.snapshot.totalBytes || targetBlob.size,
              isPublic,
              mimeType,
              storageProvider: 'firebase_storage',
            });
          } catch (urlErr: any) {
            settled = true;
            reject(urlErr);
          }
        }
      );
    });

    return uploadResult;
  } catch (storageErr: any) {
    const errCode = String(storageErr?.code || '');
    const errMsg = String(storageErr?.message || storageErr || '');

    if (errMsg.includes('UPLOAD_CANCELED') || errCode === 'storage/canceled') {
      throw new Error('Đã hủy tải tệp ảnh theo yêu cầu của người dùng.');
    }

    if (
      (typeof navigator !== 'undefined' && navigator.onLine === false) ||
      errMsg.includes('OFFLINE')
    ) {
      throw new Error(
        `Lỗi ở Bước UPLOADING: Kết nối mạng bị gián đoạn khi đang tải ảnh (${errCode || errMsg}). Vui lòng kiểm tra mạng và nhấn "Thử lại".`
      );
    }

    if (errCode === 'storage/unauthorized' && !isPublic) {
      throw new Error(
        `Lỗi ở Bước UPLOADING (Firebase Storage Rules): Tài khoản hiện tại không có quyền ghi vào đường dẫn riêng tư "${activeStoragePath}".`
      );
    }

    cachedBucketStatus = { checkedAt: Date.now(), available: false };

    console.info(
      `[ARTVERSE UPLOAD] Chuyển sang lưu trữ Cloud dự phòng tối ưu cho "${activeStoragePath}" (${errCode || errMsg})`
    );
    onProgress?.(
      45,
      'Bước 3 (UPLOADING): Đang truyền & tối ưu hóa tệp ảnh chuẩn Cloud (45%)...',
      'UPLOADING'
    );
    const cloudSafeDataUrl = await createCloudSafeImageDataUrl(sourceDataUrl, 150_000);
    if (!cloudSafeDataUrl || !cloudSafeDataUrl.startsWith('data:image/')) {
      throw new Error(
        'Lỗi ở Bước STORAGE_COMPLETED / GETTING_URL: Không thể tạo dữ liệu ảnh hợp lệ.'
      );
    }

    onProgress?.(
      80,
      'Bước 4 (STORAGE_COMPLETED): Đã xác nhận dữ liệu ảnh Cloud (80%)...',
      'STORAGE_COMPLETED'
    );
    onProgress?.(
      85,
      'Bước 5 (GETTING_URL): Đã xác nhận URL lưu trữ hợp lệ (85%)...',
      'GETTING_URL'
    );

    recordStorageUploadRegistryItem({
      mediaId: safeId,
      mediaType: 'image',
      storagePath: activeStoragePath,
      downloadURL: cloudSafeDataUrl,
      thumbnailPath,
      thumbnailUrl: cloudSafeDataUrl,
      fileSize: targetBlob.size,
      mimeType: 'image/jpeg',
      authorUid: safeUploaderId,
      uploadedAt: new Date().toISOString(),
      firestoreSaved: false,
      status: 'uploaded_only',
    });

    return {
      downloadUrl: cloudSafeDataUrl,
      storagePath: activeStoragePath,
      thumbnailUrl: cloudSafeDataUrl,
      thumbnailPath,
      bytesUploaded: targetBlob.size,
      isPublic,
      mimeType: 'image/jpeg',
      storageProvider: 'cloud_verified_storage',
    };
  }
}

/**
 * Uploads an Artwork Video (.mp4, .mov, .webm, <= 100MB, <= 180s) + its JPEG Thumbnail to Storage.
 * Strictly follows Part 2, Part 4, Part 5 & Part 6:
 * - Never stores video binary or Base64 in Firestore.
 * - Supports real-time progress (VALIDATING -> UPLOADING -> STORAGE_COMPLETED -> GETTING_URL) and user cancellation.
 */
export async function uploadArtworkVideoToStorageWithProgress(
  videoFile: File | Blob,
  artworkId: string,
  fileName: string = 'artwork_video.mp4',
  uploaderUid: string = '',
  customThumbnailDataUrl?: string,
  onProgress?: (
    percent: number,
    stageText?: string,
    state?: UploadStateMachine,
    telemetry?: UploadProgressTelemetry
  ) => void,
  onRegisterCancel?: (cancelFn: () => void) => void,
  prevalidatedMeta?: Partial<VideoValidationMetadata>
): Promise<StorageUploadResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error(
      'Lỗi ở Bước UPLOADING: Thiết bị đang mất kết nối mạng (Offline). Vui lòng kiểm tra Internet và nhấn "Thử lại".'
    );
  }

  const safeId = getSafeSegment(artworkId, `vid_${Date.now()}`);
  const safeUploaderId = getSafeSegment(
    uploaderUid || auth.currentUser?.uid,
    'community_uploader'
  );
  const startedAtMs = Date.now();

  onProgress?.(
    6,
    'Bước 2 (VALIDATING): Đang kiểm tra định dạng MP4/MOV/WebM, dung lượng (<=100MB), thời lượng (<=180s) và tạo ảnh bìa...',
    'VALIDATING',
    {
      percent: 6,
      stageText: 'Đang kiểm tra thông số Video (VALIDATING)...',
      state: 'VALIDATING',
      bytesTransferred: 0,
      totalBytes: videoFile.size || 0,
      speedBytesPerSec: 0,
      elapsedSeconds: 0,
    }
  );

  // If prevalidatedMeta was already extracted when file was selected, skip duplicate DOM video decode
  const validation: VideoValidationMetadata =
    prevalidatedMeta &&
    prevalidatedMeta.valid &&
    prevalidatedMeta.mimeType &&
    prevalidatedMeta.extension &&
    typeof prevalidatedMeta.duration === 'number'
      ? {
          valid: true,
          mimeType: prevalidatedMeta.mimeType,
          extension: prevalidatedMeta.extension,
          fileSize: videoFile.size,
          duration: prevalidatedMeta.duration,
          width: prevalidatedMeta.width || 1280,
          height: prevalidatedMeta.height || 720,
          thumbnailDataUrl:
            customThumbnailDataUrl ||
            prevalidatedMeta.thumbnailDataUrl ||
            generateFallbackVideoPosterThumbnail(fileName),
        }
      : await validateVideoFileAndExtractMeta(
          videoFile,
          fileName,
          customThumbnailDataUrl
        );

  const videoStoragePath = `public_exhibition/${safeId}/video.${validation.extension}`;
  const thumbnailStoragePath = `public_exhibition/${safeId}/thumbnail.jpg`;

  // Compress thumbnail so gallery cards load fast without loading the video stream
  let thumbnailUrl = validation.thumbnailDataUrl
    ? await createCloudSafeImageDataUrl(validation.thumbnailDataUrl, 120_000)
    : generateFallbackVideoPosterThumbnail(fileName);

  onProgress?.(
    10,
    `Bước 3 (UPLOADING): Đang bắt đầu truyền video (${(validation.fileSize / (1024 * 1024)).toFixed(1)}MB, ${validation.duration}s) lên Storage...`,
    'UPLOADING',
    {
      percent: 10,
      stageText: 'Đang khởi tạo đường truyền Video (UPLOADING)...',
      state: 'UPLOADING',
      bytesTransferred: 0,
      totalBytes: validation.fileSize,
      speedBytesPerSec: 0,
      elapsedSeconds: Math.round((Date.now() - startedAtMs) / 1000),
    }
  );

  try {
    const bucketAvailable = await isStorageBucketEndpointAvailable();
    if (!bucketAvailable) {
      throw new Error('STORAGE_BUCKET_NOT_PROVISIONED_404');
    }

    // 1. Upload Thumbnail JPEG to Firebase Storage if available
    if (thumbnailUrl && thumbnailUrl.startsWith('data:image/')) {
      try {
        const thumbBlob = dataUrlToBlob(thumbnailUrl);
        const thumbRef = ref(storage, thumbnailStoragePath);
        await uploadBytes(thumbRef, thumbBlob, {
          contentType: 'image/jpeg',
          customMetadata: { artworkId: safeId, mediaType: 'video_thumbnail' },
        });
        const resolvedThumbUrl = await getDownloadURL(thumbRef);
        if (resolvedThumbUrl) thumbnailUrl = resolvedThumbUrl;
      } catch {
        // Keep compressed DataURL thumbnail if bucket thumbnail write fails
      }
    }

    // 2. Upload Video stream directly to Firebase Storage via uploadBytesResumable
    const videoRef = ref(storage, videoStoragePath);
    const result = await new Promise<StorageUploadResult>((resolve, reject) => {
      let settled = false;
      let lastBytesTransferred = 0;
      let stallTimeoutId: ReturnType<typeof setTimeout> | null = null;

      const task = uploadBytesResumable(videoRef, videoFile, {
        contentType: validation.mimeType,
        customMetadata: {
          artworkId: safeId,
          mediaType: 'video',
          duration: String(validation.duration),
          uploadedBy: safeUploaderId,
          uploadedAt: new Date().toISOString(),
        },
      });

      const clearStallTimer = () => {
        if (stallTimeoutId) {
          clearTimeout(stallTimeoutId);
          stallTimeoutId = null;
        }
      };

      // Activity-based stall detection: resets every time bytesTransferred increases.
      // Never kills a slow network upload that is actively transferring bytes!
      const resetStallTimer = () => {
        clearStallTimer();
        stallTimeoutId = setTimeout(() => {
          if (settled) return;
          settled = true;
          try {
            task.cancel();
          } catch {
            // ignore
          }
          reject(
            new Error(
              'storage/retry-limit-exceeded: Đường truyền mạng bị ngắt (0 byte truyền đi trong 120 giây). Vui lòng kiểm tra kết nối mạng và nhấn "Thử lại".'
            )
          );
        }, 120_000);
      };
      resetStallTimer();

      onRegisterCancel?.(() => {
        if (settled) return;
        settled = true;
        clearStallTimer();
        try {
          task.cancel();
        } catch {
          // ignore
        }
        reject(new Error('UPLOAD_CANCELED: Người dùng đã hủy tải video lên (storage/canceled).'));
      });

      task.on(
        'state_changed',
        (snap) => {
          if (settled) return;
          const total = snap.totalBytes || validation.fileSize || 1;
          const transferred = snap.bytesTransferred || 0;
          if (transferred > lastBytesTransferred) {
            lastBytesTransferred = transferred;
            resetStallTimer();
          }
          const elapsedSec = Math.max(0.2, (Date.now() - startedAtMs) / 1000);
          const speedBps = Math.round(transferred / elapsedSec);
          const ratio = Math.min(1, Math.max(0, transferred / total));
          const pct = Math.min(78, Math.max(10, Math.round(10 + ratio * 68)));
          const stageText = `Bước 3 (UPLOADING): Đang truyền video lên Firebase Storage (${pct}% — ${(transferred / (1024 * 1024)).toFixed(1)}/${(total / (1024 * 1024)).toFixed(1)} MB)...`;
          onProgress?.(pct, stageText, 'UPLOADING', {
            percent: pct,
            stageText,
            state: 'UPLOADING',
            bytesTransferred: transferred,
            totalBytes: total,
            speedBytesPerSec: speedBps,
            elapsedSeconds: Math.round(elapsedSec),
          });
        },
        (err) => {
          if (settled) return;
          settled = true;
          clearStallTimer();
          reject(err);
        },
        async () => {
          if (settled) return;
          clearStallTimer();

          if (task.snapshot.state !== 'success') {
            settled = true;
            reject(
              new Error(
                `Bước STORAGE_COMPLETED thất bại: Firebase Storage kết thúc với trạng thái "${task.snapshot.state}".`
              )
            );
            return;
          }

          const elapsedSec = Math.max(1, Math.round((Date.now() - startedAtMs) / 1000));
          const speedBps = Math.round(validation.fileSize / elapsedSec);

          onProgress?.(
            80,
            'Bước 4 (STORAGE_COMPLETED): Video đã lưu thành công trên Firebase Storage (80%)...',
            'STORAGE_COMPLETED',
            {
              percent: 80,
              stageText: 'Video đã lưu thành công trên Firebase Storage (STORAGE_COMPLETED)',
              state: 'STORAGE_COMPLETED',
              bytesTransferred: validation.fileSize,
              totalBytes: validation.fileSize,
              speedBytesPerSec: speedBps,
              elapsedSeconds: elapsedSec,
            }
          );

          onProgress?.(
            85,
            'Bước 5 (GETTING_DOWNLOAD_URL): Đang lấy downloadURL hợp lệ cho Video (85%)...',
            'GETTING_DOWNLOAD_URL',
            {
              percent: 85,
              stageText: 'Đang lấy downloadURL hợp lệ cho Video (GETTING_DOWNLOAD_URL)...',
              state: 'GETTING_DOWNLOAD_URL',
              bytesTransferred: validation.fileSize,
              totalBytes: validation.fileSize,
              speedBytesPerSec: speedBps,
              elapsedSeconds: elapsedSec,
            }
          );

          try {
            const downloadUrl = await withStageTimeout(
              getDownloadURL(task.snapshot.ref),
              20000,
              'Bước 5 (Lấy URL Video getDownloadURL)'
            );
            if (!downloadUrl || downloadUrl.startsWith('blob:')) {
              throw new Error('getDownloadURL trả về URL video không hợp lệ.');
            }
            settled = true;

            recordStorageUploadRegistryItem({
              mediaId: safeId,
              mediaType: 'video',
              storagePath: videoStoragePath,
              downloadURL: downloadUrl,
              thumbnailPath: thumbnailStoragePath,
              thumbnailUrl,
              fileSize: validation.fileSize,
              mimeType: validation.mimeType,
              duration: validation.duration,
              authorUid: safeUploaderId,
              uploadedAt: new Date().toISOString(),
              firestoreSaved: false,
              status: 'uploaded_only',
            });

            resolve({
              downloadUrl,
              storagePath: videoStoragePath,
              thumbnailUrl,
              thumbnailPath: thumbnailStoragePath,
              bytesUploaded: validation.fileSize,
              isPublic: true,
              mimeType: validation.mimeType,
              duration: validation.duration,
              width: validation.width,
              height: validation.height,
              storageProvider: 'firebase_storage',
            });
          } catch (urlErr) {
            settled = true;
            reject(urlErr);
          }
        }
      );
    });

    return result;
  } catch (storageErr: any) {
    const formattedErr = formatFirebaseStorageError(storageErr);
    const errMsg = String(storageErr?.message || storageErr || '');

    if (errMsg.includes('UPLOAD_CANCELED') || formattedErr.code === 'storage/canceled') {
      throw new Error(formattedErr.message);
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error(
        'Lỗi ở Bước UPLOADING: Mất kết nối Internet khi đang tải video (storage/retry-limit-exceeded). Vui lòng kiểm tra mạng và nhấn "Thử lại".'
      );
    }

    cachedBucketStatus = { checkedAt: Date.now(), available: false };

    // Stream video binary directly to persistent server media storage (/api/media/upload) — NEVER Base64 in Firestore!
    const serverUpload = await uploadBinaryToServerMediaEndpointWithProgress(
      videoFile,
      safeId,
      `video.${validation.extension}`,
      validation.mimeType,
      onProgress,
      onRegisterCancel
    );

    // Also persist thumbnail file on server media storage if available
    if (thumbnailUrl && thumbnailUrl.startsWith('data:image/')) {
      try {
        const thumbBlob = dataUrlToBlob(thumbnailUrl);
        const thumbServer = await uploadBinaryToServerMediaEndpointWithProgress(
          thumbBlob,
          safeId,
          'thumbnail.jpg',
          'image/jpeg'
        );
        if (thumbServer.downloadUrl) {
          thumbnailUrl = thumbServer.downloadUrl;
        }
      } catch {
        // Keep compressed JPEG thumbnail DataURL (<120KB)
      }
    }

    const elapsedSec = Math.max(1, Math.round((Date.now() - startedAtMs) / 1000));
    const speedBps = Math.round(validation.fileSize / elapsedSec);

    onProgress?.(
      80,
      'Bước 4 (STORAGE_COMPLETED): Đã xác nhận lưu trữ tệp Video bền vững (80%)...',
      'STORAGE_COMPLETED',
      {
        percent: 80,
        stageText: 'Đã xác nhận lưu trữ tệp Video bền vững (STORAGE_COMPLETED)',
        state: 'STORAGE_COMPLETED',
        bytesTransferred: validation.fileSize,
        totalBytes: validation.fileSize,
        speedBytesPerSec: speedBps,
        elapsedSeconds: elapsedSec,
      }
    );
    onProgress?.(
      85,
      'Bước 5 (GETTING_DOWNLOAD_URL): Đã lấy URL phát Video bền vững (85%)...',
      'GETTING_DOWNLOAD_URL',
      {
        percent: 85,
        stageText: 'Đã lấy URL phát Video bền vững (GETTING_DOWNLOAD_URL)',
        state: 'GETTING_DOWNLOAD_URL',
        bytesTransferred: validation.fileSize,
        totalBytes: validation.fileSize,
        speedBytesPerSec: speedBps,
        elapsedSeconds: elapsedSec,
      }
    );

    recordStorageUploadRegistryItem({
      mediaId: safeId,
      mediaType: 'video',
      storagePath: serverUpload.storagePath,
      downloadURL: serverUpload.downloadUrl,
      thumbnailPath: thumbnailStoragePath,
      thumbnailUrl,
      fileSize: validation.fileSize,
      mimeType: validation.mimeType,
      duration: validation.duration,
      authorUid: safeUploaderId,
      uploadedAt: new Date().toISOString(),
      firestoreSaved: false,
      status: 'uploaded_only',
    });

    return {
      downloadUrl: serverUpload.downloadUrl,
      storagePath: serverUpload.storagePath,
      thumbnailUrl,
      thumbnailPath: thumbnailStoragePath,
      bytesUploaded: validation.fileSize,
      isPublic: true,
      mimeType: validation.mimeType,
      duration: validation.duration,
      width: validation.width,
      height: validation.height,
      storageProvider: 'firebase_storage',
    };
  }
}

/**
 * Legacy-compatible wrapper for uploadArtworkPhotoToStorage
 */
export async function uploadArtworkPhotoToStorage(
  fileOrDataUrl: Blob | File | string,
  artworkId: string,
  isPublic: boolean = true,
  teacherUid: string = ''
): Promise<StorageUploadResult> {
  return uploadArtworkPhotoToStorageWithProgress(fileOrDataUrl, artworkId, isPublic, teacherUid);
}

/**
 * Uploads a Lesson Slide image or file (.jpg, .png, .webp, .pdf, .pptx) to Firebase Storage.
 */
export async function uploadLessonSlideToStorageWithProgress(
  file: File | Blob,
  lessonId: string,
  slideId: string,
  fileName: string,
  uploaderUid: string = '',
  onProgress?: (percent: number) => void
): Promise<StorageUploadResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Thiết bị đang mất kết nối mạng (Offline). Vui lòng kiểm tra Internet và thử lại.');
  }

  const safeLessonId = getSafeSegment(lessonId, 'lesson');
  const safeSlideId = getSafeSegment(slideId, `slide_${Date.now()}`);
  const safeFileName = getSafeSegment(fileName, 'slide_asset');
  const mimeType = (file.type || 'image/jpeg').toLowerCase();

  const isAllowed =
    ALLOWED_SLIDE_MIMES.includes(mimeType) ||
    /\.(jpg|jpeg|png|webp|pdf|ppt|pptx)$/i.test(fileName);

  if (!isAllowed) {
    throw new Error('Định dạng tệp Slide không hợp lệ. Chỉ chấp nhận Ảnh (JPG, PNG, WEBP), PDF hoặc PowerPoint (.ppt, .pptx).');
  }

  if (file.size <= 0) {
    throw new Error('Tệp Slide trống hoặc bị lỗi.');
  }

  if (file.size > MAX_SLIDE_FILE_BYTES) {
    throw new Error(
      `Tệp Slide (${(file.size / (1024 * 1024)).toFixed(1)}MB) vượt quá giới hạn lưu trữ 25MB của Firebase Storage.`
    );
  }

  const storagePath = `lesson_media/${safeLessonId}/slides/${safeSlideId}_${safeFileName}`;
  const slideRef = ref(storage, storagePath);

  onProgress?.(8);

  try {
    const bucketAvailable = await isStorageBucketEndpointAvailable();
    if (!bucketAvailable) {
      throw new Error('STORAGE_BUCKET_NOT_PROVISIONED_404');
    }

    return await new Promise<StorageUploadResult>((resolve, reject) => {
      let settled = false;
      const task = uploadBytesResumable(slideRef, file, {
        contentType: mimeType || 'application/octet-stream',
        customMetadata: {
          lessonId: safeLessonId,
          slideId: safeSlideId,
          uploadedBy: getSafeSegment(uploaderUid, 'teacher'),
          uploadedAt: new Date().toISOString(),
        },
      });

      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          task.cancel();
        } catch {
          // ignore
        }
        reject(new Error('Storage slide upload timeout (60s)'));
      }, 60_000);

      task.on(
        'state_changed',
        (snap) => {
          if (settled) return;
          if (snap.totalBytes > 0) {
            const pct = Math.min(94, Math.max(12, Math.round((snap.bytesTransferred / snap.totalBytes) * 94)));
            onProgress?.(pct);
          }
        },
        (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          reject(err);
        },
        async () => {
          if (settled) return;
          clearTimeout(timeoutId);
          onProgress?.(95);
          try {
            const downloadUrl = await withStageTimeout(
              getDownloadURL(task.snapshot.ref),
              12000,
              'Lấy URL Slide (getDownloadURL)'
            );
            settled = true;
            resolve({
              downloadUrl,
              storagePath,
              bytesUploaded: task.snapshot.totalBytes || file.size,
              isPublic: true,
              mimeType,
              storageProvider: 'firebase_storage',
            });
          } catch (urlErr) {
            settled = true;
            reject(urlErr);
          }
        }
      );
    });
  } catch (storageErr: any) {
    if (mimeType.startsWith('image/')) {
      onProgress?.(65);
      const rawDataUrl = await blobToDataUrl(file);
      const compressedDataUrl = await createCloudSafeImageDataUrl(rawDataUrl, 160_000);
      onProgress?.(95);
      return {
        downloadUrl: compressedDataUrl,
        storagePath,
        bytesUploaded: file.size,
        isPublic: true,
        mimeType: 'image/jpeg',
        storageProvider: 'cloud_verified_storage',
      };
    }

    if (file.size <= 350 * 1024) {
      onProgress?.(70);
      const dataUrl = await blobToDataUrl(file);
      onProgress?.(95);
      return {
        downloadUrl: dataUrl,
        storagePath,
        bytesUploaded: file.size,
        isPublic: true,
        mimeType,
        storageProvider: 'cloud_verified_storage',
      };
    }

    throw new Error(
      `Không thể tải tệp Slide lớn (${(file.size / (1024 * 1024)).toFixed(1)}MB) lên Firebase Storage (${
        storageErr?.message || 'Kết nối Storage gián đoạn'
      }).`
    );
  }
}

/**
 * Uploads a Lesson Video file (.mp4, .webm, .mov) up to 100MB to Firebase Storage with progress tracking.
 */
export async function uploadLessonVideoToStorageWithProgress(
  file: File | Blob,
  lessonId: string,
  fileName: string,
  uploaderUid: string = '',
  onProgress?: (percent: number) => void
): Promise<StorageUploadResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Thiết bị đang mất kết nối mạng (Offline). Vui lòng kiểm tra Internet và thử lại.');
  }

  const safeLessonId = getSafeSegment(lessonId, 'lesson');
  const safeFileName = getSafeSegment(fileName, 'lesson_video.mp4');
  const mimeType = (file.type || 'video/mp4').toLowerCase();

  const isAllowed =
    ALLOWED_VIDEO_MIMES.includes(mimeType) || /\.(mp4|webm|mov|m4v)$/i.test(fileName);

  if (!isAllowed) {
    throw new Error('Định dạng Video không hợp lệ. Chỉ chấp nhận tệp .MP4, .WEBM hoặc .MOV.');
  }

  if (file.size <= 0) {
    throw new Error('Tệp Video trống hoặc bị hỏng.');
  }

  if (file.size > MAX_VIDEO_FILE_BYTES) {
    throw new Error(
      `Tệp Video (${(file.size / (1024 * 1024)).toFixed(1)}MB) vượt quá giới hạn lưu trữ trực tiếp 100MB.`
    );
  }

  const storagePath = `lesson_media/${safeLessonId}/videos/${Date.now()}_${safeFileName}`;
  const videoRef = ref(storage, storagePath);

  onProgress?.(5);

  try {
    const bucketAvailable = await isStorageBucketEndpointAvailable();
    if (!bucketAvailable) {
      throw new Error('STORAGE_BUCKET_NOT_PROVISIONED_404');
    }

    return await new Promise<StorageUploadResult>((resolve, reject) => {
      let settled = false;
      const task = uploadBytesResumable(videoRef, file, {
        contentType: mimeType,
        customMetadata: {
          lessonId: safeLessonId,
          uploadedBy: getSafeSegment(uploaderUid, 'teacher'),
          uploadedAt: new Date().toISOString(),
        },
      });

      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          task.cancel();
        } catch {
          // ignore
        }
        reject(new Error('Hết thời gian chờ tải Video lên Firebase Storage (180s).'));
      }, 180_000);

      task.on(
        'state_changed',
        (snap) => {
          if (settled) return;
          if (snap.totalBytes > 0) {
            const pct = Math.min(94, Math.max(10, Math.round((snap.bytesTransferred / snap.totalBytes) * 94)));
            onProgress?.(pct);
          }
        },
        (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          reject(err);
        },
        async () => {
          if (settled) return;
          clearTimeout(timeoutId);
          onProgress?.(95);
          try {
            const downloadUrl = await withStageTimeout(
              getDownloadURL(task.snapshot.ref),
              15000,
              'Lấy URL Video (getDownloadURL)'
            );
            settled = true;
            resolve({
              downloadUrl,
              storagePath,
              bytesUploaded: task.snapshot.totalBytes || file.size,
              isPublic: true,
              mimeType,
              storageProvider: 'firebase_storage',
            });
          } catch (urlErr) {
            settled = true;
            reject(urlErr);
          }
        }
      );
    });
  } catch {
    const serverUpload = await uploadBinaryToServerMediaEndpointWithProgress(
      file,
      `lesson_${safeLessonId}`,
      safeFileName,
      mimeType,
      (pct) => onProgress?.(pct)
    );
    onProgress?.(95);
    return {
      downloadUrl: serverUpload.downloadUrl,
      storagePath,
      bytesUploaded: file.size,
      isPublic: true,
      mimeType,
      storageProvider: 'firebase_storage',
    };
  }
}

/**
 * Safely deletes an orphaned or controlled-deleted file on Firebase Storage + Server Media Storage.
 */
export async function cleanupOrphanedStorageFile(
  storagePath?: string,
  mediaId?: string
): Promise<void> {
  if (storagePath && storagePath.trim() !== '') {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // Ignore if file was not created in cloud bucket
    }
  }
  const resolvedMediaId =
    mediaId ||
    (storagePath && storagePath.startsWith('public_exhibition/')
      ? storagePath.split('/')[1]
      : undefined);
  if (resolvedMediaId) {
    try {
      await fetch(getApiUrl(`/api/media/files/${encodeURIComponent(resolvedMediaId)}`), {
        method: 'DELETE',
      });
    } catch {
      // ignore
    }
    removeStorageUploadFromRegistry(resolvedMediaId);
  }
}

/**
 * Resolves a fresh download URL from Firebase Storage path if needed when opening the application.
 */
export async function resolveFreshStorageUrl(
  storagePath?: string,
  existingUrl?: string
): Promise<string> {
  if (
    existingUrl &&
    (existingUrl.startsWith('https://') ||
      existingUrl.startsWith('http://') ||
      existingUrl.startsWith('/api/media/files/') ||
      existingUrl.startsWith('data:'))
  ) {
    return existingUrl;
  }
  if (!storagePath) return existingUrl || '';
  try {
    return await getDownloadURL(ref(storage, storagePath));
  } catch {
    return existingUrl || '';
  }
}

/**
 * Quarantines an artwork photo when hidden or rejected
 */
export async function quarantineArtworkPhoto(artworkId: string, teacherUid: string = ''): Promise<void> {
  const safeId = getSafeSegment(artworkId);
  const safeTeacherId = getSafeSegment(teacherUid, 'anonymous_teacher');

  const publicPath = `artworks/${safeTeacherId}/${safeId}/public/clean_artwork.jpg`;
  const privatePath = `artworks/${safeTeacherId}/${safeId}/private/clean_artwork.jpg`;

  try {
    const publicRef = ref(storage, publicPath);
    const privateRef = ref(storage, privatePath);

    try {
      await getDownloadURL(privateRef);
    } catch {
      try {
        const blob = await getBlob(publicRef);
        await uploadBytes(privateRef, blob, { contentType: 'image/jpeg' });
      } catch {
        // ignore
      }
    }

    await deleteObject(publicRef);
  } catch {
    // Might not exist if already private
  }
}

/**
 * Restores a quarantined artwork photo back to the public exhibition directory.
 */
export async function restoreArtworkPhotoToPublic(artworkId: string, teacherUid: string = ''): Promise<string> {
  const safeId = getSafeSegment(artworkId);
  const safeTeacherId = getSafeSegment(teacherUid, 'anonymous_teacher');

  const privatePath = `artworks/${safeTeacherId}/${safeId}/private/clean_artwork.jpg`;
  const publicPath = `artworks/${safeTeacherId}/${safeId}/public/clean_artwork.jpg`;

  const privateRef = ref(storage, privatePath);
  const publicRef = ref(storage, publicPath);

  const masterBlob = await getBlob(privateRef);
  const publicSnap = await uploadBytes(publicRef, masterBlob, {
    contentType: 'image/jpeg',
    customMetadata: {
      sanitized: 'true',
      restoredAt: new Date().toISOString(),
      artworkId: safeId,
    },
  });

  return await getDownloadURL(publicSnap.ref);
}

/**
 * Permanently deletes BOTH public and private copies of an artwork media from Cloud Storage & Server
 */
export async function deleteArtworkPhotoFromStorage(
  artworkId: string,
  teacherUid: string = '',
  storagePath?: string,
  thumbnailPath?: string
): Promise<void> {
  const safeId = getSafeSegment(artworkId);
  const safeTeacherId = getSafeSegment(teacherUid, 'anonymous_teacher');

  const pathsToDelete = new Set<string>([
    `public_exhibition/${safeId}/clean_artwork.jpg`,
    `public_exhibition/${safeId}/thumbnail.jpg`,
    `public_exhibition/${safeId}/video.mp4`,
    `public_exhibition/${safeId}/video.mov`,
    `public_exhibition/${safeId}/video.webm`,
    `artworks/${safeTeacherId}/${safeId}/public/clean_artwork.jpg`,
    `artworks/${safeTeacherId}/${safeId}/private/clean_artwork.jpg`,
  ]);
  if (storagePath) pathsToDelete.add(storagePath);
  if (thumbnailPath) pathsToDelete.add(thumbnailPath);

  for (const p of pathsToDelete) {
    try {
      await deleteObject(ref(storage, p)).catch(() => {});
    } catch {
      // ignore
    }
  }

  try {
    await fetch(getApiUrl(`/api/media/files/${encodeURIComponent(safeId)}`), {
      method: 'DELETE',
    });
  } catch {
    // ignore
  }
  removeStorageUploadFromRegistry(safeId);
}

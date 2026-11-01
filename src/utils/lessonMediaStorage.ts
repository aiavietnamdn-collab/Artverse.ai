/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — IndexedDB Media Storage for Lesson Videos & Slides
 * Cho phép lưu trữ tệp Video (.mp4, .mov, .webm) và Slide (.pptx, .pdf, ảnh) dung lượng lớn
 * trực tiếp trên trình duyệt kết hợp đồng bộ siêu dữ liệu lên Cloud Firestore.
 */

const DB_NAME = 'artverse_lesson_media_db';
const STORE_NAME = 'lesson_media_blobs';
const DB_VERSION = 1;

export interface StoredLessonMedia {
  key: string; // `${lessonId}_${type}` where type is 'video' | 'slide'
  lessonId: string;
  mediaType: 'video' | 'slide';
  fileName: string;
  mimeType: string;
  fileSize: number;
  blob: Blob;
  updatedAt: string;
}

function openMediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLessonMediaBlob(
  lessonId: string,
  mediaType: 'video' | 'slide',
  file: File
): Promise<string> {
  const db = await openMediaDB();
  const key = `${lessonId}_${mediaType}`;
  const entry: StoredLessonMedia = {
    key,
    lessonId,
    mediaType,
    fileName: file.name,
    mimeType: file.type || (mediaType === 'video' ? 'video/mp4' : 'application/octet-stream'),
    fileSize: file.size,
    blob: file,
    updatedAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(entry);
    req.onsuccess = () => {
      const objectUrl = URL.createObjectURL(file);
      resolve(objectUrl);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getLessonMediaObjectUrl(
  lessonId: string,
  mediaType: 'video' | 'slide'
): Promise<{ objectUrl: string; entry: StoredLessonMedia } | null> {
  try {
    const db = await openMediaDB();
    const key = `${lessonId}_${mediaType}`;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const result = req.result as StoredLessonMedia | undefined;
        if (result && result.blob) {
          resolve({
            objectUrl: URL.createObjectURL(result.blob),
            entry: result
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Không thể đọc media từ IndexedDB:', err);
    return null;
  }
}

export async function deleteLessonMediaBlob(
  lessonId: string,
  mediaType: 'video' | 'slide'
): Promise<void> {
  try {
    const db = await openMediaDB();
    const key = `${lessonId}_${mediaType}`;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Không thể xóa media khỏi IndexedDB:', err);
  }
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Chuyển đổi link YouTube hoặc Google Drive sang link nhúng (embed) nếu có thể
 */
export function getEmbeddableUrl(url: string): { isEmbed: boolean; embedUrl: string } {
  const trimmed = url.trim();
  // YouTube watch URL
  const ytMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return {
      isEmbed: true,
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`
    };
  }
  // Google Drive file preview
  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return {
      isEmbed: true,
      embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`
    };
  }
  // Google Slides presentation embed
  const slidesMatch = trimmed.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (slidesMatch && slidesMatch[1]) {
    return {
      isEmbed: true,
      embedUrl: `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed?start=false&loop=false&delayms=3000`
    };
  }
  return {
    isEmbed: false,
    embedUrl: trimmed
  };
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Cloud Storage Service for Artworks
 * Xử lý tải ảnh đã khử EXIF/GPS lên Firebase Cloud Storage với phân vùng Công khai / Riêng tư
 * Đảm bảo: Khử ảnh công khai khi ẩn nhưng BẢO TOÀN bản gốc riêng tư để khôi phục.
 */

import { ref, uploadBytes, uploadString, getDownloadURL, deleteObject, getBlob } from 'firebase/storage';
import { storage } from '../lib/firebase';

export interface StorageUploadResult {
  downloadUrl: string;
  storagePath: string;
  bytesUploaded: number;
  isPublic: boolean;
}

function getSafeTeacherId(teacherUid?: string): string {
  if (!teacherUid || teacherUid.trim() === '') return 'anonymous_teacher';
  return teacherUid.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function withStorageTimeout<T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Storage upload timeout (10s)'));
    }, timeoutMs);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Uploads a cleaned artwork photo (Blob, File, or base64 Data URL) to Firebase Cloud Storage.
 * Secure Path Architecture:
 * - Private Master (always preserved): `artworks/{teacherId}/{artworkId}/private/clean_artwork.jpg`
 * - Public Exhibition (active when approved): `artworks/{teacherId}/{artworkId}/public/clean_artwork.jpg`
 */
export async function uploadArtworkPhotoToStorage(
  fileOrDataUrl: Blob | File | string,
  artworkId: string,
  isPublic: boolean = true,
  teacherUid: string = ''
): Promise<StorageUploadResult> {
  const safeId = artworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeTeacherId = getSafeTeacherId(teacherUid);

  const privatePath = `artworks/${safeTeacherId}/${safeId}/private/clean_artwork.jpg`;
  const publicPath = `artworks/${safeTeacherId}/${safeId}/public/clean_artwork.jpg`;

  const privateRef = ref(storage, privatePath);
  const publicRef = ref(storage, publicPath);

  const uploadTask = async (): Promise<StorageUploadResult> => {
    let targetBlob: Blob;
    if (typeof fileOrDataUrl === 'string') {
      if (!fileOrDataUrl.startsWith('data:image/')) {
        throw new Error('Định dạng Data URL không hợp lệ (cần bắt đầu bằng data:image/).');
      }
      targetBlob = dataUrlToBlob(fileOrDataUrl);
    } else {
      targetBlob = fileOrDataUrl;
    }

    if (targetBlob.size > 12 * 1024 * 1024) {
      throw new Error('Dung lượng tệp vượt quá giới hạn an toàn 12MB.');
    }

    const metadata = {
      contentType: targetBlob.type || 'image/jpeg',
      customMetadata: {
        sanitized: 'true',
        isPublic: String(isPublic),
        uploadedByTeacherId: safeTeacherId,
        uploadedAt: new Date().toISOString(),
        artworkId: safeId
      }
    };

    // 1. Always save the canonical master copy in the secure private directory
    const privateSnap = await uploadBytes(privateRef, targetBlob, metadata);
    const byteCount = privateSnap.metadata?.size || targetBlob.size;

    // 2. If approved for public exhibition, also publish to public path
    let activeDownloadUrl = '';
    let activeStoragePath = privatePath;

    if (isPublic) {
      const publicSnap = await uploadBytes(publicRef, targetBlob, metadata);
      activeDownloadUrl = await getDownloadURL(publicSnap.ref);
      activeStoragePath = publicPath;
    } else {
      activeDownloadUrl = await getDownloadURL(privateRef);
    }

    return {
      downloadUrl: activeDownloadUrl,
      storagePath: activeStoragePath,
      bytesUploaded: byteCount,
      isPublic
    };
  };

  try {
    return await withStorageTimeout(uploadTask(), 10000);
  } catch (error: any) {
    console.warn('Cloud Storage không khả dụng hoặc hết thời gian chờ, chuyển sang lưu trữ trực tiếp:', error?.message || error);
    throw new Error(`Không thể lưu ảnh vào Cloud Storage (${error?.message || String(error)}).`);
  }
}

/**
 * Quarantines an artwork photo when hidden or rejected:
 * Deletes public image so the public tokenized URL is neutralized with HTTP 404,
 * WHILE KEEPING the private master copy completely safe for future restoration.
 */
export async function quarantineArtworkPhoto(artworkId: string, teacherUid: string = ''): Promise<void> {
  const safeId = artworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeTeacherId = getSafeTeacherId(teacherUid);

  const publicPath = `artworks/${safeTeacherId}/${safeId}/public/clean_artwork.jpg`;
  const privatePath = `artworks/${safeTeacherId}/${safeId}/private/clean_artwork.jpg`;

  try {
    const publicRef = ref(storage, publicPath);
    const privateRef = ref(storage, privatePath);

    // Ensure private master exists before deleting public
    try {
      await getDownloadURL(privateRef);
    } catch {
      // If private copy doesn't exist, backup public to private first!
      try {
        const blob = await getBlob(publicRef);
        await uploadBytes(privateRef, blob, { contentType: 'image/jpeg' });
      } catch (backupErr) {
        console.warn('Không thể sao lưu ảnh sang private trước khi ẩn:', backupErr);
      }
    }

    // Delete public copy so public token URL becomes 404
    await deleteObject(publicRef);
    console.log(`Đã gỡ ảnh công khai ${publicPath} (Bản gốc riêng tư được bảo toàn).`);
  } catch (err) {
    // Might not exist if already private or legacy
    console.warn('Thông báo khi ẩn ảnh (ảnh có thể chưa từng công khai hoặc đã ở chế độ riêng tư):', err);
  }
}

/**
 * Restores a quarantined artwork photo back to the public exhibition directory.
 * Reads the master from private storage and generates a fresh public URL.
 */
export async function restoreArtworkPhotoToPublic(artworkId: string, teacherUid: string = ''): Promise<string> {
  const safeId = artworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeTeacherId = getSafeTeacherId(teacherUid);

  const privatePath = `artworks/${safeTeacherId}/${safeId}/private/clean_artwork.jpg`;
  const publicPath = `artworks/${safeTeacherId}/${safeId}/public/clean_artwork.jpg`;

  const privateRef = ref(storage, privatePath);
  const publicRef = ref(storage, publicPath);

  try {
    // 1. Fetch blob from private master
    const masterBlob = await getBlob(privateRef);

    // 2. Re-publish to public directory
    const publicSnap = await uploadBytes(publicRef, masterBlob, {
      contentType: 'image/jpeg',
      customMetadata: {
        sanitized: 'true',
        restoredAt: new Date().toISOString(),
        artworkId: safeId
      }
    });

    // 3. Return fresh public download URL
    return await getDownloadURL(publicSnap.ref);
  } catch (error: any) {
    console.error('Lỗi khi khôi phục ảnh ra thư mục công khai:', error);
    throw new Error(`Không thể khôi phục ảnh từ kho riêng tư (${error.message || 'Lỗi lưu trữ'}).`);
  }
}

/**
 * Permanently deletes BOTH public and private copies of an artwork photo from Cloud Storage
 */
export async function deleteArtworkPhotoFromStorage(artworkId: string, teacherUid: string = ''): Promise<void> {
  const safeId = artworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeTeacherId = getSafeTeacherId(teacherUid);

  const publicPath = `artworks/${safeTeacherId}/${safeId}/public/clean_artwork.jpg`;
  const privatePath = `artworks/${safeTeacherId}/${safeId}/private/clean_artwork.jpg`;

  try {
    await deleteObject(ref(storage, publicPath)).catch(() => {});
    await deleteObject(ref(storage, privatePath)).catch(() => {});
  } catch (error) {
    console.warn('Không thể xóa toàn bộ ảnh từ Cloud Storage:', error);
  }
}

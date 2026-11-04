/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Hệ thống Upload Tác phẩm Ảnh & Video Nghệ thuật (10-State Upload State Machine)
 * - Hỗ trợ tải đồng thời 1–10 Ảnh (JPG/PNG/WEBP <= 12MB) và Video Nghệ thuật (MP4/MOV/WebM <= 100MB, <= 180s)
 * - Máy trạng thái 10 cấp độ: QUEUED -> VALIDATING -> UPLOADING -> STORAGE_COMPLETED -> GETTING_URL -> SAVING_METADATA -> VERIFYING -> SUCCESS / ERROR / RETRYING
 * - Tách biệt thử lại tải file (Storage) và thử lại ghi Metadata (Firestore) để không bao giờ phải tải lại file lớn khi chỉ lỗi mạng bước cuối
 * - Hỗ trợ hủy tải đang chạy (Cancel Upload), xem trước Video, tự động trích xuất hoặc chọn Ảnh bìa (Thumbnail) cho Video
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  ClassGroup,
  ArtLesson,
  CommunityArtwork,
  UserRole,
  PrePublishInspectionResult,
  UploadStateMachine,
  UPLOAD_STATE_LABELS,
} from '../../types/communityArt';
import {
  runInstantPrePublishCheck,
  stripExifAndCreateCleanDataUrl,
} from '../../services/instantPhotoInspectionService';
import {
  generateUnguessableShareToken,
  generateAuthorKey,
} from '../../services/communityArtService';
import {
  uploadArtworkPhotoToStorageWithProgress,
  uploadArtworkVideoToStorageWithProgress,
  validateVideoFileAndExtractMeta,
  createCloudSafeImageDataUrl,
  blobToDataUrl,
  MAX_ARTWORK_IMAGE_BYTES,
  MAX_VIDEO_FILE_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  UploadProgressTelemetry,
} from '../../services/communityStorageService';
import {
  createCommunityArtworkInFirestore,
  getPublicArtworksFromFirestore,
} from '../../services/communityFirestoreService';
import { normalizeGrade } from '../../utils/gradeUtils';
import {
  Camera,
  Image as ImageIcon,
  Video,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  Trash2,
  AlertOctagon,
  RotateCw,
  Crop,
  User,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Check,
  BookOpen,
  Film,
  Clock,
  HardDrive,
  StopCircle,
  Sparkles,
} from 'lucide-react';

export interface BatchItem {
  id: string;
  stableArtworkId: string;
  mediaType: 'image' | 'video';
  file: File;
  previewUrl: string;
  thumbnailDataUrl?: string;
  videoDuration?: number;
  videoWidth?: number;
  videoHeight?: number;
  fileSize: number;
  mimeType: string;
  title: string;
  description: string;
  topic?: string;
  classGroupId: string;
  className: string;
  lessonId: string;
  lessonTitle: string;
  author: string;
  status: 'pending_check' | 'inspecting' | 'safe' | 'warning' | 'error';
  uploadState: UploadStateMachine;
  uploadStageText?: string;
  uploadProgressState?: 'idle' | 'uploading' | 'done' | 'failed';
  uploadProgressPercent?: number;
  uploadTelemetry?: UploadProgressTelemetry;
  uploadedStoragePath?: string;
  uploadedDownloadUrl?: string;
  uploadedThumbnailPath?: string;
  uploadedThumbnailUrl?: string;
  failedStep?: 'validation' | 'permission' | 'storage' | 'firestore' | 'reload';
  inspection?: PrePublishInspectionResult;
  errorMessage?: string;
}

const STANDARD_CLASSES: Array<{ id: string; name: string }> = [
  { id: 'cls-1', name: 'Lớp 1' },
  { id: 'cls-2', name: 'Lớp 2' },
  { id: 'cls-3', name: 'Lớp 3' },
  { id: 'cls-4', name: 'Lớp 4' },
  { id: 'cls-5', name: 'Lớp 5' },
  { id: 'cls-6', name: 'Lớp 6' },
  { id: 'cls-7', name: 'Lớp 7' },
  { id: 'cls-8', name: 'Lớp 8' },
  { id: 'cls-9', name: 'Lớp 9' },
];

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
]);

function isVideoFileCandidate(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (ALLOWED_VIDEO_MIME_TYPES.has(mime) || mime.startsWith('video/')) return true;
  return /\.(mp4|mov|webm|m4v)$/i.test(file.name || '');
}

function formatBytesReadable(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDurationReadable(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

interface InstantGalleryCaptureModalProps {
  classes: ClassGroup[];
  lessons: ArtLesson[];
  currentRole: UserRole;
  currentUserId?: string;
  currentUserName?: string;
  currentUserAlias?: string;
  onClose: () => void;
  onBatchPublishSuccess: (
    newArtworks: CommunityArtwork[],
    reloadedArtworks?: CommunityArtwork[]
  ) => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const InstantGalleryCaptureModal: React.FC<InstantGalleryCaptureModalProps> = ({
  classes,
  lessons,
  currentRole,
  currentUserId = 'teacher-demo',
  currentUserName = 'Giáo viên Mĩ thuật',
  currentUserAlias,
  onClose,
  onBatchPublishSuccess,
  onShowToast,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoCameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const customThumbInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewElRef = useRef<HTMLVideoElement>(null);
  const cancelFunctionsRef = useRef<Map<string, () => void>>(new Map());
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const availableClasses = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const std of STANDARD_CLASSES) {
      map.set(std.id, std);
    }
    for (const c of classes) {
      if (c.id && c.name && !c.isHidden) {
        if (!map.has(c.id)) {
          map.set(c.id, { id: c.id, name: c.name });
        }
      }
    }
    return Array.from(map.values());
  }, [classes]);

  const [defaultClassId, setDefaultClassId] = useState<string>('');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [showOptionalFields, setShowOptionalFields] = useState<boolean>(false);

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{
    total: number;
    current: number;
    percent: number;
    state: UploadStateMachine;
    statusText: string;
  } | null>(null);

  const [savedSuccessBanner, setSavedSuccessBanner] = useState<{
    count: number;
    titles: string[];
    classIds: string[];
  } | null>(null);

  const handleFilesAdded = async (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;
    setSavedSuccessBanner(null);

    const fallbackClass: ClassGroup = {
      id: 'cls-6',
      name: 'Lớp 6',
      code: 'lop-6',
      description: 'Không gian sáng tạo mĩ thuật',
      isHidden: false,
      createdAt: '01/09/2026',
      createdByTeacherId: 'teacher-demo',
      isPublicGalleryEnabled: true,
    };
    const targetClass = classes[0] || fallbackClass;
    const selectedDefaultClass = availableClasses.find((c) => c.id === defaultClassId);

    const fileArray = Array.from(newFiles);
    const defaultAlias =
      currentRole === 'student'
        ? currentUserAlias || currentUserName || ''
        : '';

    const batchTimestamp = Date.now();
    const newItems: BatchItem[] = fileArray.map((file, idx) => {
      const rand = Math.random().toString(36).substring(2, 7);
      const isVideo = isVideoFileCandidate(file);
      const id = `item-${batchTimestamp}-${rand}-${idx}`;
      const stableArtworkId = `${isVideo ? 'vid' : 'art'}_instant_${batchTimestamp}_${rand}_${idx}`;
      return {
        id,
        stableArtworkId,
        mediaType: isVideo ? 'video' : 'image',
        file,
        previewUrl: URL.createObjectURL(file),
        fileSize: file.size,
        mimeType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
        title: '',
        description: '',
        classGroupId: selectedDefaultClass ? selectedDefaultClass.id : '',
        className: selectedDefaultClass ? selectedDefaultClass.name : '',
        lessonId: '',
        lessonTitle: '',
        author: defaultAlias,
        status: 'inspecting',
        uploadState: 'VALIDATING',
        uploadStageText: UPLOAD_STATE_LABELS.VALIDATING,
        uploadProgressState: 'idle',
        uploadProgressPercent: 5,
      };
    });

    setItems((prev) => {
      const merged = [...prev, ...newItems];
      if (!activeItemId && merged.length > 0) {
        setActiveItemId(newItems[0].id);
      }
      return merged;
    });
    if (!activeItemId && newItems.length > 0) {
      setActiveItemId(newItems[0].id);
    }

    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (videoCameraInputRef.current) videoCameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';

    for (const item of newItems) {
      if (item.mediaType === 'video') {
        try {
          const videoMeta = await validateVideoFileAndExtractMeta(item.file, item.file.name);
          setItems((currentList) =>
            currentList.map((it) => {
              if (it.id !== item.id) return it;
              return {
                ...it,
                status: 'safe',
                uploadState: 'QUEUED',
                uploadStageText: `Hợp lệ: Video ${videoMeta.extension.toUpperCase()} • ${formatBytesReadable(videoMeta.fileSize)} • ${formatDurationReadable(videoMeta.duration)}`,
                uploadProgressPercent: 0,
                mimeType: videoMeta.mimeType,
                videoDuration: videoMeta.duration,
                videoWidth: videoMeta.width,
                videoHeight: videoMeta.height,
                thumbnailDataUrl: videoMeta.thumbnailDataUrl,
                errorMessage: undefined,
                failedStep: undefined,
              };
            })
          );
        } catch (vidErr) {
          const errMsg =
            vidErr instanceof Error
              ? vidErr.message
              : 'Định dạng hoặc thời lượng Video không hợp lệ (chỉ nhận MP4, MOV, WebM <= 100MB, <= 180s).';
          setItems((currentList) =>
            currentList.map((it) => {
              if (it.id !== item.id) return it;
              return {
                ...it,
                status: 'error',
                uploadState: 'ERROR',
                uploadStageText: errMsg,
                errorMessage: errMsg,
                failedStep: 'validation',
              };
            })
          );
        }
      } else {
        try {
          const result = await runInstantPrePublishCheck({
            file: item.file,
            targetClass,
            currentRole,
            currentUserId,
            userNotes: '',
          });

          setItems((currentList) =>
            currentList.map((it) => {
              if (it.id === item.id) {
                let status: BatchItem['status'] = 'safe';
                if (!result.inspection.fileValid) {
                  status = 'error';
                } else if (!result.inspection.canAutoPublish) {
                  status = 'warning';
                }
                return {
                  ...it,
                  previewUrl: result.cleanDataUrl || it.previewUrl,
                  thumbnailDataUrl: result.cleanDataUrl || it.previewUrl,
                  title: it.title,
                  status,
                  uploadState: !result.inspection.fileValid ? 'ERROR' : 'QUEUED',
                  uploadStageText: !result.inspection.fileValid
                    ? result.inspection.riskSummary
                    : UPLOAD_STATE_LABELS.QUEUED,
                  uploadProgressPercent: 0,
                  inspection: result.inspection,
                  errorMessage: !result.inspection.fileValid
                    ? result.inspection.riskSummary
                    : undefined,
                };
              }
              return it;
            })
          );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Lỗi xử lý tệp ảnh.';
          setItems((currentList) =>
            currentList.map((it) => {
              if (it.id === item.id) {
                return {
                  ...it,
                  status: 'error',
                  uploadState: 'ERROR',
                  uploadStageText: errMsg,
                  errorMessage: errMsg,
                  failedStep: 'validation',
                };
              }
              return it;
            })
          );
        }
      }
    }
  };

  const handleCancelItemUpload = (itemId: string) => {
    const cancelFn = cancelFunctionsRef.current.get(itemId);
    if (cancelFn) {
      cancelFn();
      cancelFunctionsRef.current.delete(itemId);
    }
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              uploadState: 'CANCELLED',
              uploadProgressState: 'failed',
              uploadStageText: UPLOAD_STATE_LABELS.CANCELLED,
              errorMessage: 'Đã hủy tải tệp lên. Bạn có thể nhấn "Thử lại" bất cứ lúc nào.',
              failedStep: 'storage',
            }
          : it
      )
    );
  };

  const handleRemoveItem = (id: string) => {
    const cancelFn = cancelFunctionsRef.current.get(id);
    if (cancelFn) {
      cancelFn();
      cancelFunctionsRef.current.delete(id);
    }
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      if (activeItemId === id) {
        setActiveItemId(next[0]?.id || null);
      }
      return next;
    });
  };

  const handleUpdateItem = (id: string, updates: Partial<BatchItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updates } : it)));
  };

  const handleSelectClassForItem = (id: string, classId: string) => {
    const found = availableClasses.find((c) => c.id === classId);
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              classGroupId: classId,
              className: found ? found.name : '',
              lessonId: '',
              lessonTitle: '',
            }
          : it
      )
    );
  };

  const handleSelectLessonForItem = (id: string, lessonId: string) => {
    const foundLesson = lessons.find((l) => l.id === lessonId || l.lessonId === lessonId);
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              lessonId,
              lessonTitle: foundLesson ? foundLesson.title : '',
              topic: foundLesson ? foundLesson.topic || foundLesson.title : it.topic,
            }
          : it
      )
    );
  };

  const handleApplyDefaultClassToAll = (classId: string) => {
    setDefaultClassId(classId);
    const found = availableClasses.find((c) => c.id === classId);
    if (!found) return;
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        classGroupId: classId,
        className: found.name,
      }))
    );
  };

  // Capture current video frame as thumbnail cover
  const handleCaptureVideoFrameAsThumbnail = async (item: BatchItem) => {
    const videoEl = videoPreviewElRef.current;
    if (!videoEl || item.mediaType !== 'video') return;
    try {
      const w = videoEl.videoWidth || 640;
      const h = videoEl.videoHeight || 360;
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(720, w);
      canvas.height = Math.round((canvas.width * h) / w);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const dataUrl = await createCloudSafeImageDataUrl(canvas.toDataURL('image/jpeg', 0.82), 120_000);
      handleUpdateItem(item.id, { thumbnailDataUrl: dataUrl });
      onShowToast('success', 'Đã cập nhật ảnh bìa Video', 'Khung hình hiện tại đã được chọn làm ảnh đại diện cho video.');
    } catch {
      onShowToast('error', 'Không thể chụp khung hình', 'Vui lòng chọn tệp ảnh đại diện từ thiết bị.');
    }
  };

  const handleCustomThumbnailSelected = async (e: React.ChangeEvent<HTMLInputElement>, item: BatchItem) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const rawUrl = await blobToDataUrl(f);
      const safeUrl = await createCloudSafeImageDataUrl(rawUrl, 120_000);
      handleUpdateItem(item.id, { thumbnailDataUrl: safeUrl });
      onShowToast('success', 'Đã đổi ảnh đại diện Video', 'Ảnh bìa mới sẽ hiển thị ngoài danh sách Triển lãm.');
    } catch {
      onShowToast('error', 'Ảnh bìa không hợp lệ', 'Vui lòng chọn ảnh JPG, PNG hoặc WEBP.');
    } finally {
      if (customThumbInputRef.current) customThumbInputRef.current.value = '';
    }
  };

  // Quick Rotate 90deg for images
  const handleRotateActiveImage = async (item: BatchItem) => {
    if (!item.previewUrl || item.mediaType === 'video') return;
    const img = new Image();
    img.src = item.previewUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.height;
    canvas.height = img.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((90 * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    const rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    handleUpdateItem(item.id, {
      previewUrl: rotatedDataUrl,
      thumbnailDataUrl: rotatedDataUrl,
    });
  };

  // Auto-crop 4:3 center for images
  const handleCropCenterActiveImage = async (item: BatchItem) => {
    if (!item.previewUrl || item.mediaType === 'video') return;
    const img = new Image();
    img.src = item.previewUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const cutX = Math.round(img.width * 0.06);
    const cutY = Math.round(img.height * 0.06);
    const newW = img.width - cutX * 2;
    const newH = img.height - cutY * 2;

    const canvas = document.createElement('canvas');
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, cutX, cutY, newW, newH, 0, 0, newW, newH);
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    handleUpdateItem(item.id, {
      previewUrl: croppedDataUrl,
      thumbnailDataUrl: croppedDataUrl,
    });
  };

  /**
   * 10-State Upload Pipeline for a single BatchItem (Image or Video):
   * QUEUED -> VALIDATING -> UPLOADING -> STORAGE_COMPLETED -> GETTING_URL -> SAVING_METADATA -> VERIFYING -> SUCCESS / ERROR
   */
  const executeSingleArtworkNineStepPipeline = async (
    item: BatchItem,
    indexInBatch: number,
    totalInBatch: number
  ): Promise<CommunityArtwork> => {
    const artworkId = item.stableArtworkId;
    const trimmedTitle = item.title.trim();
    const isRetrying =
      item.uploadState === 'ERROR' ||
      item.uploadState === 'CANCELLED' ||
      item.uploadProgressState === 'failed';

    const updateStage = (
      state: UploadStateMachine,
      percent: number,
      stageText: string,
      extra?: Partial<BatchItem>
    ) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                ...extra,
                uploadState: state,
                uploadStageText: stageText,
                uploadProgressState:
                  state === 'SUCCESS'
                    ? 'done'
                    : state === 'ERROR' || state === 'CANCELLED'
                      ? 'failed'
                      : 'uploading',
                uploadProgressPercent: percent,
                errorMessage:
                  state === 'ERROR' || state === 'CANCELLED'
                    ? extra?.errorMessage || stageText
                    : undefined,
              }
            : it
        )
      );
      setPublishProgress({
        total: totalInBatch,
        current: indexInBatch + 1,
        percent,
        state,
        statusText: `[${indexInBatch + 1}/${totalInBatch}] "${trimmedTitle || item.file.name}" — ${stageText}`,
      });
    };

    if (isRetrying) {
      updateStage(
        'RETRYING',
        2,
        `Đang thử lại quá trình tải "${trimmedTitle || item.file.name}"...`
      );
    }

    // ========================================================================
    // BƯỚC 1 & 2: VALIDATING — Kiểm tra file thực tế (Ảnh <=12MB / Video <=100MB, <=180s) & Quyền hạn
    // ========================================================================
    updateStage('VALIDATING', 5, 'Bước VALIDATING: Đang kiểm tra định dạng, dung lượng và quyền hạn...');

    if (!item.file || item.file.size <= 0) {
      throw Object.assign(new Error('Tệp rỗng (0 bytes) hoặc không tồn tại.'), {
        failedStep: 'validation',
      });
    }

    if (item.mediaType === 'video') {
      if (item.file.size > MAX_VIDEO_FILE_BYTES) {
        throw Object.assign(
          new Error(
            `Dung lượng video (${formatBytesReadable(item.file.size)}) vượt quá giới hạn tối đa 100MB.`
          ),
          { failedStep: 'validation' }
        );
      }
      if (item.videoDuration && item.videoDuration > MAX_VIDEO_DURATION_SECONDS) {
        throw Object.assign(
          new Error(
            `Thời lượng video (${Math.ceil(item.videoDuration)}s) vượt quá giới hạn tối đa 180 giây.`
          ),
          { failedStep: 'validation' }
        );
      }
    } else {
      const normalizedMime = (item.file.type || 'image/jpeg').toLowerCase();
      const hasValidExt = /\.(jpe?g|png|webp|heic|heif)$/i.test(item.file.name || '');
      if (!ALLOWED_IMAGE_MIME_TYPES.has(normalizedMime) && !hasValidExt) {
        throw Object.assign(
          new Error(
            `Định dạng "${item.file.type || item.file.name}" không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP.`
          ),
          { failedStep: 'validation' }
        );
      }
      if (item.file.size > MAX_ARTWORK_IMAGE_BYTES) {
        throw Object.assign(
          new Error(
            `Dung lượng ảnh (${formatBytesReadable(item.file.size)}) vượt quá giới hạn tối đa 12MB.`
          ),
          { failedStep: 'validation' }
        );
      }
    }

    if (!trimmedTitle) {
      throw Object.assign(
        new Error('Vui lòng nhập Tên tác phẩm trước khi đăng.'),
        { failedStep: 'validation' }
      );
    }

    if (!item.classGroupId) {
      throw Object.assign(
        new Error('Vui lòng chọn Lớp học (Lớp 1 – Lớp 9) trước khi đăng.'),
        { failedStep: 'validation' }
      );
    }

    const allowedRoles: UserRole[] = ['student', 'contributor', 'teacher', 'moderator', 'admin'];
    if (!allowedRoles.includes(currentRole)) {
      throw Object.assign(
        new Error('Vui lòng đăng nhập tài khoản Học sinh hoặc Giáo viên để tải tác phẩm lên.'),
        { failedStep: 'permission' }
      );
    }

    const isAutoSafe = item.status === 'safe' || item.mediaType === 'video';
    const isPublic = isAutoSafe;

    // ========================================================================
    // BƯỚC 3, 4, 5: UPLOADING -> STORAGE_COMPLETED -> GETTING_URL
    // Nếu tệp đã tải thành công lên Storage ở lần trước và chỉ lỗi bước ghi Firestore,
    // tái sử dụng URL đã có mà không bắt người dùng tải lại file nặng!
    // ========================================================================
    let finalDownloadUrl = item.uploadedDownloadUrl || '';
    let finalStoragePath = item.uploadedStoragePath || '';
    let finalThumbnailUrl = item.uploadedThumbnailUrl || item.thumbnailDataUrl || '';
    let finalThumbnailPath = item.uploadedThumbnailPath || '';
    let finalDuration = item.videoDuration;
    let finalWidth = item.videoWidth || item.inspection?.width;
    let finalHeight = item.videoHeight || item.inspection?.height;

    if (
      !finalDownloadUrl ||
      !finalStoragePath ||
      finalDownloadUrl.startsWith('blob:')
    ) {
      try {
        if (item.mediaType === 'video') {
          const videoUploadResult = await uploadArtworkVideoToStorageWithProgress(
            item.file,
            artworkId,
            item.file.name,
            currentUserId,
            item.thumbnailDataUrl,
            (pct, stageText, state, telemetry) => {
              updateStage(
                state || 'UPLOADING',
                pct,
                stageText || `Đang tải video lên Storage (${pct}%)...`,
                telemetry ? { uploadTelemetry: telemetry } : undefined
              );
            },
            (cancelFn) => {
              cancelFunctionsRef.current.set(item.id, cancelFn);
            },
            {
              duration: item.videoDuration,
              width: item.videoWidth,
              height: item.videoHeight,
              mimeType: item.mimeType,
              thumbnailDataUrl: item.thumbnailDataUrl,
              fileSize: item.fileSize,
            }
          );
          cancelFunctionsRef.current.delete(item.id);
          finalDownloadUrl = videoUploadResult.downloadUrl;
          finalStoragePath = videoUploadResult.storagePath;
          finalThumbnailUrl = videoUploadResult.thumbnailUrl || item.thumbnailDataUrl || '';
          finalThumbnailPath =
            videoUploadResult.thumbnailPath || `public_exhibition/${artworkId}/thumbnail.jpg`;
          finalDuration = videoUploadResult.duration || item.videoDuration;
          finalWidth = videoUploadResult.width || item.videoWidth;
          finalHeight = videoUploadResult.height || item.videoHeight;
        } else {
          let cleanDataUrl = item.previewUrl;
          if (!cleanDataUrl || cleanDataUrl.startsWith('blob:')) {
            const stripped = await stripExifAndCreateCleanDataUrl(item.file);
            cleanDataUrl = stripped.cleanDataUrl;
          }
          const photoUploadResult = await uploadArtworkPhotoToStorageWithProgress(
            cleanDataUrl,
            artworkId,
            isPublic,
            currentUserId,
            (pct, stageText, state) => {
              updateStage(
                state || 'UPLOADING',
                pct,
                stageText || `Đang tải ảnh lên Storage (${pct}%)...`
              );
            },
            (cancelFn) => {
              cancelFunctionsRef.current.set(item.id, cancelFn);
            }
          );
          cancelFunctionsRef.current.delete(item.id);
          finalDownloadUrl = photoUploadResult.downloadUrl;
          finalStoragePath = photoUploadResult.storagePath;
          finalThumbnailUrl = photoUploadResult.thumbnailUrl || photoUploadResult.downloadUrl;
          finalThumbnailPath = photoUploadResult.thumbnailPath || photoUploadResult.storagePath;
        }

        handleUpdateItem(item.id, {
          uploadedStoragePath: finalStoragePath,
          uploadedDownloadUrl: finalDownloadUrl,
          uploadedThumbnailPath: finalThumbnailPath,
          uploadedThumbnailUrl: finalThumbnailUrl,
        });
      } catch (storageErr: any) {
        cancelFunctionsRef.current.delete(item.id);
        throw Object.assign(
          new Error(
            storageErr instanceof Error
              ? storageErr.message
              : 'Lỗi tải tệp lên Firebase Storage.'
          ),
          { failedStep: 'storage' }
        );
      }
    } else {
      updateStage(
        'GETTING_URL',
        85,
        'Đã có sẵn tệp trên Storage (85%), đang chuyển thẳng sang bước ghi Metadata Firestore...'
      );
    }

    // ========================================================================
    // BƯỚC 6 & 7: SAVING_METADATA (90%) & VERIFYING (95–98%)
    // ========================================================================
    const selectedClass = availableClasses.find((c) => c.id === item.classGroupId);
    const stdGrade = normalizeGrade(selectedClass ? selectedClass.name : item.className);
    const safeAlias =
      item.author && item.author.trim() !== ''
        ? item.author.trim()
        : currentUserAlias || 'Họa sĩ Nhí';
    const nowIso = new Date().toISOString();

    const artworkToSave: CommunityArtwork = {
      id: artworkId,
      artworkId,
      mediaId: artworkId,
      mediaType: item.mediaType,
      ownerKey: generateAuthorKey(),
      authorId: currentUserId,
      authorUid: currentUserId,
      authorAlias: safeAlias,
      authorNickname: safeAlias,
      creatorAnonymousPseudonym: safeAlias,
      title: trimmedTitle,
      description:
        item.description.trim() ||
        (item.mediaType === 'video'
          ? `Video quá trình sáng tạo nghệ thuật của học sinh ${stdGrade}.`
          : `Tác phẩm được số hóa và trưng bày tại Triển lãm Nghệ thuật Số ARTVERSE AI (${stdGrade}).`),
      materialsUsed:
        item.mediaType === 'video'
          ? 'Video Nghệ thuật (MP4/MOV/WebM)'
          : 'Màu tổng hợp (Đã khử EXIF & tối ưu hóa hiển thị)',
      processNotes: item.description.trim() || 'Chia sẻ trong không gian học tập sáng tạo.',
      classId: item.classGroupId,
      classGroupId: item.classGroupId,
      className: stdGrade,
      grade: stdGrade,
      lessonId: item.lessonId || '',
      lessonTitle: item.lessonTitle || '',
      topic: item.topic || item.lessonTitle || `Mĩ thuật ${stdGrade}`,
      storagePath: finalStoragePath,
      downloadURL: finalDownloadUrl,
      thumbnailPath: finalThumbnailPath || finalStoragePath,
      thumbnailUrl: finalThumbnailUrl || finalDownloadUrl,
      imagePath: finalStoragePath,
      imageUrl: item.mediaType === 'video' ? finalThumbnailUrl || finalDownloadUrl : finalDownloadUrl,
      videoPath: item.mediaType === 'video' ? finalStoragePath : undefined,
      videoUrl: item.mediaType === 'video' ? finalDownloadUrl : undefined,
      fileSize: item.file.size,
      mimeType: item.mimeType,
      duration: item.mediaType === 'video' ? finalDuration : undefined,
      width: finalWidth,
      height: finalHeight,
      visualType: 'watercolor',
      status: isAutoSafe ? 'approved' : 'pending',
      shareStatus: isAutoSafe ? 'shared' : 'private',
      shareToken: generateUnguessableShareToken(),
      moderation: {
        moderatedBy: isAutoSafe ? 'AUTO_INSPECTION_ENGINE' : undefined,
        moderatedAt: isAutoSafe ? nowIso : undefined,
        moderatorNote: isAutoSafe
          ? 'Tự động phát hành sau khi vượt qua kiểm tra định dạng & an toàn.'
          : item.inspection?.riskSummary,
        isFlaggedSensitive: !isAutoSafe,
      },
      reactions: {
        unique_idea: 0,
        striking_color: 0,
        interesting_composition: 0,
        noteworthy_detail: 0,
        inspiring: 0,
      },
      comments: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      isAutoPublished: isAutoSafe,
      publishedByTeacherId: currentUserId,
      storageLocation: 'firebase_storage',
      inspectionSummary: item.inspection
        ? {
            ...item.inspection,
            sanitizedDataUrl: undefined,
          }
        : undefined,
    };

    try {
      const verifiedArtwork = await createCommunityArtworkInFirestore(
        artworkToSave,
        currentUserId,
        (pct, stageText, state) => {
          updateStage(state || 'SAVING_METADATA', pct, stageText);
        }
      );
      return verifiedArtwork;
    } catch (fsErr: any) {
      throw Object.assign(
        new Error(
          fsErr instanceof Error
            ? fsErr.message
            : 'Lỗi ở Bước 6–7 (Ghi/Xác minh metadata trên Firestore).'
        ),
        { failedStep: 'firestore' }
      );
    }
  };

  // Retry a single failed item (Storage or Firestore metadata)
  const handleRetrySingleItem = async (item: BatchItem) => {
    if (isPublishing) return;
    const trimmedTitle = item.title.trim();
    if (!trimmedTitle) {
      setActiveItemId(item.id);
      onShowToast('error', 'Thiếu tên tác phẩm', 'Vui lòng nhập Tên tác phẩm trước khi thử lại.');
      return;
    }
    if (!item.classGroupId) {
      setActiveItemId(item.id);
      onShowToast('error', 'Chưa chọn lớp', 'Vui lòng chọn Lớp học trước khi thử lại.');
      return;
    }

    setIsPublishing(true);
    try {
      const verified = await executeSingleArtworkNineStepPipeline(item, 0, 1);

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                uploadState: 'VERIFYING',
                uploadStageText: 'Đang đồng bộ danh sách triển lãm (99%)...',
                uploadProgressPercent: 99,
              }
            : it
        )
      );

      let reloadedList: CommunityArtwork[] | undefined;
      try {
        reloadedList = await getPublicArtworksFromFirestore();
      } catch {
        // use verified item
      }

      onBatchPublishSuccess([verified], reloadedList);

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                uploadState: 'SUCCESS',
                uploadStageText: UPLOAD_STATE_LABELS.SUCCESS,
                uploadProgressState: 'done',
                uploadProgressPercent: 100,
                errorMessage: undefined,
                failedStep: undefined,
              }
            : it
        )
      );

      setSavedSuccessBanner({
        count: 1,
        titles: [verified.title],
        classIds: [verified.className || verified.grade || 'Lớp 6'],
      });
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi không xác định khi thử lại.';
      const failedStep = err?.failedStep || 'storage';
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                uploadState: 'ERROR',
                uploadStageText: errMsg,
                uploadProgressState: 'failed',
                errorMessage: errMsg,
                failedStep,
              }
            : it
        )
      );
      onShowToast('error', 'Thử lại chưa thành công', errMsg);
    } finally {
      if (isMountedRef.current) {
        setIsPublishing(false);
        setPublishProgress(null);
      }
    }
  };

  // Batch upload all queued/retryable items
  const handleBatchPublish = async () => {
    if (isPublishing) return;

    const validItems = items.filter(
      (it) =>
        (it.status === 'safe' || it.status === 'warning') &&
        it.uploadState !== 'SUCCESS'
    );
    if (validItems.length === 0) {
      onShowToast(
        'error',
        'Không có tệp hợp lệ cần tải',
        'Vui lòng chọn ít nhất 1 ảnh hoặc video hợp lệ để xuất bản.'
      );
      return;
    }

    const missingTitleItem = validItems.find((it) => !it.title || it.title.trim() === '');
    if (missingTitleItem) {
      setActiveItemId(missingTitleItem.id);
      onShowToast(
        'error',
        'Thiếu tên tác phẩm',
        'Vui lòng nhập Tên tác phẩm cho tất cả các ảnh/video trước khi lưu.'
      );
      return;
    }

    const missingClassItem = validItems.find(
      (it) => !it.classGroupId || it.classGroupId.trim() === ''
    );
    if (missingClassItem) {
      setActiveItemId(missingClassItem.id);
      onShowToast(
        'error',
        'Chưa chọn lớp',
        `Vui lòng chọn Lớp (Lớp 1 – Lớp 9) cho tác phẩm "${missingClassItem.title.trim()}".`
      );
      return;
    }

    setIsPublishing(true);
    setSavedSuccessBanner(null);

    const total = validItems.length;
    setPublishProgress({
      total,
      current: 1,
      percent: 2,
      state: 'VALIDATING',
      statusText: `Đang kiểm tra và tải song song ${total} tác phẩm...`,
    });

    try {
      const itemPromises = validItems.map(async (item, index) => {
        try {
          const verifiedArtwork = await executeSingleArtworkNineStepPipeline(item, index, total);
          return { status: 'fulfilled' as const, item, verifiedArtwork };
        } catch (itemErr: any) {
          const errMsg =
            itemErr instanceof Error ? itemErr.message : 'Lỗi không xác định khi tải tác phẩm.';
          const failedStep = itemErr?.failedStep || 'storage';
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    uploadState: 'ERROR',
                    uploadStageText: errMsg,
                    uploadProgressState: 'failed',
                    errorMessage: errMsg,
                    failedStep,
                  }
                : it
            )
          );
          return { status: 'rejected' as const, item, errMsg, failedStep };
        }
      });

      const settledResults = await Promise.all(itemPromises);
      const verifiedArtworks: CommunityArtwork[] = [];
      const failedItems: Array<{ title: string; reason: string }> = [];

      for (const res of settledResults) {
        if (res.status === 'fulfilled') {
          verifiedArtworks.push(res.verifiedArtwork);
        } else {
          failedItems.push({
            title: res.item.title.trim() || res.item.file.name,
            reason: res.errMsg,
          });
        }
      }

      if (verifiedArtworks.length > 0) {
        const verifiedIds = new Set(verifiedArtworks.map((a) => a.id));
        setItems((prev) =>
          prev.map((it) =>
            verifiedIds.has(it.stableArtworkId)
              ? {
                  ...it,
                  uploadState: 'VERIFYING',
                  uploadStageText: 'Đang cập nhật danh sách triển lãm (99%)...',
                  uploadProgressPercent: 99,
                }
              : it
          )
        );

        let reloadedList: CommunityArtwork[] | undefined;
        try {
          reloadedList = await getPublicArtworksFromFirestore();
        } catch {
          // fallback to verifiedArtworks
        }

        onBatchPublishSuccess(verifiedArtworks, reloadedList);

        setItems((prev) =>
          prev.map((it) =>
            verifiedIds.has(it.stableArtworkId)
              ? {
                  ...it,
                  uploadState: 'SUCCESS',
                  uploadStageText: UPLOAD_STATE_LABELS.SUCCESS,
                  uploadProgressState: 'done',
                  uploadProgressPercent: 100,
                  errorMessage: undefined,
                  failedStep: undefined,
                }
              : it
          )
        );

        const classLabels = Array.from(
          new Set(verifiedArtworks.map((a) => a.className || a.grade || 'Lớp 6'))
        );

        setSavedSuccessBanner({
          count: verifiedArtworks.length,
          titles: verifiedArtworks.map((a) => a.title),
          classIds: classLabels,
        });
      }

      if (failedItems.length > 0 && verifiedArtworks.length === 0) {
        onShowToast('error', 'Upload thất bại', failedItems[0].reason);
      } else if (failedItems.length > 0) {
        onShowToast(
          'info',
          `Đã hoàn tất ${verifiedArtworks.length}/${total} tác phẩm`,
          `${failedItems.length} tác phẩm gặp lỗi (${failedItems[0].title}: ${failedItems[0].reason}). Bạn có thể nhấn "Thử lại" trên mục bị lỗi.`
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsPublishing(false);
        setPublishProgress(null);
      }
    }
  };

  const activeItem = items.find((it) => it.id === activeItemId) || items[0] || null;
  const safeCount = items.filter((it) => it.status === 'safe').length;
  const warningCount = items.filter((it) => it.status === 'warning').length;
  const errorCount = items.filter((it) => it.status === 'error' || it.uploadState === 'ERROR').length;
  const inspectingCount = items.filter((it) => it.status === 'inspecting').length;
  const pendingPublishCount = items.filter(
    (it) =>
      (it.status === 'safe' || it.status === 'warning') &&
      it.uploadState !== 'SUCCESS'
  ).length;

  const activeItemLessons = useMemo(() => {
    if (!activeItem || !activeItem.classGroupId) return lessons;
    const filtered = lessons.filter(
      (l) =>
        l.classGroupId === activeItem.classGroupId ||
        l.classId === activeItem.classGroupId ||
        normalizeGrade(l.grade || l.className) === normalizeGrade(activeItem.className)
    );
    return filtered.length > 0 ? filtered : lessons;
  }, [lessons, activeItem]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172044]/75 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-3xl bg-[#FFF8ED] border-2 border-[#172044]/15 text-[#172044] shadow-[0_24px_70px_rgba(23,32,68,0.45)] overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#172044]/10 bg-gradient-to-r from-[#FFF8ED] via-[#FFF2DB] to-[#F3EEFF] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF7A32] via-[#F05B86] to-[#7047EB] flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-[#172044] tracking-tight">
                  Đăng Tranh & Video Nghệ Thuật
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#7047EB]/15 text-[#7047EB] border border-[#7047EB]/30">
                  Ảnh &le; 12MB • Video &le; 100MB / 180s
                </span>
              </div>
              <p className="text-xs text-[#4A5578] font-medium">
                Lưu trữ bền vững trên Firebase Storage + xác minh đọc lại Firestore tự động
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white hover:bg-[#FFE4E6] text-[#172044] hover:text-[#E11D48] border border-[#172044]/15 transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) => handleFilesAdded(e.target.files)}
          className="hidden"
        />
        <input
          ref={videoCameraInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          capture="environment"
          onChange={(e) => handleFilesAdded(e.target.files)}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
          multiple
          onChange={(e) => handleFilesAdded(e.target.files)}
          className="hidden"
        />
        <input
          ref={customThumbInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => activeItem && handleCustomThumbnailSelected(e, activeItem)}
          className="hidden"
        />

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Top Action Bar: Default Class Selector + Capture / Upload Buttons */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#172044]/10 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#172044]">
                <GraduationCap className="w-4 h-4 text-[#7047EB]" />
                <span>Áp dụng nhanh Lớp:</span>
              </div>
              <select
                value={defaultClassId}
                onChange={(e) => handleApplyDefaultClassToAll(e.target.value)}
                disabled={isPublishing}
                className="px-3 py-2 rounded-xl bg-[#FFF8ED] border border-[#172044]/20 text-xs font-bold text-[#172044] focus:outline-none focus:border-[#7047EB]"
              >
                <option value="">-- Chọn lớp chung (Lớp 1 – Lớp 9) --</option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isPublishing}
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#3B5BDB] hover:bg-[#2F4AC0] text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                Chụp Ảnh Tranh
              </button>
              <button
                type="button"
                disabled={isPublishing}
                onClick={() => videoCameraInputRef.current?.click()}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F05B86] hover:bg-[#D94670] text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                <Video className="w-4 h-4" />
                Quay Video
              </button>
              <button
                type="button"
                disabled={isPublishing}
                onClick={() => galleryInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF7A32] to-[#7047EB] hover:opacity-95 text-white text-xs font-extrabold shadow-sm transition-all disabled:opacity-50"
              >
                <ImageIcon className="w-4 h-4" />
                Chọn Ảnh / Video từ Máy
              </button>
            </div>
          </div>

          {/* Confirmed Success Banner */}
          {savedSuccessBanner && (
            <div className="p-4 rounded-2xl bg-[#ECFDF5] border-2 border-[#10B981] text-[#065F46] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#10B981] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-extrabold">
                    Đã xuất bản thành công {savedSuccessBanner.count} tác phẩm vào Triển lãm ({savedSuccessBanner.classIds.join(', ')})!
                  </h4>
                  <p className="text-xs mt-0.5 text-[#047857]">
                    Đã xác minh lưu trữ trên Firebase Storage và đọc kiểm tra lại bản ghi Firestore ({savedSuccessBanner.titles.join(', ')}).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-extrabold shrink-0"
              >
                Xem ngay trong Triển lãm
              </button>
            </div>
          )}

          {/* Empty State Dropzone */}
          {items.length === 0 ? (
            <div
              onClick={() => galleryInputRef.current?.click()}
              className="cursor-pointer rounded-3xl border-2 border-dashed border-[#7047EB]/40 bg-white hover:bg-[#F8F5FF] p-8 sm:p-12 text-center transition-all"
            >
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#FFD447] via-[#FF7A32] to-[#7047EB] mx-auto flex items-center justify-center text-white shadow-lg mb-4">
                <Film className="w-10 h-10" />
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-[#172044]">
                Chạm để chọn Tranh vẽ hoặc Video nghệ thuật
              </h3>
              <p className="text-xs sm:text-sm text-[#4A5578] max-w-lg mx-auto mt-2 leading-relaxed">
                Hỗ trợ tải đồng thời <strong className="text-[#172044]">1 – 10 bức tranh</strong> (JPG, PNG, WEBP tối đa 12MB) hoặc <strong className="text-[#7047EB]">Video quá trình sáng tạo / thuyết trình</strong> (MP4, MOV, WebM tối đa 100MB, thời lượng &le; 180 giây).
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <span className="px-3.5 py-1.5 rounded-full bg-[#FFF8ED] border border-[#172044]/15 text-xs font-bold text-[#172044]">
                  🎨 Tự động khử EXIF/GPS bảo vệ học sinh
                </span>
                <span className="px-3.5 py-1.5 rounded-full bg-[#FFF8ED] border border-[#172044]/15 text-xs font-bold text-[#172044]">
                  🎬 Tự động trích xuất ảnh đại diện Video
                </span>
                <span className="px-3.5 py-1.5 rounded-full bg-[#FFF8ED] border border-[#172044]/15 text-xs font-bold text-[#172044]">
                  ☁️ Lưu bền vững trên Cloud Storage + Firestore
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Batch Queue List */}
              <div className="lg:col-span-4 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#4A5578]">
                    Danh sách tệp ({items.length})
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold">
                    {safeCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {safeCount} hợp lệ
                      </span>
                    )}
                    {errorCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                        {errorCount} lỗi
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {items.map((it, idx) => {
                    const isSelected = activeItem?.id === it.id;
                    const isUploadingThis =
                      it.uploadState === 'UPLOADING' ||
                      it.uploadState === 'VALIDATING' ||
                      it.uploadState === 'STORAGE_COMPLETED' ||
                      it.uploadState === 'GETTING_URL' ||
                      it.uploadState === 'SAVING_METADATA' ||
                      it.uploadState === 'VERIFYING';
                    return (
                      <div
                        key={it.id}
                        onClick={() => setActiveItemId(it.id)}
                        className={`p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white border-[#7047EB] shadow-md'
                            : 'bg-white/75 border-[#172044]/10 hover:border-[#172044]/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-[#172044] shrink-0 border border-[#172044]/15">
                            {it.mediaType === 'video' ? (
                              it.thumbnailDataUrl ? (
                                <img
                                  src={it.thumbnailDataUrl}
                                  alt={it.title || 'Video thumbnail'}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white bg-[#172044]">
                                  <Video className="w-6 h-6 text-[#FFD447]" />
                                </div>
                              )
                            ) : (
                              <img
                                src={it.previewUrl}
                                alt={it.title || `Tranh ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            )}
                            <span
                              className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase text-white ${
                                it.mediaType === 'video' ? 'bg-[#F05B86]' : 'bg-[#3B5BDB]'
                              }`}
                            >
                              {it.mediaType === 'video' ? 'VIDEO' : 'ẢNH'}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-extrabold text-[#172044] truncate">
                                {it.title.trim() || `Chưa đặt tên (#${idx + 1})`}
                              </p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveItem(it.id);
                                }}
                                className="p-1 rounded-lg text-[#4A5578] hover:text-rose-600 hover:bg-rose-50"
                                title="Xóa khỏi danh sách"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] font-bold text-[#4A5578]">
                              <span>{it.className || 'Chưa chọn lớp'}</span>
                              <span>•</span>
                              <span>{formatBytesReadable(it.fileSize)}</span>
                              {it.mediaType === 'video' && it.videoDuration && (
                                <>
                                  <span>•</span>
                                  <span className="text-[#7047EB]">
                                    {formatDurationReadable(it.videoDuration)}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* State Machine Pill */}
                            <div className="mt-1.5 flex items-center justify-between gap-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  it.uploadState === 'SUCCESS'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : it.uploadState === 'ERROR'
                                      ? 'bg-rose-100 text-rose-800'
                                      : isUploadingThis
                                        ? 'bg-[#7047EB]/15 text-[#7047EB]'
                                        : 'bg-[#FFF8ED] text-[#172044] border border-[#172044]/15'
                                }`}
                              >
                                {it.uploadState === 'SUCCESS' && <Check className="w-3 h-3" />}
                                {it.uploadState === 'ERROR' && <AlertTriangle className="w-3 h-3" />}
                                {isUploadingThis && <RefreshCw className="w-3 h-3 animate-spin" />}
                                {it.uploadState}
                              </span>

                              {isUploadingThis && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelItemUpload(it.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-extrabold"
                                >
                                  <StopCircle className="w-3 h-3" />
                                  Hủy
                                </button>
                              )}
                            </div>

                            {/* Per-item Progress Bar */}
                            {(isUploadingThis || it.uploadState === 'SUCCESS') && (
                              <div className="mt-1.5 w-full h-1.5 rounded-full bg-[#172044]/10 overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    it.uploadState === 'SUCCESS'
                                      ? 'bg-[#10B981]'
                                      : 'bg-gradient-to-r from-[#FF7A32] to-[#7047EB]'
                                  }`}
                                  style={{ width: `${it.uploadProgressPercent || 0}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Active Item Editor & Preview */}
              {activeItem && (
                <div className="lg:col-span-8 bg-white rounded-3xl border border-[#172044]/12 p-4 sm:p-5 space-y-4 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Media Preview Area */}
                    <div className="md:col-span-5 flex flex-col gap-2.5">
                      <div className="relative rounded-2xl overflow-hidden bg-[#172044] border border-[#172044]/15 aspect-[4/3] flex items-center justify-center">
                        {activeItem.mediaType === 'video' ? (
                          <video
                            ref={videoPreviewElRef}
                            src={activeItem.previewUrl}
                            poster={activeItem.thumbnailDataUrl}
                            controls
                            preload="metadata"
                            playsInline
                            className="w-full h-full object-contain bg-[#172044]"
                          />
                        ) : (
                          <img
                            src={activeItem.previewUrl}
                            alt={activeItem.title || 'Xem trước tác phẩm'}
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>

                      {/* Image or Video Tools */}
                      {activeItem.mediaType === 'video' ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FFF8ED] border border-[#172044]/10 text-[11px] font-bold text-[#172044]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-[#7047EB]" />
                              Thời lượng: {formatDurationReadable(activeItem.videoDuration)} / 3:00
                            </span>
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3.5 h-3.5 text-[#FF7A32]" />
                              {formatBytesReadable(activeItem.fileSize)} / 100 MB
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isPublishing}
                              onClick={() => handleCaptureVideoFrameAsThumbnail(activeItem)}
                              className="flex-1 px-2.5 py-2 rounded-xl bg-[#FFF8ED] hover:bg-[#FFE8C2] border border-[#172044]/15 text-[11px] font-bold text-[#172044] transition-colors"
                            >
                              📸 Lấy khung hình hiện tại làm bìa
                            </button>
                            <button
                              type="button"
                              disabled={isPublishing}
                              onClick={() => customThumbInputRef.current?.click()}
                              className="px-2.5 py-2 rounded-xl bg-[#F3EEFF] hover:bg-[#E5DCFF] border border-[#7047EB]/30 text-[11px] font-bold text-[#7047EB] transition-colors"
                            >
                              Đổi ảnh bìa
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={isPublishing}
                            onClick={() => handleRotateActiveImage(activeItem)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFF8ED] hover:bg-[#FFE8C2] border border-[#172044]/15 text-xs font-bold text-[#172044]"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            Xoay 90°
                          </button>
                          <button
                            type="button"
                            disabled={isPublishing}
                            onClick={() => handleCropCenterActiveImage(activeItem)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFF8ED] hover:bg-[#FFE8C2] border border-[#172044]/15 text-xs font-bold text-[#172044]"
                          >
                            <Crop className="w-3.5 h-3.5" />
                            Cắt viền chuẩn
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Metadata Form Fields */}
                    <div className="md:col-span-7 space-y-3.5">
                      <div>
                        <label className="block text-xs font-extrabold text-[#172044] mb-1">
                          Tên tác phẩm <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={activeItem.title}
                          onChange={(e) =>
                            handleUpdateItem(activeItem.id, { title: e.target.value })
                          }
                          disabled={isPublishing}
                          placeholder={
                            activeItem.mediaType === 'video'
                              ? 'Ví dụ: Video quá trình vẽ Cầu Rồng Đà Nẵng...'
                              : 'Ví dụ: Đà Nẵng trong em, Hoa sen mùa hạ...'
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF8ED] border border-[#172044]/20 text-sm font-bold text-[#172044] focus:outline-none focus:border-[#7047EB]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-extrabold text-[#172044] mb-1">
                            Lớp học (Lớp 1 – Lớp 9) <span className="text-rose-600">*</span>
                          </label>
                          <select
                            value={activeItem.classGroupId}
                            onChange={(e) =>
                              handleSelectClassForItem(activeItem.id, e.target.value)
                            }
                            disabled={isPublishing}
                            className="w-full px-3 py-2.5 rounded-xl bg-[#FFF8ED] border border-[#172044]/20 text-xs font-bold text-[#172044] focus:outline-none focus:border-[#7047EB]"
                          >
                            <option value="">-- Chọn Lớp --</option>
                            {availableClasses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold text-[#172044] mb-1">
                            Biệt danh tác giả (Không ghi tên thật)
                          </label>
                          <div className="relative">
                            <User className="w-4 h-4 text-[#4A5578] absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={activeItem.author}
                              onChange={(e) =>
                                handleUpdateItem(activeItem.id, { author: e.target.value })
                              }
                              disabled={isPublishing}
                              placeholder="Ví dụ: Cọ Vẽ Mùa Thu"
                              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#FFF8ED] border border-[#172044]/20 text-xs font-bold text-[#172044] focus:outline-none focus:border-[#7047EB]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Optional Topic / Lesson & Story */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowOptionalFields((v) => !v)}
                          className="flex items-center gap-1.5 text-xs font-extrabold text-[#7047EB] hover:underline"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>
                            {showOptionalFields
                              ? 'Ẩn chủ đề bài học & câu chuyện sáng tác'
                              : 'Thêm chủ đề bài học & câu chuyện sáng tác (Tùy chọn)'}
                          </span>
                          {showOptionalFields ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {showOptionalFields && (
                          <div className="mt-2.5 space-y-3 p-3 rounded-2xl bg-[#FFF8ED]/70 border border-[#172044]/10">
                            <div>
                              <label className="block text-[11px] font-bold text-[#4A5578] mb-1">
                                Gắn với Chủ đề / Bài học Mĩ thuật
                              </label>
                              <select
                                value={activeItem.lessonId}
                                onChange={(e) =>
                                  handleSelectLessonForItem(activeItem.id, e.target.value)
                                }
                                disabled={isPublishing}
                                className="w-full px-3 py-2 rounded-xl bg-white border border-[#172044]/20 text-xs font-semibold text-[#172044]"
                              >
                                <option value="">-- Sáng tác tự do --</option>
                                {activeItemLessons.map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.title} ({l.grade || l.className})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-[#4A5578] mb-1">
                                Cảm hứng / Câu chuyện sau tác phẩm
                              </label>
                              <textarea
                                rows={2}
                                value={activeItem.description}
                                onChange={(e) =>
                                  handleUpdateItem(activeItem.id, {
                                    description: e.target.value,
                                  })
                                }
                                disabled={isPublishing}
                                placeholder="Chia sẻ ý tưởng, chất liệu hoặc kỷ niệm khi thực hiện tác phẩm..."
                                className="w-full px-3 py-2 rounded-xl bg-white border border-[#172044]/20 text-xs font-medium text-[#172044] focus:outline-none focus:border-[#7047EB]"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Detailed Upload State & Error Recovery Box */}
                      <div className="p-3 rounded-2xl bg-[#FFF8ED] border border-[#172044]/15 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-extrabold text-[#172044]">
                            Trạng thái: {UPLOAD_STATE_LABELS[activeItem.uploadState]}
                          </span>
                          <span className="text-[11px] font-extrabold text-[#7047EB] tabular-nums">
                            {activeItem.uploadProgressPercent || 0}%
                          </span>
                        </div>
                        <p className="text-[11px] text-[#4A5578] leading-snug">
                          {activeItem.uploadStageText || UPLOAD_STATE_LABELS[activeItem.uploadState]}
                        </p>

                        {/* Real-time Upload Telemetry (Bytes / Total, Speed, Elapsed) */}
                        {activeItem.uploadTelemetry &&
                          activeItem.uploadTelemetry.totalBytes > 0 && (
                            <div className="pt-1.5 border-t border-[#172044]/10 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-[#172044] tabular-nums">
                              <span>
                                Đã tải:{' '}
                                {formatBytesReadable(activeItem.uploadTelemetry.bytesTransferred)} /{' '}
                                {formatBytesReadable(activeItem.uploadTelemetry.totalBytes)}
                              </span>
                              {activeItem.uploadTelemetry.speedBytesPerSec > 0 && (
                                <span className="text-[#3B5BDB]">
                                  Tốc độ:{' '}
                                  {formatBytesReadable(
                                    activeItem.uploadTelemetry.speedBytesPerSec
                                  )}
                                  /s
                                </span>
                              )}
                              <span>
                                Thời gian:{' '}
                                {formatDurationReadable(activeItem.uploadTelemetry.elapsedSeconds)}
                              </span>
                            </div>
                          )}

                        {(activeItem.uploadState === 'ERROR' ||
                          activeItem.uploadState === 'CANCELLED') && (
                          <div className="pt-2 border-t border-rose-200 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-rose-700">
                              {activeItem.uploadedDownloadUrl
                                ? '✓ File đã lưu trên Storage. Chỉ cần thử lại bước ghi Metadata Firestore!'
                                : 'Quá trình tải file chưa hoàn tất. Bạn có thể thử lại ngay.'}
                            </span>
                            <button
                              type="button"
                              disabled={isPublishing}
                              onClick={() => handleRetrySingleItem(activeItem)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#7047EB] hover:bg-[#5B35D5] text-white text-xs font-extrabold shadow-sm cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              {activeItem.uploadedDownloadUrl
                                ? 'Thử lại hoàn tất Metadata Firestore'
                                : 'Thử lại tải tác phẩm'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Progress & Submit Bar */}
        <div className="px-5 py-4 border-t border-[#172044]/10 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex-1">
            {publishProgress ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-extrabold text-[#172044]">
                  <span className="truncate">{publishProgress.statusText}</span>
                  <span className="text-[#7047EB] shrink-0 ml-2">
                    {publishProgress.percent}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#172044]/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF7A32] via-[#F05B86] to-[#7047EB] transition-all duration-300"
                    style={{ width: `${publishProgress.percent}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#4A5578]">
                <span>
                  Sẵn sàng xuất bản: <strong className="text-[#172044]">{pendingPublishCount}</strong> tác phẩm
                </span>
                {warningCount > 0 && (
                  <span className="text-amber-700">
                    • {warningCount} chờ giáo viên duyệt
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#FFF8ED] hover:bg-[#F3EAD8] text-[#172044] border border-[#172044]/15 text-xs font-extrabold"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={isPublishing || pendingPublishCount === 0 || inspectingCount > 0}
              onClick={handleBatchPublish}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#3B5BDB] via-[#7047EB] to-[#FF7A32] hover:opacity-95 text-white text-xs sm:text-sm font-extrabold shadow-md transition-all disabled:opacity-50"
            >
              {isPublishing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang xử lý ({publishProgress?.percent || 0}%)...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Xuất bản vào Triển lãm ({pendingPublishCount})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

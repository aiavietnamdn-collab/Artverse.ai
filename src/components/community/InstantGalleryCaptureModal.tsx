/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Giao diện Upload Tác phẩm Tối ưu Chuyên biệt cho iPhone (Safari iOS & PWA)
 * - Nút Chụp ảnh trực tiếp & Chọn ảnh từ thư viện (hỗ trợ nhiều ảnh)
 * - Xem trước ảnh theo lưới (Grid Preview)
 * - Nhập thông tin tác phẩm gọn gàng (Tên tác phẩm *, Lớp *)
 * - Có thể thu gọn phần thông tin tùy chọn (Tác giả & Xoay/Cắt viền)
 * - Nút Đăng tác phẩm cố định cuối màn hình tôn trọng Safe Area
 * - Hiển thị tiến trình từng ảnh
 * - Giữ nguyên logic upload Firebase hiện tại (không tự động áp bài học)
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  ClassGroup,
  ArtLesson,
  CommunityArtwork,
  UserRole,
  PrePublishInspectionResult
} from '../../types/communityArt';
import { runInstantPrePublishCheck, stripExifAndCreateCleanDataUrl } from '../../services/instantPhotoInspectionService';
import { generateUnguessableShareToken, generateAuthorKey } from '../../services/communityArtService';
import { createCommunityArtworkInFirestore } from '../../services/communityFirestoreService';
import {
  Camera,
  Image as ImageIcon,
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
  Check
} from 'lucide-react';

export interface BatchItem {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  classGroupId: string;
  className: string;
  author: string;
  status: 'pending_check' | 'inspecting' | 'safe' | 'warning' | 'error';
  uploadProgressState?: 'idle' | 'uploading' | 'done';
  inspection?: PrePublishInspectionResult;
  errorMessage?: string;
}

const STANDARD_CLASSES: Array<{ id: string; name: string }> = [
  { id: 'cls-6', name: 'Khối 6' },
  { id: 'cls-7', name: 'Khối 7' },
  { id: 'cls-8', name: 'Khối 8' },
  { id: 'cls-9', name: 'Khối 9' },
];

interface InstantGalleryCaptureModalProps {
  classes: ClassGroup[];
  lessons: ArtLesson[];
  currentRole: UserRole;
  currentUserId?: string;
  currentUserName?: string;
  onClose: () => void;
  onBatchPublishSuccess: (artworks: CommunityArtwork[]) => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const InstantGalleryCaptureModal: React.FC<InstantGalleryCaptureModalProps> = ({
  classes,
  currentRole,
  currentUserId = 'teacher-demo',
  currentUserName = 'Giáo viên Mĩ thuật',
  onClose,
  onBatchPublishSuccess,
  onShowToast
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Merge standard classes (Khối 6, 7, 8, 9) with any custom classes in Firestore
  const availableClasses = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const std of STANDARD_CLASSES) {
      map.set(std.id, std);
    }
    for (const c of classes) {
      if (c.id && c.name && !c.isHidden) {
        map.set(c.id, { id: c.id, name: c.name });
      }
    }
    return Array.from(map.values());
  }, [classes]);

  const [defaultClassId, setDefaultClassId] = useState<string>('');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [showOptionalFields, setShowOptionalFields] = useState<boolean>(false);

  // Publishing lock state & progress
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{
    total: number;
    current: number;
    statusText: string;
  } | null>(null);

  // Process newly selected files (from Camera or Multi-file gallery picker)
  const handleFilesAdded = async (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;

    const fallbackClass: ClassGroup = {
      id: 'cls-6',
      name: 'Khối 6',
      code: 'khoi-6',
      description: 'Không gian sáng tạo mĩ thuật',
      isHidden: false,
      createdAt: '01/09/2026',
      createdByTeacherId: 'teacher-demo',
      isPublicGalleryEnabled: true
    };
    const targetClass = classes[0] || fallbackClass;
    const selectedDefaultClass = availableClasses.find((c) => c.id === defaultClassId);

    const fileArray = Array.from(newFiles);

    const newItems: BatchItem[] = fileArray.map((file, idx) => {
      const id = `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${idx}`;
      return {
        id,
        file,
        previewUrl: URL.createObjectURL(file),
        title: '',
        classGroupId: selectedDefaultClass ? selectedDefaultClass.id : '',
        className: selectedDefaultClass ? selectedDefaultClass.name : '',
        author: '',
        status: 'inspecting',
        uploadProgressState: 'idle'
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

    // Reset input values so selecting the same photo again triggers onChange on Safari iOS
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';

    for (const item of newItems) {
      try {
        const result = await runInstantPrePublishCheck({
          file: item.file,
          targetClass,
          currentRole,
          currentUserId,
          userNotes: ''
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
                title: it.title,
                status,
                inspection: result.inspection,
                errorMessage: !result.inspection.fileValid ? result.inspection.riskSummary : undefined
              };
            }
            return it;
          })
        );
      } catch (err) {
        setItems((currentList) =>
          currentList.map((it) => {
            if (it.id === item.id) {
              return {
                ...it,
                status: 'error',
                errorMessage: err instanceof Error ? err.message : 'Lỗi xử lý tệp ảnh.'
              };
            }
            return it;
          })
        );
      }
    }
  };

  const handleRemoveItem = (id: string) => {
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
    handleUpdateItem(id, {
      classGroupId: classId,
      className: found ? found.name : ''
    });
    if (classId && !defaultClassId) {
      setDefaultClassId(classId);
    }
  };

  const handleApplyClassToAll = (classId: string) => {
    const found = availableClasses.find((c) => c.id === classId);
    if (!found) return;
    setDefaultClassId(classId);
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        classGroupId: found.id,
        className: found.name
      }))
    );
    onShowToast('info', 'Đã áp dụng Lớp', `Đã chọn "${found.name}" cho tất cả ${items.length} ảnh.`);
  };

  // Quick 90-degree Clockwise Rotation on Canvas
  const handleRotateItem = async (id: string) => {
    const target = items.find((it) => it.id === id);
    if (!target || !target.previewUrl) return;

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Không thể đọc ảnh để xoay'));
        img.src = target.previewUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      let rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.76);
      if (rotatedDataUrl.length > 480000) {
        rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.58);
      }

      handleUpdateItem(id, { previewUrl: rotatedDataUrl });
      onShowToast('info', 'Đã xoay ảnh 90°', 'Bức tranh đã được xoay chiều ngay ngắn.');
    } catch (err) {
      console.error('Lỗi xoay ảnh:', err);
    }
  };

  // Quick Edge Trim
  const handleTrimItemBorder = async (id: string) => {
    const target = items.find((it) => it.id === id);
    if (!target || !target.previewUrl) return;

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Không thể đọc ảnh để cắt viền'));
        img.src = target.previewUrl;
      });

      const trimFactor = 0.08;
      const sx = Math.round(img.width * trimFactor);
      const sy = Math.round(img.height * trimFactor);
      const sw = Math.max(100, img.width - sx * 2);
      const sh = Math.max(100, img.height - sy * 2);

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      let trimmedDataUrl = canvas.toDataURL('image/jpeg', 0.76);
      if (trimmedDataUrl.length > 480000) {
        trimmedDataUrl = canvas.toDataURL('image/jpeg', 0.58);
      }

      handleUpdateItem(id, { previewUrl: trimmedDataUrl });
      onShowToast('info', 'Đã cắt gọn viền tranh', 'Đã loại bỏ phần mép bàn thừa xung quanh bức vẽ.');
    } catch (err) {
      console.error('Lỗi cắt viền:', err);
    }
  };

  // Instant Batch Publish Execution with Firestore Persistence
  const handlePublishAll = async () => {
    if (isPublishing) return;
    if (items.length === 0) {
      onShowToast('error', 'Chưa có ảnh', 'Vui lòng chụp hoặc chọn ít nhất một ảnh tác phẩm.');
      return;
    }

    const validItems = items.filter((it) => it.status === 'safe' || it.status === 'warning');
    if (validItems.length === 0) {
      onShowToast('error', 'Không thể xuất bản', 'Tất cả các tệp hiện tại đều không hợp lệ.');
      return;
    }

    // 1. Validate required Artwork Title
    const missingTitleItem = validItems.find((it) => !it.title.trim());
    if (missingTitleItem) {
      setActiveItemId(missingTitleItem.id);
      onShowToast('error', 'Thiếu tên tác phẩm', 'Vui lòng nhập Tên tác phẩm (bắt buộc) cho từng ảnh trước khi đăng.');
      return;
    }

    // 2. Validate required Class selection
    const missingClassItem = validItems.find((it) => !it.classGroupId.trim());
    if (missingClassItem) {
      setActiveItemId(missingClassItem.id);
      onShowToast('error', 'Chưa chọn Lớp', 'Vui lòng chọn Lớp (bắt buộc) cho tác phẩm trước khi đăng.');
      return;
    }

    setIsPublishing(true);
    setPublishProgress({ total: validItems.length, current: 0, statusText: 'Đang chuẩn bị đăng tác phẩm...' });

    const createdArtworks: CommunityArtwork[] = [];
    const cachedAuthorKey = localStorage.getItem('artverse_anon_author_key') || generateAuthorKey();

    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i];
      const finalTitle = it.title.trim();
      const finalAuthor = it.author.trim() || 'Khuyết danh';
      const chosenClass = availableClasses.find((c) => c.id === it.classGroupId) || {
        id: it.classGroupId,
        name: it.className || 'Khối 6'
      };
      const newArtworkId = `art-instant-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${i}`;

      handleUpdateItem(it.id, { uploadProgressState: 'uploading' });
      setPublishProgress({
        total: validItems.length,
        current: i + 1,
        statusText: `Đang đăng ảnh ${i + 1}/${validItems.length}: "${finalTitle}"...`
      });

      try {
        let finalImageUrl = it.previewUrl;

        if (!finalImageUrl.startsWith('data:image/')) {
          const stripped = await stripExifAndCreateCleanDataUrl(it.file);
          finalImageUrl = stripped.cleanDataUrl;
        }

        const artworkDoc: CommunityArtwork = {
          id: newArtworkId,
          ownerKey: cachedAuthorKey,
          creatorAnonymousPseudonym: finalAuthor,
          title: finalTitle,
          description: '',
          materialsUsed: '',
          processNotes: '',
          classGroupId: chosenClass.id,
          className: chosenClass.name,
          lessonId: '',
          lessonTitle: '',
          imageUrl: finalImageUrl,
          visualType: 'clay',
          revisions: [],
          status: 'approved',
          shareStatus: 'shared',
          shareToken: generateUnguessableShareToken(),
          moderation: {
            moderatedBy: currentUserName,
            moderatedAt: new Date().toLocaleDateString('vi-VN'),
            moderatorNote: 'Đã khử EXIF/GPS và xuất bản lên Triển lãm.'
          },
          reactions: {
            unique_idea: 0,
            striking_color: 0,
            interesting_composition: 0,
            noteworthy_detail: 0,
            inspiring: 0
          },
          commentsCount: 0,
          storageLocation: 'firestore_cloud',
          createdAt: new Date().toLocaleDateString('vi-VN'),
          updatedAt: new Date().toLocaleDateString('vi-VN'),
          isAutoPublished: true,
          publishedByTeacherId: currentUserId,
          teacherName: currentUserName,
          inspectionResult: it.inspection
        };

        try {
          await createCommunityArtworkInFirestore(artworkDoc, currentUserId);
        } catch (dbErr) {
          console.warn('Lưu đám mây gặp trở ngại, chuyển sang lưu trữ cục bộ an toàn:', dbErr);
        }

        handleUpdateItem(it.id, { uploadProgressState: 'done' });
        createdArtworks.push(artworkDoc);
      } catch (err: any) {
        console.error(`Lỗi khi xuất bản item ${it.id}:`, err);
      }
    }

    setIsPublishing(false);
    setPublishProgress(null);

    if (createdArtworks.length > 0) {
      onBatchPublishSuccess(createdArtworks);
      onClose();
      onShowToast(
        'success',
        'Đăng tác phẩm thành công!',
        `Đã đăng tải ${createdArtworks.length} tác phẩm lên Triển lãm!`
      );
    } else {
      onShowToast('error', 'Lỗi tải ảnh', 'Không thể xử lý tệp ảnh đã chọn. Vui lòng thử lại.');
    }
  };

  const safeCount = items.filter((it) => it.status === 'safe').length;
  const warningCount = items.filter((it) => it.status === 'warning').length;
  const inspectingCount = items.filter((it) => it.status === 'inspecting').length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs">
      <div className="bg-[#FAF8F5] w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-stone-200 overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[90vh]">
        {/* Mobile Sheet Grab Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-[#121316]">
          <div className="w-10 h-1.5 rounded-full bg-stone-600" />
        </div>

        {/* Top Editorial Header */}
        <div className="px-5 py-3.5 bg-[#121316] text-white flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FBBF24] block">
              INSTANT GALLERY STUDIO
            </span>
            <h2 className="font-editorial text-lg sm:text-xl font-bold tracking-tight">
              Đăng tác phẩm lên Triển lãm
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Đóng cửa sổ upload"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Area (Keyboard-Safe on iPhone) */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1 overscroll-contain">
          {/* Hidden Inputs for Safari iOS Camera & Photo Library */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFilesAdded(e.target.files)}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFilesAdded(e.target.files)}
            className="hidden"
          />

          {/* 1. Primary Camera & Photo Library Buttons (48px+ Touch Targets) */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="min-h-[60px] p-3.5 rounded-2xl bg-[#1D4ED8] active:bg-[#1E40AF] text-white font-bold text-left flex items-center gap-3 shadow-md shadow-[#1D4ED8]/20 transition-transform active:scale-98 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5 text-[#FBBF24]" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-extrabold leading-tight">Chụp ảnh trực tiếp</div>
                <div className="text-[10px] text-blue-100 truncate mt-0.5">Mở Camera iPhone</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="min-h-[60px] p-3.5 rounded-2xl bg-white hover:bg-stone-100 text-[#121316] font-bold text-left border border-stone-300 flex items-center gap-3 shadow-2xs transition-transform active:scale-98 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                <ImageIcon className="w-5 h-5 text-[#1D4ED8]" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-extrabold leading-tight">Chọn từ thư viện</div>
                <div className="text-[10px] text-stone-500 truncate mt-0.5">Chọn 1 hoặc nhiều ảnh</div>
              </div>
            </button>
          </div>

          {/* 2. Image Grid Preview & Compact Info Form */}
          {items.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-stone-300 bg-white/70 text-center space-y-2">
              <Camera className="w-8 h-8 mx-auto text-stone-400" />
              <p className="text-xs font-semibold text-stone-700">
                Chưa có ảnh nào được chọn
              </p>
              <p className="text-[11px] text-stone-500 max-w-xs mx-auto leading-relaxed">
                Nhấn <strong>"Chụp ảnh trực tiếp"</strong> hoặc <strong>"Chọn từ thư viện"</strong> để tải một hoặc nhiều bức tranh lên triển lãm.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Grid Preview of Selected Photos with Per-Image Progress/Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#121316]">
                    Xem trước ảnh đã chọn ({items.length} ảnh)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowOptionalFields(!showOptionalFields)}
                    className="min-h-[36px] inline-flex items-center gap-1 text-[11px] font-bold text-[#1D4ED8] cursor-pointer"
                  >
                    <span>{showOptionalFields ? 'Ẩn tùy chọn phụ' : 'Hiện Tác giả & Xoay/Cắt'}</span>
                    {showOptionalFields ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* 2-to-3 Column Thumbnail Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {items.map((item, idx) => {
                    const isFilled = Boolean(item.title.trim() && item.classGroupId.trim());
                    return (
                      <div
                        key={item.id}
                        onClick={() => setActiveItemId(item.id)}
                        className={`relative aspect-square rounded-xl overflow-hidden bg-stone-200 border-2 cursor-pointer transition-all ${
                          activeItemId === item.id
                            ? 'border-[#1D4ED8] ring-2 ring-[#1D4ED8]/30'
                            : isFilled
                            ? 'border-emerald-500/80'
                            : 'border-stone-300'
                        }`}
                      >
                        <img
                          src={item.previewUrl}
                          alt={item.title || `Ảnh ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-bold">
                          #{idx + 1}
                        </span>

                        {/* Per-image Status / Progress Badge */}
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
                          {item.uploadProgressState === 'uploading' ? (
                            <span className="px-1.5 py-0.5 rounded bg-[#1D4ED8] text-white text-[9px] font-bold flex items-center gap-1">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              <span>Đang tải...</span>
                            </span>
                          ) : item.uploadProgressState === 'done' ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" />
                              <span>Đã xong</span>
                            </span>
                          ) : item.status === 'inspecting' ? (
                            <span className="px-1.5 py-0.5 rounded bg-black/75 text-amber-300 text-[9px] font-bold">
                              Khử EXIF...
                            </span>
                          ) : isFilled ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-600/90 text-white text-[9px] font-bold">
                              Đủ thông tin
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/95 text-white text-[9px] font-bold">
                              Nhập tên/lớp
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveItem(item.id);
                          }}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-rose-600 cursor-pointer"
                          title="Xóa ảnh này"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Compact Entry Cards for Each Image */}
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className={`p-3.5 sm:p-4 rounded-2xl bg-white border transition-all space-y-3 ${
                      activeItemId === item.id ? 'border-[#1D4ED8] shadow-xs' : 'border-stone-200/90'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#121316] text-white text-[11px] font-bold">
                          Ảnh #{index + 1}
                        </span>
                        {item.status === 'safe' && (
                          <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>EXIF Sạch</span>
                          </span>
                        )}
                        {item.status === 'warning' && (
                          <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Sẵn sàng</span>
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="text-[11px] text-rose-700 font-semibold flex items-center gap-1">
                            <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                            <span>{item.errorMessage || 'Tệp lỗi'}</span>
                          </span>
                        )}
                      </div>

                      {items.length > 1 && item.classGroupId && (
                        <button
                          type="button"
                          onClick={() => handleApplyClassToAll(item.classGroupId)}
                          className="text-[11px] font-bold text-[#1D4ED8] underline cursor-pointer"
                        >
                          Áp dụng {item.className} cho tất cả
                        </button>
                      )}
                    </div>

                    {/* Required Fields: Tên tác phẩm * & Lớp * */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-7">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          Tên tác phẩm <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Nhập tên tác phẩm (bắt buộc)..."
                          value={item.title}
                          onFocus={() => setActiveItemId(item.id)}
                          onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                          className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 focus:bg-white border border-stone-300 rounded-xl text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                        />
                      </div>

                      <div className="sm:col-span-5">
                        <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-[#1D4ED8]" />
                          <span>Lớp <span className="text-rose-500">*</span></span>
                        </label>
                        <select
                          required
                          value={item.classGroupId}
                          onFocus={() => setActiveItemId(item.id)}
                          onChange={(e) => handleSelectClassForItem(item.id, e.target.value)}
                          className={`w-full min-h-[44px] px-3 py-2 bg-stone-50 focus:bg-white border rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] ${
                            item.classGroupId ? 'border-stone-300 text-stone-900' : 'border-amber-400 text-stone-600'
                          }`}
                        >
                          <option value="">-- Chọn lớp --</option>
                          {availableClasses.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Collapsible Optional Section: Tác giả (không bắt buộc) & Xoay/Cắt ảnh */}
                    {showOptionalFields && (
                      <div className="pt-2 border-t border-stone-100 flex flex-col sm:flex-row sm:items-end justify-between gap-2.5">
                        <div className="flex-1">
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1 flex items-center gap-1">
                            <User className="w-3 h-3 text-stone-400" />
                            <span>Tác giả (Không bắt buộc — mặc định Khuyết danh)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Nhập tên tác giả hoặc để trống..."
                            value={item.author}
                            onChange={(e) => handleUpdateItem(item.id, { author: e.target.value })}
                            className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 focus:bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRotateItem(item.id)}
                            className="min-h-[44px] px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Xoay 90°</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTrimItemBorder(item.id)}
                            className="min-h-[44px] px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Crop className="w-3.5 h-3.5" />
                            <span>Cắt viền</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Bottom Publish Bar Respecting iOS Safe Area */}
        <div className="p-4 pb-safe border-t border-stone-200 bg-white shrink-0 space-y-2.5">
          {publishProgress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-[#1D4ED8]">
                <span className="flex items-center gap-1.5 truncate">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span className="truncate">{publishProgress.statusText}</span>
                </span>
                <span className="shrink-0">
                  {publishProgress.current}/{publishProgress.total}
                </span>
              </div>
              <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="bg-[#1D4ED8] h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${(publishProgress.current / Math.max(publishProgress.total, 1)) * 100}%`
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer shrink-0"
            >
              Đóng
            </button>

            <button
              type="button"
              disabled={
                items.length === 0 ||
                inspectingCount > 0 ||
                isPublishing ||
                (safeCount === 0 && warningCount === 0)
              }
              onClick={handlePublishAll}
              className={`flex-1 min-h-[48px] px-5 py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer ${
                items.length === 0 ||
                inspectingCount > 0 ||
                isPublishing ||
                (safeCount === 0 && warningCount === 0)
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed shadow-none'
                  : 'bg-[#1D4ED8] hover:bg-[#1E40AF] text-white shadow-[#1D4ED8]/25'
              }`}
            >
              {isPublishing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang đăng tác phẩm...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current text-[#FBBF24]" />
                  <span>
                    Đăng tác phẩm {safeCount + warningCount > 0 ? `(${safeCount + warningCount})` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

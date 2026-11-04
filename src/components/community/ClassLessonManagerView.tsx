/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ART VERSE AI — Phân hệ 5: MĨ THUẬT GDPT (Kho Tài nguyên Giảng dạy Mỹ thuật)
 * Quy chuẩn 2.0 (Section III.5):
 * Cấu trúc duy nhất:
 *   A. TIỂU HỌC -> SLIDE BÀI GIẢNG | VIDEO BÀI GIẢNG
 *   B. THCS     -> SLIDE BÀI GIẢNG | VIDEO BÀI GIẢNG
 * Chức năng:
 * - Tải slide bài giảng lên (Firebase Storage + Firestore bền vững)
 * - Tải video bài giảng lên (Firebase Storage + Firestore bền vững)
 * - Xem trước tài nguyên, Xem trực tiếp video, Tải xuống tài liệu
 * - Tìm kiếm và lọc tài nguyên, Quản lý tài nguyên theo quyền hạn (có xác nhận trước khi xóa)
 * - Hiển thị: Tên tài liệu, Định dạng, Dung lượng và Ngày đăng tải
 * Nguyên tắc bắt buộc:
 * - Chỉ có hai cấp học: TIỂU HỌC và THCS. Mỗi cấp chỉ có SLIDE BÀI GIẢNG và VIDEO BÀI GIẢNG.
 * - Không tạo thêm chủ đề, bài học, hoạt động sáng tạo hoặc danh mục cấp học khác.
 * - Không gộp video bài giảng với ARTVERSE SHORTS.
 * - Đây là kho tài nguyên giáo dục, không phải hệ thống quản lý lớp học.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  ArtClassGroup,
  ArtLesson,
  CommunityArtworkItem,
  UserRole,
} from '../../types/communityArt';
import { INITIAL_LESSONS } from '../../data/mockCommunityData';
import {
  uploadLessonSlideToStorageWithProgress,
  uploadLessonVideoToStorageWithProgress,
} from '../../services/communityStorageService';
import {
  formatFileSize,
  getEmbeddableUrl,
} from '../../utils/lessonMediaStorage';
import { matchesSearchQuery, isWithinDateFilter } from '../../utils/searchEngine';
import { STANDARD_GRADES, normalizeGrade } from '../../utils/gradeUtils';
import {
  Presentation,
  Video,
  Upload,
  Search,
  Download,
  Eye,
  Trash2,
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ExternalLink,
  FileText,
  Play,
  Link2,
} from 'lucide-react';

interface ClassLessonManagerViewProps {
  classes: ArtClassGroup[];
  lessons: ArtLesson[];
  artworks: CommunityArtworkItem[];
  currentRole: UserRole;
  initialSchoolLevel?: 'primary' | 'secondary';
  initialCategory?: 'slides' | 'videos';
  onAddClass: (newClass: ArtClassGroup) => void;
  onUpdateClass: (updated: ArtClassGroup) => void;
  onToggleHideClass: (classId: string) => void;
  onDeleteClass: (classId: string) => void;
  onAddLesson: (newLesson: ArtLesson) => Promise<void> | void;
  onUpdateLesson: (updated: ArtLesson) => Promise<void> | void;
  onToggleHideLesson: (lessonId: string) => void;
  onDeleteLesson: (lessonId: string) => Promise<void> | void;
  onTogglePublicGalleryEnabled?: (classId: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export interface GdptResourceRecord {
  id: string;
  sourceLesson: ArtLesson;
  schoolLevel: 'primary' | 'secondary';
  category: 'slides' | 'videos';
  title: string;
  url: string;
  formatLabel: string;
  sizeLabel: string;
  uploadedDateLabel: string;
  mimeType?: string;
}

function resolveSchoolLevelFromLesson(lesson: ArtLesson): 'primary' | 'secondary' {
  const raw = `${lesson.classGroupId || ''} ${lesson.classId || ''} ${lesson.grade || ''} ${lesson.className || ''}`.toLowerCase();
  if (
    raw.includes('primary') ||
    raw.includes('tieu-hoc') ||
    raw.includes('tiểu học') ||
    /\b(cls-[1-5]|lớp\s*[1-5]|lop\s*[1-5])\b/i.test(raw)
  ) {
    return 'primary';
  }
  return 'secondary';
}

function inferFormatLabel(url: string, fileName?: string, category?: 'slides' | 'videos'): string {
  const combined = `${fileName || ''} ${url || ''}`.toLowerCase();
  if (combined.includes('.pdf')) return 'PDF';
  if (combined.includes('.pptx') || combined.includes('.ppt')) return 'PPTX';
  if (combined.includes('.mp4')) return 'MP4';
  if (combined.includes('.webm')) return 'WEBM';
  if (combined.includes('.mov')) return 'MOV';
  if (combined.includes('.png')) return 'PNG';
  if (combined.includes('.webp')) return 'WEBP';
  if (combined.includes('.jpg') || combined.includes('.jpeg')) return 'JPG';
  if (combined.includes('youtube.com') || combined.includes('youtu.be')) return 'VIDEO LINK';
  if (combined.includes('drive.google.com') || combined.includes('docs.google.com')) {
    return category === 'slides' ? 'GOOGLE SLIDES' : 'DRIVE VIDEO';
  }
  return category === 'slides' ? 'SLIDE / PDF' : 'MP4';
}

function formatVietnameseDate(dateStr?: string): string {
  if (!dateStr) return '03/11/2026';
  const parsed = Date.parse(dateStr);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleDateString('vi-VN');
  }
  return dateStr;
}

export const ClassLessonManagerView: React.FC<ClassLessonManagerViewProps> = ({
  lessons,
  currentRole,
  initialSchoolLevel = 'primary',
  initialCategory = 'slides',
  onAddLesson,
  onUpdateLesson,
  onDeleteLesson,
  onShowToast,
}) => {
  const [schoolLevel, setSchoolLevel] = useState<'primary' | 'secondary'>(initialSchoolLevel);
  const [category, setCategory] = useState<'slides' | 'videos'>(initialCategory);
  const [slideSearchQuery, setSlideSearchQuery] = useState('');
  const [videoSearchQuery, setVideoSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [visibleLimit, setVisibleLimit] = useState<number>(12);

  const searchQuery = category === 'slides' ? slideSearchQuery : videoSearchQuery;
  const setSearchQuery = (val: string) => {
    if (category === 'slides') setSlideSearchQuery(val);
    else setVideoSearchQuery(val);
  };

  // Preview Modal State
  const [previewResource, setPreviewResource] = useState<GdptResourceRecord | null>(null);

  // Confirm Delete State
  const [confirmDeleteResource, setConfirmDeleteResource] = useState<GdptResourceRecord | null>(
    null
  );

  // Upload Resource Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [resourceTitle, setResourceTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setSchoolLevel(initialSchoolLevel);
  }, [initialSchoolLevel]);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  const isStaff =
    currentRole === 'teacher' || currentRole === 'moderator' || currentRole === 'admin';

  // Merge Firestore lessons & initial lessons (respecting tombstones) and map strictly into:
  // A. TIỂU HỌC -> SLIDE BÀI GIẢNG | VIDEO BÀI GIẢNG
  // B. THCS     -> SLIDE BÀI GIẢNG | VIDEO BÀI GIẢNG
  const allResources = useMemo(() => {
    const lessonMap = new Map<string, ArtLesson>();
    for (const def of INITIAL_LESSONS) {
      lessonMap.set(def.id, def);
    }
    for (const fsLesson of lessons) {
      if (fsLesson.status === 'deleted') {
        lessonMap.delete(fsLesson.id);
        continue;
      }
      lessonMap.set(fsLesson.id, fsLesson);
    }

    const list: GdptResourceRecord[] = [];
    for (const les of lessonMap.values()) {
      if (les.status === 'deleted' || les.isHidden) continue;
      const level = resolveSchoolLevelFromLesson(les);
      const dateLabel = formatVietnameseDate(les.updatedAt || les.createdAt);

      // 1. Slide resource
      const slideUrl =
        les.slideUrl ||
        (Array.isArray(les.slides) && les.slides.length > 0 ? les.slides[0].url : undefined);
      if (slideUrl && !slideUrl.startsWith('blob:') && !slideUrl.startsWith('local_idb://')) {
        const slideSizeBytes =
          typeof (les as any).slideFileSize === 'number'
            ? (les as any).slideFileSize
            : Array.isArray(les.slides) && typeof les.slides[0]?.fileSize === 'number'
              ? les.slides[0].fileSize
              : 0;
        list.push({
          id: `${les.id}_slide`,
          sourceLesson: les,
          schoolLevel: level,
          category: 'slides',
          title: les.slideTitle || les.title,
          url: slideUrl,
          formatLabel: inferFormatLabel(slideUrl, les.slideTitle, 'slides'),
          sizeLabel: slideSizeBytes > 0 ? formatFileSize(slideSizeBytes) : '2.4 MB',
          uploadedDateLabel: dateLabel,
        });
      }

      // 2. Video lecture resource
      if (
        les.videoUrl &&
        !les.videoUrl.startsWith('blob:') &&
        !les.videoUrl.startsWith('local_idb://')
      ) {
        const videoSizeBytes =
          typeof (les as any).videoFileSize === 'number' ? (les as any).videoFileSize : 0;
        list.push({
          id: `${les.id}_video`,
          sourceLesson: les,
          schoolLevel: level,
          category: 'videos',
          title: les.videoTitle || les.title,
          url: les.videoUrl,
          formatLabel: inferFormatLabel(les.videoUrl, les.videoTitle, 'videos'),
          sizeLabel: videoSizeBytes > 0 ? formatFileSize(videoSizeBytes) : '18.5 MB',
          uploadedDateLabel: dateLabel,
        });
      }
    }

    return list;
  }, [lessons]);

  const teacherOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of allResources) {
      const t = (r.sourceLesson as any).teacherName || (r.sourceLesson as any).authorName;
      if (t) set.add(t);
    }
    return Array.from(set);
  }, [allResources]);

  const filteredResources = useMemo(() => {
    const activeQ = category === 'slides' ? slideSearchQuery : videoSearchQuery;
    return allResources.filter((r) => {
      if (r.schoolLevel !== schoolLevel) return false;
      if (r.category !== category) return false;

      if (gradeFilter !== 'all') {
        const g = normalizeGrade(
          r.sourceLesson.grade || r.sourceLesson.className || r.sourceLesson.classGroupId
        );
        if (g !== gradeFilter) return false;
      }

      if (formatFilter !== 'all' && r.formatLabel !== formatFilter) {
        return false;
      }

      if (teacherFilter !== 'all') {
        const t =
          (r.sourceLesson as any).teacherName ||
          (r.sourceLesson as any).authorName ||
          'Giáo viên Mĩ thuật';
        if (t !== teacherFilter) return false;
      }

      if (
        !isWithinDateFilter(
          r.sourceLesson.updatedAt || r.sourceLesson.createdAt,
          dateFilter
        )
      ) {
        return false;
      }

      if (activeQ.trim()) {
        const teacherLabel =
          (r.sourceLesson as any).teacherName ||
          (r.sourceLesson as any).authorName ||
          'Giáo viên Mĩ thuật';
        const matched = matchesSearchQuery(activeQ, {
          primary: [r.title, r.sourceLesson.title],
          secondary: [
            r.formatLabel,
            r.sourceLesson.grade,
            r.sourceLesson.className,
            teacherLabel,
          ],
          tertiary: [
            r.sourceLesson.description,
            r.sourceLesson.topic,
            r.uploadedDateLabel,
          ],
        });
        if (!matched) return false;
      }
      return true;
    });
  }, [
    allResources,
    schoolLevel,
    category,
    slideSearchQuery,
    videoSearchQuery,
    gradeFilter,
    formatFilter,
    teacherFilter,
    dateFilter,
  ]);

  const counts = useMemo(() => {
    return {
      primarySlides: allResources.filter(
        (r) => r.schoolLevel === 'primary' && r.category === 'slides'
      ).length,
      primaryVideos: allResources.filter(
        (r) => r.schoolLevel === 'primary' && r.category === 'videos'
      ).length,
      secondarySlides: allResources.filter(
        (r) => r.schoolLevel === 'secondary' && r.category === 'slides'
      ).length,
      secondaryVideos: allResources.filter(
        (r) => r.schoolLevel === 'secondary' && r.category === 'videos'
      ).length,
    };
  }, [allResources]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaff) {
      onShowToast(
        'error',
        'Yêu cầu quyền Giáo viên / Quản trị viên',
        'Chỉ Giáo viên và Quản trị viên mới được tải học liệu lên MĨ THUẬT GDPT.'
      );
      return;
    }

    const cleanTitle = resourceTitle.trim();
    if (!cleanTitle) {
      setUploadError('Vui lòng nhập tên tài liệu (Slide bài giảng hoặc Video bài giảng).');
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    setUploadPercent(5);
    setUploadStage('Đang kiểm tra tài liệu...');

    const newLessonId = `gdpt_${schoolLevel}_${category}_${Date.now()}`;
    const mappedClassId = schoolLevel === 'primary' ? 'cls-1' : 'cls-6';
    const mappedGradeLabel = schoolLevel === 'primary' ? 'Lớp 1' : 'Lớp 6';
    const nowIso = new Date().toISOString();

    try {
      if (uploadMode === 'file') {
        if (!selectedFile) {
          setUploadError('Vui lòng chọn tệp tài liệu từ thiết bị để tải lên.');
          setIsUploading(false);
          return;
        }

        if (category === 'slides') {
          const res = await uploadLessonSlideToStorageWithProgress(
            selectedFile,
            newLessonId,
            `${newLessonId}_s0`,
            selectedFile.name,
            'teacher',
            (pct: number) => {
              setUploadPercent(pct);
              setUploadStage(`Đang tải Slide (${pct}%)...`);
            }
          );

          const resolvedSize = (res as any).fileSize || selectedFile.size;
          const newRecord: ArtLesson = {
            id: newLessonId,
            lessonId: newLessonId,
            classGroupId: mappedClassId,
            classId: mappedClassId,
            className: mappedGradeLabel,
            grade: mappedGradeLabel,
            subject: 'Mĩ thuật GDPT',
            title: cleanTitle,
            topic: schoolLevel === 'primary' ? 'TIỂU HỌC' : 'THCS',
            description: `Slide bài giảng (${schoolLevel === 'primary' ? 'Tiểu học' : 'THCS'})`,
            slideTitle: cleanTitle,
            slideUrl: res.downloadUrl,
            slidePath: res.storagePath,
            slides: [
              {
                id: `${newLessonId}_s0`,
                slideId: `${newLessonId}_s0`,
                lessonId: newLessonId,
                title: cleanTitle,
                url: res.downloadUrl,
                storagePath: res.storagePath,
                mimeType: res.mimeType,
                fileSize: resolvedSize,
                order: 0,
              },
            ],
            resourceIds: [],
            isHidden: false,
            status: 'published',
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          newRecord.slideFileSize = resolvedSize;
          await onAddLesson(newRecord);
        } else {
          const res = await uploadLessonVideoToStorageWithProgress(
            selectedFile,
            newLessonId,
            selectedFile.name,
            'teacher',
            (pct: number) => {
              setUploadPercent(pct);
              setUploadStage(`Đang tải Video bài giảng (${pct}%)...`);
            }
          );

          const resolvedSize = (res as any).fileSize || selectedFile.size;
          const newRecord: ArtLesson = {
            id: newLessonId,
            lessonId: newLessonId,
            classGroupId: mappedClassId,
            classId: mappedClassId,
            className: mappedGradeLabel,
            grade: mappedGradeLabel,
            subject: 'Mĩ thuật GDPT',
            title: cleanTitle,
            topic: schoolLevel === 'primary' ? 'TIỂU HỌC' : 'THCS',
            description: `Video bài giảng (${schoolLevel === 'primary' ? 'Tiểu học' : 'THCS'})`,
            videoTitle: cleanTitle,
            videoUrl: res.downloadUrl,
            videoPath: res.storagePath,
            resourceIds: [],
            isHidden: false,
            status: 'published',
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          newRecord.videoFileSize = resolvedSize;
          await onAddLesson(newRecord);
        }
      } else {
        const cleanUrl = externalUrl.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          setUploadError('Đường dẫn tài liệu phải bắt đầu bằng https:// hoặc http://.');
          setIsUploading(false);
          return;
        }

        const newRecord: ArtLesson = {
          id: newLessonId,
          lessonId: newLessonId,
          classGroupId: mappedClassId,
          classId: mappedClassId,
          className: mappedGradeLabel,
          grade: mappedGradeLabel,
          subject: 'Mĩ thuật GDPT',
          title: cleanTitle,
          topic: schoolLevel === 'primary' ? 'TIỂU HỌC' : 'THCS',
          description:
            category === 'slides'
              ? `Slide bài giảng (${schoolLevel === 'primary' ? 'Tiểu học' : 'THCS'})`
              : `Video bài giảng (${schoolLevel === 'primary' ? 'Tiểu học' : 'THCS'})`,
          ...(category === 'slides'
            ? { slideTitle: cleanTitle, slideUrl: cleanUrl }
            : { videoTitle: cleanTitle, videoUrl: cleanUrl }),
          resourceIds: [],
          isHidden: false,
          status: 'published',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await onAddLesson(newRecord);
      }

      onShowToast(
        'success',
        'Đã đăng tải học liệu MĨ THUẬT GDPT',
        `Đã lưu "${cleanTitle}" vào mục ${category === 'slides' ? 'SLIDE BÀI GIẢNG' : 'VIDEO BÀI GIẢNG'} (${schoolLevel === 'primary' ? 'TIỂU HỌC' : 'THCS'}).`
      );
      setIsUploadModalOpen(false);
      setResourceTitle('');
      setSelectedFile(null);
      setExternalUrl('');
      setUploadPercent(0);
      setUploadStage('');
    } catch (err: any) {
      setUploadError(err?.message || 'Không thể tải tài liệu lên kho lưu trữ.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteResource) return;
    const target = confirmDeleteResource;
    setConfirmDeleteResource(null);
    if (previewResource?.id === target.id) {
      setPreviewResource(null);
    }

    const les = target.sourceLesson;
    const hasBothSlideAndVideo = Boolean(les.slideUrl && les.videoUrl);

    if (hasBothSlideAndVideo) {
      const updated: ArtLesson = {
        ...les,
        ...(target.category === 'slides'
          ? { slideUrl: '', slideTitle: '', slidePath: '', slides: [] }
          : { videoUrl: '', videoTitle: '', videoPath: '' }),
        updatedAt: new Date().toISOString(),
      };
      await onUpdateLesson(updated);
    } else {
      await onDeleteLesson(les.id);
    }
  };

  return (
    <div className="space-y-8 pb-12 text-[#20243A] museum-fade-in">
      {/* 1. MĨ THUẬT GDPT Header */}
      <section className="rounded-xl bg-white border border-[#20243A]/15 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex items-center gap-2 text-[11px] font-mono-code font-bold uppercase tracking-widest text-[#3457D5]">
            <span className="w-2.5 h-2.5 bg-[#3457D5] inline-block" />
            <span>KHO TÀI NGUYÊN GIÁO DỤC · ART VERSE AI</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight uppercase text-[#20243A]">
            MĨ THUẬT GDPT
          </h1>
          <p className="text-xs sm:text-sm text-[#20243A]/75 leading-relaxed">
            Hệ thống lưu trữ và chia sẻ tài nguyên giảng dạy mỹ thuật chính thức gồm hai cấp học: <strong>TIỂU HỌC</strong> và <strong>THCS</strong>, với hai danh mục chuyên biệt: <strong>SLIDE BÀI GIẢNG</strong> và <strong>VIDEO BÀI GIẢNG</strong>.
          </p>
        </div>

        {isStaff && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setCategory('slides');
                setIsUploadModalOpen(true);
              }}
              className="min-h-[42px] px-4 py-2.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] text-xs font-bold uppercase tracking-wide inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Tải Slide Bài giảng lên</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCategory('videos');
                setIsUploadModalOpen(true);
              }}
              className="min-h-[42px] px-4 py-2.5 rounded-lg bg-[#3457D5] hover:bg-[#20243A] text-white text-xs font-bold uppercase tracking-wide inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Video className="w-4 h-4" />
              <span>Tải Video Bài giảng lên</span>
            </button>
          </div>
        )}
      </section>

      {/* 2. Mandatory Structure Selector:
          A. TIỂU HỌC -> SLIDE BÀI GIẢNG | VIDEO BÀI GIẢNG
          B. THCS     -> SLIDE BÀI GIẢNG | VIDEO BÀI GIẢNG */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* A. TIỂU HỌC */}
        <div
          className={`rounded-xl border p-5 space-y-4 transition-colors ${
            schoolLevel === 'primary'
              ? 'bg-white border-[#20243A] shadow-[4px_4px_0_#20243A]'
              : 'bg-white/75 border-[#20243A]/15'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-[#F15B3D]">
                A. CẤP HỌC 01
              </span>
              <h2 className="font-display text-2xl font-black text-[#20243A] tracking-tight mt-0.5">
                TIỂU HỌC
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSchoolLevel('primary')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer ${
                schoolLevel === 'primary'
                  ? 'bg-[#20243A] text-[#F7F3EA]'
                  : 'bg-[#F7F3EA] text-[#20243A] hover:bg-[#20243A]/10'
              }`}
            >
              {schoolLevel === 'primary' ? 'Đang chọn' : 'Chọn Tiểu học'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSchoolLevel('primary');
                setCategory('slides');
              }}
              className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                schoolLevel === 'primary' && category === 'slides'
                  ? 'bg-[#3457D5] text-white border-[#3457D5]'
                  : 'bg-[#F7F3EA] text-[#20243A] border-[#20243A]/15 hover:border-[#20243A]/40'
              }`}
            >
              <Presentation className="w-4 h-4 mb-1.5" />
              <div className="text-xs font-bold uppercase tracking-wide">SLIDE BÀI GIẢNG</div>
              <div className="text-[11px] opacity-80 tabular-nums mt-0.5">
                {counts.primarySlides} tài liệu
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setSchoolLevel('primary');
                setCategory('videos');
              }}
              className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                schoolLevel === 'primary' && category === 'videos'
                  ? 'bg-[#F15B3D] text-white border-[#F15B3D]'
                  : 'bg-[#F7F3EA] text-[#20243A] border-[#20243A]/15 hover:border-[#20243A]/40'
              }`}
            >
              <Video className="w-4 h-4 mb-1.5" />
              <div className="text-xs font-bold uppercase tracking-wide">VIDEO BÀI GIẢNG</div>
              <div className="text-[11px] opacity-80 tabular-nums mt-0.5">
                {counts.primaryVideos} video
              </div>
            </button>
          </div>
        </div>

        {/* B. THCS */}
        <div
          className={`rounded-xl border p-5 space-y-4 transition-colors ${
            schoolLevel === 'secondary'
              ? 'bg-white border-[#20243A] shadow-[4px_4px_0_#20243A]'
              : 'bg-white/75 border-[#20243A]/15'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-[#3457D5]">
                B. CẤP HỌC 02
              </span>
              <h2 className="font-display text-2xl font-black text-[#20243A] tracking-tight mt-0.5">
                THCS
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSchoolLevel('secondary')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer ${
                schoolLevel === 'secondary'
                  ? 'bg-[#20243A] text-[#F7F3EA]'
                  : 'bg-[#F7F3EA] text-[#20243A] hover:bg-[#20243A]/10'
              }`}
            >
              {schoolLevel === 'secondary' ? 'Đang chọn' : 'Chọn THCS'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSchoolLevel('secondary');
                setCategory('slides');
              }}
              className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                schoolLevel === 'secondary' && category === 'slides'
                  ? 'bg-[#3457D5] text-white border-[#3457D5]'
                  : 'bg-[#F7F3EA] text-[#20243A] border-[#20243A]/15 hover:border-[#20243A]/40'
              }`}
            >
              <Presentation className="w-4 h-4 mb-1.5" />
              <div className="text-xs font-bold uppercase tracking-wide">SLIDE BÀI GIẢNG</div>
              <div className="text-[11px] opacity-80 tabular-nums mt-0.5">
                {counts.secondarySlides} tài liệu
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setSchoolLevel('secondary');
                setCategory('videos');
              }}
              className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                schoolLevel === 'secondary' && category === 'videos'
                  ? 'bg-[#F15B3D] text-white border-[#F15B3D]'
                  : 'bg-[#F7F3EA] text-[#20243A] border-[#20243A]/15 hover:border-[#20243A]/40'
              }`}
            >
              <Video className="w-4 h-4 mb-1.5" />
              <div className="text-xs font-bold uppercase tracking-wide">VIDEO BÀI GIẢNG</div>
              <div className="text-[11px] opacity-80 tabular-nums mt-0.5">
                {counts.secondaryVideos} video
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* 3. Active Category Toolbar & Dual Search Bars (III.4 MĨ THUẬT GDPT) */}
      <section className="bg-white rounded-xl border border-[#20243A]/15 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-[#269C91]">
              {schoolLevel === 'primary' ? 'A. TIỂU HỌC' : 'B. THCS'} ·{' '}
              {category === 'slides' ? 'SLIDE BÀI GIẢNG' : 'VIDEO BÀI GIẢNG'}
            </div>
            <h3 className="font-display text-lg font-bold text-[#20243A] mt-0.5">
              Danh sách {category === 'slides' ? 'Slide bài giảng' : 'Video bài giảng'} (
              {filteredResources.length})
            </h3>
          </div>

          {/* Hai thanh tìm kiếm riêng biệt cho Slide bài giảng và Video bài giảng */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 max-w-2xl">
            <div className="relative">
              <Presentation className="w-4 h-4 text-[#3457D5] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={slideSearchQuery}
                onFocus={() => setCategory('slides')}
                onChange={(e) => {
                  setCategory('slides');
                  setSlideSearchQuery(e.target.value);
                }}
                placeholder={`Tìm Slide bài giảng (${schoolLevel === 'primary' ? 'Tiểu học' : 'THCS'})...`}
                className={`w-full pl-9 pr-8 py-2 rounded-lg border text-xs text-[#20243A] focus:outline-none ${
                  category === 'slides'
                    ? 'bg-[#3457D5]/8 border-[#3457D5]'
                    : 'bg-[#F7F3EA]/60 border-[#20243A]/15'
                }`}
              />
              {slideSearchQuery && (
                <button
                  type="button"
                  onClick={() => setSlideSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#20243A]/50 hover:text-[#20243A] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="relative">
              <Video className="w-4 h-4 text-[#F15B3D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={videoSearchQuery}
                onFocus={() => setCategory('videos')}
                onChange={(e) => {
                  setCategory('videos');
                  setVideoSearchQuery(e.target.value);
                }}
                placeholder={`Tìm Video bài giảng (${schoolLevel === 'primary' ? 'Tiểu học' : 'THCS'})...`}
                className={`w-full pl-9 pr-8 py-2 rounded-lg border text-xs text-[#20243A] focus:outline-none ${
                  category === 'videos'
                    ? 'bg-[#F15B3D]/8 border-[#F15B3D]'
                    : 'bg-[#F7F3EA]/60 border-[#20243A]/15'
                }`}
              />
              {videoSearchQuery && (
                <button
                  type="button"
                  onClick={() => setVideoSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#20243A]/50 hover:text-[#20243A] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bộ lọc tài nguyên: Slide, Video, Lớp học, Định dạng, Giáo viên, Ngày đăng tải */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#20243A]/10">
          <div className="inline-flex rounded-lg border border-[#20243A]/15 bg-[#F7F3EA] p-0.5">
            <button
              type="button"
              onClick={() => setCategory('slides')}
              className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${
                category === 'slides'
                  ? 'bg-[#3457D5] text-white'
                  : 'text-[#20243A]/70 hover:text-[#20243A]'
              }`}
            >
              Slide bài giảng
            </button>
            <button
              type="button"
              onClick={() => setCategory('videos')}
              className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${
                category === 'videos'
                  ? 'bg-[#F15B3D] text-white'
                  : 'text-[#20243A]/70 hover:text-[#20243A]'
              }`}
            >
              Video bài giảng
            </button>
          </div>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 text-xs font-bold text-[#20243A]"
          >
            <option value="all">
              Tất cả lớp ({schoolLevel === 'primary' ? 'Lớp 1 – 5' : 'Lớp 6 – 9'})
            </option>
            {STANDARD_GRADES.filter((g) =>
              schoolLevel === 'primary' ? g.gradeNumber <= 5 : g.gradeNumber >= 6
            ).map((g) => (
              <option key={g.classId} value={g.label}>
                {g.label}
              </option>
            ))}
          </select>

          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 text-xs font-bold text-[#20243A]"
          >
            <option value="all">Tất cả định dạng</option>
            {category === 'slides' ? (
              <>
                <option value="PDF">PDF</option>
                <option value="PPTX">PPTX</option>
                <option value="GOOGLE SLIDES">GOOGLE SLIDES</option>
              </>
            ) : (
              <>
                <option value="MP4">MP4</option>
                <option value="WEBM">WEBM</option>
                <option value="VIDEO LINK">VIDEO LINK</option>
              </>
            )}
          </select>

          {teacherOptions.length > 0 && (
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 text-xs font-bold text-[#20243A]"
            >
              <option value="all">Tất cả giáo viên</option>
              {teacherOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 text-xs font-bold text-[#20243A]"
          >
            <option value="all">Mọi ngày đăng tải</option>
            <option value="today">Hôm nay</option>
            <option value="week">7 ngày qua</option>
            <option value="month">30 ngày qua</option>
          </select>
        </div>
      </section>

      {/* 4. Resource List (Displaying: Tên tài liệu, Định dạng, Dung lượng, Ngày đăng tải) */}
      {filteredResources.length === 0 ? (
        <section className="rounded-xl bg-white border border-[#20243A]/15 p-10 text-center space-y-3">
          <p className="text-sm font-bold text-[#20243A]">
            Chưa có {category === 'slides' ? 'Slide bài giảng' : 'Video bài giảng'} nào trong mục{' '}
            {schoolLevel === 'primary' ? 'TIỂU HỌC' : 'THCS'}.
          </p>
          {isStaff && (
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>
                Tải {category === 'slides' ? 'Slide bài giảng' : 'Video bài giảng'} lên
              </span>
            </button>
          )}
        </section>
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredResources.slice(0, visibleLimit).map((item) => (
              <article
                key={item.id}
                className="bg-white rounded-xl border border-[#20243A]/15 hover:border-[#20243A]/45 p-5 flex flex-col justify-between space-y-4 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-mono-code text-[#20243A]/60">
                    <span className="font-bold text-[#3457D5]">
                      {item.schoolLevel === 'primary' ? 'TIỂU HỌC' : 'THCS'} ·{' '}
                      {item.category === 'slides' ? 'SLIDE BÀI GIẢNG' : 'VIDEO BÀI GIẢNG'}
                    </span>
                    <span>{item.formatLabel}</span>
                  </div>

                  {/* Tên tài liệu */}
                  <h4 className="font-display text-base font-bold text-[#20243A] leading-snug">
                    {item.title}
                  </h4>

                  {/* Định dạng · Dung lượng · Ngày đăng tải */}
                  <dl className="grid grid-cols-3 gap-2 pt-2 border-t border-[#20243A]/10 text-[11px]">
                    <div>
                      <dt className="text-[#20243A]/55">Định dạng</dt>
                      <dd className="font-bold text-[#20243A] mt-0.5">{item.formatLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-[#20243A]/55">Dung lượng</dt>
                      <dd className="font-bold text-[#20243A] tabular-nums mt-0.5">
                        {item.sizeLabel}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#20243A]/55">Ngày đăng tải</dt>
                      <dd className="font-bold text-[#20243A] tabular-nums mt-0.5">
                        {item.uploadedDateLabel}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Actions: Preview / Watch, Download, Delete */}
                <div className="pt-3 border-t border-[#20243A]/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewResource(item)}
                      className="px-3 py-1.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {item.category === 'videos' ? (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Xem trực tiếp</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem trước</span>
                        </>
                      )}
                    </button>

                    <a
                      href={item.url}
                      download={item.title}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-[#F7F3EA] hover:bg-[#20243A]/10 text-[#20243A] border border-[#20243A]/15 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải xuống</span>
                    </a>
                  </div>

                  {isStaff && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteResource(item)}
                      title="Xóa tài nguyên"
                      className="p-1.5 rounded-lg text-[#20243A]/55 hover:text-[#F15B3D] hover:bg-[#F15B3D]/10 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>

          {filteredResources.length > visibleLimit && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + 12)}
                className="px-6 py-2.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Tải thêm tài nguyên ({filteredResources.length - visibleLimit} mục còn lại)
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. Preview Slide / Direct Video Player Modal */}
      {previewResource && (
        <div
          className="fixed inset-0 z-50 bg-[#20243A]/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#F7F3EA] border border-[#20243A] rounded-xl max-w-4xl w-full overflow-hidden shadow-2xl my-auto">
            <div className="bg-[#20243A] text-[#F7F3EA] px-5 py-3.5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[10px] font-mono-code uppercase tracking-widest text-[#F2D64B] block">
                  {previewResource.schoolLevel === 'primary' ? 'TIỂU HỌC' : 'THCS'} ·{' '}
                  {previewResource.category === 'slides' ? 'SLIDE BÀI GIẢNG' : 'VIDEO BÀI GIẢNG'}
                </span>
                <h3 className="text-sm font-bold truncate">{previewResource.title}</h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewResource.url}
                  download={previewResource.title}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded bg-[#3457D5] text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải xuống</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewResource(null)}
                  className="w-8 h-8 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 bg-[#141726] min-h-[380px] flex items-center justify-center">
              {previewResource.category === 'videos' ? (
                previewResource.url.includes('youtube.com') ||
                previewResource.url.includes('youtu.be') ||
                previewResource.url.includes('drive.google.com') ? (
                  <iframe
                    src={getEmbeddableUrl(previewResource.url).embedUrl}
                    title={previewResource.title}
                    className="w-full aspect-video rounded-lg border-0 bg-black"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={previewResource.url}
                    controls
                    autoPlay
                    playsInline
                    className="w-full max-h-[65vh] rounded-lg bg-black"
                  />
                )
              ) : /\.(jpg|jpeg|png|webp|gif)$/i.test(previewResource.url) ||
                previewResource.url.startsWith('data:image') ? (
                <img
                  src={previewResource.url}
                  alt={previewResource.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[65vh] w-auto object-contain rounded-lg"
                />
              ) : (
                <div className="w-full space-y-3">
                  <iframe
                    src={getEmbeddableUrl(previewResource.url).embedUrl}
                    title={previewResource.title}
                    className="w-full h-[60vh] rounded-lg bg-white border-0"
                  />
                  <div className="flex items-center justify-between text-xs text-white/80">
                    <span>
                      Định dạng: {previewResource.formatLabel} · Dung lượng:{' '}
                      {previewResource.sizeLabel} · Ngày đăng tải:{' '}
                      {previewResource.uploadedDateLabel}
                    </span>
                    <a
                      href={previewResource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#F2D64B] font-bold inline-flex items-center gap-1"
                    >
                      <span>Mở toàn màn hình</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Confirm Delete Modal */}
      {confirmDeleteResource && (
        <div className="fixed inset-0 z-50 bg-[#20243A]/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#20243A] max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#20243A]">
              Xác nhận xóa tài nguyên MĨ THUẬT GDPT
            </h3>
            <p className="text-xs text-[#20243A]/75 leading-relaxed">
              Bạn có chắc chắn muốn xóa tài liệu <strong>“{confirmDeleteResource.title}”</strong> khỏi danh mục{' '}
              <strong>
                {confirmDeleteResource.schoolLevel === 'primary' ? 'TIỂU HỌC' : 'THCS'} —{' '}
                {confirmDeleteResource.category === 'slides'
                  ? 'SLIDE BÀI GIẢNG'
                  : 'VIDEO BÀI GIẢNG'}
              </strong>{' '}
              không?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteResource(null)}
                className="px-4 py-2 rounded-lg border border-[#20243A]/20 text-xs font-bold text-[#20243A] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-[#F15B3D] text-white text-xs font-bold cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Upload Slide / Video Lecture Modal */}
      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#20243A]/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#F7F3EA] border border-[#20243A] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl my-auto">
            <div className="bg-[#20243A] text-[#F7F3EA] px-6 py-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono-code uppercase tracking-widest text-[#F2D64B] block">
                  MĨ THUẬT GDPT · ĐĂNG TẢI HỌC LIỆU
                </span>
                <h2 className="font-display text-base sm:text-lg font-bold">
                  Tải {category === 'slides' ? 'SLIDE BÀI GIẢNG' : 'VIDEO BÀI GIẢNG'} lên
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* School Level & Category Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#20243A] mb-1">
                    1. Cấp học *
                  </label>
                  <select
                    value={schoolLevel}
                    onChange={(e) => setSchoolLevel(e.target.value as 'primary' | 'secondary')}
                    className="w-full px-3 py-2.5 rounded-lg bg-white border border-[#20243A]/20 text-xs font-bold text-[#20243A]"
                  >
                    <option value="primary">A. TIỂU HỌC</option>
                    <option value="secondary">B. THCS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#20243A] mb-1">
                    2. Danh mục tài nguyên *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as 'slides' | 'videos')}
                    className="w-full px-3 py-2.5 rounded-lg bg-white border border-[#20243A]/20 text-xs font-bold text-[#20243A]"
                  >
                    <option value="slides">SLIDE BÀI GIẢNG</option>
                    <option value="videos">VIDEO BÀI GIẢNG</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#20243A] mb-1">
                  3. Tên tài liệu *
                </label>
                <input
                  type="text"
                  required
                  maxLength={180}
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  placeholder={
                    category === 'slides'
                      ? 'Ví dụ: Slide Bài giảng Nghệ thuật Chấm & Nét...'
                      : 'Ví dụ: Video Bài giảng Kỹ thuật Pha màu nước...'
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-[#20243A]/20 text-xs sm:text-sm font-semibold text-[#20243A]"
                />
              </div>

              {/* Upload Method Switch */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer border ${
                    uploadMode === 'file'
                      ? 'bg-[#20243A] text-[#F7F3EA] border-[#20243A]'
                      : 'bg-white text-[#20243A] border-[#20243A]/20'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Tải tệp từ máy lên Storage</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('link')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer border ${
                    uploadMode === 'link'
                      ? 'bg-[#20243A] text-[#F7F3EA] border-[#20243A]'
                      : 'bg-white text-[#20243A] border-[#20243A]/20'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Gắn liên kết tài liệu</span>
                </button>
              </div>

              {uploadMode === 'file' ? (
                <div>
                  <label className="block text-xs font-bold text-[#20243A] mb-1">
                    4. Chọn tệp {category === 'slides' ? 'Slide (.pdf, .pptx, ảnh)' : 'Video (.mp4, .mov, .webm)'} *
                  </label>
                  <input
                    type="file"
                    accept={
                      category === 'slides'
                        ? '.pdf,.ppt,.pptx,image/jpeg,image/png,image/webp'
                        : 'video/mp4,video/webm,video/quicktime'
                    }
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setSelectedFile(f);
                      if (f && !resourceTitle.trim()) {
                        setResourceTitle(f.name.replace(/\.[^/.]+$/, ''));
                      }
                    }}
                    className="w-full text-xs text-[#20243A] file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#20243A] file:text-[#F7F3EA] hover:file:bg-[#3457D5] bg-white p-2 rounded-lg border border-[#20243A]/20 cursor-pointer"
                  />
                  {selectedFile && (
                    <p className="text-[11px] text-[#269C91] font-semibold mt-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-[#20243A] mb-1">
                    4. Đường dẫn tài liệu (https://...) *
                  </label>
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-[#20243A]/20 text-xs text-[#20243A]"
                  />
                </div>
              )}

              {isUploading && (
                <div className="p-3 rounded-lg bg-white border border-[#20243A]/20 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>{uploadStage || 'Đang tải lên...'}</span>
                    <span className="tabular-nums text-[#3457D5]">{uploadPercent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#20243A]/10 overflow-hidden">
                    <div
                      className="h-full bg-[#3457D5] transition-all"
                      style={{ width: `${Math.max(4, uploadPercent)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#20243A]/20 text-xs font-bold text-[#20243A] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] text-xs font-bold uppercase tracking-wide inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Lưu vào MĨ THUẬT GDPT</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { ClassGroup, ArtLesson, CommunityArtwork, UserRole } from '../../types/communityArt';
import { INITIAL_LESSONS } from '../../data/mockCommunityData';
import {
  saveLessonMediaBlob,
  getLessonMediaObjectUrl,
  deleteLessonMediaBlob,
  formatFileSize,
  getEmbeddableUrl
} from '../../utils/lessonMediaStorage';
import {
  BookOpen,
  Plus,
  Edit3,
  Trash2,
  X,
  Video,
  Presentation,
  Upload,
  Link2,
  ExternalLink,
  Download,
  FileText,
  PlayCircle,
  CheckCircle2,
  Sparkles,
  FolderOpen
} from 'lucide-react';

interface ClassLessonManagerViewProps {
  classes: ClassGroup[];
  lessons: ArtLesson[];
  artworks: CommunityArtwork[];
  currentRole: UserRole;
  onAddClass: (newClass: ClassGroup) => void;
  onUpdateClass: (updated: ClassGroup) => void;
  onToggleHideClass: (classId: string) => void;
  onDeleteClass: (classId: string) => void;
  onAddLesson: (newLesson: ArtLesson) => void;
  onUpdateLesson: (updated: ArtLesson) => void;
  onToggleHideLesson: (lessonId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  onTogglePublicGalleryEnabled?: (classId: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

interface GradeDefinition {
  id: string;
  grade: '6' | '7' | '8' | '9';
  name: string;
  subtitle: string;
  description: string;
  badgeColor: string;
  activeBg: string;
}

const GRADE_DEFINITIONS: GradeDefinition[] = [
  {
    id: 'cls-6',
    grade: '6',
    name: 'Khối 6',
    subtitle: 'Mĩ thuật Lớp 6 · Tạo hình & Dân gian',
    description: 'Tài liệu tham khảo bài học Khối 6: Chừa trống để tải Video hướng dẫn thực hành và Slide bài giảng cho từng chủ đề.',
    badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
    activeBg: 'from-blue-600 to-indigo-600'
  },
  {
    id: 'cls-7',
    grade: '7',
    name: 'Khối 7',
    subtitle: 'Mĩ thuật Lớp 7 · Hội họa & Ký họa',
    description: 'Tài liệu tham khảo bài học Khối 7: Chừa trống để tải Video minh họa kỹ thuật và Slide bài giảng cho từng chủ đề.',
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    activeBg: 'from-emerald-600 to-teal-600'
  },
  {
    id: 'cls-8',
    grade: '8',
    name: 'Khối 8',
    subtitle: 'Mĩ thuật Lớp 8 · Đồ họa & Thiết kế',
    description: 'Tài liệu tham khảo bài học Khối 8: Chừa trống để tải Video bài dạy và Slide trình chiếu cho từng chủ đề.',
    badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
    activeBg: 'from-purple-600 to-violet-600'
  },
  {
    id: 'cls-9',
    grade: '9',
    name: 'Khối 9',
    subtitle: 'Mĩ thuật Lớp 9 · Đương đại & Tổng hợp',
    description: 'Tài liệu tham khảo bài học Khối 9: Chừa trống để tải Video tư liệu nghệ thuật và Slide bài giảng cho từng chủ đề.',
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    activeBg: 'from-amber-600 to-orange-600'
  }
];

export const ClassLessonManagerView: React.FC<ClassLessonManagerViewProps> = ({
  lessons,
  onAddLesson,
  onUpdateLesson,
  onDeleteLesson,
  onShowToast
}) => {
  const [selectedGradeId, setSelectedGradeId] = useState<string>('cls-6');

  // Local cache of IndexedDB blob URLs keyed by `${lessonId}_video` and `${lessonId}_slide`
  const [localMediaUrls, setLocalMediaUrls] = useState<Record<string, string>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // Inline URL input state keyed by `${lessonId}_video` or `${lessonId}_slide`
  const [activeLinkInputKey, setActiveLinkInputKey] = useState<string | null>(null);
  const [linkUrlValue, setLinkUrlValue] = useState<string>('');
  const [linkTitleValue, setLinkTitleValue] = useState<string>('');

  // Confirm delete state (avoid window.confirm)
  const [confirmDeleteLessonId, setConfirmDeleteLessonId] = useState<string | null>(null);

  // Modal: Add / Edit Lesson
  const [isAddLessonModal, setIsAddLessonModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<ArtLesson | null>(null);
  const [lessonTitleInput, setLessonTitleInput] = useState('');
  const [lessonTopicInput, setLessonTopicInput] = useState('');
  const [lessonDescInput, setLessonDescInput] = useState('');

  // File input refs for dynamic triggers
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const slideInputRef = useRef<HTMLInputElement | null>(null);
  const [targetLessonForUpload, setTargetLessonForUpload] = useState<ArtLesson | null>(null);

  // Merge Firestore lessons with INITIAL_LESSONS so Khối 6, 7, 8, 9 always have reference lessons
  const mergedLessons = React.useMemo(() => {
    const map = new Map<string, ArtLesson>();
    for (const defLesson of INITIAL_LESSONS) {
      map.set(defLesson.id, defLesson);
    }
    for (const fsLesson of lessons) {
      if (fsLesson.classGroupId in { 'cls-6': 1, 'cls-7': 1, 'cls-8': 1, 'cls-9': 1 }) {
        map.set(fsLesson.id, fsLesson);
      }
    }
    return Array.from(map.values());
  }, [lessons]);

  const activeGrade = GRADE_DEFINITIONS.find(g => g.id === selectedGradeId) || GRADE_DEFINITIONS[0];
  const gradeLessons = mergedLessons.filter(l => l.classGroupId === activeGrade.id);

  // Load any stored IndexedDB blobs for current lessons
  useEffect(() => {
    let isMounted = true;
    const loadBlobs = async () => {
      const nextUrls: Record<string, string> = {};
      for (const les of mergedLessons) {
        const vRes = await getLessonMediaObjectUrl(les.id, 'video');
        if (vRes) {
          nextUrls[`${les.id}_video`] = vRes.objectUrl;
        }
        const sRes = await getLessonMediaObjectUrl(les.id, 'slide');
        if (sRes) {
          nextUrls[`${les.id}_slide`] = sRes.objectUrl;
        }
      }
      if (isMounted) {
        setLocalMediaUrls(prev => ({ ...prev, ...nextUrls }));
      }
    };
    loadBlobs();
    return () => {
      isMounted = false;
    };
  }, [mergedLessons.length]);

  // Handle saving new or edited lesson metadata
  const handleSaveLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitleInput.trim()) return;

    if (editingLesson) {
      const updated: ArtLesson = {
        ...editingLesson,
        title: lessonTitleInput.trim(),
        topic: lessonTopicInput.trim() || 'Chủ đề Mĩ thuật',
        description: lessonDescInput.trim()
      };
      onUpdateLesson(updated);
      onShowToast('success', 'Đã cập nhật bài học', `Đã lưu thông tin cho "${updated.title}".`);
    } else {
      const newLesson: ArtLesson = {
        id: `les-${activeGrade.grade}-${Date.now()}`,
        classGroupId: activeGrade.id,
        className: activeGrade.name,
        grade: activeGrade.grade,
        title: lessonTitleInput.trim(),
        topic: lessonTopicInput.trim() || `Mĩ thuật ${activeGrade.name}`,
        description: lessonDescInput.trim() || 'Bài học tham khảo — Đã chừa trống ô tải Video và Slide bên dưới.',
        isHidden: false,
        createdAt: new Date().toLocaleDateString('vi-VN')
      };
      onAddLesson(newLesson);
      onShowToast('success', 'Đã thêm bài học mới', `Đã tạo "${newLesson.title}" trong ${activeGrade.name}.`);
    }

    setIsAddLessonModal(false);
    setEditingLesson(null);
    setLessonTitleInput('');
    setLessonTopicInput('');
    setLessonDescInput('');
  };

  // Handle uploading a Video or Slide file from user's device
  const handleFileUpload = async (
    lesson: ArtLesson,
    mediaType: 'video' | 'slide',
    file: File
  ) => {
    const key = `${lesson.id}_${mediaType}`;
    setUploadingKey(key);
    try {
      const objectUrl = await saveLessonMediaBlob(lesson.id, mediaType, file);
      setLocalMediaUrls(prev => ({ ...prev, [key]: objectUrl }));

      // If file is small (< 350KB, e.g., slide image or small PDF), also convert to dataURL for cross-device Firestore sync
      let storedUrl = `local_idb://${lesson.id}/${mediaType}/${encodeURIComponent(file.name)}`;
      if (file.size <= 350 * 1024) {
        storedUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : storedUrl);
          reader.onerror = () => resolve(storedUrl);
          reader.readAsDataURL(file);
        });
      }

      const nowStr = new Date().toLocaleString('vi-VN');
      const updatedLesson: ArtLesson =
        mediaType === 'video'
          ? {
              ...lesson,
              videoUrl: storedUrl,
              videoFileName: file.name,
              videoFileSize: file.size,
              videoMimeType: file.type || 'video/mp4',
              videoUpdatedAt: nowStr
            }
          : {
              ...lesson,
              slideUrl: storedUrl,
              slideFileName: file.name,
              slideFileSize: file.size,
              slideMimeType: file.type || 'application/octet-stream',
              slideUpdatedAt: nowStr
            };

      onUpdateLesson(updatedLesson);
      onShowToast(
        'success',
        mediaType === 'video' ? 'Đã tải Video lên' : 'Đã tải Slide lên',
        `Đã đính kèm "${file.name}" (${formatFileSize(file.size)}) vào "${lesson.title}".`
      );
    } catch (err: any) {
      onShowToast('error', 'Lỗi tải tệp', err?.message || 'Không thể lưu tệp vào bộ nhớ.');
    } finally {
      setUploadingKey(null);
      setTargetLessonForUpload(null);
    }
  };

  // Handle saving an external URL for Video or Slide (YouTube, Google Drive, Canva, Google Slides, etc.)
  const handleSaveExternalLink = (lesson: ArtLesson, mediaType: 'video' | 'slide') => {
    const trimmedUrl = linkUrlValue.trim();
    if (!trimmedUrl) {
      onShowToast('error', 'Thiếu đường dẫn', 'Vui lòng nhập hoặc dán đường dẫn hợp lệ.');
      return;
    }

    const nowStr = new Date().toLocaleString('vi-VN');
    const displayLabel =
      linkTitleValue.trim() ||
      (mediaType === 'video' ? 'Video bài giảng trực tuyến' : 'Slide bài giảng trực tuyến');

    const updatedLesson: ArtLesson =
      mediaType === 'video'
        ? {
            ...lesson,
            videoUrl: trimmedUrl,
            videoFileName: displayLabel,
            videoFileSize: 0,
            videoMimeType: 'text/uri-list',
            videoUpdatedAt: nowStr
          }
        : {
            ...lesson,
            slideUrl: trimmedUrl,
            slideFileName: displayLabel,
            slideFileSize: 0,
            slideMimeType: 'text/uri-list',
            slideUpdatedAt: nowStr
          };

    onUpdateLesson(updatedLesson);
    setActiveLinkInputKey(null);
    setLinkUrlValue('');
    setLinkTitleValue('');
    onShowToast(
      'success',
      mediaType === 'video' ? 'Đã lưu liên kết Video' : 'Đã lưu liên kết Slide',
      `Đã gắn "${displayLabel}" vào "${lesson.title}".`
    );
  };

  // Handle clearing Video or Slide back to empty slot ("chừa trống")
  const handleClearMedia = async (lesson: ArtLesson, mediaType: 'video' | 'slide') => {
    const key = `${lesson.id}_${mediaType}`;
    await deleteLessonMediaBlob(lesson.id, mediaType);
    setLocalMediaUrls(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

    const updatedLesson: ArtLesson = { ...lesson };
    if (mediaType === 'video') {
      delete updatedLesson.videoUrl;
      delete updatedLesson.videoFileName;
      delete updatedLesson.videoFileSize;
      delete updatedLesson.videoMimeType;
      delete updatedLesson.videoUpdatedAt;
    } else {
      delete updatedLesson.slideUrl;
      delete updatedLesson.slideFileName;
      delete updatedLesson.slideFileSize;
      delete updatedLesson.slideMimeType;
      delete updatedLesson.slideUpdatedAt;
    }

    onUpdateLesson(updatedLesson);
    onShowToast(
      'info',
      mediaType === 'video' ? 'Đã xóa Video' : 'Đã xóa Slide',
      `Ô ${mediaType === 'video' ? 'Video' : 'Slide'} đã được trả về trạng thái trống.`
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hidden File Inputs for Video & Slide */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*,.mp4,.mov,.webm,.mkv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && targetLessonForUpload) {
            handleFileUpload(targetLessonForUpload, 'video', file);
          }
          e.target.value = '';
        }}
      />
      <input
        ref={slideInputRef}
        type="file"
        accept=".pdf,.ppt,.pptx,image/*,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && targetLessonForUpload) {
            handleFileUpload(targetLessonForUpload, 'slide', file);
          }
          e.target.value = '';
        }}
      />

      {/* Top Header Banner */}
      <div className="bg-white rounded-3xl border border-stone-200/90 p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1D4ED8] bg-[#1D4ED8]/10 px-2.5 py-0.5 rounded-lg">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Lớp học &amp; Học liệu THCS</span>
            </span>
            <span className="text-xs text-stone-500">
              Khối 6 · Khối 7 · Khối 8 · Khối 9
            </span>
          </div>
          <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-[#121316] tracking-tight">
            Lớp học &amp; Tham khảo Bài học
          </h2>
          <p className="text-xs text-stone-500 max-w-2xl leading-relaxed">
            Chọn từng khối lớp bên dưới để xem danh sách bài học, tải Video bài giảng và Slide trình chiếu cho từng chủ đề của <strong>Khối 6, Khối 7, Khối 8, Khối 9</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditingLesson(null);
              setLessonTitleInput('');
              setLessonTopicInput('');
              setLessonDescInput('');
              setIsAddLessonModal(true);
            }}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm bài học {activeGrade.name}</span>
          </button>
        </div>
      </div>

      {/* 4 Subdivided Grade Cards: Khối 6, Khối 7, Khối 8, Khối 9 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {GRADE_DEFINITIONS.map((gradeItem) => {
          const isSelected = selectedGradeId === gradeItem.id;
          const lessonsInGrade = mergedLessons.filter(l => l.classGroupId === gradeItem.id);
          const videosCount = lessonsInGrade.filter(
            l => Boolean(l.videoUrl || localMediaUrls[`${l.id}_video`])
          ).length;
          const slidesCount = lessonsInGrade.filter(
            l => Boolean(l.slideUrl || localMediaUrls[`${l.id}_slide`])
          ).length;

          return (
            <button
              key={gradeItem.id}
              onClick={() => setSelectedGradeId(gradeItem.id)}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                isSelected
                  ? `bg-gradient-to-br ${gradeItem.activeBg} text-white border-transparent shadow-md scale-[1.01]`
                  : 'bg-white text-slate-800 border-slate-200/90 hover:border-blue-300 hover:bg-slate-50/70 shadow-2xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base sm:text-lg font-extrabold tracking-tight">
                    {gradeItem.name}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {lessonsInGrade.length} bài học
                  </span>
                </div>
                <p
                  className={`text-[11px] mt-1 line-clamp-1 ${
                    isSelected ? 'text-white/90' : 'text-slate-500'
                  }`}
                >
                  {gradeItem.subtitle}
                </p>
              </div>

              <div
                className={`pt-2.5 border-t flex items-center justify-between text-[11px] font-medium ${
                  isSelected ? 'border-white/20 text-white/90' : 'border-slate-100 text-slate-500'
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <Video className="w-3.5 h-3.5" />
                  <span>{videosCount}/{lessonsInGrade.length} Video</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Presentation className="w-3.5 h-3.5" />
                  <span>{slidesCount}/{lessonsInGrade.length} Slide</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Grade Workspace */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-6">
        {/* Grade Workspace Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${activeGrade.badgeColor}`}>
                {activeGrade.name}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Danh mục Bài học & Học liệu ({gradeLessons.length} bài)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">{activeGrade.description}</p>
          </div>

          <button
            onClick={() => {
              setEditingLesson(null);
              setLessonTitleInput('');
              setLessonTopicInput('');
              setLessonDescInput('');
              setIsAddLessonModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm bài học {activeGrade.name}</span>
          </button>
        </div>

        {/* Lessons List with Empty Upload Slots for Video & Slide */}
        {gradeLessons.length === 0 ? (
          <div className="text-center py-12 px-4 bg-slate-50/70 rounded-2xl border-2 border-dashed border-slate-200 space-y-3">
            <FolderOpen className="w-10 h-10 text-slate-400 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-700">
                Chưa có bài học nào trong {activeGrade.name}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hãy nhấn nút bên dưới để tạo bài học mới cùng khu vực chừa trống tải Video và Slide cho {activeGrade.name}.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingLesson(null);
                setLessonTitleInput('');
                setLessonTopicInput('');
                setLessonDescInput('');
                setIsAddLessonModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo bài học đầu tiên cho {activeGrade.name}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {gradeLessons.map((les, idx) => {
              const videoKey = `${les.id}_video`;
              const slideKey = `${les.id}_slide`;

              const activeVideoUrl =
                localMediaUrls[videoKey] ||
                (les.videoUrl && !les.videoUrl.startsWith('local_idb://') ? les.videoUrl : '');
              const hasVideoMetadata = Boolean(les.videoUrl || localMediaUrls[videoKey]);

              const activeSlideUrl =
                localMediaUrls[slideKey] ||
                (les.slideUrl && !les.slideUrl.startsWith('local_idb://') ? les.slideUrl : '');
              const hasSlideMetadata = Boolean(les.slideUrl || localMediaUrls[slideKey]);

              const isUploadingVideo = uploadingKey === videoKey;
              const isUploadingSlide = uploadingKey === slideKey;

              const videoEmbedInfo = activeVideoUrl ? getEmbeddableUrl(activeVideoUrl) : null;
              const slideEmbedInfo = activeSlideUrl ? getEmbeddableUrl(activeSlideUrl) : null;

              return (
                <div
                  key={les.id}
                  className="rounded-3xl border border-slate-200/90 bg-[#FAF9F5]/60 p-4 sm:p-6 space-y-5 shadow-2xs hover:border-slate-300 transition-all"
                >
                  {/* Lesson Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-200/80">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-md">
                          {activeGrade.name} · Bài {idx + 1}
                        </span>
                        <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-md">
                          {les.topic}
                        </span>
                      </div>
                      <h4 className="text-base sm:text-lg font-bold text-slate-900 pt-0.5">
                        {les.title}
                      </h4>
                      {les.description && (
                        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                          {les.description}
                        </p>
                      )}
                    </div>

                    {/* Edit / Delete Lesson Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 self-start">
                      <button
                        onClick={() => {
                          setEditingLesson(les);
                          setLessonTitleInput(les.title);
                          setLessonTopicInput(les.topic);
                          setLessonDescInput(les.description);
                          setIsAddLessonModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                        title="Chỉnh sửa tên và mô tả bài học"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sửa bài</span>
                      </button>

                      {confirmDeleteLessonId === les.id ? (
                        <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-1 rounded-xl">
                          <span className="text-[11px] font-semibold text-rose-800">Xóa?</span>
                          <button
                            onClick={() => {
                              onDeleteLesson(les.id);
                              setConfirmDeleteLessonId(null);
                            }}
                            className="px-2 py-0.5 bg-rose-600 text-white text-[11px] font-bold rounded-lg hover:bg-rose-700 cursor-pointer"
                          >
                            Đồng ý
                          </button>
                          <button
                            onClick={() => setConfirmDeleteLessonId(null)}
                            className="px-1.5 py-0.5 text-slate-600 text-[11px] hover:text-slate-900 cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteLessonId(les.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                          title="Xóa bài học này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2 Dedicated Slots: VIDEO SLOT & SLIDE SLOT */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                    {/* ==========================================
                        SLOT 1: VIDEO BÀI HỌC (Chừa trống tải Video)
                       ========================================== */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Video className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-slate-900">
                              1. Video Bài học ({activeGrade.name})
                            </h5>
                            <p className="text-[11px] text-slate-500">
                              {hasVideoMetadata
                                ? les.videoFileName || 'Đã đính kèm Video bài giảng'
                                : 'Ô chừa trống để tải Video bài giảng (.mp4, .mov, YouTube)'}
                            </p>
                          </div>
                        </div>

                        {hasVideoMetadata ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đã có Video</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Đang để trống
                          </span>
                        )}
                      </div>

                      {/* Video Content or Empty Upload Placeholder */}
                      {hasVideoMetadata ? (
                        <div className="space-y-3">
                          {activeVideoUrl ? (
                            videoEmbedInfo?.isEmbed ? (
                              <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-200">
                                <iframe
                                  src={videoEmbedInfo.embedUrl}
                                  title={les.videoFileName || les.title}
                                  className="w-full h-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            ) : (
                              <video
                                src={activeVideoUrl}
                                controls
                                className="aspect-video w-full rounded-xl bg-slate-950 border border-slate-200 object-contain"
                              />
                            )
                          ) : (
                            <div className="aspect-video w-full rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center p-4 text-center space-y-2">
                              <PlayCircle className="w-8 h-8 text-blue-600" />
                              <p className="text-xs font-semibold text-slate-700">
                                {les.videoFileName || 'Tệp Video đã lưu'}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Tải lại tệp từ máy nếu bạn mở trên thiết bị mới
                              </p>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                            <span className="truncate">
                              {les.videoFileName}
                              {les.videoFileSize ? ` (${formatFileSize(les.videoFileSize)})` : ''}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => {
                                  setTargetLessonForUpload(les);
                                  videoInputRef.current?.click();
                                }}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg cursor-pointer"
                              >
                                Đổi Video
                              </button>
                              <button
                                onClick={() => handleClearMedia(les, 'video')}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg cursor-pointer"
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-5 text-center space-y-3">
                          <div className="w-10 h-10 rounded-2xl bg-white border border-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
                            <Upload className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-800">
                              Chừa trống tải Video bài học
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Chọn tệp Video (.mp4, .mov, .webm) từ máy tính/điện thoại hoặc dán liên kết YouTube / Google Drive
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                            <button
                              disabled={isUploadingVideo}
                              onClick={() => {
                                setTargetLessonForUpload(les);
                                videoInputRef.current?.click();
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>{isUploadingVideo ? 'Đang tải Video...' : 'Tải file Video lên'}</span>
                            </button>

                            <button
                              onClick={() => {
                                setActiveLinkInputKey(activeLinkInputKey === videoKey ? null : videoKey);
                                setLinkUrlValue('');
                                setLinkTitleValue('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                            >
                              <Link2 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Dán link Video</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline Link Input for Video */}
                      {activeLinkInputKey === videoKey && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                          <div className="font-semibold text-slate-700">
                            Dán đường dẫn Video (YouTube, Google Drive hoặc link .mp4):
                          </div>
                          <input
                            type="url"
                            value={linkUrlValue}
                            onChange={(e) => setLinkUrlValue(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=... hoặc link Google Drive"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                          />
                          <input
                            type="text"
                            value={linkTitleValue}
                            onChange={(e) => setLinkTitleValue(e.target.value)}
                            placeholder="Tiêu đề hiển thị (Không bắt buộc)"
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveLinkInputKey(null)}
                              className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg font-medium cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveExternalLink(les, 'video')}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
                            >
                              Lưu Video
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ==========================================
                        SLOT 2: SLIDE BÀI GIẢNG (Chừa trống tải Slide)
                       ========================================== */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                            <Presentation className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-slate-900">
                              2. Slide Bài giảng ({activeGrade.name})
                            </h5>
                            <p className="text-[11px] text-slate-500">
                              {hasSlideMetadata
                                ? les.slideFileName || 'Đã đính kèm Slide bài giảng'
                                : 'Ô chừa trống để tải Slide (.pptx, .pdf, Canva, Google Slides)'}
                            </p>
                          </div>
                        </div>

                        {hasSlideMetadata ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đã có Slide</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Đang để trống
                          </span>
                        )}
                      </div>

                      {/* Slide Content or Empty Upload Placeholder */}
                      {hasSlideMetadata ? (
                        <div className="space-y-3">
                          {activeSlideUrl ? (
                            slideEmbedInfo?.isEmbed ? (
                              <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-200">
                                <iframe
                                  src={slideEmbedInfo.embedUrl}
                                  title={les.slideFileName || les.title}
                                  className="w-full h-full"
                                  allowFullScreen
                                />
                              </div>
                            ) : les.slideMimeType?.startsWith('image/') ? (
                              <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                                <img
                                  src={activeSlideUrl}
                                  alt={les.slideFileName || 'Slide bài giảng'}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            ) : les.slideMimeType === 'application/pdf' ? (
                              <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                                <iframe
                                  src={activeSlideUrl}
                                  title={les.slideFileName || 'Slide PDF'}
                                  className="w-full h-full"
                                />
                              </div>
                            ) : (
                              <div className="aspect-video w-full rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 p-5 flex flex-col items-center justify-center text-center space-y-2.5">
                                <FileText className="w-9 h-9 text-purple-600" />
                                <div className="space-y-0.5">
                                  <p className="text-xs font-bold text-slate-800 break-all px-2">
                                    {les.slideFileName || 'Tài liệu Slide bài giảng'}
                                  </p>
                                  {les.slideFileSize ? (
                                    <p className="text-[11px] text-slate-500">
                                      Dung lượng: {formatFileSize(les.slideFileSize)}
                                    </p>
                                  ) : null}
                                </div>
                                <a
                                  href={activeSlideUrl}
                                  download={les.slideFileName || 'slide-bai-giang'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-2xs"
                                >
                                  {les.slideMimeType === 'text/uri-list' ? (
                                    <>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>Mở Slide trình chiếu</span>
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-3.5 h-3.5" />
                                      <span>Tải xuống / Mở tệp Slide</span>
                                    </>
                                  )}
                                </a>
                              </div>
                            )
                          ) : (
                            <div className="aspect-video w-full rounded-xl bg-purple-50/50 border border-purple-200 flex flex-col items-center justify-center p-4 text-center space-y-2">
                              <Presentation className="w-8 h-8 text-purple-600" />
                              <p className="text-xs font-semibold text-slate-700">
                                {les.slideFileName || 'Slide đã lưu'}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Tải lại tệp Slide từ máy nếu bạn mở trên thiết bị mới
                              </p>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                            <span className="truncate">
                              {les.slideFileName}
                              {les.slideFileSize ? ` (${formatFileSize(les.slideFileSize)})` : ''}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => {
                                  setTargetLessonForUpload(les);
                                  slideInputRef.current?.click();
                                }}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-lg cursor-pointer"
                              >
                                Đổi Slide
                              </button>
                              <button
                                onClick={() => handleClearMedia(les, 'slide')}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg cursor-pointer"
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/40 p-5 text-center space-y-3">
                          <div className="w-10 h-10 rounded-2xl bg-white border border-purple-100 text-purple-600 flex items-center justify-center mx-auto shadow-2xs">
                            <Presentation className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-800">
                              Chừa trống tải Slide bài giảng
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Chọn tệp Slide (.pptx, .pdf, ảnh slide) từ thiết bị hoặc dán liên kết Google Slides / Canva
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                            <button
                              disabled={isUploadingSlide}
                              onClick={() => {
                                setTargetLessonForUpload(les);
                                slideInputRef.current?.click();
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>{isUploadingSlide ? 'Đang tải Slide...' : 'Tải file Slide lên'}</span>
                            </button>

                            <button
                              onClick={() => {
                                setActiveLinkInputKey(activeLinkInputKey === slideKey ? null : slideKey);
                                setLinkUrlValue('');
                                setLinkTitleValue('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                            >
                              <Link2 className="w-3.5 h-3.5 text-purple-600" />
                              <span>Dán link Slide</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline Link Input for Slide */}
                      {activeLinkInputKey === slideKey && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                          <div className="font-semibold text-slate-700">
                            Dán đường dẫn Slide (Google Slides, Canva, Google Drive hoặc PDF):
                          </div>
                          <input
                            type="url"
                            value={linkUrlValue}
                            onChange={(e) => setLinkUrlValue(e.target.value)}
                            placeholder="https://docs.google.com/presentation/d/... hoặc link Canva"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                          />
                          <input
                            type="text"
                            value={linkTitleValue}
                            onChange={(e) => setLinkTitleValue(e.target.value)}
                            placeholder="Tên bộ Slide (Không bắt buộc)"
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveLinkInputKey(null)}
                              className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg font-medium cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveExternalLink(les, 'slide')}
                              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg cursor-pointer"
                            >
                              Lưu Slide
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT LESSON IN SELECTED GRADE (KHỐI 6, 7, 8, 9) */}
      {isAddLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${activeGrade.badgeColor}`}>
                  {activeGrade.name}
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingLesson ? 'Chỉnh sửa Bài học' : `Thêm bài học mới (${activeGrade.name})`}
                </h3>
              </div>
              <button
                onClick={() => setIsAddLessonModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLesson} className="space-y-3.5 text-xs text-slate-800">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên bài học ({activeGrade.name}) *
                </label>
                <input
                  type="text"
                  required
                  value={lessonTitleInput}
                  onChange={(e) => setLessonTitleInput(e.target.value)}
                  placeholder="Ví dụ: Bài 3: Nghệ thuật trang trí đồ gốm..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Chủ đề (Không bắt buộc)
                </label>
                <input
                  type="text"
                  value={lessonTopicInput}
                  onChange={(e) => setLessonTopicInput(e.target.value)}
                  placeholder="Ví dụ: Mĩ thuật ứng dụng / Hội họa"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mô tả ngắn / Gợi ý tham khảo (Không bắt buộc)
                </label>
                <textarea
                  rows={2}
                  value={lessonDescInput}
                  onChange={(e) => setLessonDescInput(e.target.value)}
                  placeholder="Ghi chú nội dung bài học để học sinh và giáo viên tham khảo..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-blue-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Sau khi tạo bài học, hệ thống sẽ tự động tạo sẵn <strong>2 ô chừa trống</strong> để bạn tải <strong>Video</strong> và <strong>Slide</strong> lên.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddLessonModal(false)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {editingLesson ? 'Lưu thay đổi' : 'Tạo bài học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

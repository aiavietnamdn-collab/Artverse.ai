/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ART VERSE AI — Phân hệ Video ngắn độc lập: ARTVERSE SHORTS
 * Quy chuẩn 2.0 (Section III.3):
 * - Khám phá video, Xem video, Tải video lên, Xem thông tin video
 * - Bình luận (3 bình luận mới nhất + Xem tất cả) và 5 loại cảm xúc (❤️ Yêu thích | 👍 Thích | 😂 Vui | 😢 Buồn | 😡 Giận)
 * - Báo cáo nội dung & Quản lý video theo quyền hạn (có xác nhận trước khi xóa)
 * - Độc lập hoàn toàn với TRIỂN LÃM TÁC PHẨM và VIDEO BÀI GIẢNG trong MĨ THUẬT GDPT
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  CommunityArtwork,
  ClassGroup,
  UserRole,
  ArtworkEmotionKey,
  ARTWORK_EMOTION_ORDER,
  ARTWORK_EMOTIONS_META,
  UPLOAD_STATE_LABELS,
  UploadStateMachine,
} from '../../types/communityArt';
import {
  validateVideoFileAndExtractMeta,
  uploadArtworkVideoToStorageWithProgress,
  UploadProgressTelemetry,
  VideoValidationMetadata,
} from '../../services/communityStorageService';
import {
  createCommunityArtworkInFirestore,
  fetchArtworkEmotionSummary,
  toggleArtworkEmotionReaction,
} from '../../services/communityFirestoreService';
import { useAuth } from '../../context/AuthContext';
import { getArtworkNormalizedGrade, normalizeGrade } from '../../utils/gradeUtils';
import { formatFileSize } from '../../utils/lessonMediaStorage';
import { matchesSearchQuery, isWithinDateFilter } from '../../utils/searchEngine';
import { ArtverseCommunityComments } from './ArtverseCommunityComments';
import {
  Film,
  Play,
  Plus,
  Search,
  Flag,
  Trash2,
  EyeOff,
  Eye,
  CheckCircle2,
  X,
  Upload,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

interface ArtverseShortsViewProps {
  artworks: CommunityArtwork[];
  classes: ClassGroup[];
  currentRole: UserRole;
  currentAuthorKey: string;
  currentUserId: string;
  currentUserAlias: string;
  initialOpenUpload?: boolean;
  onConsumeInitialUpload?: () => void;
  onShortPublished: (newShort: CommunityArtwork) => void;
  onApproveShort?: (shortId: string) => Promise<void> | void;
  onHideShort?: (shortId: string) => Promise<void> | void;
  onUnhideShort?: (shortId: string) => Promise<void> | void;
  onDeleteShort?: (shortId: string) => Promise<void> | void;
  onOpenReportModal: (
    targetType: 'artwork' | 'comment' | 'story',
    targetId: string,
    targetTitle: string
  ) => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const ArtverseShortsView: React.FC<ArtverseShortsViewProps> = ({
  artworks,
  classes,
  currentRole,
  currentAuthorKey,
  currentUserId,
  currentUserAlias,
  initialOpenUpload = false,
  onConsumeInitialUpload,
  onShortPublished,
  onApproveShort,
  onHideShort,
  onUnhideShort,
  onDeleteShort,
  onOpenReportModal,
  onShowToast,
}) => {
  const {
    user,
    profile,
    isTeacher,
    isAdmin,
    isStudent,
    verifiedRole,
    getValidBearerToken,
    setIsStudentLoginModalOpen,
  } = useAuth();

  const isStaff =
    isTeacher ||
    isAdmin ||
    currentRole === 'teacher' ||
    currentRole === 'moderator' ||
    currentRole === 'admin';
  const isLoggedIn = Boolean(profile?.uid || user?.uid || verifiedRole !== 'viewer');

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'featured'>('newest');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'hidden'>('all');
  const [visibleLimit, setVisibleLimit] = useState<number>(9);

  // Active Short Video Detail Modal
  const [selectedShort, setSelectedShort] = useState<CommunityArtwork | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 5-Emotion State for Selected Short Video
  const [emotionCounts, setEmotionCounts] = useState<Record<ArtworkEmotionKey, number>>({
    love: 0,
    like: 0,
    haha: 0,
    sad: 0,
    angry: 0,
  });
  const [myEmotion, setMyEmotion] = useState<ArtworkEmotionKey | null>(null);
  const [reactionStatus, setReactionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle'
  );
  const [reactionErrorMsg, setReactionErrorMsg] = useState<string | null>(null);
  const [lastAttemptedEmotion, setLastAttemptedEmotion] = useState<ArtworkEmotionKey | null>(null);

  // Upload Short Video Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoMeta, setVideoMeta] = useState<VideoValidationMetadata | null>(null);
  const [shortTitle, setShortTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [shortCategory, setShortCategory] = useState('Quá trình sáng tác');
  const [selectedClassId, setSelectedClassId] = useState<string>(
    profile?.classGroupId || 'cls-6'
  );
  const [uploadState, setUploadState] = useState<UploadStateMachine>('QUEUED');
  const [uploadTelemetry, setUploadTelemetry] = useState<UploadProgressTelemetry | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (initialOpenUpload) {
      setIsUploadModalOpen(true);
      onConsumeInitialUpload?.();
    }
  }, [initialOpenUpload, onConsumeInitialUpload]);

  // Extract strictly ARTVERSE SHORTS videos (never mixing with visual paintings or GDPT lecture videos)
  const allShorts = useMemo(() => {
    return artworks.filter((item) => item.mediaType === 'video' || Boolean(item.videoUrl));
  }, [artworks]);

  const visibleShorts = useMemo(() => {
    const filtered = allShorts.filter((short) => {
      const isOwner =
        short.ownerKey === currentAuthorKey ||
        Boolean(currentUserId && short.authorAccountId === currentUserId) ||
        Boolean(currentUserId && short.authorUid === currentUserId);

      if (!isStaff && !isOwner && (short.status !== 'approved' || short.shareStatus !== 'shared')) {
        return false;
      }

      if (isStaff && statusFilter !== 'all' && short.status !== statusFilter) {
        return false;
      }

      if (gradeFilter !== 'all') {
        const normGrade = getArtworkNormalizedGrade(short);
        if (normGrade !== normalizeGrade(gradeFilter) && short.classGroupId !== gradeFilter) {
          return false;
        }
      }

      if (!isWithinDateFilter(short.updatedAt || short.createdAt, timeFilter)) {
        return false;
      }

      if (searchQuery.trim()) {
        const publicAlias =
          short.authorNickname || short.authorAlias || short.creatorAnonymousPseudonym || '';
        const matched = matchesSearchQuery(
          searchQuery,
          [short.title, publicAlias],
          [
            short.description,
            short.materialsUsed,
            short.lessonTitle,
            short.topic,
            getArtworkNormalizedGrade(short),
          ]
        );
        if (!matched) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'featured') {
        const scoreA =
          (Object.values(a.emotionCounts || {}) as number[]).reduce((s, v) => s + v, 0) +
          (Object.values(a.reactions || {}) as number[]).reduce((s, v) => s + v, 0);
        const scoreB =
          (Object.values(b.emotionCounts || {}) as number[]).reduce((s, v) => s + v, 0) +
          (Object.values(b.reactions || {}) as number[]).reduce((s, v) => s + v, 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
      }
      const tA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
      const tB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
      return tB - tA;
    });
  }, [
    allShorts,
    isStaff,
    currentAuthorKey,
    currentUserId,
    statusFilter,
    gradeFilter,
    timeFilter,
    searchQuery,
    sortBy,
  ]);

  // Load 5-emotion reaction summary when opening a Short video
  useEffect(() => {
    if (!selectedShort) return;
    let active = true;
    setReactionStatus('idle');
    setReactionErrorMsg(null);

    getValidBearerToken()
      .then((token) =>
        fetchArtworkEmotionSummary(
          selectedShort.id,
          token,
          profile?.uid || user?.uid || null
        )
      )
      .then((summary) => {
        if (!active || !summary) return;
        setEmotionCounts({
          love: summary.counts.love || 0,
          like: summary.counts.like || 0,
          haha: summary.counts.haha || 0,
          sad: summary.counts.sad || 0,
          angry: summary.counts.angry || 0,
        });
        setMyEmotion(summary.userEmotion);
      })
      .catch(() => {
        if (!active) return;
        if (selectedShort.emotionCounts) {
          setEmotionCounts({
            love: selectedShort.emotionCounts.love || 0,
            like: selectedShort.emotionCounts.like || 0,
            haha: selectedShort.emotionCounts.haha || 0,
            sad: selectedShort.emotionCounts.sad || 0,
            angry: selectedShort.emotionCounts.angry || 0,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [selectedShort?.id, profile?.uid, user?.uid, getValidBearerToken]);

  const handleToggleShortEmotion = async (emotionKey: ArtworkEmotionKey) => {
    if (!selectedShort) return;
    if (!isLoggedIn) {
      onShowToast(
        'info',
        'Yêu cầu đăng nhập',
        'Vui lòng đăng nhập tài khoản Học sinh hoặc Giáo viên để thả cảm xúc cho video ARTVERSE SHORTS.'
      );
      setIsStudentLoginModalOpen(true);
      return;
    }
    if (reactionStatus === 'loading') return;

    const prevCounts = { ...emotionCounts };
    const prevEmotion = myEmotion;
    setLastAttemptedEmotion(emotionKey);
    setReactionStatus('loading');
    setReactionErrorMsg(null);

    try {
      const token = await getValidBearerToken();
      const summary = await toggleArtworkEmotionReaction(
        selectedShort.id,
        emotionKey,
        token,
        profile?.uid || user?.uid || null
      );
      setEmotionCounts(summary.counts);
      setMyEmotion(summary.userEmotion);
      setReactionStatus('success');
    } catch (err: any) {
      setEmotionCounts(prevCounts);
      setMyEmotion(prevEmotion);
      setReactionStatus('error');
      setReactionErrorMsg(err?.message || 'Không thể cập nhật cảm xúc lúc này.');
    }
  };

  const handleSelectVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadState('VALIDATING');
    setVideoFile(file);

    try {
      const meta = await validateVideoFileAndExtractMeta(file, file.name);
      setVideoMeta(meta);
      if (!shortTitle.trim()) {
        setShortTitle(file.name.replace(/\.[^/.]+$/, '').slice(0, 80));
      }
      setUploadState('QUEUED');
    } catch (err: any) {
      setUploadError(err?.message || 'Tệp video không hợp lệ.');
      setUploadState('ERROR');
    }
  };

  const handleUploadShortSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      setUploadError('Vui lòng chọn tệp video ngắn (.mp4, .mov, .webm) để tải lên.');
      return;
    }
    if (!shortTitle.trim()) {
      setUploadError('Vui lòng nhập tiêu đề cho video ARTVERSE SHORTS.');
      return;
    }

    setUploadError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const shortId = `short_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const matchedClass =
      classes.find((c) => c.id === selectedClassId) || {
        id: 'cls-6',
        name: 'Lớp 6',
      };

    try {
      const uploadRes = await uploadArtworkVideoToStorageWithProgress(
        videoFile,
        shortId,
        videoFile.name,
        currentUserId || 'student-short',
        videoMeta?.thumbnailDataUrl,
        (percent: number, stageText?: string, state?: UploadStateMachine, telemetry?: UploadProgressTelemetry) => {
          const resolvedState: UploadStateMachine = state || 'UPLOADING';
          setUploadState(resolvedState);
          if (telemetry) setUploadTelemetry(telemetry);
          else {
            setUploadTelemetry({
              percent,
              stageText: stageText || UPLOAD_STATE_LABELS[resolvedState],
              state: resolvedState,
              bytesTransferred: Math.round((percent / 100) * videoFile.size),
              totalBytes: videoFile.size,
              speedBytesPerSec: 0,
              elapsedSeconds: 0,
            });
          }
        },
        undefined,
        videoMeta || undefined
      );

      setUploadState('SAVING_METADATA');
      const nowIso = new Date().toISOString();
      const autoApproved = isStaff;
      const durationSec = uploadRes.duration || videoMeta?.duration || 15;

      const newShortRecord: CommunityArtwork = {
        id: shortId,
        artworkId: shortId,
        mediaId: shortId,
        mediaType: 'video',
        title: shortTitle.trim(),
        creatorAnonymousPseudonym: currentUserAlias || 'Nghệ sĩ Trẻ',
        authorNickname: currentUserAlias || 'Nghệ sĩ Trẻ',
        authorAlias: currentUserAlias || 'Nghệ sĩ Trẻ',
        authorUid: currentUserId,
        authorAccountId: currentUserId,
        ownerKey: currentAuthorKey,
        classGroupId: matchedClass.id,
        classId: matchedClass.id,
        className: matchedClass.name,
        grade: normalizeGrade(matchedClass.name),
        lessonId: 'artverse-shorts',
        lessonTitle: `ARTVERSE SHORTS · ${shortCategory}`,
        topic: shortCategory,
        materialsUsed: shortCategory,
        description:
          shortDescription.trim() ||
          `Video ngắn ARTVERSE SHORTS (${shortCategory}) · Thời lượng ${Math.round(durationSec)}s.`,
        visualType: 'watercolor',
        imageUrl: uploadRes.thumbnailUrl || uploadRes.downloadUrl,
        imagePath: uploadRes.thumbnailPath || uploadRes.storagePath,
        thumbnailUrl: uploadRes.thumbnailUrl,
        thumbnailPath: uploadRes.thumbnailPath,
        videoUrl: uploadRes.downloadUrl,
        videoPath: uploadRes.storagePath,
        storagePath: uploadRes.storagePath,
        downloadURL: uploadRes.downloadUrl,
        fileSize: uploadRes.bytesUploaded || videoFile.size,
        mimeType: uploadRes.mimeType,
        duration: durationSec,
        createdAt: nowIso,
        updatedAt: nowIso,
        status: autoApproved ? 'approved' : 'pending',
        shareStatus: 'shared',
        shareToken: `shr_${shortId}`,
        moderation: {
          moderatedBy: autoApproved ? 'Tự động duyệt (Giáo viên/Admin)' : 'Hàng chờ Kiểm duyệt',
          moderatedAt: new Date().toLocaleDateString('vi-VN'),
          moderatorNote: autoApproved
            ? 'Xuất bản trên ARTVERSE SHORTS'
            : 'Đang chờ giáo viên kiểm duyệt trước khi hiển thị công khai',
        },
        reactions: {
          unique_idea: 0,
          striking_color: 0,
          interesting_composition: 0,
          noteworthy_detail: 0,
          inspiring: 0,
        },
        emotionCounts: {
          love: 0,
          like: 0,
          haha: 0,
          sad: 0,
          angry: 0,
        },
      };

      const saved = await createCommunityArtworkInFirestore(newShortRecord);
      setUploadState('SUCCESS');
      onShortPublished(saved);

      onShowToast(
        'success',
        autoApproved ? 'Đã đăng lên ARTVERSE SHORTS!' : 'Đã gửi duyệt ARTVERSE SHORTS!',
        autoApproved
          ? `Video "${saved.title}" đã xuất hiện trên ARTVERSE SHORTS.`
          : `Video "${saved.title}" đã được lưu bền vững và đang chờ giáo viên kiểm duyệt.`
      );

      setIsUploadModalOpen(false);
      setVideoFile(null);
      setVideoMeta(null);
      setShortTitle('');
      setShortDescription('');
      setUploadState('QUEUED');
      setUploadTelemetry(null);
    } catch (err: any) {
      setUploadState(err?.message?.includes('hủy') ? 'CANCELLED' : 'ERROR');
      setUploadError(err?.message || 'Không thể tải video lên ARTVERSE SHORTS.');
    }
  };

  return (
    <div className="space-y-8 pb-12 text-[#20243A] museum-fade-in">
      {/* 1. ARTVERSE SHORTS Architectural Header */}
      <section className="rounded-xl bg-[#20243A] text-[#F7F3EA] p-6 sm:p-8 border border-[#20243A] relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute top-0 right-0 w-44 h-44 bg-[#F15B3D] opacity-90 translate-x-12 -translate-y-12 rotate-12 pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 right-36 w-24 h-16 bg-[#3457D5] pointer-events-none"
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-[11px] font-mono-code font-bold uppercase tracking-widest text-[#F2D64B]">
              <Film className="w-3.5 h-3.5 text-[#F15B3D]" />
              <span>PHÂN HỆ VIDEO NGẮN ĐỘC LẬP</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight uppercase text-white">
              ARTVERSE SHORTS
            </h1>
            <p className="text-xs sm:text-sm text-[#F7F3EA]/80 leading-relaxed">
              Không gian khám phá các thước phim ngắn ghi lại quá trình sáng tạo, kỹ thuật pha màu, ký họa và góc nhìn nghệ thuật của học sinh và giáo viên trên nền tảng ART VERSE AI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!isLoggedIn) {
                  setIsStudentLoginModalOpen(true);
                  return;
                }
                setIsUploadModalOpen(true);
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#F15B3D] hover:bg-[#3457D5] text-white text-xs sm:text-sm font-bold uppercase tracking-wide inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tải video lên ARTVERSE SHORTS</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Search & Filter Bar (III.2 ARTVERSE SHORTS) */}
      <section className="bg-white rounded-xl border border-[#20243A]/15 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#20243A]/45 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm video hoặc người đăng..."
              className="w-full pl-10 pr-9 py-2.5 rounded-lg bg-[#F7F3EA]/60 border border-[#20243A]/15 text-xs sm:text-sm text-[#20243A] focus:outline-none focus:border-[#3457D5]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="Xóa nhanh từ khóa"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#20243A]/10 hover:bg-[#20243A]/20 text-[#20243A] flex items-center justify-center cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bộ lọc: Video mới nhất | Video nổi bật */}
            <div className="inline-flex rounded-lg border border-[#20243A]/15 bg-[#F7F3EA] p-0.5">
              <button
                type="button"
                onClick={() => setSortBy('newest')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  sortBy === 'newest'
                    ? 'bg-[#20243A] text-[#F7F3EA]'
                    : 'text-[#20243A]/70 hover:text-[#20243A]'
                }`}
              >
                Video mới nhất
              </button>
              <button
                type="button"
                onClick={() => setSortBy('featured')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  sortBy === 'featured'
                    ? 'bg-[#F15B3D] text-white'
                    : 'text-[#20243A]/70 hover:text-[#20243A]'
                }`}
              >
                Video nổi bật
              </button>
            </div>

            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              aria-label="Lọc video theo thời gian đăng tải"
              className="px-3 py-2 rounded-lg bg-white border border-[#20243A]/15 text-xs font-semibold text-[#20243A] focus:outline-none focus:border-[#3457D5]"
            >
              <option value="all">Mọi thời gian</option>
              <option value="today">Hôm nay</option>
              <option value="week">7 ngày qua</option>
              <option value="month">30 ngày qua</option>
            </select>

            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              aria-label="Lọc video theo khối lớp"
              className="px-3 py-2 rounded-lg bg-white border border-[#20243A]/15 text-xs font-semibold text-[#20243A] focus:outline-none focus:border-[#3457D5]"
            >
              <option value="all">Tất cả khối lớp (Lớp 1 – 9)</option>
              {['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5', 'Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9'].map(
                (g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                )
              )}
            </select>

            {isStaff && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                aria-label="Lọc trạng thái kiểm duyệt video"
                className="px-3 py-2 rounded-lg bg-[#20243A] text-[#F7F3EA] text-xs font-bold focus:outline-none"
              >
                <option value="all">Tất cả trạng thái ({allShorts.length})</option>
                <option value="approved">Đã công bố</option>
                <option value="pending">Chờ duyệt</option>
                <option value="hidden">Đã ẩn</option>
              </select>
            )}
          </div>
        </div>
      </section>

      {/* 3. ARTVERSE SHORTS Video Grid */}
      {visibleShorts.length === 0 ? (
        <section className="rounded-xl bg-white border border-[#20243A]/15 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-lg bg-[#20243A] text-[#F2D64B] flex items-center justify-center mx-auto">
            <Film className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="font-display text-lg font-bold text-[#20243A]">
              Không tìm thấy video phù hợp
            </h2>
            <p className="text-xs text-[#20243A]/65 leading-relaxed">
              Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc thời gian, khối lớp. ARTVERSE SHORTS chỉ hiển thị video ngắn sáng tạo (không bao gồm video bài giảng Mĩ thuật GDPT).
            </p>
          </div>
          {(searchQuery || gradeFilter !== 'all' || timeFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setGradeFilter('all');
                setTimeFilter('all');
              }}
              className="px-4 py-2 rounded-lg border border-[#20243A]/20 text-xs font-bold text-[#20243A] hover:bg-[#20243A] hover:text-white transition-colors cursor-pointer"
            >
              Xóa bộ lọc tìm kiếm
            </button>
          )}
        </section>
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {visibleShorts.slice(0, visibleLimit).map((short) => {
              const authorAlias =
                short.authorNickname || short.authorAlias || short.creatorAnonymousPseudonym;
              const gradeLabel = getArtworkNormalizedGrade(short);
              const totalEmotions = (Object.values(short.emotionCounts || {}) as number[]).reduce(
                (a, b) => a + b,
                0
              );

              return (
                <article
                  key={short.id}
                  onClick={() => setSelectedShort(short)}
                  className="group cursor-pointer rounded-xl bg-white border border-[#20243A]/15 hover:border-[#20243A]/45 overflow-hidden flex flex-col justify-between transition-colors"
                >
                  {/* Vertical 9:16 / 4:5 Contemporary Video Frame */}
                  <div className="relative aspect-[4/5] bg-[#161929] overflow-hidden flex items-center justify-center">
                    {short.thumbnailUrl || short.imageUrl ? (
                      <img
                        src={short.thumbnailUrl || short.imageUrl}
                        alt={short.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-90 group-hover:scale-103 transition-transform duration-300"
                      />
                    ) : (
                      <video
                        src={short.videoUrl || short.downloadURL}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full h-full object-cover opacity-90"
                      />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Play Button */}
                    <div className="w-12 h-12 rounded-full bg-white/95 text-[#20243A] flex items-center justify-center shadow-lg group-hover:bg-[#F15B3D] group-hover:text-white transition-colors z-10">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>

                    {/* Top Status Label (Only if pending/hidden) */}
                    {short.status !== 'approved' && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-sm bg-[#F2D64B] text-[#20243A] text-[10px] font-bold uppercase tracking-wider">
                        {short.status === 'pending' ? 'CHỜ DUYỆT' : 'ĐÃ ẨN'}
                      </span>
                    )}

                    {/* Bottom Overlay Info */}
                    <div className="absolute bottom-3 left-3 right-3 text-white z-10 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono-code text-[#F2D64B]">
                        <span>ARTVERSE SHORTS</span>
                        <span>
                          {short.duration ? `${Math.round(short.duration)}s` : 'VIDEO'}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">
                        {short.title}
                      </h3>
                    </div>
                  </div>

                  {/* Metadata & Staff Controls Footer */}
                  <div className="p-3.5 space-y-2.5 bg-white">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-[#20243A] truncate">{authorAlias}</p>
                        <p className="text-[11px] text-[#20243A]/60 truncate">
                          {gradeLabel} · {short.materialsUsed || 'Video ngắn'}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-[#3457D5] tabular-nums shrink-0">
                        ❤️ {totalEmotions}
                      </span>
                    </div>

                    {isStaff && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="pt-2 border-t border-[#20243A]/10 flex items-center justify-between gap-1.5"
                      >
                        {short.status === 'pending' && onApproveShort && (
                          <button
                            type="button"
                            onClick={() => onApproveShort(short.id)}
                            className="px-2 py-1 rounded bg-[#269C91] text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Duyệt</span>
                          </button>
                        )}

                        {short.status === 'hidden'
                          ? onUnhideShort && (
                              <button
                                type="button"
                                onClick={() => onUnhideShort(short.id)}
                                className="px-2 py-1 rounded bg-[#3457D5] text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Hiện lại</span>
                              </button>
                            )
                          : onHideShort && (
                              <button
                                type="button"
                                onClick={() => onHideShort(short.id)}
                                className="px-2 py-1 rounded bg-[#20243A]/10 text-[#20243A] text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <EyeOff className="w-3 h-3" />
                                <span>Ẩn</span>
                              </button>
                            )}

                        {onDeleteShort && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(short.id)}
                            className="px-2 py-1 rounded bg-[#F15B3D]/15 text-[#F15B3D] text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer ml-auto"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Xóa</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          {visibleShorts.length > visibleLimit && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + 12)}
                className="px-6 py-2.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Tải thêm video ({visibleShorts.length - visibleLimit} video còn lại)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal Before Deleting a Short Video */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-[#20243A]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#20243A] max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#20243A]">
              Xác nhận xóa video ARTVERSE SHORTS
            </h3>
            <p className="text-xs text-[#20243A]/75 leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn video này khỏi ARTVERSE SHORTS và giải phóng dung lượng lưu trữ không? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-lg border border-[#20243A]/20 text-xs font-bold text-[#20243A] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = confirmDeleteId;
                  setConfirmDeleteId(null);
                  if (selectedShort?.id === id) setSelectedShort(null);
                  await onDeleteShort?.(id);
                }}
                className="px-4 py-2 rounded-lg bg-[#F15B3D] text-white text-xs font-bold cursor-pointer"
              >
                Xác nhận xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ARTVERSE SHORTS Video Player & Detail Modal */}
      {selectedShort && (
        <div
          className="fixed inset-0 z-50 bg-[#20243A]/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#F7F3EA] border border-[#20243A] rounded-xl w-full max-w-5xl overflow-hidden shadow-2xl my-auto">
            {/* Top Bar */}
            <div className="bg-[#20243A] text-[#F7F3EA] px-5 py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <Film className="w-4 h-4 text-[#F15B3D] shrink-0" />
                <span className="text-xs font-mono-code font-bold uppercase tracking-widest text-[#F2D64B]">
                  ARTVERSE SHORTS
                </span>
                <span className="text-white/30">·</span>
                <span className="text-xs font-bold truncate">{selectedShort.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShort(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 max-h-[84vh] overflow-y-auto">
              {/* Left: Video Player Stage */}
              <div className="lg:col-span-6 bg-[#101320] flex flex-col items-center justify-center p-4 min-h-[320px]">
                <video
                  key={selectedShort.videoUrl || selectedShort.downloadURL}
                  src={selectedShort.videoUrl || selectedShort.downloadURL}
                  poster={selectedShort.thumbnailUrl || selectedShort.imageUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-[68vh] rounded-lg bg-black object-contain"
                />
              </div>

              {/* Right: Video Info, 5-Emotion Bar & Comments */}
              <div className="lg:col-span-6 p-5 sm:p-6 space-y-5 overflow-y-auto bg-[#F7F3EA]">
                <div className="bg-white rounded-lg border border-[#20243A]/15 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg sm:text-xl font-bold text-[#20243A]">
                        {selectedShort.title}
                      </h2>
                      <p className="text-xs text-[#20243A]/65 mt-0.5">
                        Tác giả:{' '}
                        <strong className="text-[#20243A]">
                          {selectedShort.authorNickname ||
                            selectedShort.authorAlias ||
                            selectedShort.creatorAnonymousPseudonym}
                        </strong>{' '}
                        · {getArtworkNormalizedGrade(selectedShort)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenReportModal('artwork', selectedShort.id, selectedShort.title)
                      }
                      className="px-2.5 py-1 rounded border border-[#20243A]/15 text-[11px] font-semibold text-[#20243A]/70 hover:text-[#F15B3D] inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Flag className="w-3 h-3" />
                      <span>Báo cáo</span>
                    </button>
                  </div>

                  {selectedShort.description && (
                    <p className="text-xs text-[#20243A]/80 leading-relaxed">
                      {selectedShort.description}
                    </p>
                  )}

                  <div className="pt-2 border-t border-[#20243A]/10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#20243A]/60">
                    <span>
                      Thời lượng:{' '}
                      {selectedShort.duration ? `${Math.round(selectedShort.duration)}s` : 'Ngắn'}
                    </span>
                    <span>·</span>
                    <span>
                      Dung lượng:{' '}
                      {selectedShort.fileSize ? formatFileSize(selectedShort.fileSize) : 'Chuẩn HD'}
                    </span>
                    <span>·</span>
                    <span>Định dạng: {selectedShort.mimeType || 'video/mp4'}</span>
                  </div>
                </div>

                {/* Unified 5-Emotion Bar (❤️ Yêu thích | 👍 Thích | 😂 Vui | 😢 Buồn | 😡 Giận) */}
                <div className="bg-white rounded-lg border border-[#20243A]/15 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#20243A]">
                      Cảm xúc dành cho video
                    </span>
                    {reactionStatus === 'loading' && (
                      <span className="text-[11px] text-[#3457D5] font-semibold inline-flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Đang lưu...</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {ARTWORK_EMOTION_ORDER.map((emoKey) => {
                      const meta = ARTWORK_EMOTIONS_META[emoKey];
                      const count = emotionCounts[emoKey] || 0;
                      const isSelected = myEmotion === emoKey;
                      return (
                        <button
                          key={emoKey}
                          type="button"
                          disabled={reactionStatus === 'loading'}
                          onClick={() => handleToggleShortEmotion(emoKey)}
                          className={`py-2 px-1.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                            isSelected
                              ? 'bg-[#20243A] text-[#F7F3EA] border-[#20243A] font-bold'
                              : 'bg-[#F7F3EA]/60 hover:bg-[#20243A]/5 text-[#20243A] border-[#20243A]/15'
                          }`}
                        >
                          <span className="text-base leading-none">{meta.emoji}</span>
                          <span className="text-[10px] leading-tight truncate w-full">
                            {meta.label}
                          </span>
                          <span className="text-[11px] font-bold tabular-nums">{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {reactionStatus === 'error' && reactionErrorMsg && (
                    <div className="p-2.5 rounded bg-rose-50 border border-rose-200 flex items-center justify-between gap-2 text-xs text-rose-800">
                      <span>{reactionErrorMsg}</span>
                      {lastAttemptedEmotion && (
                        <button
                          type="button"
                          onClick={() => handleToggleShortEmotion(lastAttemptedEmotion)}
                          className="px-2.5 py-1 rounded bg-rose-700 text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Thử lại</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Comments Section (Default 3 newest + View All) */}
                <div className="bg-white rounded-lg border border-[#20243A]/15 p-4">
                  <ArtverseCommunityComments
                    artwork={selectedShort}
                    currentRole={currentRole}
                    onShowToast={onShowToast}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Upload Short Video Modal */}
      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#20243A]/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#F7F3EA] border border-[#20243A] rounded-xl max-w-xl w-full overflow-hidden shadow-2xl my-auto">
            <div className="bg-[#20243A] text-[#F7F3EA] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-[#F15B3D]" />
                <h2 className="font-display text-base sm:text-lg font-bold">
                  Tải video ngắn lên ARTVERSE SHORTS
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (uploadState === 'UPLOADING') {
                    abortControllerRef.current?.abort();
                  }
                  setIsUploadModalOpen(false);
                }}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadShortSubmit} className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{uploadError}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#20243A] mb-1.5">
                  1. Chọn tệp video ngắn (.mp4, .mov, .webm · tối đa 100MB, &le;180 giây) *
                </label>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                  onChange={handleSelectVideoFile}
                  className="w-full text-xs text-[#20243A] file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#20243A] file:text-[#F7F3EA] hover:file:bg-[#3457D5] bg-white p-2 rounded-lg border border-[#20243A]/20 cursor-pointer"
                />
                {videoFile && videoMeta && (
                  <p className="text-[11px] text-[#269C91] font-semibold mt-1.5 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      Đã sẵn sàng: {videoFile.name} ({formatFileSize(videoFile.size)} ·{' '}
                      {Math.round(videoMeta.duration)}s)
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#20243A] mb-1.5">
                  2. Tiêu đề video ARTVERSE SHORTS *
                </label>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={shortTitle}
                  onChange={(e) => setShortTitle(e.target.value)}
                  placeholder="Ví dụ: Quá trình pha màu nước bức tranh Cầu Rồng..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-[#20243A]/20 text-xs sm:text-sm font-semibold text-[#20243A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#20243A] mb-1.5">
                    3. Khối lớp
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    disabled={isStudent && Boolean(profile?.classGroupId)}
                    className="w-full px-3 py-2.5 rounded-lg bg-white border border-[#20243A]/20 text-xs font-semibold text-[#20243A]"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#20243A] mb-1.5">
                    4. Chủ đề video ngắn
                  </label>
                  <select
                    value={shortCategory}
                    onChange={(e) => setShortCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-white border border-[#20243A]/20 text-xs font-semibold text-[#20243A]"
                  >
                    <option value="Quá trình sáng tác">Quá trình sáng tác</option>
                    <option value="Kỹ thuật chất liệu">Kỹ thuật chất liệu</option>
                    <option value="Giới thiệu tác phẩm">Giới thiệu tác phẩm</option>
                    <option value="Góc nhìn nghệ thuật">Góc nhìn nghệ thuật</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#20243A] mb-1.5">
                  5. Mô tả ngắn (không ghi số điện thoại hoặc địa chỉ riêng tư)
                </label>
                <textarea
                  rows={3}
                  maxLength={800}
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Chia sẻ ngắn gọn về kỹ thuật hoặc cảm hứng trong video..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-[#20243A]/20 text-xs text-[#20243A]"
                />
              </div>

              {/* Real-time Upload Telemetry */}
              {uploadState !== 'QUEUED' && uploadTelemetry && (
                <div className="p-3.5 rounded-lg bg-white border border-[#20243A]/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#20243A]">
                    <span>{uploadTelemetry.stageText || UPLOAD_STATE_LABELS[uploadState]}</span>
                    <span className="tabular-nums text-[#3457D5]">{uploadTelemetry.percent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#20243A]/10 overflow-hidden">
                    <div
                      className="h-full bg-[#3457D5] transition-all duration-200"
                      style={{ width: `${Math.min(100, Math.max(2, uploadTelemetry.percent))}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-[#20243A]/65 tabular-nums">
                    <span>
                      {formatFileSize(uploadTelemetry.bytesTransferred)} /{' '}
                      {formatFileSize(uploadTelemetry.totalBytes)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{uploadTelemetry.elapsedSeconds}s</span>
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[11px] text-[#20243A]/65">
                  <ShieldCheck className="w-4 h-4 text-[#269C91] shrink-0" />
                  <span>
                    {isStaff
                      ? 'Tài khoản Giáo viên/Admin: Xuất bản ngay lên ARTVERSE SHORTS.'
                      : 'Video của học sinh sẽ được kiểm duyệt an toàn trước khi công bố.'}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={
                    !videoFile ||
                    uploadState === 'UPLOADING' ||
                    uploadState === 'SAVING_METADATA'
                  }
                  className="px-5 py-2.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] text-xs font-bold uppercase tracking-wide inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {uploadState === 'UPLOADING' || uploadState === 'SAVING_METADATA' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tải lên...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Đăng video</span>
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

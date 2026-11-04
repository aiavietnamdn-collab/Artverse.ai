/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ART VERSE AI — 2. TRIỂN LÃM TÁC PHẨM (CommunityLibraryView)
 * Ngôn ngữ thiết kế: CONTEMPORARY CREATIVE GALLERY
 *
 * Đặc tả Tìm kiếm (Mục III.1):
 * - Placeholder: "Tìm kiếm tác phẩm hoặc tác giả..."
 * - Tìm theo: Tên tác phẩm, Bí danh tác giả, Tên chủ đề / từ khóa mô tả, Lớp học, Thời gian đăng tải.
 * - Hỗ trợ tiếng Việt có dấu & không dấu, nút xóa nhanh từ khóa, gợi ý từ khóa, phân trang (Tải thêm).
 * - Bộ lọc: Tác phẩm mới nhất, Tác phẩm nổi bật, Theo cấp học (Tiểu học / THCS), Theo lớp (Lớp 1–9), Theo chủ đề, Theo thời gian.
 * - Không đưa video vào TRIỂN LÃM TÁC PHẨM (video thuộc ARTVERSE SHORTS).
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  ClassGroup,
  ArtLesson,
  ArtworkStory,
  ArtworkStoryStatus,
  CommunityArtwork,
  PositiveReactionKey,
  UserRole,
} from '../../types/communityArt';
import {
  STANDARD_GRADES,
  getArtworkNormalizedGrade,
  doesArtworkMatchGradeFilter,
  normalizeGrade,
} from '../../utils/gradeUtils';
import {
  matchesSearchQuery,
  isWithinDateFilter,
} from '../../utils/searchEngine';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import {
  Camera,
  Search,
  Sparkles,
  Flag,
  Clock,
  BookOpen,
  Presentation,
  Award,
  Trash2,
  Pencil,
  SlidersHorizontal,
  EyeOff,
  Eye,
  QrCode,
  Palette,
  Layers,
  Heart,
  X,
  GraduationCap,
  ArrowUpDown,
} from 'lucide-react';

interface CommunityLibraryViewProps {
  artworks: CommunityArtwork[];
  stories?: ArtworkStory[];
  classes: ClassGroup[];
  lessons: ArtLesson[];
  currentRole: UserRole;
  currentAuthorKey: string;
  currentStudentUid?: string;
  selectedClassFilter: string;
  onChangeClassFilter: (classId: string) => void;
  selectedLessonFilter: string;
  onChangeLessonFilter: (lessonId: string) => void;
  onSelectArtwork: (artwork: CommunityArtwork) => void;
  onOpenInstantCaptureModal: () => void;
  onOpenProjectorModal: (startIndex: number) => void;
  onOpenArtbookExportModal: () => void;
  onOpenLabelAndCertificate: (artwork: CommunityArtwork, tab: 'qr-label' | 'certificate') => void;
  onOpenWriteStoryModal?: (
    artwork?: CommunityArtwork | null,
    storyToEdit?: ArtworkStory | null
  ) => void;
  onStoriesRefresh?: () => void;
  onModerateStory?: (
    storyId: string,
    status: ArtworkStoryStatus,
    teacherNote?: string
  ) => Promise<void>;
  onEditArtwork: (artwork: CommunityArtwork) => void;
  onHideArtwork: (artworkId: string) => void;
  onUnhideArtwork: (artworkId: string) => void;
  onReaction: (artworkId: string, reactionKey: PositiveReactionKey) => void;
  onDeleteArtwork: (artworkId: string) => void;
  onToggleShareStatus: (artworkId: string) => void;
  onOpenReportModal: (
    targetType: 'artwork' | 'comment' | 'story',
    targetId: string,
    targetTitle: string
  ) => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

const PAGE_SIZE = 12;

export const CommunityLibraryView: React.FC<CommunityLibraryViewProps> = ({
  artworks,
  stories = [],
  lessons,
  currentRole,
  currentAuthorKey,
  currentStudentUid,
  selectedClassFilter,
  onChangeClassFilter,
  selectedLessonFilter,
  onChangeLessonFilter,
  onSelectArtwork,
  onOpenInstantCaptureModal,
  onOpenProjectorModal,
  onOpenArtbookExportModal,
  onOpenLabelAndCertificate,
  onOpenWriteStoryModal,
  onEditArtwork,
  onHideArtwork,
  onUnhideArtwork,
  onDeleteArtwork,
  onOpenReportModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'featured'>('newest');
  const [educationLevelFilter, setEducationLevelFilter] = useState<'all' | 'TIEU_HOC' | 'THCS'>(
    'all'
  );
  const [mediumFilter, setMediumFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isTeacherOrMod =
    currentRole === 'teacher' || currentRole === 'moderator' || currentRole === 'admin';

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    searchQuery,
    sortBy,
    educationLevelFilter,
    selectedClassFilter,
    selectedLessonFilter,
    mediumFilter,
    timeFilter,
  ]);

  const approvedStoryMapByArtworkId = useMemo(() => {
    const map = new Map<string, ArtworkStory>();
    for (const s of stories) {
      if (s.status === 'approved') {
        map.set(s.artworkId, s);
      }
    }
    return map;
  }, [stories]);

  // Visual Artworks Only ("Không đưa video vào TRIỂN LÃM TÁC PHẨM")
  const visualArtworksOnly = useMemo(
    () =>
      artworks.filter(
        (item) =>
          item.mediaType !== 'video' &&
          !item.videoUrl &&
          !(item.mimeType && item.mimeType.startsWith('video/'))
      ),
    [artworks]
  );

  const availableMediums = useMemo(() => {
    const set = new Set<string>();
    for (const art of visualArtworksOnly) {
      if (art.materialsUsed && art.materialsUsed.trim()) {
        set.add(art.materialsUsed.trim());
      }
    }
    return Array.from(set);
  }, [visualArtworksOnly]);

  const availableLessons = useMemo(() => {
    return lessons.filter((l) => {
      if (l.status === 'deleted') return false;
      if (selectedClassFilter === 'all') return true;
      return (
        l.classGroupId === selectedClassFilter ||
        normalizeGrade(l.className || l.classGroupId) === normalizeGrade(selectedClassFilter)
      );
    });
  }, [lessons, selectedClassFilter]);

  const visibleArtworks = useMemo(() => {
    const filtered = visualArtworksOnly.filter((item) => {
      const isOwner =
        item.ownerKey === currentAuthorKey ||
        Boolean(currentStudentUid && item.ownerKey === currentStudentUid) ||
        Boolean(currentStudentUid && item.authorAccountId === currentStudentUid);
      if (
        !isTeacherOrMod &&
        !isOwner &&
        (item.status !== 'approved' || item.shareStatus !== 'shared')
      ) {
        return false;
      }

      const normalizedItemGrade = getArtworkNormalizedGrade(item);

      // Education Level Filter (Tiểu học vs THCS)
      if (educationLevelFilter === 'TIEU_HOC') {
        if (!['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5'].includes(normalizedItemGrade)) {
          return false;
        }
      } else if (educationLevelFilter === 'THCS') {
        if (!['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9'].includes(normalizedItemGrade)) {
          return false;
        }
      }

      if (!doesArtworkMatchGradeFilter(item, selectedClassFilter)) {
        return false;
      }

      if (selectedLessonFilter !== 'all' && item.lessonId !== selectedLessonFilter) {
        return false;
      }

      if (mediumFilter !== 'all' && (item.materialsUsed || '').trim() !== mediumFilter) {
        return false;
      }

      if (!isWithinDateFilter(item.updatedAt || item.createdAt, timeFilter)) {
        return false;
      }

      // Accented + Unaccented Vietnamese Search across Title, Alias, Topic, Description, Class, Date
      if (searchQuery.trim() !== '') {
        const linkedStory = approvedStoryMapByArtworkId.get(item.id);
        const publicAlias =
          linkedStory?.authorNickname ||
          item.authorNickname ||
          item.authorAlias ||
          item.creatorAnonymousPseudonym;
        const matched = matchesSearchQuery(
          searchQuery,
          [item.title, publicAlias, normalizedItemGrade],
          [
            item.description,
            item.materialsUsed,
            item.lessonTitle,
            item.topic,
            item.createdAt,
          ]
        );
        if (!matched) return false;
      }

      return true;
    });

    // Sort by newest vs featured (total emotions)
    return filtered.sort((a, b) => {
      if (sortBy === 'featured') {
        const emotionsA =
          (Object.values(a.emotionCounts || {}) as number[]).reduce((s, v) => s + v, 0) +
          (Object.values(a.reactions || {}) as number[]).reduce((s, v) => s + v, 0);
        const emotionsB =
          (Object.values(b.emotionCounts || {}) as number[]).reduce((s, v) => s + v, 0) +
          (Object.values(b.reactions || {}) as number[]).reduce((s, v) => s + v, 0);
        if (emotionsB !== emotionsA) return emotionsB - emotionsA;
      }
      const timeA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
      const timeB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
      return timeB - timeA;
    });
  }, [
    visualArtworksOnly,
    isTeacherOrMod,
    currentAuthorKey,
    currentStudentUid,
    educationLevelFilter,
    selectedClassFilter,
    selectedLessonFilter,
    mediumFilter,
    timeFilter,
    searchQuery,
    sortBy,
    approvedStoryMapByArtworkId,
  ]);

  const approvedTotalCount = useMemo(
    () =>
      visualArtworksOnly.filter(
        (a) => isTeacherOrMod || (a.status === 'approved' && a.shareStatus === 'shared')
      ).length,
    [visualArtworksOnly, isTeacherOrMod]
  );

  const gradeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of STANDARD_GRADES) {
      counts[g.label] = 0;
    }
    for (const item of visualArtworksOnly) {
      if (!isTeacherOrMod && (item.status !== 'approved' || item.shareStatus !== 'shared')) {
        continue;
      }
      const gradeLabel = getArtworkNormalizedGrade(item);
      if (counts[gradeLabel] !== undefined) {
        counts[gradeLabel] += 1;
      }
    }
    return counts;
  }, [visualArtworksOnly, isTeacherOrMod]);

  const selectedGradeLabel =
    selectedClassFilter === 'all' ? 'Tất cả khối lớp' : normalizeGrade(selectedClassFilter);

  const paginatedArtworks = visibleArtworks.slice(0, visibleCount);
  const hasMoreArtworks = visibleArtworks.length > visibleCount;

  return (
    <div className="space-y-8 pb-16 text-[#20243A] museum-fade-in">
      {/* 1. Contemporary Creative Gallery Header & Search / Filter Controls */}
      <section className="rounded-xl bg-white border border-[#20243A]/15 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 border-b border-[#20243A]/12 pb-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#3457D5]">
              <span className="w-2.5 h-2.5 bg-[#3457D5] inline-block" />
              <span>ART VERSE AI · PHÂN HỆ 02</span>
            </div>
            <h1
              className="font-display font-black text-[#20243A] tracking-tight uppercase leading-[1.02]"
              style={{ fontSize: 'clamp(1.85rem, 4vw, 3rem)' }}
            >
              TRIỂN LÃM TÁC PHẨM
            </h1>
            <p className="text-xs sm:text-sm text-[#20243A]/70 max-w-2xl">
              Không gian trưng bày các tác phẩm mỹ thuật của học sinh Tiểu học &amp; THCS (Lớp 1 – Lớp 9). Nhấn vào tác phẩm để xem chi tiết, thả 5 cảm xúc ❤️ 👍 😂 😢 😡 và bình luận.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => onOpenProjectorModal(0)}
              className="min-h-[40px] px-4 py-2 bg-[#F7F3EA] hover:bg-[#20243A] text-[#20243A] hover:text-[#F7F3EA] border border-[#20243A]/20 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Presentation className="w-4 h-4" />
              <span>Trình chiếu</span>
            </button>

            {onOpenWriteStoryModal && (
              <button
                type="button"
                onClick={() => onOpenWriteStoryModal(null)}
                className="min-h-[40px] px-4 py-2 bg-[#269C91]/12 hover:bg-[#269C91] text-[#269C91] hover:text-white border border-[#269C91]/30 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>Viết câu chuyện</span>
              </button>
            )}

            {visibleArtworks.length > 0 && (
              <button
                type="button"
                onClick={onOpenArtbookExportModal}
                className="min-h-[40px] px-4 py-2 bg-white hover:bg-[#F7F3EA] text-[#20243A] border border-[#20243A]/20 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <BookOpen className="w-4 h-4 text-[#3457D5]" />
                <span>In Kỷ yếu</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenInstantCaptureModal}
              className="min-h-[40px] px-5 py-2 bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] font-bold text-xs uppercase tracking-wider rounded-lg inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4 text-[#F2D64B]" />
              <span>Đăng tác phẩm</span>
            </button>
          </div>
        </div>

        {/* Search Input ("Tìm kiếm tác phẩm hoặc tác giả...") + Sort & Filter Controls */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#3457D5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm tác phẩm hoặc tác giả..."
                className="w-full pl-10 pr-20 py-2.5 bg-[#F7F3EA] border border-[#20243A]/20 rounded-lg text-xs sm:text-sm font-medium text-[#20243A] placeholder:text-[#20243A]/50 focus:outline-none focus:border-[#3457D5] focus:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-white hover:bg-[#F15B3D] text-[#20243A] hover:text-white border border-[#20243A]/15 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <X className="w-3 h-3" />
                  <span>Xóa</span>
                </button>
              )}
            </div>

            {/* Sort Filter: Tác phẩm mới nhất vs Tác phẩm nổi bật */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="inline-flex items-center rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 p-1">
                <button
                  type="button"
                  onClick={() => setSortBy('newest')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    sortBy === 'newest'
                      ? 'bg-[#20243A] text-[#F7F3EA]'
                      : 'text-[#20243A]/70 hover:text-[#20243A]'
                  }`}
                >
                  Tác phẩm mới nhất
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('featured')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    sortBy === 'featured'
                      ? 'bg-[#3457D5] text-white'
                      : 'text-[#20243A]/70 hover:text-[#20243A]'
                  }`}
                >
                  Tác phẩm nổi bật
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`min-h-[40px] px-3.5 py-2 rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
                  showAdvancedFilters ||
                  educationLevelFilter !== 'all' ||
                  selectedLessonFilter !== 'all' ||
                  mediumFilter !== 'all' ||
                  timeFilter !== 'all'
                    ? 'bg-[#F2D64B] text-[#20243A] border-[#20243A]'
                    : 'bg-white text-[#20243A] border-[#20243A]/20 hover:bg-[#F7F3EA]'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Bộ lọc nâng cao</span>
              </button>
            </div>
          </div>

          {/* Education Level + Grade Filter Bar (Lớp 1 -> Lớp 9) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => {
                setEducationLevelFilter('all');
                onChangeClassFilter('all');
                onChangeLessonFilter('all');
              }}
              className={`min-h-[34px] px-3.5 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                selectedClassFilter === 'all' && educationLevelFilter === 'all'
                  ? 'bg-[#20243A] text-[#F7F3EA]'
                  : 'bg-[#F7F3EA] text-[#20243A]/75 border border-[#20243A]/12 hover:text-[#20243A]'
              }`}
            >
              Tất cả ({approvedTotalCount})
            </button>

            <button
              type="button"
              onClick={() => {
                setEducationLevelFilter(
                  educationLevelFilter === 'TIEU_HOC' ? 'all' : 'TIEU_HOC'
                );
                onChangeClassFilter('all');
              }}
              className={`min-h-[34px] px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                educationLevelFilter === 'TIEU_HOC'
                  ? 'bg-[#3457D5] text-white'
                  : 'bg-white text-[#3457D5] border border-[#3457D5]/30 hover:bg-[#3457D5]/8'
              }`}
            >
              Cấp Tiểu học (Lớp 1–5)
            </button>

            <button
              type="button"
              onClick={() => {
                setEducationLevelFilter(educationLevelFilter === 'THCS' ? 'all' : 'THCS');
                onChangeClassFilter('all');
              }}
              className={`min-h-[34px] px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                educationLevelFilter === 'THCS'
                  ? 'bg-[#3457D5] text-white'
                  : 'bg-white text-[#3457D5] border border-[#3457D5]/30 hover:bg-[#3457D5]/8'
              }`}
            >
              Cấp THCS (Lớp 6–9)
            </button>

            {STANDARD_GRADES.map((g) => {
              const isSelected =
                selectedClassFilter === g.classId ||
                normalizeGrade(selectedClassFilter) === g.label;
              const count = gradeCounts[g.label] ?? 0;

              return (
                <button
                  key={g.classId}
                  type="button"
                  onClick={() => {
                    onChangeClassFilter(g.classId);
                    onChangeLessonFilter('all');
                  }}
                  className={`min-h-[34px] px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-[#20243A] text-[#F7F3EA] font-bold'
                      : 'bg-white text-[#20243A]/80 border border-[#20243A]/15 hover:bg-[#F7F3EA]'
                  }`}
                >
                  {g.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Advanced Filters: Theo cấp học, Theo chủ đề, Chất liệu, Thời gian đăng tải */}
          {showAdvancedFilters && (
            <div className="p-4 rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#20243A] mb-1 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-[#3457D5]" />
                  <span>Cấp học</span>
                </label>
                <select
                  value={educationLevelFilter}
                  onChange={(e) =>
                    setEducationLevelFilter(e.target.value as 'all' | 'TIEU_HOC' | 'THCS')
                  }
                  className="w-full px-3 py-2 rounded-md bg-white border border-[#20243A]/20 text-xs font-semibold text-[#20243A]"
                >
                  <option value="all">Tất cả cấp học</option>
                  <option value="TIEU_HOC">Tiểu học (Lớp 1 – Lớp 5)</option>
                  <option value="THCS">THCS (Lớp 6 – Lớp 9)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#20243A] mb-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-[#3457D5]" />
                  <span>Chủ đề / Bài học</span>
                </label>
                <select
                  value={selectedLessonFilter}
                  onChange={(e) => onChangeLessonFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-white border border-[#20243A]/20 text-xs font-semibold text-[#20243A]"
                >
                  <option value="all">Tất cả chủ đề</option>
                  {availableLessons.map((les) => (
                    <option key={les.id} value={les.id}>
                      {les.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#20243A] mb-1 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-[#F15B3D]" />
                  <span>Chất liệu sáng tác</span>
                </label>
                <select
                  value={mediumFilter}
                  onChange={(e) => setMediumFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-white border border-[#20243A]/20 text-xs font-semibold text-[#20243A]"
                >
                  <option value="all">Mọi chất liệu</option>
                  {availableMediums.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#20243A] mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#269C91]" />
                  <span>Thời gian đăng tải</span>
                </label>
                <select
                  value={timeFilter}
                  onChange={(e) =>
                    setTimeFilter(e.target.value as 'all' | 'today' | '7d' | '30d')
                  }
                  className="w-full px-3 py-2 rounded-md bg-white border border-[#20243A]/20 text-xs font-semibold text-[#20243A]"
                >
                  <option value="all">Mọi thời gian</option>
                  <option value="today">Hôm nay</option>
                  <option value="7d">7 ngày gần đây</option>
                  <option value="30d">30 ngày gần đây</option>
                </select>
              </div>
            </div>
          )}

          {/* Active Search / Filter Summary */}
          <div className="flex items-center justify-between text-xs text-[#20243A]/65 pt-1">
            <span>
              Hiển thị <strong>{paginatedArtworks.length}</strong> /{' '}
              <strong>{visibleArtworks.length}</strong> tác phẩm phù hợp
              {searchQuery.trim() ? ` cho từ khóa “${searchQuery.trim()}”` : ''}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-[#3457D5]">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>
                {sortBy === 'featured' ? 'Sắp xếp: Tác phẩm nổi bật' : 'Sắp xếp: Tác phẩm mới nhất'}
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* 2. Artwork Exhibition Grid */}
      {visibleArtworks.length === 0 ? (
        <div className="rounded-xl bg-white border border-[#20243A]/15 p-12 text-center space-y-4">
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-display text-xl font-bold text-[#20243A]">
              {searchQuery.trim()
                ? `Không tìm thấy tác phẩm hoặc tác giả nào khớp với “${searchQuery.trim()}”`
                : selectedClassFilter === 'all'
                  ? 'Phòng triển lãm đang chờ bức tranh mở màn'
                  : `Chưa có tác phẩm nào trong ${selectedGradeLabel}`}
            </h3>
            <p className="text-xs text-[#20243A]/65">
              {searchQuery.trim()
                ? 'Bạn có thể thử tìm bằng tiếng Việt không dấu, bí danh nghệ sĩ hoặc xóa bộ lọc để xem toàn bộ triển lãm.'
                : 'Nhấn nút Đăng tác phẩm để tải tác phẩm của học sinh lên phòng trưng bày.'}
            </p>
          </div>
          {searchQuery.trim() ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setEducationLevelFilter('all');
                onChangeClassFilter('all');
                onChangeLessonFilter('all');
                setMediumFilter('all');
                setTimeFilter('all');
              }}
              className="min-h-[40px] px-5 py-2 bg-[#20243A] text-[#F7F3EA] font-bold text-xs rounded-lg cursor-pointer"
            >
              Xóa từ khóa &amp; bộ lọc
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenInstantCaptureModal}
              className="min-h-[42px] px-6 py-2.5 bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] font-bold text-xs rounded-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#F2D64B]" />
              <span>Đăng tác phẩm</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedArtworks.map((artwork) => {
              const normalizedGradeLabel = getArtworkNormalizedGrade(artwork);
              const isOwner =
                artwork.ownerKey === currentAuthorKey ||
                Boolean(currentStudentUid && artwork.ownerKey === currentStudentUid) ||
                Boolean(currentStudentUid && artwork.authorAccountId === currentStudentUid);
              const canManage = isTeacherOrMod || isOwner;
              const displayThumb =
                artwork.thumbnailUrl || artwork.imageUrl || artwork.downloadURL || '';
              const hasRealImg = Boolean(
                displayThumb &&
                  (displayThumb.startsWith('data:image') ||
                    displayThumb.startsWith('http') ||
                    displayThumb.startsWith('/api/media/files/'))
              );
              const linkedStory = approvedStoryMapByArtworkId.get(artwork.id);
              const displayNickname =
                linkedStory?.authorNickname ||
                artwork.authorNickname ||
                artwork.authorAlias ||
                artwork.creatorAnonymousPseudonym ||
                'Nghệ sĩ Trẻ';

              const totalEmotions =
                (Object.values(artwork.emotionCounts || {}) as number[]).reduce(
                  (a, b) => a + b,
                  0
                ) +
                (Object.values(artwork.reactions || {}) as number[]).reduce((a, b) => a + b, 0);

              return (
                <article
                  key={artwork.id}
                  className="group rounded-lg bg-white border border-[#20243A]/15 hover:border-[#20243A]/45 overflow-hidden transition-colors flex flex-col justify-between"
                >
                  {/* Uncropped Contemporary Gallery Artwork Frame */}
                  <div
                    onClick={() => onSelectArtwork(artwork)}
                    className="relative cursor-pointer aspect-[4/3] bg-[#EFECE4] p-2.5 flex items-center justify-center overflow-hidden"
                  >
                    {hasRealImg ? (
                      <img
                        src={displayThumb}
                        alt={artwork.title}
                        loading="lazy"
                        className="w-full h-full object-contain museum-img-zoom"
                      />
                    ) : (
                      <ArtCanvasVisual
                        type={artwork.visualType || 'watercolor'}
                        title={artwork.title}
                        badgeText={normalizedGradeLabel}
                        className="w-full h-full"
                      />
                    )}

                    {/* Minimal Grade Tag */}
                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded-sm bg-[#20243A]/90 text-[#F7F3EA] text-[10px] font-mono-code font-bold">
                      {normalizedGradeLabel}
                    </span>

                    {/* Quick Edit / Hide / Delete with Confirmation for Teacher or Owner */}
                    {canManage && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-3 right-3 z-20 flex items-center gap-1"
                      >
                        <button
                          type="button"
                          onClick={() => onEditArtwork(artwork)}
                          title="Chỉnh sửa thông tin tác phẩm"
                          className="px-2 py-1 rounded bg-white/95 hover:bg-[#F2D64B] text-[#20243A] border border-[#20243A]/20 cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Sửa</span>
                        </button>

                        {isTeacherOrMod && (
                          <button
                            type="button"
                            onClick={() => {
                              if (artwork.status === 'hidden') {
                                onUnhideArtwork(artwork.id);
                              } else {
                                onHideArtwork(artwork.id);
                              }
                            }}
                            className="p-1.5 rounded bg-white/95 hover:bg-[#20243A] text-[#20243A] hover:text-white border border-[#20243A]/20 cursor-pointer"
                            title={artwork.status === 'hidden' ? 'Hiện lại' : 'Tạm ẩn'}
                          >
                            {artwork.status === 'hidden' ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {confirmDeleteId === artwork.id ? (
                          <div className="inline-flex items-center gap-1 bg-white p-1 rounded border border-[#20243A]">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteArtwork(artwork.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-0.5 rounded bg-[#F15B3D] text-white text-[10px] font-bold cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-0.5 rounded bg-[#F7F3EA] text-[#20243A] text-[10px] font-bold cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(artwork.id)}
                            className="p-1.5 rounded bg-white/95 hover:bg-[#F15B3D] hover:text-white text-[#F15B3D] border border-[#20243A]/20 cursor-pointer"
                            title="Xóa tác phẩm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Clean Museum Caption */}
                  <div className="p-4 space-y-2.5 bg-white">
                    <div>
                      <p className="text-xs font-bold text-[#20243A] truncate">{displayNickname}</p>
                      <h3
                        onClick={() => onSelectArtwork(artwork)}
                        className="font-display text-base font-bold text-[#20243A] group-hover:text-[#3457D5] transition-colors cursor-pointer truncate mt-0.5"
                      >
                        {artwork.title}
                      </h3>
                      <div className="flex items-center justify-between text-[11px] text-[#20243A]/60 mt-0.5">
                        <span className="truncate">
                          {artwork.materialsUsed || artwork.lessonTitle || 'Màu tổng hợp'}
                        </span>
                        <span>{artwork.createdAt}</span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[#20243A]/10 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => onSelectArtwork(artwork)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#3457D5]/10 hover:bg-[#3457D5] text-[#3457D5] hover:text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                        <span>
                          {totalEmotions > 0 ? `${totalEmotions} cảm xúc` : 'Thả cảm xúc'}
                        </span>
                      </button>

                      <div className="flex items-center gap-2 text-[11px] font-bold text-[#20243A]/65">
                        <button
                          type="button"
                          onClick={() => onOpenLabelAndCertificate(artwork, 'qr-label')}
                          className="hover:text-[#3457D5] inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenLabelAndCertificate(artwork, 'certificate')}
                          className="hover:text-[#3457D5] inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Chứng nhận</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenReportModal('artwork', artwork.id, artwork.title)}
                          className="hover:text-[#F15B3D] cursor-pointer"
                          title="Báo cáo vi phạm"
                        >
                          <Flag className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination / Load More */}
          {hasMoreArtworks && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="min-h-[42px] px-6 py-2.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Tải thêm tác phẩm ({visibleArtworks.length - visibleCount} còn lại)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

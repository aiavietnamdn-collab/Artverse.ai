/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — ARTVERSE STORIES ("CÂU CHUYỆN PHÍA SAU NÉT VẼ")
 * Design Language: CONTEMPORARY CREATIVE GALLERY
 * Palette: Warm Ivory (#F7F3EA), Ink Navy (#20243A), Electric Cobalt (#3457D5), Vermilion (#F15B3D), Acid Yellow (#F2D64B), Teal (#269C91)
 */

import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Sparkles,
  Calendar,
  Filter,
  Flag,
  CheckCircle2,
  EyeOff,
  Edit3,
  Clock,
  GraduationCap,
  Layers,
  Award,
  ExternalLink,
  Quote,
  Play,
  RotateCcw,
  XCircle,
  Film,
  Heart,
  Search,
  X,
} from 'lucide-react';
import {
  ArtLesson,
  ArtworkStory,
  ArtworkStoryStatus,
  CommunityArtwork,
} from '../../types/communityArt';
import { STANDARD_GRADES, normalizeGrade } from '../../utils/gradeUtils';
import { matchesSearchQuery } from '../../utils/searchEngine';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import { useAuth } from '../../context/AuthContext';

interface ArtworkStoriesSectionProps {
  stories: ArtworkStory[];
  artworks: CommunityArtwork[];
  lessons: ArtLesson[];
  onOpenArtworkDetail: (artwork: CommunityArtwork) => void;
  onOpenWriteStoryModal: (artwork?: CommunityArtwork | null, storyToEdit?: ArtworkStory | null) => void;
  onModerateStory?: (
    storyId: string,
    status: ArtworkStoryStatus,
    teacherNote?: string
  ) => Promise<void>;
  onReportStory?: (story: ArtworkStory) => void;
}

const STATUS_BADGE_MAP: Record<
  ArtworkStoryStatus,
  { label: string; className: string }
> = {
  approved: {
    label: 'Đã xuất bản',
    className: 'bg-[#269C91]/15 text-[#269C91] border border-[#269C91]/35',
  },
  pending: {
    label: 'Chờ giáo viên duyệt',
    className: 'bg-[#3457D5]/12 text-[#3457D5] border border-[#3457D5]/30',
  },
  draft: {
    label: 'Bản nháp riêng tư',
    className: 'bg-[#20243A]/10 text-[#20243A]/75 border border-[#20243A]/20',
  },
  revision_required: {
    label: 'Cần chỉnh sửa theo góp ý GV',
    className: 'bg-[#F2D64B]/40 text-[#20243A] border border-[#20243A]/30',
  },
  rejected: {
    label: 'Từ chối xuất bản',
    className: 'bg-[#F15B3D]/15 text-[#F15B3D] border border-[#F15B3D]/35',
  },
  hidden: {
    label: 'Đang tạm ẩn',
    className: 'bg-[#20243A]/15 text-[#20243A] border border-[#20243A]/30',
  },
};

export const ArtworkStoriesSection: React.FC<ArtworkStoriesSectionProps> = ({
  stories,
  artworks,
  lessons,
  onOpenArtworkDetail,
  onOpenWriteStoryModal,
  onModerateStory,
  onReportStory,
}) => {
  const { user, profile, isStudent, isTeacher, isAdmin } = useAuth();
  const activeUid = profile?.uid || user?.uid || '';

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [viewMode, setViewMode] = useState<'public' | 'my_stories' | 'class_moderation'>('public');
  const [visibleLimit, setVisibleLimit] = useState<number>(8);
  const [teacherNoteInputs, setTeacherNoteInputs] = useState<Record<string, string>>({});
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [playingVideoStoryId, setPlayingVideoStoryId] = useState<string | null>(null);

  const artworkMap = useMemo(() => {
    const map = new Map<string, CommunityArtwork>();
    for (const art of artworks) {
      map.set(art.id, art);
    }
    return map;
  }, [artworks]);

  const topicOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of stories) {
      if (s.lessonTitle) set.add(s.lessonTitle);
      else if (s.topic) set.add(s.topic);
    }
    for (const l of lessons) {
      if (l.title) set.add(l.title);
    }
    return Array.from(set);
  }, [stories, lessons]);

  const pendingClassCount = useMemo(() => {
    return stories.filter((s) => s.status === 'pending').length;
  }, [stories]);

  const myStoriesCount = useMemo(() => {
    if (!activeUid) return 0;
    return stories.filter((s) => s.authorAccountId === activeUid).length;
  }, [stories, activeUid]);

  const filteredStories = useMemo(() => {
    const nowMs = Date.now();
    return stories.filter((story) => {
      // View mode filter (Never auto-publish unapproved stories in public view)
      if (viewMode === 'public') {
        if (story.status !== 'approved') return false;
      } else if (viewMode === 'my_stories') {
        if (!activeUid || story.authorAccountId !== activeUid) return false;
      } else if (viewMode === 'class_moderation') {
        if (story.status === 'draft' && story.authorAccountId !== activeUid) return false;
      }

      // Grade filter (Lớp 1 -> Lớp 9)
      const normalizedStoryGrade = normalizeGrade(story.gradeLabel || story.classGroupId);
      if (selectedGrade !== 'all' && normalizedStoryGrade !== selectedGrade) {
        return false;
      }

      // Topic / Lesson filter
      if (selectedTopic !== 'all') {
        const storyTopic = story.lessonTitle || story.topic || '';
        if (storyTopic !== selectedTopic) return false;
      }

      // Time filter
      if (selectedTimeRange !== 'all') {
        const dateStr = story.publishedAt || story.createdAt;
        const storyMs = Date.parse(dateStr);
        if (!Number.isNaN(storyMs)) {
          const diffMs = nowMs - storyMs;
          if (selectedTimeRange === 'today' && diffMs > 24 * 3600 * 1000) return false;
          if (selectedTimeRange === '7d' && diffMs > 7 * 24 * 3600 * 1000) return false;
          if (selectedTimeRange === '30d' && diffMs > 30 * 24 * 3600 * 1000) return false;
        }
      }

      // III.3 Search by story title, author alias, content keywords, date
      if (searchQuery.trim()) {
        const matched = matchesSearchQuery(searchQuery, {
          primary: [story.storyTitle, story.artworkTitle],
          secondary: [story.authorNickname, story.gradeLabel, story.lessonTitle, story.topic],
          tertiary: [
            story.storyContent,
            story.inspirationText,
            story.feelingText,
            story.viewerMessage,
            story.createdAt,
          ],
        });
        if (!matched) return false;
      }

      return true;
    });
  }, [stories, viewMode, selectedGrade, selectedTopic, selectedTimeRange, searchQuery, activeUid]);

  const formatViDate = (iso?: string) => {
    if (!iso) return '2026';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-8 text-[#20243A] museum-fade-in">
      {/* Contemporary Creative Gallery Editorial Masthead */}
      <section className="relative overflow-hidden rounded-xl bg-white border border-[#20243A]/15 p-6 sm:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-8 space-y-3">
            <div className="inline-flex items-center gap-2 text-[#3457D5] text-[11px] font-bold uppercase tracking-widest">
              <span className="w-2.5 h-2.5 bg-[#F15B3D] inline-block" />
              <span>ARTVERSE STORIES · TẠP CHÍ TỰ SỰ NGHỆ THUẬT</span>
            </div>
            <h1
              className="font-display font-black text-[#20243A] tracking-tight leading-[1.02] uppercase"
              style={{ fontSize: 'clamp(1.9rem, 4.2vw, 3.25rem)' }}
            >
              CÂU CHUYỆN <span className="text-[#3457D5]">PHÍA SAU NÉT VẼ</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#20243A]/75 max-w-2xl leading-relaxed">
              Mỗi bức tranh hay đoạn video sáng tạo đều bắt đầu từ một kỷ niệm, một câu hỏi hoặc một rung động trước cuộc sống. Đây là không gian nơi các nghệ sĩ trẻ Lớp 1 – Lớp 9 chia sẻ hành trình sáng tác bằng chính giọng kể của mình.
            </p>
          </div>

          <div className="lg:col-span-4 flex flex-wrap lg:justify-end items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenWriteStoryModal(null, null)}
              className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#F2D64B]" />
              <span>KỂ CÂU CHUYỆN CỦA EM</span>
            </button>
          </div>
        </div>
      </section>

      {/* Mode Switcher: Ấn phẩm Công khai / Bản thảo & Câu chuyện của em / Biên tập & Duyệt */}
      {(isStudent || isTeacher || isAdmin || Boolean(activeUid)) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#20243A]/12 pb-3">
          <button
            type="button"
            onClick={() => setViewMode('public')}
            className={`min-h-[38px] px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              viewMode === 'public'
                ? 'bg-[#20243A] text-[#F7F3EA]'
                : 'bg-white text-[#20243A]/75 border border-[#20243A]/15 hover:text-[#20243A]'
            }`}
          >
            Ấn phẩm Công khai ({stories.filter((s) => s.status === 'approved').length})
          </button>

          {Boolean(activeUid) && (
            <button
              type="button"
              onClick={() => setViewMode('my_stories')}
              className={`min-h-[38px] px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'my_stories'
                  ? 'bg-[#3457D5] text-white'
                  : 'bg-white text-[#20243A]/75 border border-[#20243A]/15 hover:text-[#20243A]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Bản nháp & Câu chuyện của em ({myStoriesCount})</span>
            </button>
          )}

          {(isTeacher || isAdmin) && (
            <button
              type="button"
              onClick={() => setViewMode('class_moderation')}
              className={`min-h-[38px] px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'class_moderation'
                  ? 'bg-[#269C91] text-white'
                  : 'bg-white text-[#20243A]/75 border border-[#20243A]/15 hover:text-[#20243A]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Biên tập & Duyệt câu chuyện</span>
              {pendingClassCount > 0 && (
                <span className="px-2 py-0.5 rounded-sm bg-[#F15B3D] text-white text-[10px] font-bold">
                  {pendingClassCount} chờ duyệt
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {/* Editorial Search & Filter Bar (III.3 CÂU CHUYỆN SAU NÉT VẼ) */}
      <div className="bg-white border border-[#20243A]/12 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-[#20243A]/45 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm câu chuyện hoặc tác giả..."
            className="w-full pl-10 pr-9 py-2.5 rounded-lg bg-[#F7F3EA]/70 border border-[#20243A]/15 text-xs sm:text-sm text-[#20243A] focus:outline-none focus:border-[#3457D5]"
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

        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#20243A]">
            <Filter className="w-3.5 h-3.5 text-[#3457D5]" />
            <span>Bộ lọc Mục lục ({filteredStories.length}):</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 max-w-3xl">
            <div className="flex items-center gap-2 bg-[#F7F3EA] border border-[#20243A]/15 rounded-lg px-3.5 py-2">
              <GraduationCap className="w-4 h-4 text-[#3457D5] shrink-0" />
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-[#20243A] focus:outline-none"
              >
                <option value="all">Tất cả khối lớp (Lớp 1 – Lớp 9)</option>
                {STANDARD_GRADES.map((grade) => (
                  <option key={grade.classId} value={grade.label}>
                    {grade.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-[#F7F3EA] border border-[#20243A]/15 rounded-lg px-3.5 py-2">
              <Layers className="w-4 h-4 text-[#F15B3D] shrink-0" />
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-[#20243A] focus:outline-none"
              >
                <option value="all">Tất cả chủ đề sáng tác</option>
                {topicOptions.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-[#F7F3EA] border border-[#20243A]/15 rounded-lg px-3.5 py-2">
              <Clock className="w-4 h-4 text-[#269C91] shrink-0" />
              <select
                value={selectedTimeRange}
                onChange={(e) =>
                  setSelectedTimeRange(e.target.value as 'all' | 'today' | '7d' | '30d')
                }
                className="w-full bg-transparent text-xs font-bold text-[#20243A] focus:outline-none"
              >
                <option value="all">Mọi thời gian</option>
                <option value="today">Hôm nay</option>
                <option value="7d">7 ngày qua</option>
                <option value="30d">30 ngày qua</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Magazine Editorial Spreads */}
      {filteredStories.length === 0 ? (
        <div className="bg-white border border-[#20243A]/12 rounded-xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-lg bg-[#3457D5]/10 text-[#3457D5] flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="font-display text-xl font-bold text-[#20243A]">
              {viewMode === 'my_stories'
                ? 'Em chưa có bản nháp hoặc câu chuyện nào'
                : viewMode === 'class_moderation'
                  ? 'Hiện chưa có câu chuyện nào chờ duyệt'
                  : 'Chưa có bài viết tự sự nào trong mục lục này'}
            </h3>
            <p className="text-xs sm:text-sm text-[#20243A]/65 leading-relaxed">
              Nhấn nút <strong className="text-[#3457D5]">“KỂ CÂU CHUYỆN CỦA EM”</strong> để chia sẻ cảm hứng, quá trình thực hiện và thông điệp phía sau tác phẩm của mình.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenWriteStoryModal(null, null)}
            className="min-h-[42px] px-6 py-2.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#F2D64B]" />
            <span>Viết câu chuyện đầu tiên</span>
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredStories.slice(0, visibleLimit).map((story, idx) => {
            const linkedArtwork = artworkMap.get(story.artworkId);
            const displayGrade = normalizeGrade(story.gradeLabel || story.classGroupId);
            const isOwnStory = Boolean(
              activeUid && story.authorAccountId && story.authorAccountId === activeUid
            );
            const isReversed = idx % 2 === 1;
            const statusMeta = STATUS_BADGE_MAP[story.status] || STATUS_BADGE_MAP.pending;

            const videoUrl =
              story.artworkVideoUrl ||
              linkedArtwork?.videoUrl ||
              (linkedArtwork?.mediaType === 'video' ? linkedArtwork.downloadURL : '') ||
              '';
            const isVideoLinked = Boolean(videoUrl && !videoUrl.startsWith('blob:'));
            const coverImage =
              story.coverImageUrl ||
              story.artworkImageUrl ||
              linkedArtwork?.thumbnailUrl ||
              linkedArtwork?.imageUrl ||
              linkedArtwork?.downloadURL ||
              '';
            const isPlayingThisVideo = playingVideoStoryId === story.id;

            const totalArtworkEmotions = linkedArtwork
              ? (Object.values(linkedArtwork.emotionCounts || {}) as number[]).reduce(
                  (a, b) => a + b,
                  0
                ) +
                (Object.values(linkedArtwork.reactions || {}) as number[]).reduce(
                  (a, b) => a + b,
                  0
                )
              : 0;

            return (
              <article
                key={story.id}
                className="rounded-xl bg-white border border-[#20243A]/15 overflow-hidden shadow-xs hover:border-[#20243A]/35 transition-all"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12">
                  {/* Visual Plate Column (5 cols) — Image or Video Player */}
                  <div
                    className={`lg:col-span-5 bg-[#20243A] p-5 sm:p-7 flex flex-col items-center justify-center relative group min-h-[280px] ${
                      isReversed ? 'lg:order-2 lg:border-l' : 'lg:border-r'
                    } border-[#20243A]/12`}
                  >
                    {isVideoLinked ? (
                      isPlayingThisVideo ? (
                        <video
                          src={videoUrl}
                          poster={coverImage || undefined}
                          controls
                          autoPlay
                          playsInline
                          preload="metadata"
                          className="w-full max-h-[380px] object-contain rounded-lg bg-black"
                        />
                      ) : (
                        <div
                          onClick={() => setPlayingVideoStoryId(story.id)}
                          className="relative w-full h-full min-h-[240px] flex items-center justify-center cursor-pointer overflow-hidden rounded-lg"
                        >
                          {coverImage ? (
                            <img
                              src={coverImage}
                              alt={story.artworkTitle}
                              className="w-full max-h-[360px] object-contain opacity-90 group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="h-60 w-full flex items-center justify-center text-white/80">
                              <Film className="w-10 h-10 text-[#F2D64B]" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center gap-2">
                            <div className="w-14 h-14 rounded-full bg-[#F2D64B] text-[#20243A] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                              <Play className="w-6 h-6 fill-[#20243A] ml-0.5" />
                            </div>
                            <span className="px-3 py-1 rounded-sm bg-[#20243A]/90 text-[#F7F3EA] text-[11px] font-bold uppercase tracking-wider">
                              Xem Video Quá trình Sáng tạo
                            </span>
                          </div>
                        </div>
                      )
                    ) : coverImage ? (
                      <div
                        onClick={() => {
                          if (linkedArtwork) onOpenArtworkDetail(linkedArtwork);
                        }}
                        className={`w-full flex items-center justify-center ${
                          linkedArtwork ? 'cursor-pointer' : ''
                        }`}
                      >
                        <img
                          src={coverImage}
                          alt={story.artworkTitle}
                          className="w-full h-auto max-h-[380px] object-contain rounded-lg"
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          if (linkedArtwork) onOpenArtworkDetail(linkedArtwork);
                        }}
                        className="w-full"
                      >
                        <ArtCanvasVisual
                          type={
                            story.artworkVisualType ||
                            linkedArtwork?.visualType ||
                            'watercolor'
                          }
                          title={story.artworkTitle}
                          className="w-full h-64 rounded-lg"
                        />
                      </div>
                    )}

                    {linkedArtwork && (
                      <div className="w-full pt-3 mt-3 border-t border-white/15 flex items-center justify-between text-xs text-[#F7F3EA]">
                        <span className="truncate font-semibold">{linkedArtwork.title}</span>
                        <button
                          type="button"
                          onClick={() => onOpenArtworkDetail(linkedArtwork)}
                          className="text-[#F2D64B] hover:underline font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Chi tiết & Thả cảm xúc</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Editorial Essay Column (7 cols) */}
                  <div
                    className={`lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between space-y-6 ${
                      isReversed ? 'lg:order-1' : ''
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Magazine Issue & Grade Metadata */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-[#20243A]/60">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-code text-[#3457D5]">
                            STORY 0{idx + 1}
                          </span>
                          <span>·</span>
                          <span className="px-2.5 py-0.5 rounded-sm bg-[#20243A] text-[#F7F3EA]">
                            {displayGrade}
                          </span>
                          {(story.lessonTitle || story.topic) && (
                            <span className="px-2.5 py-0.5 rounded-sm bg-[#F7F3EA] text-[#20243A] border border-[#20243A]/15">
                              {story.lessonTitle || story.topic}
                            </span>
                          )}
                          {(story.status !== 'approved' || viewMode !== 'public') && (
                            <span className={`px-2.5 py-0.5 rounded-sm ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 text-[#20243A]/60">
                          <Calendar className="w-3.5 h-3.5 text-[#3457D5]" />
                          {formatViDate(story.publishedAt || story.createdAt)}
                        </span>
                      </div>

                      {/* Large Editorial Headline */}
                      <div>
                        <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-[#20243A] leading-tight">
                          “{story.storyTitle}”
                        </h2>
                        <p className="text-xs text-[#20243A]/65 mt-1.5">
                          Tác giả tự sự:{' '}
                          <strong className="text-[#20243A]">{story.authorNickname}</strong>{' '}
                          ({displayGrade})
                          {linkedArtwork && (
                            <>
                              {' '}
                              · Tác phẩm:{' '}
                              <button
                                type="button"
                                onClick={() => onOpenArtworkDetail(linkedArtwork)}
                                className="text-[#3457D5] hover:underline font-bold cursor-pointer"
                              >
                                {story.artworkTitle}
                              </button>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Main Story Body */}
                      <p className="text-sm sm:text-base text-[#20243A]/90 leading-relaxed whitespace-pre-line">
                        {story.storyContent}
                      </p>

                      {/* Guided Inspiration & Feeling Blocks if provided */}
                      {(story.inspirationText || story.feelingText) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {story.inspirationText && (
                            <div className="p-3.5 rounded-lg bg-[#F7F3EA] border border-[#20243A]/12 space-y-1">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#3457D5] block">
                                Nguồn cảm hứng sáng tạo
                              </span>
                              <p className="text-xs text-[#20243A]/85 leading-relaxed">
                                {story.inspirationText}
                              </p>
                            </div>
                          )}
                          {story.feelingText && (
                            <div className="p-3.5 rounded-lg bg-[#F7F3EA] border border-[#20243A]/12 space-y-1">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#269C91] block">
                                Cảm xúc khi thực hiện
                              </span>
                              <p className="text-xs text-[#20243A]/85 leading-relaxed">
                                {story.feelingText}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pull Quote (Viewer Message) */}
                      {story.viewerMessage && (
                        <blockquote className="p-4 rounded-lg bg-[#F7F3EA] border-l-4 border-[#F15B3D] space-y-1.5">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#F15B3D] flex items-center gap-1.5">
                            <Quote className="w-3.5 h-3.5" />
                            <span>THÔNG ĐIỆP GỬI NGƯỜI THƯỞNG LÃM</span>
                          </div>
                          <p className="font-editorial text-base sm:text-lg italic text-[#20243A]">
                            “{story.viewerMessage}”
                          </p>
                        </blockquote>
                      )}

                      {/* Teacher Curatorial Note */}
                      {story.teacherNote && (
                        <div className="p-4 rounded-lg bg-[#269C91]/10 border border-[#269C91]/30 text-xs text-[#20243A] flex items-start gap-2.5">
                          <Award className="w-4 h-4 text-[#269C91] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-extrabold text-[#269C91] uppercase tracking-wider block text-[10px]">
                              Lời nhận xét & khích lệ từ Giáo viên Mĩ thuật
                            </span>
                            <span className="mt-0.5 block leading-relaxed">{story.teacherNote}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Spread Footer Actions */}
                    <div className="pt-4 border-t border-[#20243A]/12 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {linkedArtwork && (
                          <button
                            type="button"
                            onClick={() => onOpenArtworkDetail(linkedArtwork)}
                            className="px-4 py-2 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Heart className="w-3.5 h-3.5 text-[#F15B3D] fill-[#F15B3D]" />
                            <span>
                              Ngắm tác phẩm & Thả cảm xúc
                              {totalArtworkEmotions > 0 ? ` (${totalArtworkEmotions})` : ''}
                            </span>
                          </button>
                        )}

                        {isOwnStory && (
                          <button
                            type="button"
                            onClick={() => onOpenWriteStoryModal(linkedArtwork || null, story)}
                            className="px-3.5 py-2 rounded-lg bg-[#F7F3EA] hover:bg-[#F2D64B] text-[#20243A] border border-[#20243A]/20 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>
                              {story.status === 'revision_required'
                                ? 'Chỉnh sửa theo góp ý GV'
                                : 'Chỉnh sửa câu chuyện'}
                            </span>
                          </button>
                        )}
                      </div>

                      {onReportStory && (
                        <button
                          type="button"
                          onClick={() => onReportStory(story)}
                          className="px-2.5 py-1.5 rounded-lg text-[#20243A]/60 hover:text-[#F15B3D] transition-colors text-xs flex items-center gap-1 cursor-pointer"
                          title="Báo cáo nội dung câu chuyện chưa phù hợp"
                        >
                          <Flag className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-semibold">Báo cáo</span>
                        </button>
                      )}
                    </div>

                    {/* Teacher / Admin Class Moderation Bar */}
                    {(isTeacher || isAdmin) && onModerateStory && (
                      <div className="pt-4 border-t border-[#20243A]/12 space-y-2.5 bg-[#F7F3EA]/70 -mx-6 -mb-6 sm:-mx-8 sm:-mb-8 lg:-mx-10 lg:-mb-10 p-4 sm:p-6">
                        <div className="flex items-center justify-between text-[11px] font-extrabold text-[#20243A]">
                          <span>Bàn Biên tập Giáo viên phụ trách ({displayGrade})</span>
                          <span className="text-[#3457D5]">
                            Trạng thái hiện tại: {statusMeta.label}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={teacherNoteInputs[story.id] ?? (story.teacherNote || '')}
                            onChange={(e) =>
                              setTeacherNoteInputs((prev) => ({
                                ...prev,
                                [story.id]: e.target.value,
                              }))
                            }
                            placeholder="Nhập lời khích lệ hoặc hướng dẫn học sinh chỉnh sửa..."
                            className="flex-1 px-3.5 py-2 rounded-lg bg-white border border-[#20243A]/20 text-xs text-[#20243A] font-medium"
                          />
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {story.status !== 'approved' && (
                              <button
                                type="button"
                                disabled={moderatingId === story.id}
                                onClick={async () => {
                                  setModeratingId(story.id);
                                  try {
                                    await onModerateStory(
                                      story.id,
                                      'approved',
                                      teacherNoteInputs[story.id] ?? story.teacherNote
                                    );
                                  } finally {
                                    setModeratingId(null);
                                  }
                                }}
                                className="px-3 py-2 rounded-lg bg-[#269C91] hover:bg-[#1f8278] text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Duyệt xuất bản</span>
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={moderatingId === story.id}
                              onClick={async () => {
                                setModeratingId(story.id);
                                try {
                                  await onModerateStory(
                                    story.id,
                                    'revision_required',
                                    teacherNoteInputs[story.id] ||
                                      story.teacherNote ||
                                      'Em hãy bổ sung thêm vài dòng kể về cảm xúc hoặc ý nghĩa bức tranh nhé!'
                                  );
                                } finally {
                                  setModeratingId(null);
                                }
                              }}
                              className="px-3 py-2 rounded-lg bg-[#F2D64B] hover:bg-[#e5c83b] text-[#20243A] font-bold text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Yêu cầu chỉnh sửa</span>
                            </button>

                            {story.status !== 'rejected' && (
                              <button
                                type="button"
                                disabled={moderatingId === story.id}
                                onClick={async () => {
                                  setModeratingId(story.id);
                                  try {
                                    await onModerateStory(
                                      story.id,
                                      'rejected',
                                      teacherNoteInputs[story.id] ?? story.teacherNote
                                    );
                                  } finally {
                                    setModeratingId(null);
                                  }
                                }}
                                className="px-3 py-2 rounded-lg bg-[#F15B3D]/15 hover:bg-[#F15B3D] text-[#F15B3D] hover:text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Từ chối</span>
                              </button>
                            )}

                            {story.status !== 'hidden' && (
                              <button
                                type="button"
                                disabled={moderatingId === story.id}
                                onClick={async () => {
                                  setModeratingId(story.id);
                                  try {
                                    await onModerateStory(
                                      story.id,
                                      'hidden',
                                      teacherNoteInputs[story.id] ?? story.teacherNote
                                    );
                                  } finally {
                                    setModeratingId(null);
                                  }
                                }}
                                className="px-3 py-2 rounded-lg bg-white hover:bg-[#20243A] text-[#20243A] hover:text-white border border-[#20243A]/20 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Tạm ẩn</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {filteredStories.length > visibleLimit && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + 8)}
                className="px-6 py-2.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Tải thêm câu chuyện ({filteredStories.length - visibleLimit} câu chuyện còn lại)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

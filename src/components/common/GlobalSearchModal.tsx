/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ART VERSE AI — THANH TÌM KIẾM TOÀN CỤC (GlobalSearchModal)
 *
 * Placeholder chuẩn: "Tìm kiếm tác phẩm, tác giả, video, câu chuyện..."
 * Hiển thị kết quả theo 5 nhóm:
 * 1. Tác phẩm
 * 2. Tác giả (Chỉ hiển thị Bí danh công khai — tuyệt đối không lộ tên thật hay mã HS)
 * 3. ARTVERSE SHORTS
 * 4. Câu chuyện sau nét vẽ
 * 5. Tài nguyên Mĩ thuật GDPT
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ScreenTab } from '../../types/artverse';
import {
  CommunityArtwork,
  ArtworkStory,
  ArtLesson,
  UserRole,
} from '../../types/communityArt';
import {
  normalizeVietnameseSearch,
  computeSearchRelevance,
  GlobalSearchGroupItem,
} from '../../utils/searchEngine';
import { getArtworkNormalizedGrade, normalizeGrade } from '../../utils/gradeUtils';
import { queryFirestoreIndexedArtworks } from '../../services/communityFirestoreService';
import { getApiUrl } from '../../lib/platform';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  X,
  Image as ImageIcon,
  User,
  Film,
  BookOpen,
  GraduationCap,
  Loader2,
  AlertCircle,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  artworks: CommunityArtwork[];
  stories: ArtworkStory[];
  lessons: ArtLesson[];
  currentRole: UserRole;
  onSelectArtwork: (artwork: CommunityArtwork) => void;
  onNavigateTab: (tab: ScreenTab) => void;
}

type SearchGroupFilter = 'all' | 'artwork' | 'author' | 'short' | 'story' | 'gdpt';

const DEFAULT_KEYWORD_SUGGESTIONS = [
  'Phong cảnh quê hương',
  'Màu nước',
  'Lớp 6',
  'Tiểu học',
  'THCS',
  'Sơn dầu',
  'Ký họa',
  'Slide bài giảng',
];

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  artworks,
  stories,
  lessons,
  currentRole,
  onSelectArtwork,
  onNavigateTab,
}) => {
  const { user, profile, getValidBearerToken } = useAuth();
  const activeUid = profile?.uid || user?.uid || '';
  const isStaff =
    currentRole === 'admin' || currentRole === 'teacher' || currentRole === 'moderator';

  const [queryText, setQueryText] = useState(initialQuery);
  const [selectedGroup, setSelectedGroup] = useState<SearchGroupFilter>('all');
  const [visibleLimitPerGroup, setVisibleLimitPerGroup] = useState<number>(6);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [serverItems, setServerItems] = useState<GlobalSearchGroupItem[]>([]);
  const [indexedFirestoreArtworks, setIndexedFirestoreArtworks] = useState<CommunityArtwork[]>([]);

  useEffect(() => {
    if (isOpen && initialQuery) {
      setQueryText(initialQuery);
    }
  }, [isOpen, initialQuery]);

  // Reset pagination when query or group changes
  useEffect(() => {
    setVisibleLimitPerGroup(selectedGroup === 'all' ? 5 : 12);
  }, [queryText, selectedGroup]);

  // Query backend `/api/search/global` + bounded Firestore index (`queryFirestoreIndexedArtworks`)
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = queryText.trim();
    if (!trimmed) {
      setServerItems([]);
      setIndexedFirestoreArtworks([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const token = await getValidBearerToken();
        const [apiRes, fsIndexed] = await Promise.all([
          fetch(
            getApiUrl(
              `/api/search/global?q=${encodeURIComponent(trimmed)}&limit=30&offset=0`
            ),
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }
          ).catch(() => null),
          queryFirestoreIndexedArtworks(trimmed, 20).catch(() => []),
        ]);

        if (cancelled) return;

        if (fsIndexed.length > 0) {
          setIndexedFirestoreArtworks(fsIndexed);
        } else {
          setIndexedFirestoreArtworks([]);
        }

        if (apiRes && apiRes.ok) {
          const data = await apiRes.json();
          const combinedServer: GlobalSearchGroupItem[] = [
            ...(data?.groups?.artworks || []),
            ...(data?.groups?.authors || []),
            ...(data?.groups?.shorts || []),
            ...(data?.groups?.stories || []),
            ...(data?.groups?.gdptResources || []),
          ];
          setServerItems(combinedServer);
        }
      } catch (err: any) {
        if (!cancelled) {
          setSearchError(err?.message || 'Lỗi kết nối truy vấn tìm kiếm.');
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, queryText, getValidBearerToken]);

  // Combine synchronized client state + Firestore indexed results + server results
  const groupedResults = useMemo(() => {
    const trimmed = queryText.trim();
    const normQuery = normalizeVietnameseSearch(trimmed);
    if (!normQuery) {
      return {
        artworks: [] as GlobalSearchGroupItem[],
        authors: [] as GlobalSearchGroupItem[],
        shorts: [] as GlobalSearchGroupItem[],
        stories: [] as GlobalSearchGroupItem[],
        gdptResources: [] as GlobalSearchGroupItem[],
        totalCount: 0,
        dynamicSuggestions: DEFAULT_KEYWORD_SUGGESTIONS,
      };
    }

    const artworkPoolMap = new Map<string, CommunityArtwork>();
    for (const a of artworks) {
      if (a && a.id) artworkPoolMap.set(a.id, a);
    }
    for (const a of indexedFirestoreArtworks) {
      if (a && a.id) artworkPoolMap.set(a.id, a);
    }

    const artworksGroup: GlobalSearchGroupItem[] = [];
    const shortsGroup: GlobalSearchGroupItem[] = [];
    const authorsMap = new Map<string, GlobalSearchGroupItem>();

    for (const art of artworkPoolMap.values()) {
      if (art.status === 'removed') continue;
      const isPublicApproved = art.status === 'approved' && art.shareStatus === 'shared';
      if (!isPublicApproved && !isStaff && art.authorAccountId !== activeUid) continue;

      // Public alias only — strictly never real name or studentCode
      const publicAlias =
        art.authorNickname || art.authorAlias || art.creatorAnonymousPseudonym || 'Nghệ sĩ Trẻ';
      const gradeLabel = getArtworkNormalizedGrade(art);
      const isVideo =
        art.mediaType === 'video' ||
        Boolean(art.videoUrl) ||
        Boolean(art.mimeType && art.mimeType.startsWith('video/'));

      const score = computeSearchRelevance(
        trimmed,
        [art.title, publicAlias, gradeLabel],
        [art.description, art.materialsUsed, art.lessonTitle, art.topic]
      );

      if (score > 0) {
        if (isVideo) {
          shortsGroup.push({
            id: art.id,
            group: 'short',
            title: art.title,
            subtitle: `${publicAlias} · ${gradeLabel}`,
            badge: 'ARTVERSE SHORTS',
            thumbnailUrl: art.thumbnailUrl || art.imageUrl || art.downloadURL,
            mediaType: 'video',
            gradeLabel,
            createdAt: art.createdAt,
            score,
          });
        } else {
          artworksGroup.push({
            id: art.id,
            group: 'artwork',
            title: art.title,
            subtitle: `${publicAlias} · ${gradeLabel}`,
            badge: gradeLabel,
            thumbnailUrl: art.thumbnailUrl || art.imageUrl || art.downloadURL,
            mediaType: 'image',
            gradeLabel,
            createdAt: art.createdAt,
            score,
          });
        }
      }

      const aliasScore = computeSearchRelevance(
        trimmed,
        [publicAlias],
        [gradeLabel, art.title]
      );
      if (aliasScore > 0) {
        const key = normalizeVietnameseSearch(publicAlias);
        const existing = authorsMap.get(key);
        if (!existing || aliasScore > existing.score) {
          authorsMap.set(key, {
            id: `author_${key.replace(/\s+/g, '_')}`,
            group: 'author',
            title: publicAlias,
            subtitle: `Bí danh Nghệ sĩ · ${gradeLabel}`,
            badge: gradeLabel,
            mediaType: 'author',
            gradeLabel,
            score: aliasScore,
          });
        }
      }
    }

    // Merge server author results (public aliases only)
    for (const srvItem of serverItems) {
      if (srvItem.group === 'author') {
        const key = normalizeVietnameseSearch(srvItem.title);
        if (!authorsMap.has(key)) {
          authorsMap.set(key, srvItem);
        }
      }
    }

    // Stories (Published only for public/students; staff or own story allowed per RBAC)
    const storiesGroup: GlobalSearchGroupItem[] = [];
    for (const st of stories) {
      if (!st || !st.id) continue;
      const canSee =
        st.status === 'approved' ||
        isStaff ||
        (activeUid && (st.authorAccountId === activeUid || st.ownerKey === activeUid));
      if (!canSee) continue;

      const gradeLabel = normalizeGrade(st.gradeLabel || st.classGroupId);
      const score = computeSearchRelevance(
        trimmed,
        [st.storyTitle, st.authorNickname, st.artworkTitle],
        [st.storyContent, st.inspirationText, st.feelingText, st.viewerMessage, gradeLabel]
      );
      if (score > 0) {
        storiesGroup.push({
          id: st.id,
          group: 'story',
          title: st.storyTitle,
          subtitle: `${st.authorNickname} · ${gradeLabel}`,
          badge: st.status === 'approved' ? 'PUBLISHED' : st.status.toUpperCase(),
          thumbnailUrl: st.coverImageUrl || st.artworkImageUrl,
          mediaType: 'story',
          gradeLabel,
          createdAt: st.publishedAt || st.createdAt,
          score,
        });
      }
    }

    // MĨ THUẬT GDPT Resources (TIỂU HỌC & THCS — SLIDE BÀI GIẢNG & VIDEO BÀI GIẢNG)
    const gdptGroup: GlobalSearchGroupItem[] = [];
    for (const les of lessons) {
      if (!les || !les.id || les.status === 'deleted' || les.isHidden) continue;
      const gradeLabel = normalizeGrade(les.grade || les.className || les.classGroupId);
      const isTieuHoc =
        les.educationLevel === 'TIEU_HOC' ||
        ['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5'].includes(gradeLabel);
      const isVideoLesson =
        les.resourceCategory === 'video' || (Boolean(les.videoUrl) && !les.slideUrl);
      const teacherName = les.teacherName || 'Tổ Mĩ thuật GDPT';
      const fileFormat = les.fileFormat || (isVideoLesson ? 'MP4' : 'SLIDE / PDF');

      const score = computeSearchRelevance(
        trimmed,
        [les.title, gradeLabel, teacherName, fileFormat],
        [
          les.description,
          les.topic,
          isTieuHoc ? 'Tiểu học TIEU_HOC' : 'THCS Trung học cơ sở',
          isVideoLesson ? 'Video bài giảng' : 'Slide bài giảng',
        ]
      );

      if (score > 0) {
        gdptGroup.push({
          id: les.id,
          group: 'gdpt',
          title: les.title,
          subtitle: `${isTieuHoc ? 'TIỂU HỌC' : 'THCS'} (${gradeLabel}) · ${isVideoLesson ? 'VIDEO BÀI GIẢNG' : 'SLIDE BÀI GIẢNG'} · ${teacherName}`,
          badge: `${fileFormat} · ${gradeLabel}`,
          mediaType: isVideoLesson ? 'video' : 'slide',
          gradeLabel,
          educationLevel: isTieuHoc ? 'TIEU_HOC' : 'THCS',
          resourceCategory: isVideoLesson ? 'video' : 'slide',
          createdAt: les.updatedAt || les.createdAt,
          score,
        });
      }
    }

    artworksGroup.sort((a, b) => b.score - a.score);
    const authorsGroup = Array.from(authorsMap.values()).sort((a, b) => b.score - a.score);
    shortsGroup.sort((a, b) => b.score - a.score);
    storiesGroup.sort((a, b) => b.score - a.score);
    gdptGroup.sort((a, b) => b.score - a.score);

    const totalCount =
      artworksGroup.length +
      authorsGroup.length +
      shortsGroup.length +
      storiesGroup.length +
      gdptGroup.length;

    const dynamicSuggestions = Array.from(
      new Set([
        ...artworksGroup.slice(0, 2).map((i) => i.title),
        ...authorsGroup.slice(0, 2).map((i) => i.title),
        ...gdptGroup.slice(0, 2).map((i) => i.title),
        ...DEFAULT_KEYWORD_SUGGESTIONS,
      ])
    ).slice(0, 6);

    return {
      artworks: artworksGroup,
      authors: authorsGroup,
      shorts: shortsGroup,
      stories: storiesGroup,
      gdptResources: gdptGroup,
      totalCount,
      dynamicSuggestions,
    };
  }, [
    queryText,
    artworks,
    indexedFirestoreArtworks,
    serverItems,
    stories,
    lessons,
    isStaff,
    activeUid,
  ]);

  if (!isOpen) return null;

  const handleSelectItem = (item: GlobalSearchGroupItem) => {
    if (item.group === 'artwork' || item.group === 'short') {
      const found =
        artworks.find((a) => a.id === item.id) ||
        indexedFirestoreArtworks.find((a) => a.id === item.id);
      if (found) {
        if (item.group === 'short') {
          onNavigateTab('artverse-shorts');
        } else {
          onSelectArtwork(found);
        }
        onClose();
        return;
      }
    }
    if (item.group === 'author') {
      onNavigateTab('community-library');
      onClose();
      return;
    }
    if (item.group === 'short') {
      onNavigateTab('artverse-shorts');
      onClose();
      return;
    }
    if (item.group === 'story') {
      onNavigateTab('art-stories');
      onClose();
      return;
    }
    if (item.group === 'gdpt') {
      onNavigateTab('class-lessons');
      onClose();
    }
  };

  const renderGroupSection = (
    groupKey: Exclude<SearchGroupFilter, 'all'>,
    title: string,
    icon: React.ReactNode,
    items: GlobalSearchGroupItem[],
    targetTab: ScreenTab
  ) => {
    if (selectedGroup !== 'all' && selectedGroup !== groupKey) return null;
    if (items.length === 0) return null;

    const visibleItems = items.slice(0, visibleLimitPerGroup);
    const hasMoreInGroup = items.length > visibleLimitPerGroup;

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between border-b border-[#20243A]/10 pb-1.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#20243A]">
            <span className="text-[#3457D5]">{icon}</span>
            <span>
              {title} ({items.length})
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onNavigateTab(targetTab);
              onClose();
            }}
            className="text-[11px] font-bold text-[#3457D5] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Mở phân hệ</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {visibleItems.map((item) => (
            <button
              key={`${item.group}_${item.id}`}
              type="button"
              onClick={() => handleSelectItem(item)}
              className="p-3 rounded-lg bg-[#F7F3EA]/70 hover:bg-[#3457D5]/8 border border-[#20243A]/12 hover:border-[#3457D5] text-left flex items-center justify-between gap-3 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="w-11 h-11 rounded-md object-cover bg-[#20243A] shrink-0 border border-[#20243A]/15"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-md bg-[#20243A] text-[#F7F3EA] flex items-center justify-center shrink-0">
                    {icon}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-[#20243A] group-hover:text-[#3457D5] truncate">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-[#20243A]/65 truncate">{item.subtitle}</p>
                </div>
              </div>
              {item.badge && (
                <span className="px-2 py-0.5 rounded-sm bg-[#20243A] text-[#F7F3EA] text-[9px] font-mono-code font-bold uppercase shrink-0">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {hasMoreInGroup && (
          <div className="pt-1 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleLimitPerGroup((prev) => prev + 10)}
              className="px-4 py-1.5 rounded-md bg-white hover:bg-[#20243A] text-[#20243A] hover:text-[#F7F3EA] border border-[#20243A]/20 text-xs font-bold transition-colors cursor-pointer"
            >
              Tải thêm kết quả ({items.length - visibleLimitPerGroup} còn lại)
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#20243A]/75 backdrop-blur-xs flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Tìm kiếm toàn hệ thống ART VERSE AI"
    >
      <div className="bg-white w-full max-w-4xl rounded-xl border border-[#20243A] shadow-2xl overflow-hidden my-2 sm:my-6 flex flex-col max-h-[88vh]">
        {/* Top Search Input Header */}
        <div className="p-4 sm:p-5 bg-[#F7F3EA] border-b border-[#20243A]/15 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#3457D5]">
              <span className="w-2 h-2 bg-[#F15B3D] inline-block" />
              <span>ART VERSE AI · TÌM KIẾM ĐỒNG BỘ TOÀN HỆ THỐNG</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng tìm kiếm"
              className="p-1.5 rounded-md bg-white hover:bg-[#20243A] text-[#20243A] hover:text-white border border-[#20243A]/15 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#3457D5] absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Tìm kiếm tác phẩm, tác giả, video, câu chuyện..."
              className="w-full pl-10 pr-24 py-3 rounded-lg bg-white border-2 border-[#20243A] text-xs sm:text-sm font-semibold text-[#20243A] placeholder:text-[#20243A]/45 focus:outline-none focus:border-[#3457D5]"
            />
            {queryText && (
              <button
                type="button"
                onClick={() => setQueryText('')}
                className="absolute right-2.5 px-2.5 py-1 rounded-md bg-[#F7F3EA] hover:bg-[#F15B3D] text-[#20243A] hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
              >
                Xóa nhanh
              </button>
            )}
          </div>

          {/* Group Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {(
              [
                { id: 'all', label: `Tất cả (${groupedResults.totalCount})` },
                { id: 'artwork', label: `Tác phẩm (${groupedResults.artworks.length})` },
                { id: 'author', label: `Tác giả (${groupedResults.authors.length})` },
                { id: 'short', label: `ARTVERSE SHORTS (${groupedResults.shorts.length})` },
                {
                  id: 'story',
                  label: `Câu chuyện sau nét vẽ (${groupedResults.stories.length})`,
                },
                {
                  id: 'gdpt',
                  label: `Tài nguyên Mĩ thuật GDPT (${groupedResults.gdptResources.length})`,
                },
              ] as Array<{ id: SearchGroupFilter; label: string }>
            ).map((tab) => {
              const active = selectedGroup === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedGroup(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#20243A] text-[#F7F3EA]'
                      : 'bg-white text-[#20243A]/75 border border-[#20243A]/15 hover:text-[#20243A]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Results Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Keyword Suggestions when input is empty or short */}
          {!queryText.trim() && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#20243A]/70">
                <Sparkles className="w-3.5 h-3.5 text-[#3457D5]" />
                <span>Gợi ý từ khóa tìm kiếm nhanh (hỗ trợ tiếng Việt có dấu &amp; không dấu):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_KEYWORD_SUGGESTIONS.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => setQueryText(kw)}
                    className="px-3 py-1.5 rounded-md bg-[#F7F3EA] hover:bg-[#3457D5] text-[#20243A] hover:text-white border border-[#20243A]/15 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Searching Status */}
          {isSearching && (
            <div className="flex items-center gap-2 text-xs font-bold text-[#3457D5]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang tìm kiếm dữ liệu đồng bộ...</span>
            </div>
          )}

          {/* Error State */}
          {searchError && (
            <div className="p-3.5 rounded-lg bg-[#F15B3D]/10 border border-[#F15B3D] text-xs text-[#F15B3D] font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Empty Result State */}
          {queryText.trim() && !isSearching && groupedResults.totalCount === 0 && (
            <div className="p-8 rounded-lg bg-[#F7F3EA]/60 border border-[#20243A]/15 text-center space-y-2.5">
              <p className="text-sm font-bold text-[#20243A]">
                Không tìm thấy kết quả phù hợp với từ khóa “{queryText.trim()}”
              </p>
              <p className="text-xs text-[#20243A]/65 max-w-md mx-auto">
                Hệ thống hỗ trợ cả tiếng Việt có dấu và không dấu. Bạn có thể thử một trong các từ khóa gợi ý dưới đây:
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                {groupedResults.dynamicSuggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setQueryText(sug)}
                    className="px-2.5 py-1 rounded-md bg-white border border-[#20243A]/20 text-xs font-bold text-[#3457D5] cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grouped Results */}
          {queryText.trim() && groupedResults.totalCount > 0 && (
            <div className="space-y-6">
              {renderGroupSection(
                'artwork',
                'Tác phẩm',
                <ImageIcon className="w-4 h-4" />,
                groupedResults.artworks,
                'community-library'
              )}

              {renderGroupSection(
                'author',
                'Tác giả (Bí danh Nghệ sĩ)',
                <User className="w-4 h-4" />,
                groupedResults.authors,
                'community-library'
              )}

              {renderGroupSection(
                'short',
                'ARTVERSE SHORTS',
                <Film className="w-4 h-4" />,
                groupedResults.shorts,
                'artverse-shorts'
              )}

              {renderGroupSection(
                'story',
                'Câu chuyện sau nét vẽ',
                <BookOpen className="w-4 h-4" />,
                groupedResults.stories,
                'art-stories'
              )}

              {renderGroupSection(
                'gdpt',
                'Tài nguyên Mĩ thuật GDPT',
                <GraduationCap className="w-4 h-4" />,
                groupedResults.gdptResources,
                'class-lessons'
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

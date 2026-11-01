/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Digital Gallery (Mobile-First 2-Column Masonry for iPhone)
 * - Hiển thị Masonry hai cột trên iPhone (columns-2)
 * - Ảnh giữ đúng tỷ lệ tự nhiên, không bị kéo méo (w-full h-auto block)
 * - Bộ lọc dạng thanh cuộn ngang (overflow-x-auto no-scrollbar)
 * - Lazy loading & decoding async tối ưu cho Safari iOS
 * - Chỉ hiển thị Tác phẩm, Tác giả và Lớp
 */

import React, { useState, useMemo } from 'react';
import {
  CommunityArtwork,
  ClassGroup,
  ArtLesson,
  UserRole,
  PositiveReactionKey,
  POSITIVE_REACTIONS_META
} from '../../types/communityArt';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import {
  Search,
  Share2,
  Lock,
  Layers,
  Palette,
  EyeOff,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  Camera,
  Zap,
  Flag,
  Edit3,
  PlaySquare,
  RotateCcw,
  QrCode,
  Award,
  BookOpen,
  X
} from 'lucide-react';

interface CommunityLibraryViewProps {
  artworks: CommunityArtwork[];
  classes: ClassGroup[];
  lessons: ArtLesson[];
  currentRole: UserRole;
  currentAuthorKey: string;
  selectedClassFilter: string;
  onChangeClassFilter: (clsId: string) => void;
  selectedLessonFilter: string;
  onChangeLessonFilter: (lesId: string) => void;
  onSelectArtwork: (artwork: CommunityArtwork) => void;
  onOpenInstantCaptureModal?: () => void;
  onOpenProjectorModal?: (startIndex: number) => void;
  onOpenArtbookExportModal?: () => void;
  onOpenLabelAndCertificate?: (artwork: CommunityArtwork, tab: 'qr-label' | 'certificate') => void;
  onEditArtwork?: (artwork: CommunityArtwork) => void;
  onUnhideArtwork?: (artworkId: string) => void;
  onReaction: (artworkId: string, reactionKey: PositiveReactionKey) => void;
  onDeleteArtwork?: (artworkId: string) => void;
  onToggleShareStatus?: (artworkId: string) => void;
  onHideArtwork?: (artworkId: string) => void;
  onOpenReportModal?: (targetType: 'artwork' | 'comment', targetId: string, targetTitle: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

const STANDARD_FILTER_CLASSES: Array<{ id: string; name: string }> = [
  { id: 'cls-6', name: 'Khối 6' },
  { id: 'cls-7', name: 'Khối 7' },
  { id: 'cls-8', name: 'Khối 8' },
  { id: 'cls-9', name: 'Khối 9' },
];

export const CommunityLibraryView: React.FC<CommunityLibraryViewProps> = ({
  artworks,
  classes,
  currentRole,
  currentAuthorKey,
  selectedClassFilter,
  onChangeClassFilter,
  onChangeLessonFilter,
  onSelectArtwork,
  onOpenInstantCaptureModal,
  onOpenProjectorModal,
  onOpenArtbookExportModal,
  onOpenLabelAndCertificate,
  onEditArtwork,
  onUnhideArtwork,
  onReaction,
  onDeleteArtwork,
  onHideArtwork,
  onOpenReportModal,
  onShowToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Rate limiting for anonymous report clicks
  const [lastReportTime, setLastReportTime] = useState<number>(0);

  // Unified class options (always include Khối 6, 7, 8, 9 + any custom classes)
  const filterClasses = useMemo(() => {
    const map = new Map<string, { id: string; name: string; isPublicGalleryEnabled?: boolean }>();
    for (const std of STANDARD_FILTER_CLASSES) {
      map.set(std.id, { ...std, isPublicGalleryEnabled: true });
    }
    for (const c of classes) {
      if (c.id && c.name && !c.isHidden) {
        map.set(c.id, { id: c.id, name: c.name, isPublicGalleryEnabled: c.isPublicGalleryEnabled });
      }
    }
    return Array.from(map.values());
  }, [classes]);

  const currentClassObj = useMemo(() => {
    if (!selectedClassFilter || selectedClassFilter === 'all') return null;
    return classes.find((c) => c.id === selectedClassFilter);
  }, [classes, selectedClassFilter]);

  // Filter artworks strictly enforcing role-based visibility
  const filteredArtworks = useMemo(() => {
    return artworks.filter((item) => {
      if (currentRole === 'viewer') {
        if (item.status !== 'approved' || item.shareStatus !== 'shared') {
          return false;
        }
      } else if (currentRole === 'contributor') {
        if (item.ownerKey !== currentAuthorKey && (item.status !== 'approved' || item.shareStatus !== 'shared')) {
          return false;
        }
      }

      if (selectedClassFilter && selectedClassFilter !== 'all') {
        if (item.classGroupId !== selectedClassFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesAuthor = item.creatorAnonymousPseudonym.toLowerCase().includes(q);
        const matchesClass = item.className.toLowerCase().includes(q);
        if (!matchesTitle && !matchesAuthor && !matchesClass) {
          return false;
        }
      }

      return true;
    });
  }, [artworks, currentRole, currentAuthorKey, selectedClassFilter, searchQuery]);

  const handleCopyShareLink = (e: React.MouseEvent, artwork: CommunityArtwork) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/#gallery?token=${artwork.shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedToken(artwork.id);
    onShowToast('success', 'Đã sao chép liên kết chia sẻ', `Mã chia sẻ an toàn đã lưu vào khay nhớ tạm.`);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleQuickReaction = (e: React.MouseEvent, artworkId: string, reactionKey: PositiveReactionKey) => {
    e.stopPropagation();
    onReaction(artworkId, reactionKey);
  };

  const handleReportClick = (e: React.MouseEvent, artwork: CommunityArtwork) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastReportTime < 30000) {
      onShowToast('info', 'Thao tác chậm lại', 'Vui lòng chờ 30 giây trước khi gửi báo cáo tiếp theo.');
      return;
    }
    setLastReportTime(now);
    if (onOpenReportModal) {
      onOpenReportModal('artwork', artwork.id, artwork.title);
    }
  };

  const handleQuickHide = (e: React.MouseEvent, artwork: CommunityArtwork) => {
    e.stopPropagation();
    if (onHideArtwork) {
      onHideArtwork(artwork.id);
    }
  };

  const handleQuickUnhide = (e: React.MouseEvent, artwork: CommunityArtwork) => {
    e.stopPropagation();
    if (onUnhideArtwork) {
      onUnhideArtwork(artwork.id);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      {/* =================================================================
          1. CONTEMPORARY ART GALLERY MASTHEAD
         ================================================================= */}
      <div className="border-b border-stone-300/80 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1D4ED8]">
            DIGITAL GALLERY · TRIỂN LÃM SỐ HỌC ĐƯỜNG
          </span>
          <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-[#121316] mt-1">
            Không gian Triển lãm ({filteredArtworks.length})
          </h1>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenInstantCaptureModal && (
            <button
              type="button"
              onClick={onOpenInstantCaptureModal}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs shadow-sm transition-transform active:scale-98 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#FBBF24]" />
              <span>Đăng tác phẩm</span>
            </button>
          )}

          {filteredArtworks.length > 0 && onOpenProjectorModal && (
            <button
              type="button"
              onClick={() => onOpenProjectorModal(0)}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#121316] hover:bg-stone-800 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              <PlaySquare className="w-4 h-4 text-[#FBBF24]" />
              <span>Trình chiếu ({filteredArtworks.length})</span>
            </button>
          )}

          {filteredArtworks.length > 0 && onOpenArtbookExportModal && (
            <button
              type="button"
              onClick={onOpenArtbookExportModal}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-stone-100 text-[#121316] font-bold text-xs border border-stone-300 transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#D97706]" />
              <span className="hidden sm:inline">Kỷ yếu / Poster</span>
            </button>
          )}
        </div>
      </div>

      {/* Class Exhibition Status Alert */}
      {currentClassObj && !currentClassObj.isPublicGalleryEnabled && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Không gian <strong>{currentClassObj.name}</strong> hiện đang được khóa chế độ triển lãm công khai.
            </span>
          </div>
          <span className="text-[11px] font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
            Nội bộ
          </span>
        </div>
      )}

      {/* =================================================================
          2. SEARCH & HORIZONTAL SCROLLABLE FILTER BAR (OPTIMIZED FOR IPHONE)
         ================================================================= */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Tìm theo tên tác phẩm, tác giả hoặc lớp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[46px] pl-10 pr-10 py-2.5 bg-white border border-stone-300/90 rounded-2xl text-sm text-[#121316] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="min-h-[40px] min-w-[40px] absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-stone-400 hover:text-stone-700 cursor-pointer"
              aria-label="Xóa tìm kiếm"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Horizontal Scrollable Class Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => {
              onChangeClassFilter('all');
              onChangeLessonFilter('all');
            }}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer shrink-0 ${
              selectedClassFilter === 'all'
                ? 'bg-[#121316] text-white border-[#121316] shadow-2xs'
                : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
            }`}
          >
            Tất cả các Lớp ({artworks.length})
          </button>

          {filterClasses.map((cls) => {
            const isActive = selectedClassFilter === cls.id;
            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => {
                  onChangeClassFilter(cls.id);
                  onChangeLessonFilter('all');
                }}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#1D4ED8] text-white border-[#1D4ED8] shadow-2xs'
                    : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
                }`}
              >
                {cls.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* =================================================================
          3. 2-COLUMN MASONRY DIGITAL GALLERY ON IPHONE (NATURAL ASPECT RATIO)
         ================================================================= */}
      {filteredArtworks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1D4ED8]/10 flex items-center justify-center text-[#1D4ED8]">
            <Palette className="w-7 h-7" />
          </div>
          <h3 className="font-editorial text-xl font-bold text-[#121316]">
            Không tìm thấy tác phẩm phù hợp
          </h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Hãy chọn "Tất cả các Lớp" trên thanh cuộn hoặc nhấn nút bên dưới để đăng tác phẩm mới lên triển lãm.
          </p>
          {onOpenInstantCaptureModal && (
            <button
              type="button"
              onClick={onOpenInstantCaptureModal}
              className="min-h-[48px] inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#FBBF24]" />
              <span>Chụp / Tải ảnh tác phẩm ngay</span>
            </button>
          )}
        </div>
      ) : (
        <div className="columns-2 md:columns-3 xl:columns-4 gap-3.5 sm:gap-5 space-y-3.5 sm:space-y-5">
          {filteredArtworks.map((artwork, index) => {
            const isOwner = artwork.ownerKey === currentAuthorKey;
            const canManage =
              isOwner ||
              currentRole === 'teacher' ||
              currentRole === 'moderator' ||
              currentRole === 'admin';
            const hasRealPhoto = Boolean(
              artwork.imageUrl &&
                (artwork.imageUrl.startsWith('data:image') || artwork.imageUrl.startsWith('http'))
            );

            return (
              <article
                key={artwork.id}
                onClick={() => onSelectArtwork(artwork)}
                className="break-inside-avoid bg-white rounded-2xl border border-stone-200/90 hover:border-stone-400 shadow-2xs transition-all duration-200 overflow-hidden cursor-pointer group"
              >
                {/* Artwork Image preserving natural aspect ratio without stretching */}
                <div className="relative w-full overflow-hidden bg-stone-100">
                  {hasRealPhoto ? (
                    <img
                      src={artwork.imageUrl}
                      alt={artwork.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-auto block object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  ) : (
                    <ArtCanvasVisual
                      type={artwork.visualType}
                      title={artwork.title}
                      className="w-full h-44 sm:h-52"
                      badgeText={artwork.className}
                    />
                  )}

                  {/* Top Overlay Badges */}
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none">
                    <span className="px-2 py-0.5 rounded bg-[#121316]/85 text-white text-[10px] sm:text-[11px] font-bold backdrop-blur-xs">
                      {artwork.className}
                    </span>

                    {artwork.status !== 'approved' && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${
                          artwork.status === 'pending'
                            ? 'bg-amber-500'
                            : artwork.status === 'rejected'
                            ? 'bg-rose-600'
                            : 'bg-stone-600'
                        }`}
                      >
                        {artwork.status === 'pending'
                          ? 'Chờ duyệt'
                          : artwork.status === 'rejected'
                          ? 'Cần sửa'
                          : 'Đã ẩn'}
                      </span>
                    )}
                  </div>

                  {/* Projector button visible on touch & desktop */}
                  {onOpenProjectorModal && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProjectorModal(index);
                      }}
                      className="absolute bottom-2 right-2 w-8 h-8 rounded-lg bg-black/65 hover:bg-[#1D4ED8] text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
                      title="Trình chiếu tác phẩm này"
                    >
                      <PlaySquare className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Card Body: Strictly Only Tác phẩm, Tác giả, Lớp */}
                <div className="p-3 sm:p-4 space-y-2.5">
                  <div>
                    <h3 className="font-editorial text-sm sm:text-base font-bold text-[#121316] group-hover:text-[#1D4ED8] transition-colors leading-snug line-clamp-2">
                      {artwork.title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-stone-600 mt-1 truncate">
                      Tác giả: <strong className="text-stone-900">{artwork.creatorAnonymousPseudonym}</strong>
                    </p>
                  </div>

                  {/* Positive Reactions Strip */}
                  <div className="pt-2 border-t border-stone-100 flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {(
                      [
                        'unique_idea',
                        'striking_color',
                        'interesting_composition',
                        'noteworthy_detail',
                        'inspiring'
                      ] as PositiveReactionKey[]
                    ).map((key) => {
                      const count = artwork.reactions[key] || 0;
                      const meta = POSITIVE_REACTIONS_META[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          title={`${meta.label}: ${count}`}
                          onClick={(e) => handleQuickReaction(e, artwork.id, key)}
                          className="min-h-[32px] px-1.5 py-0.5 rounded-lg bg-stone-50 hover:bg-stone-100 active:scale-95 transition-all text-stone-800 font-semibold inline-flex items-center gap-0.5 text-[11px] shrink-0 cursor-pointer"
                        >
                          <span>{meta.icon}</span>
                          <span className="text-[10px] text-stone-600">{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Bottom Action Row */}
                  <div className="pt-1.5 border-t border-stone-100 flex items-center justify-between gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={(e) => handleCopyShareLink(e, artwork)}
                      className="min-h-[34px] inline-flex items-center gap-1 text-stone-500 hover:text-[#1D4ED8] cursor-pointer"
                    >
                      {copiedToken === artwork.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 font-bold">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Chia sẻ</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      {onOpenLabelAndCertificate && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenLabelAndCertificate(artwork, 'qr-label');
                            }}
                            className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-[#1D4ED8] rounded cursor-pointer"
                            title="Thẻ QR Triển lãm"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenLabelAndCertificate(artwork, 'certificate');
                            }}
                            className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-[#D97706] rounded cursor-pointer"
                            title="Giấy chứng nhận"
                          >
                            <Award className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {canManage && onEditArtwork && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditArtwork(artwork);
                          }}
                          className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-[#1D4ED8] rounded cursor-pointer"
                          title="Sửa thông tin"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {(currentRole === 'teacher' ||
                        currentRole === 'admin' ||
                        currentRole === 'moderator') &&
                        (artwork.status === 'hidden'
                          ? onUnhideArtwork && (
                              <button
                                type="button"
                                onClick={(e) => handleQuickUnhide(e, artwork)}
                                className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] cursor-pointer"
                                title="Khôi phục"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )
                          : onHideArtwork && (
                              <button
                                type="button"
                                onClick={(e) => handleQuickHide(e, artwork)}
                                className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[10px] cursor-pointer"
                                title="Tạm ẩn"
                              >
                                <EyeOff className="w-3 h-3" />
                              </button>
                            ))}

                      {onOpenReportModal && (
                        <button
                          type="button"
                          onClick={(e) => handleReportClick(e, artwork)}
                          className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Báo cáo"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canManage && onDeleteArtwork && (
                        confirmDeleteId === artwork.id ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteArtwork(artwork.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] cursor-pointer"
                          >
                            Xóa?
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(artwork.id);
                            }}
                            className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Xóa tác phẩm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

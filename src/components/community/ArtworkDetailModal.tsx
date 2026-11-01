/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Trang Chi tiết Tác phẩm (Editorial Museum Accession View for iPhone & Desktop)
 * Chỉ hiển thị Tác phẩm, Tác giả và Lớp.
 */

import React, { useState } from 'react';
import {
  CommunityArtwork,
  ArtworkComment,
  PositiveReactionKey,
  POSITIVE_REACTIONS_META,
  UserRole
} from '../../types/communityArt';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import {
  X,
  Share2,
  Lock,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Layers,
  EyeOff,
  Zap,
  Flag,
  QrCode,
  Award
} from 'lucide-react';

interface ArtworkDetailModalProps {
  artwork: CommunityArtwork;
  comments: ArtworkComment[];
  currentRole: UserRole;
  userAuthorKey: string;
  onClose: () => void;
  onReact: (artworkId: string, reactionKey: PositiveReactionKey) => void;
  onAddComment?: (artworkId: string, content: string, nickname: string, authorKey: string, replyToId?: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onToggleShare: (artworkId: string, currentShare: 'private' | 'shared') => void;
  onHideArtwork?: (artworkId: string) => void;
  onDeleteArtwork: (artworkId: string) => void;
  onOpenReportModal: (targetType: 'artwork' | 'comment', targetId: string, targetTitle: string) => void;
  onOpenLabelAndCertificate?: (artwork: CommunityArtwork, tab: 'qr-label' | 'certificate') => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const ArtworkDetailModal: React.FC<ArtworkDetailModalProps> = ({
  artwork,
  currentRole,
  userAuthorKey,
  onClose,
  onReact,
  onToggleShare,
  onHideArtwork,
  onDeleteArtwork,
  onOpenReportModal,
  onOpenLabelAndCertificate,
  onShowToast
}) => {
  const [visualMode, setVisualMode] = useState<'final' | 'sketch' | number>('final');
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lastReportTime, setLastReportTime] = useState<number>(0);

  const isOwner = artwork.ownerKey === userAuthorKey;
  const isTeacherOrModerator =
    currentRole === 'teacher' || currentRole === 'moderator' || currentRole === 'admin';
  const isAccessible =
    (artwork.status === 'approved' && artwork.shareStatus === 'shared') ||
    isOwner ||
    isTeacherOrModerator;

  if (!isAccessible) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
        <div className="bg-[#FAF8F5] rounded-3xl max-w-md w-full p-8 text-center space-y-4 shadow-2xl border border-stone-200">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="font-editorial text-xl font-bold text-[#121316]">
            Nội dung không thể truy cập
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Tác phẩm này đang ở chế độ riêng tư hoặc đang chờ kiểm duyệt.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] py-3 bg-[#121316] text-white font-bold text-xs rounded-xl cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    );
  }

  const handleCopyShareLink = () => {
    const shareUrl = `${window.location.origin}/#gallery?token=${artwork.shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    onShowToast('success', 'Đã sao chép liên kết triển lãm', 'Mã liên kết an toàn đã được lưu vào khay nhớ tạm.');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleReport = () => {
    const now = Date.now();
    if (now - lastReportTime < 30000) {
      onShowToast('info', 'Thao tác chậm lại', 'Vui lòng chờ 30 giây trước khi gửi báo cáo tiếp theo.');
      return;
    }
    setLastReportTime(now);
    onOpenReportModal('artwork', artwork.id, artwork.title);
  };

  const currentRevision = typeof visualMode === 'number' ? artwork.revisions[visualMode] : null;
  const hasRealImage = Boolean(
    artwork.imageUrl && (artwork.imageUrl.startsWith('data:image') || artwork.imageUrl.startsWith('http'))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs">
      <div className="bg-[#FAF8F5] w-full sm:max-w-4xl rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-stone-200 overflow-hidden flex flex-col max-h-[95dvh] sm:max-h-[92vh]">
        {/* Mobile Grab Handle */}
        <div className="sm:hidden pt-2 pb-1 flex justify-center bg-[#121316]">
          <div className="w-10 h-1.5 rounded-full bg-stone-600" />
        </div>

        {/* Top Bar */}
        <div className="px-4 py-3 sm:px-6 bg-[#121316] text-white flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#FBBF24] bg-white/10 px-2.5 py-1 rounded-lg">
              <Layers className="w-3.5 h-3.5" />
              <span>{artwork.className}</span>
            </span>
            <span className="text-xs text-stone-300 truncate hidden sm:inline">
              {artwork.title}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenLabelAndCertificate && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenLabelAndCertificate(artwork, 'qr-label')}
                  className="min-h-[40px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#FBBF24]" />
                  <span className="hidden sm:inline">Thẻ QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenLabelAndCertificate(artwork, 'certificate')}
                  className="min-h-[40px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5 text-[#FBBF24]" />
                  <span className="hidden sm:inline">Chứng nhận</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleCopyShareLink}
              className="min-h-[40px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1D4ED8] hover:bg-[#1E40AF] text-white cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Đã chép' : 'Chia sẻ'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center text-stone-300 hover:text-white rounded-xl hover:bg-white/10 cursor-pointer"
              aria-label="Đóng chi tiết"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Detail Content */}
        <div className="p-4 sm:p-6 pb-safe overflow-y-auto flex-1 space-y-6 overscroll-contain">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Large Uncropped Artwork Viewer */}
            <div className="lg:col-span-7 space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-[#121316] border border-stone-800 flex items-center justify-center min-h-[280px]">
                {visualMode === 'final' ? (
                  hasRealImage ? (
                    <img
                      src={artwork.imageUrl}
                      alt={artwork.title}
                      className="max-w-full w-auto h-auto max-h-[62vh] object-contain mx-auto"
                    />
                  ) : (
                    <ArtCanvasVisual
                      type={artwork.visualType}
                      title={artwork.title}
                      className="h-80 w-full"
                    />
                  )
                ) : visualMode === 'sketch' ? (
                  <ArtCanvasVisual
                    type={artwork.sketchVisualType || 'pastel'}
                    title={`Phác thảo: ${artwork.title}`}
                    className="h-80 w-full"
                  />
                ) : currentRevision ? (
                  <ArtCanvasVisual
                    type={currentRevision.visualType}
                    title={currentRevision.caption}
                    className="h-80 w-full"
                  />
                ) : null}

                {artwork.isAutoPublished && (
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-black/75 text-[#FBBF24] backdrop-blur-xs">
                      <Zap className="w-3 h-3 fill-current" />
                      <span>EXIF Sạch</span>
                    </span>
                  </div>
                )}
              </div>

              {(artwork.sketchImageUrl || artwork.sketchNotes || artwork.revisions.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-stone-200/70 rounded-xl text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setVisualMode('final')}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      visualMode === 'final'
                        ? 'bg-white text-[#121316] font-bold shadow-2xs'
                        : 'text-stone-600'
                    }`}
                  >
                    Tác phẩm hoàn thiện
                  </button>
                  {(artwork.sketchImageUrl || artwork.sketchNotes) && (
                    <button
                      type="button"
                      onClick={() => setVisualMode('sketch')}
                      className={`min-h-[38px] px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        visualMode === 'sketch'
                          ? 'bg-white text-[#121316] font-bold shadow-2xs'
                          : 'text-stone-600'
                      }`}
                    >
                      Bản phác thảo
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right: Metadata (Strictly Tác phẩm, Tác giả, Lớp) & Positive Reactions */}
            <div className="lg:col-span-5 space-y-4">
              {/* Museum Accession Plaque */}
              <div className="p-5 bg-white rounded-2xl border border-stone-200/90 space-y-4 shadow-2xs">
                <div>
                  <span className="text-[10px] font-bold text-[#1D4ED8] uppercase tracking-[0.2em] block">
                    TÁC PHẨM TRIỂN LÃM
                  </span>
                  <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[#121316] leading-snug mt-1">
                    {artwork.title}
                  </h1>
                </div>

                <dl className="pt-3 border-t border-stone-200/80 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">
                      Tác giả
                    </dt>
                    <dd className="font-extrabold text-[#121316] text-sm mt-1">
                      {artwork.creatorAnonymousPseudonym}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">
                      Lớp
                    </dt>
                    <dd className="font-extrabold text-[#1D4ED8] text-sm mt-1">
                      {artwork.className}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* 5 Instant Positive Reactions (48px Touch Rows) */}
              <div className="p-4 sm:p-5 bg-white rounded-2xl border border-stone-200/90 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#121316]">
                    <Sparkles className="w-4 h-4 text-[#D97706]" />
                    <span>Gửi phản hồi động viên sáng tạo</span>
                  </div>
                  <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                    Không chấm điểm
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
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
                        onClick={() => onReact(artwork.id, key)}
                        className="min-h-[48px] flex items-center justify-between p-3 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200/90 active:scale-98 transition-all text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-lg shrink-0">{meta.icon}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#121316] truncate">
                              {meta.label}
                            </div>
                            <div className="text-[10px] text-stone-500 truncate">
                              {meta.description}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-extrabold text-[#1D4ED8] bg-[#1D4ED8]/10 px-2.5 py-1 rounded-lg shrink-0 ml-2">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Controls */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                {isTeacherOrModerator && onHideArtwork && (
                  <button
                    type="button"
                    onClick={() => onHideArtwork(artwork.id)}
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-bold cursor-pointer"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Tạm ẩn</span>
                  </button>
                )}

                {isOwner && (
                  <button
                    type="button"
                    onClick={() => onToggleShare(artwork.id, artwork.shareStatus)}
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[#1D4ED8] bg-[#1D4ED8]/10 font-bold cursor-pointer"
                  >
                    {artwork.shareStatus === 'shared' ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                    <span>{artwork.shareStatus === 'shared' ? 'Rút chia sẻ' : 'Mở chia sẻ'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleReport}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 font-bold cursor-pointer ml-auto"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Báo cáo</span>
                </button>

                {(isOwner || currentRole === 'admin' || currentRole === 'teacher') && (
                  confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => onDeleteArtwork(artwork.id)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-600 text-white font-bold cursor-pointer"
                    >
                      Xác nhận xóa
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-400 hover:text-rose-600 rounded-xl bg-white border border-stone-200 cursor-pointer"
                      title="Xóa tác phẩm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

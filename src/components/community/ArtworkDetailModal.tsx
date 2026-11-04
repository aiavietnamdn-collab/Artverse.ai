/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Wonderland of Art Simplified Artwork Detail & 5-Emotion Reaction System
 * Display order:
 * 1. Hình ảnh tác phẩm (Uncropped artwork focal point)
 * 2. Tên tác phẩm
 * 3. Biệt danh nghệ sĩ và lớp
 * 4. Chất liệu, chủ đề và ngày đăng ở dạng metadata ngắn
 * 5. Thanh cảm xúc 5 lựa chọn (❤️ Yêu thích, 👍 Thích, 😂 Vui, 😢 Buồn, 😡 Giận)
 * 6. Bình luận (Compact ArtverseCommunityComments)
 * 7. Tác phẩm liên quan
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  CommunityArtwork,
  ArtworkComment,
  ArtworkStory,
  PositiveReactionKey,
  ArtworkEmotionKey,
  ARTWORK_EMOTION_ORDER,
  ARTWORK_EMOTIONS_META,
  UserRole,
} from '../../types/communityArt';
import { getArtworkNormalizedGrade } from '../../utils/gradeUtils';
import { getGradeWonderlandTheme } from '../common/WonderlandGraphicSystem';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import { ArtverseCommunityComments } from './ArtverseCommunityComments';
import { useAuth } from '../../context/AuthContext';
import {
  createEmptyEmotionCounts,
  subscribeArtworkEmotionSummary,
  toggleArtworkEmotionReaction,
} from '../../services/communityFirestoreService';
import {
  X,
  Share2,
  Lock,
  Trash2,
  Copy,
  Check,
  Sparkles,
  EyeOff,
  Flag,
  QrCode,
  Award,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Sliders,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  RefreshCw,
  Save,
  Eye,
  Calendar,
  Palette,
  Tag,
  Play,
  AlertTriangle,
} from 'lucide-react';

interface ArtworkDetailModalProps {
  artwork: CommunityArtwork;
  allArtworks?: CommunityArtwork[];
  story?: ArtworkStory | null;
  comments: ArtworkComment[];
  currentRole: UserRole;
  userAuthorKey: string;
  currentStudentUid?: string;
  onClose: () => void;
  onSelectArtwork?: (artwork: CommunityArtwork) => void;
  onPrevArtwork?: () => void;
  onNextArtwork?: () => void;
  hasPrevArtwork?: boolean;
  hasNextArtwork?: boolean;
  onOpenWriteStoryModal?: (artwork: CommunityArtwork) => void;
  onReact?: (artworkId: string, reactionKey: PositiveReactionKey) => void;
  onAddComment?: (
    artworkId: string,
    content: string,
    nickname: string,
    authorKey: string,
    replyToId?: string
  ) => void;
  onDeleteComment?: (commentId: string) => void;
  onToggleShare: (artworkId: string, currentShare: 'private' | 'shared') => void;
  onHideArtwork?: (artworkId: string) => void;
  onDeleteArtwork: (artworkId: string) => void;
  onUpdateArtworkImage?: (
    artwork: CommunityArtwork,
    editedBlob: Blob,
    mode: 'overwrite' | 'new_copy'
  ) => Promise<void>;
  onOpenReportModal: (
    targetType: 'artwork' | 'comment' | 'story',
    targetId: string,
    targetTitle: string
  ) => void;
  onOpenLabelAndCertificate?: (
    artwork: CommunityArtwork,
    tab: 'qr-label' | 'certificate'
  ) => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

type CropPreset = 'free' | '1:1' | '4:3' | '3:4' | '16:9';

export const ArtworkDetailModal: React.FC<ArtworkDetailModalProps> = ({
  artwork,
  allArtworks = [],
  story,
  comments = [],
  currentRole,
  userAuthorKey,
  currentStudentUid,
  onClose,
  onSelectArtwork,
  onPrevArtwork,
  onNextArtwork,
  hasPrevArtwork = false,
  hasNextArtwork = false,
  onOpenWriteStoryModal,
  onToggleShare,
  onHideArtwork,
  onDeleteArtwork,
  onUpdateArtworkImage,
  onOpenReportModal,
  onOpenLabelAndCertificate,
  onShowToast,
}) => {
  const {
    user,
    profile,
    verifiedRole,
    getValidBearerToken,
    setIsStudentLoginModalOpen,
  } = useAuth();

  const [visualMode, setVisualMode] = useState<'final' | 'sketch' | number>('final');
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lastReportTime, setLastReportTime] = useState<number>(0);
  const [isFullscreenZoom, setIsFullscreenZoom] = useState<boolean>(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [videoPlaybackError, setVideoPlaybackError] = useState<string | null>(null);

  const isVideoArtwork =
    artwork.mediaType === 'video' ||
    Boolean(artwork.videoUrl) ||
    Boolean(artwork.mimeType && artwork.mimeType.startsWith('video/'));
  const resolvedVideoSrc = artwork.videoUrl || artwork.downloadURL || artwork.imageUrl || '';
  const resolvedPosterThumb = artwork.thumbnailUrl || artwork.imageUrl || '';

  // 5-Emotion Reaction System State (Real Firestore + Backend UID-Verified)
  const [emotionCounts, setEmotionCounts] = useState<Record<ArtworkEmotionKey, number>>({
    ...createEmptyEmotionCounts(),
    ...(artwork.emotionCounts || {}),
  });
  const [userEmotion, setUserEmotion] = useState<ArtworkEmotionKey | null>(null);
  const [isUpdatingEmotion, setIsUpdatingEmotion] = useState<boolean>(false);
  const [animatingEmotion, setAnimatingEmotion] = useState<ArtworkEmotionKey | null>(null);
  const [reactionStatus, setReactionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [reactionErrorMessage, setReactionErrorMessage] = useState<string | null>(null);
  const [lastFailedEmotion, setLastFailedEmotion] = useState<ArtworkEmotionKey | null>(null);

  // Admin Image Editor State (Strictly Admin-only)
  const [isAdminEditorOpen, setIsAdminEditorOpen] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [cropPreset, setCropPreset] = useState<CropPreset>('free');
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [warmth, setWarmth] = useState<number>(0);
  const [sharpness, setSharpness] = useState<number>(0);
  const [isComparingOriginal, setIsComparingOriginal] = useState<boolean>(false);
  const [isSavingEditedImage, setIsSavingEditedImage] = useState<boolean>(false);
  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  const normalizedGradeLabel = getArtworkNormalizedGrade(artwork);
  const gradeTheme = getGradeWonderlandTheme(normalizedGradeLabel);

  const isOwner =
    artwork.ownerKey === userAuthorKey ||
    Boolean(currentStudentUid && artwork.ownerKey === currentStudentUid) ||
    Boolean(currentStudentUid && artwork.authorAccountId === currentStudentUid);
  const isTeacherOrModerator =
    currentRole === 'teacher' || currentRole === 'moderator' || currentRole === 'admin';
  const isAdmin = currentRole === 'admin' || verifiedRole === 'admin';
  const activeAuthUid = profile?.uid || user?.uid || currentStudentUid || null;
  const isLoggedIn = Boolean(activeAuthUid);

  const isAccessible =
    (artwork.status === 'approved' && artwork.shareStatus === 'shared') ||
    isOwner ||
    isTeacherOrModerator;

  // Related Artworks in the same grade/collection
  const relatedArtworks = useMemo(() => {
    return allArtworks
      .filter(
        (item) =>
          item.id !== artwork.id &&
          item.status === 'approved' &&
          item.shareStatus === 'shared' &&
          getArtworkNormalizedGrade(item) === normalizedGradeLabel
      )
      .slice(0, 4);
  }, [allArtworks, artwork.id, normalizedGradeLabel]);

  // Reset states when switching artwork
  useEffect(() => {
    setVisualMode('final');
    setConfirmDelete(false);
    setIsAdminEditorOpen(false);
    setIsVideoPlaying(false);
    setVideoPlaybackError(null);
    setEmotionCounts({
      ...createEmptyEmotionCounts(),
      ...(artwork.emotionCounts || {}),
    });
    setUserEmotion(null);
    setReactionStatus('idle');
    setReactionErrorMessage(null);
    setLastFailedEmotion(null);
  }, [artwork.id, artwork.emotionCounts]);

  // Subscribe to real-time 5-emotion counts & current user's selected emotion
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let active = true;

    getValidBearerToken()
      .then((token) => {
        if (!active) return;
        unsub = subscribeArtworkEmotionSummary(
          artwork.id,
          activeAuthUid,
          token,
          (summary) => {
            if (!active) return;
            setEmotionCounts(summary.counts);
            setUserEmotion(summary.userEmotion);
          }
        );
      })
      .catch(() => {
        if (!active) return;
        unsub = subscribeArtworkEmotionSummary(
          artwork.id,
          activeAuthUid,
          null,
          (summary) => {
            if (!active) return;
            setEmotionCounts(summary.counts);
            setUserEmotion(summary.userEmotion);
          }
        );
      });

    return () => {
      active = false;
      if (unsub) unsub();
    };
  }, [artwork.id, activeAuthUid, getValidBearerToken]);

  const handleSelectEmotion = async (emotionKey: ArtworkEmotionKey) => {
    if (isUpdatingEmotion) return; // Prevent rapid spam clicks

    if (!isLoggedIn) {
      setReactionStatus('error');
      setReactionErrorMessage(
        'Vui lòng đăng nhập tài khoản Học sinh (Mã PIN) hoặc Google để lưu cảm xúc cho tác phẩm.'
      );
      onShowToast(
        'info',
        'Đăng nhập để thả cảm xúc',
        'Vui lòng đăng nhập tài khoản Học sinh hoặc Giáo viên để lưu cảm xúc cho tác phẩm.'
      );
      setIsStudentLoginModalOpen(true);
      return;
    }

    const prevCounts = { ...emotionCounts };
    const prevUserEmotion = userEmotion;

    setIsUpdatingEmotion(true);
    setReactionStatus('loading');
    setReactionErrorMessage(null);
    setLastFailedEmotion(null);
    setAnimatingEmotion(emotionKey);
    setTimeout(() => setAnimatingEmotion(null), 350);

    try {
      const token = await getValidBearerToken();
      if (!token && !activeAuthUid) {
        setIsStudentLoginModalOpen(true);
        setReactionStatus('error');
        setReactionErrorMessage('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        return;
      }

      const summary = await toggleArtworkEmotionReaction(
        artwork.id,
        emotionKey,
        token,
        activeAuthUid
      );

      // Update UI only after backend/Firestore confirms success
      setEmotionCounts(summary.counts);
      setUserEmotion(summary.userEmotion);
      setReactionStatus('success');
      setReactionErrorMessage(null);
      setLastFailedEmotion(null);
    } catch (err: any) {
      // Rollback to previous confirmed state on failure
      setEmotionCounts(prevCounts);
      setUserEmotion(prevUserEmotion);
      const errMsg =
        err?.message || 'Không thể cập nhật cảm xúc do kết nối mạng hoặc phân quyền.';
      setReactionStatus('error');
      setReactionErrorMessage(errMsg);
      setLastFailedEmotion(emotionKey);
      onShowToast('error', 'Không thể cập nhật cảm xúc', errMsg);
    } finally {
      setIsUpdatingEmotion(false);
    }
  };

  // Render live preview in Admin Image Editor Canvas
  useEffect(() => {
    if (!isAdminEditorOpen || !artwork.imageUrl) return;
    let isCancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (isCancelled) return;
      loadedImageRef.current = img;
      drawAdminEditorCanvas();
    };
    img.src = artwork.imageUrl;
    return () => {
      isCancelled = true;
    };
  }, [isAdminEditorOpen, artwork.imageUrl]);

  const drawAdminEditorCanvas = () => {
    const canvas = editorCanvasRef.current;
    const img = loadedImageRef.current;
    if (!canvas || !img) return;

    const rad = ((rotation % 360) * Math.PI) / 180;
    const isRotated90 = Math.abs(rotation % 180) === 90;
    const rawW = isRotated90 ? img.naturalHeight : img.naturalWidth;
    const rawH = isRotated90 ? img.naturalWidth : img.naturalHeight;

    let targetW = rawW;
    let targetH = rawH;
    const ratioMap: Record<CropPreset, number | null> = {
      free: null,
      '1:1': 1,
      '4:3': 4 / 3,
      '3:4': 3 / 4,
      '16:9': 16 / 9,
    };
    const desiredRatio = isComparingOriginal ? null : ratioMap[cropPreset];
    if (desiredRatio) {
      if (rawW / rawH > desiredRatio) {
        targetW = Math.round(rawH * desiredRatio);
      } else {
        targetH = Math.round(rawW / desiredRatio);
      }
    }

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, targetW, targetH);

    if (!isComparingOriginal) {
      const sepiaAmt = warmth > 0 ? Math.min(warmth * 0.6, 35) : 0;
      const hueShift = warmth < 0 ? warmth * 0.4 : 0;
      const extraContrast = sharpness > 0 ? Math.round(sharpness * 0.18) : 0;
      ctx.filter = `brightness(${brightness}%) contrast(${contrast + extraContrast}%) saturate(${saturation}%) sepia(${sepiaAmt}%) hue-rotate(${hueShift}deg)`;
    } else {
      ctx.filter = 'none';
    }

    ctx.translate(targetW / 2, targetH / 2);
    if (!isComparingOriginal) {
      ctx.rotate(rad);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    }
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  };

  useEffect(() => {
    if (isAdminEditorOpen) {
      drawAdminEditorCanvas();
    }
  }, [
    isAdminEditorOpen,
    rotation,
    flipH,
    flipV,
    cropPreset,
    brightness,
    contrast,
    saturation,
    warmth,
    sharpness,
    isComparingOriginal,
  ]);

  const handleResetEditor = () => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setCropPreset('free');
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setWarmth(0);
    setSharpness(0);
    setIsComparingOriginal(false);
  };

  const handleSaveAdminEditedImage = async (mode: 'overwrite' | 'new_copy') => {
    if (!editorCanvasRef.current || !onUpdateArtworkImage) return;
    setIsSavingEditedImage(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        editorCanvasRef.current?.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      );
      if (!blob) {
        throw new Error('Không thể xuất dữ liệu ảnh từ trình chỉnh sửa.');
      }
      await onUpdateArtworkImage(artwork, blob, mode);
      setIsAdminEditorOpen(false);
    } catch (err: any) {
      onShowToast(
        'error',
        'Lỗi lưu ảnh đã chỉnh sửa',
        err?.message || 'Không thể lưu ảnh lên Firebase Storage.'
      );
    } finally {
      setIsSavingEditedImage(false);
    }
  };

  if (!isAccessible) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1B4B]/60 backdrop-blur-md">
        <div className="bg-[#FFF8EC] rounded-3xl max-w-md w-full p-8 text-center space-y-4 shadow-2xl border-2 border-[#E2D9F3] text-[#1E1B4B]">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="font-display text-2xl font-extrabold">Nội dung không thể truy cập</h3>
          <p className="text-xs text-[#5B587B] leading-relaxed">
            Tác phẩm này đang ở chế độ riêng tư hoặc đang chờ kiểm duyệt từ giáo viên.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] py-3 bg-[#8B5CF6] text-white font-extrabold text-xs rounded-2xl cursor-pointer"
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
    onShowToast(
      'success',
      'Đã sao chép liên kết triển lãm',
      'Liên kết tác phẩm đã được lưu vào khay nhớ tạm.'
    );
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleReport = () => {
    const now = Date.now();
    if (now - lastReportTime < 30000) {
      onShowToast(
        'info',
        'Thao tác chậm lại',
        'Vui lòng chờ 30 giây trước khi gửi báo cáo tiếp theo.'
      );
      return;
    }
    setLastReportTime(now);
    onOpenReportModal('artwork', artwork.id, artwork.title);
  };

  const revisions = artwork.revisions || [];
  const currentRevision = typeof visualMode === 'number' ? revisions[visualMode] : null;
  const hasRealImage = Boolean(
    artwork.imageUrl &&
      (artwork.imageUrl.startsWith('data:image') || artwork.imageUrl.startsWith('http'))
  );

  const displayNickname =
    story?.authorNickname ||
    artwork.authorAlias ||
    artwork.creatorAnonymousPseudonym ||
    'Nghệ sĩ Nhí';

  const formattedDate = useMemo(() => {
    if (!artwork.createdAt) return 'Năm học 2025–2026';
    const parsed = new Date(artwork.createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
    return artwork.createdAt;
  }, [artwork.createdAt]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1E1B4B]/65 backdrop-blur-md p-0 sm:p-4">
      <div
        className={`bg-[#FFF8EC] text-[#1E1B4B] w-full ${
          isFullscreenZoom
            ? 'h-dvh max-w-none rounded-none'
            : 'sm:max-w-6xl rounded-t-3xl sm:rounded-[32px] max-h-[95dvh] sm:max-h-[92vh]'
        } shadow-[0_24px_80px_rgba(30,27,75,0.35)] border-t-2 sm:border-2 border-[#E2D9F3] overflow-hidden flex flex-col transition-all`}
      >
        {/* Mobile Grab Handle */}
        <div className="sm:hidden pt-2 pb-1 flex justify-center bg-[#FFF8EC]">
          <div className="w-10 h-1.5 rounded-full bg-[#C4B5FD]" />
        </div>

        {/* Top Bar with Prev/Next Navigation, Admin Image Editor Button & Share */}
        <div className="px-4 py-3 sm:px-6 bg-white/90 border-b-2 border-[#E2D9F3] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full text-white shadow-xs shrink-0"
              style={{ backgroundColor: gradeTheme.badgeBg }}
            >
              <span>{normalizedGradeLabel}</span>
            </span>
            <span className="font-display font-bold text-sm sm:text-base text-[#1E1B4B] truncate hidden md:inline">
              {artwork.title}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* Previous / Next Artwork Navigation */}
            {(onPrevArtwork || onNextArtwork) && (
              <div className="flex items-center gap-1 mr-1 bg-[#FFF8EC] border border-[#E2D9F3] rounded-full p-0.5">
                <button
                  type="button"
                  onClick={onPrevArtwork}
                  disabled={!hasPrevArtwork}
                  className="min-h-[32px] px-2.5 py-1 rounded-full text-xs font-bold text-[#1E1B4B] hover:bg-white disabled:opacity-35 inline-flex items-center gap-1 cursor-pointer"
                  title="Tác phẩm trước đó"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden lg:inline">Trước</span>
                </button>
                <button
                  type="button"
                  onClick={onNextArtwork}
                  disabled={!hasNextArtwork}
                  className="min-h-[32px] px-2.5 py-1 rounded-full text-xs font-bold text-[#1E1B4B] hover:bg-white disabled:opacity-35 inline-flex items-center gap-1 cursor-pointer"
                  title="Tác phẩm tiếp theo"
                >
                  <span className="hidden lg:inline">Tiếp</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ADMIN-ONLY IMAGE EDITOR BUTTON */}
            {isAdmin && hasRealImage && (
              <button
                type="button"
                onClick={() => setIsAdminEditorOpen(!isAdminEditorOpen)}
                className={`min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold cursor-pointer transition-colors ${
                  isAdminEditorOpen
                    ? 'bg-[#FFD93D] text-[#1E1B4B] border-2 border-[#F59E0B]'
                    : 'bg-[#FFF8EC] hover:bg-[#FFD93D] text-[#B45309] hover:text-[#1E1B4B] border border-[#F59E0B]/40'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>CHỈNH SỬA ẢNH</span>
              </button>
            )}

            {/* Fullscreen Zoom Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreenZoom(!isFullscreenZoom)}
              className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#FFF8EC] hover:bg-[#F3E8FF] text-[#1E1B4B] border border-[#E2D9F3] cursor-pointer"
              title="Chế độ xem toàn màn hình"
            >
              {isFullscreenZoom ? (
                <Minimize2 className="w-3.5 h-3.5 text-[#7C3AED]" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-[#7C3AED]" />
              )}
              <span className="hidden sm:inline">
                {isFullscreenZoom ? 'Thu nhỏ' : 'Phóng to'}
              </span>
            </button>

            {onOpenLabelAndCertificate && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenLabelAndCertificate(artwork, 'qr-label')}
                  className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-[#FFF8EC] hover:bg-[#F3E8FF] text-[#1E1B4B] border border-[#E2D9F3] cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span className="hidden sm:inline">QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenLabelAndCertificate(artwork, 'certificate')}
                  className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-[#FFF8EC] hover:bg-[#FEF3C7] text-[#1E1B4B] border border-[#E2D9F3] cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span className="hidden sm:inline">Chứng nhận</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleCopyShareLink}
              className="min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-[#FFD93D] hover:bg-[#FBBF24] text-[#1E1B4B] cursor-pointer shadow-xs"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Đã chép' : 'Chia sẻ'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[34px] min-w-[34px] flex items-center justify-center text-[#5B587B] hover:text-[#1E1B4B] rounded-full hover:bg-[#F3E8FF] cursor-pointer"
              aria-label="Đóng chi tiết"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Detail Content */}
        <div className="p-4 sm:p-6 pb-safe overflow-y-auto flex-1 space-y-6 overscroll-contain">
          {/* Built-in Admin Image Editor Studio (When Activated by Admin) */}
          {isAdmin && isAdminEditorOpen && hasRealImage && (
            <div className="rounded-3xl bg-white border-2 border-[#F59E0B] p-4 sm:p-6 space-y-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#B45309] block">
                    CÔNG CỤ QUẢN TRỊ · CHỈNH SỬA ẢNH TRƯNG BÀY
                  </span>
                  <h3 className="font-display text-lg font-extrabold text-[#1E1B4B]">
                    Hiệu chỉnh Ánh sáng, Bố cục &amp; Khung hình Tác phẩm
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onMouseDown={() => setIsComparingOriginal(true)}
                    onMouseUp={() => setIsComparingOriginal(false)}
                    onMouseLeave={() => setIsComparingOriginal(false)}
                    onTouchStart={() => setIsComparingOriginal(true)}
                    onTouchEnd={() => setIsComparingOriginal(false)}
                    className="px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Giữ xem Ảnh gốc</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetEditor}
                    className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#1E1B4B] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Đặt lại mặc định</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-7 rounded-2xl bg-[#FFF8EC] border-2 border-[#E2D9F3] p-4 flex items-center justify-center min-h-[300px]">
                  <canvas
                    ref={editorCanvasRef}
                    className="max-w-full max-h-[50vh] w-auto h-auto object-contain rounded-xl shadow-md"
                  />
                </div>

                <div className="lg:col-span-5 space-y-4">
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-[#5B587B] block">Xoay &amp; Lật ảnh</span>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setRotation((r) => r - 90)}
                        className="p-2.5 rounded-xl bg-slate-100 hover:bg-[#FFD93D] text-[#1E1B4B] text-xs font-bold flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>-90°</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRotation((r) => r + 90)}
                        className="p-2.5 rounded-xl bg-slate-100 hover:bg-[#FFD93D] text-[#1E1B4B] text-xs font-bold flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <RotateCw className="w-4 h-4" />
                        <span>+90°</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFlipH((f) => !f)}
                        className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 cursor-pointer ${
                          flipH ? 'bg-[#8B5CF6] text-white' : 'bg-slate-100 text-[#1E1B4B]'
                        }`}
                      >
                        <FlipHorizontal className="w-4 h-4" />
                        <span>Lật ngang</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFlipV((f) => !f)}
                        className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 cursor-pointer ${
                          flipV ? 'bg-[#8B5CF6] text-white' : 'bg-slate-100 text-[#1E1B4B]'
                        }`}
                      >
                        <FlipVertical className="w-4 h-4" />
                        <span>Lật dọc</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-[#5B587B] block">
                      Tỷ lệ Khung hình (Crop)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(['free', '1:1', '4:3', '3:4', '16:9'] as CropPreset[]).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCropPreset(preset)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer ${
                            cropPreset === preset
                              ? 'bg-[#8B5CF6] text-white'
                              : 'bg-slate-100 text-[#5B587B]'
                          }`}
                        >
                          {preset === 'free' ? 'Nguyên bản' : preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-[#5B587B] mb-0.5">
                        <span>Độ sáng</span>
                        <span className="text-[#1E1B4B] font-bold">{brightness}%</span>
                      </div>
                      <input
                        type="range"
                        min={60}
                        max={140}
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                        className="w-full accent-[#8B5CF6]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[#5B587B] mb-0.5">
                        <span>Độ tương phản</span>
                        <span className="text-[#1E1B4B] font-bold">{contrast}%</span>
                      </div>
                      <input
                        type="range"
                        min={60}
                        max={140}
                        value={contrast}
                        onChange={(e) => setContrast(Number(e.target.value))}
                        className="w-full accent-[#8B5CF6]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[#5B587B] mb-0.5">
                        <span>Độ bão hòa màu</span>
                        <span className="text-[#1E1B4B] font-bold">{saturation}%</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={150}
                        value={saturation}
                        onChange={(e) => setSaturation(Number(e.target.value))}
                        className="w-full accent-[#8B5CF6]"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={isSavingEditedImage}
                      onClick={() => handleSaveAdminEditedImage('overwrite')}
                      className="flex-1 min-h-[42px] px-4 py-2.5 rounded-full bg-[#FFD93D] hover:bg-[#FBBF24] text-[#1E1B4B] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingEditedImage ? 'Đang lưu...' : 'Cập nhật ảnh hiện tại'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSavingEditedImage}
                      onClick={() => handleSaveAdminEditedImage('new_copy')}
                      className="min-h-[42px] px-4 py-2.5 rounded-full bg-[#F3E8FF] hover:bg-[#E9D5FF] text-[#6D28D9] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Lưu bản mới</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MAIN 2-COLUMN LAYOUT (Desktop: Left Image [1], Right Info+Reactions+Comments [2..6]; Mobile: Vertical 1 -> 6) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 1. HÌNH ẢNH TÁC PHẨM (Focal Point) */}
            <div className="lg:col-span-7 space-y-3">
              <div
                className="relative rounded-3xl overflow-hidden bg-white border-4 p-3 sm:p-6 flex items-center justify-center min-h-[300px] sm:min-h-[460px] shadow-[0_14px_40px_rgba(30,27,75,0.09)]"
                style={{ borderColor: gradeTheme.cardBorder }}
              >
                {visualMode === 'final' ? (
                  isVideoArtwork && resolvedVideoSrc ? (
                    <div className="w-full flex flex-col items-center justify-center space-y-3">
                      {!isVideoPlaying ? (
                        <div
                          onClick={() => {
                            setVideoPlaybackError(null);
                            setIsVideoPlaying(true);
                          }}
                          className="relative group cursor-pointer w-full flex items-center justify-center rounded-2xl overflow-hidden bg-[#172044] min-h-[280px] sm:min-h-[400px]"
                        >
                          {resolvedPosterThumb ? (
                            <img
                              src={resolvedPosterThumb}
                              alt={artwork.title}
                              className="max-w-full w-auto h-auto max-h-[64vh] object-contain mx-auto opacity-90 group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="h-80 w-full flex items-center justify-center text-white/80">
                              <span>Video Nghệ Thuật</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center gap-3 p-4 text-center">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-[#172044] flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                              <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-[#172044] ml-1" />
                            </div>
                            <span className="px-4 py-1.5 rounded-full bg-[#172044]/90 text-white text-xs font-extrabold border border-white/25 shadow-md">
                              Nhấn để phát Video Nghệ Thuật{' '}
                              {artwork.duration ? `(${Math.round(artwork.duration)} giây)` : ''}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full flex flex-col items-center justify-center space-y-2">
                          <video
                            src={resolvedVideoSrc}
                            poster={resolvedPosterThumb || undefined}
                            controls
                            autoPlay
                            playsInline
                            preload="metadata"
                            onError={() =>
                              setVideoPlaybackError(
                                'Trình duyệt hiện tại không thể giải mã trực tiếp định dạng video này (hoặc kết nối mạng bị gián đoạn).'
                              )
                            }
                            className="max-w-full w-auto h-auto max-h-[68vh] object-contain mx-auto rounded-2xl bg-[#172044] shadow-md"
                          />
                          {videoPlaybackError && (
                            <div className="w-full p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span>{videoPlaybackError}</span>
                              </div>
                              <a
                                href={resolvedVideoSrc}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-extrabold shrink-0"
                              >
                                Tải / Mở Video trực tiếp
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : hasRealImage ? (
                    <img
                      src={artwork.imageUrl || artwork.downloadURL}
                      alt={artwork.title}
                      className="max-w-full w-auto h-auto max-h-[68vh] object-contain mx-auto rounded-2xl shadow-md"
                    />
                  ) : (
                    <ArtCanvasVisual
                      type={artwork.visualType || 'watercolor'}
                      title={artwork.title}
                      className="h-96 w-full rounded-2xl"
                    />
                  )
                ) : visualMode === 'sketch' ? (
                  <ArtCanvasVisual
                    type={artwork.sketchVisualType || 'pastel'}
                    title={`Phác thảo: ${artwork.title}`}
                    className="h-96 w-full rounded-2xl"
                  />
                ) : currentRevision ? (
                  <ArtCanvasVisual
                    type={currentRevision.visualType}
                    title={currentRevision.caption}
                    className="h-96 w-full rounded-2xl"
                  />
                ) : null}
              </div>

              {/* Optional switch if sketch exists */}
              {(artwork.sketchImageUrl || artwork.sketchNotes || revisions.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 p-1 bg-white border border-[#E2D9F3] rounded-full text-xs font-bold w-fit">
                  <button
                    type="button"
                    onClick={() => setVisualMode('final')}
                    className={`min-h-[32px] px-3.5 py-1 rounded-full transition-colors cursor-pointer ${
                      visualMode === 'final'
                        ? 'bg-[#8B5CF6] text-white'
                        : 'text-[#5B587B] hover:text-[#1E1B4B]'
                    }`}
                  >
                    Tác phẩm hoàn thiện
                  </button>
                  {(artwork.sketchImageUrl || artwork.sketchNotes) && (
                    <button
                      type="button"
                      onClick={() => setVisualMode('sketch')}
                      className={`min-h-[32px] px-3.5 py-1 rounded-full transition-colors cursor-pointer ${
                        visualMode === 'sketch'
                          ? 'bg-[#8B5CF6] text-white'
                          : 'text-[#5B587B] hover:text-[#1E1B4B]'
                      }`}
                    >
                      Bản phác thảo
                    </button>
                  )}
                </div>
              )}

              {/* Story behind the artwork (Câu chuyện phía sau nét vẽ) */}
              {(story || onOpenWriteStoryModal) && (
                <div className="rounded-2xl bg-white border-2 border-[#20243A]/12 p-4 space-y-2.5 text-xs shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[#20243A] font-extrabold uppercase tracking-wider text-[11px]">
                      <BookOpen className="w-4 h-4 text-[#3457D5] shrink-0" />
                      <span>
                        {story ? `Câu chuyện tác phẩm: “${story.storyTitle}”` : 'Câu chuyện sau nét vẽ'}
                      </span>
                    </div>
                    {onOpenWriteStoryModal && (
                      <button
                        type="button"
                        onClick={() => onOpenWriteStoryModal(artwork)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] font-bold text-[11px] shrink-0 cursor-pointer transition-colors"
                      >
                        {story && isOwner ? 'Chỉnh sửa câu chuyện' : 'Kể câu chuyện của em'}
                      </button>
                    )}
                  </div>
                  {story ? (
                    <div className="space-y-1.5 text-[#20243A]/85 leading-relaxed">
                      <p className="whitespace-pre-line">{story.storyContent}</p>
                      {story.viewerMessage && (
                        <p className="italic text-[#3457D5] font-medium pt-1 border-t border-[#20243A]/10">
                          Thông điệp gửi người xem: “{story.viewerMessage}”
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[#20243A]/65">
                      Chia sẻ ý tưởng, nguồn cảm hứng và cảm xúc khi sáng tạo tác phẩm này.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: 2. Tên tác phẩm -> 3. Nghệ sĩ & Lớp -> 4. Metadata ngắn -> 5. Thanh 5 Cảm xúc -> 6. Bình luận */}
            <div className="lg:col-span-5 space-y-4">
              {/* 2, 3, 4: Compact Artwork Info Card */}
              <div className="p-5 bg-white rounded-3xl border-2 border-[#E2D9F3] space-y-3.5 shadow-sm">
                {/* 2. Tên tác phẩm */}
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#1E1B4B] leading-snug">
                  {artwork.title}
                </h1>

                {/* 3. Biệt danh nghệ sĩ và lớp */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF8EC] border border-[#FDE68A] text-xs font-extrabold text-[#1E1B4B]">
                    <span>🎨 {displayNickname}</span>
                  </span>
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold text-white"
                    style={{ backgroundColor: gradeTheme.badgeBg }}
                  >
                    {normalizedGradeLabel}
                  </span>
                </div>

                {/* 4. Chất liệu, chủ đề và ngày đăng ở dạng metadata ngắn */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-[#5B587B]">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-[#1E1B4B]">
                    <Palette className="w-3.5 h-3.5 text-[#EC4899]" />
                    <span>{artwork.materialsUsed || 'Chất liệu tổng hợp'}</span>
                  </span>

                  {(artwork.lessonTitle || artwork.topic) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-[#1E1B4B] max-w-full truncate">
                      <Tag className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                      <span className="truncate">{artwork.lessonTitle || artwork.topic}</span>
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 font-medium text-[#5B587B]">
                    <Calendar className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>{formattedDate}</span>
                  </span>
                </div>

                {/* Compact Owner / Teacher / Report actions */}
                <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                  {isTeacherOrModerator && onHideArtwork && (
                    <button
                      type="button"
                      onClick={() => onHideArtwork(artwork.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-bold cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Tạm ẩn</span>
                    </button>
                  )}

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => onToggleShare(artwork.id, artwork.shareStatus)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[#1E1B4B] bg-slate-100 hover:bg-slate-200 font-bold cursor-pointer"
                    >
                      {artwork.shareStatus === 'shared' ? (
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>{artwork.shareStatus === 'shared' ? 'Rút chia sẻ' : 'Mở chia sẻ'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleReport}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[#64748B] hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 font-semibold cursor-pointer ml-auto"
                  >
                    <Flag className="w-3 h-3" />
                    <span>Báo cáo</span>
                  </button>

                  {(isOwner || currentRole === 'admin' || currentRole === 'teacher') &&
                    (confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => onDeleteArtwork(artwork.id)}
                        className="px-3 py-1.5 rounded-full bg-rose-600 text-white font-bold cursor-pointer"
                      >
                        Xác nhận xóa
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="p-1.5 text-[#64748B] hover:text-rose-600 rounded-full bg-slate-50 border border-slate-200 cursor-pointer"
                        title="Xóa tác phẩm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ))}
                </div>
              </div>

              {/* 5. HỆ THỐNG 5 CẢM XÚC (❤️ Yêu thích, 👍 Thích, 😂 Vui, 😢 Buồn, 😡 Giận) */}
              <div
                aria-label="Thanh tương tác 5 cảm xúc"
                className="p-4 bg-white rounded-3xl border-2 border-[#E2D9F3] space-y-2.5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-display font-extrabold text-sm text-[#1E1B4B]">
                    Bày tỏ cảm xúc của bạn
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isUpdatingEmotion && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3457D5] bg-[#EEF2FF] px-2.5 py-0.5 rounded-full">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Đang lưu...</span>
                      </span>
                    )}
                    {!isUpdatingEmotion && reactionStatus === 'success' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        <Check className="w-3 h-3" />
                        <span>Đã đồng bộ</span>
                      </span>
                    )}
                    {userEmotion && (
                      <span className="text-[11px] font-bold text-[#7C3AED] bg-[#F3E8FF] px-2.5 py-0.5 rounded-full">
                        Đã chọn: {ARTWORK_EMOTIONS_META[userEmotion].emoji}{' '}
                        {ARTWORK_EMOTIONS_META[userEmotion].label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {ARTWORK_EMOTION_ORDER.map((emotionKey) => {
                    const meta = ARTWORK_EMOTIONS_META[emotionKey];
                    const count = emotionCounts[emotionKey] || 0;
                    const isSelected = userEmotion === emotionKey;
                    const isAnimating = animatingEmotion === emotionKey;

                    return (
                      <button
                        key={emotionKey}
                        type="button"
                        disabled={isUpdatingEmotion}
                        onClick={() => handleSelectEmotion(emotionKey)}
                        aria-pressed={isSelected}
                        title={`${meta.label} (${count})`}
                        style={
                          isSelected
                            ? {
                                backgroundColor: meta.activeBg,
                                borderColor: meta.activeBorder,
                                color: meta.activeText,
                              }
                            : undefined
                        }
                        className={`group flex flex-col items-center justify-center py-2.5 px-1.5 rounded-2xl border-2 transition-all cursor-pointer select-none disabled:opacity-65 disabled:cursor-wait ${
                          isSelected
                            ? 'shadow-sm scale-[1.03]'
                            : 'bg-[#FFFDF8] hover:bg-[#FFF8EC] border-[#EDE9FE] hover:border-[#C4B5FD] text-[#1E1B4B]'
                        } ${isAnimating ? 'scale-110' : 'active:scale-95'}`}
                      >
                        <span
                          className={`text-2xl sm:text-3xl leading-none transition-transform duration-200 ${
                            isSelected ? 'scale-110' : 'group-hover:scale-110'
                          }`}
                        >
                          {meta.emoji}
                        </span>
                        <span className="text-[11px] font-bold mt-1.5 truncate max-w-full">
                          {meta.label}
                        </span>
                        <span
                          className={`mt-0.5 px-2 py-0.2 rounded-full text-xs font-extrabold tabular-nums ${
                            isSelected
                              ? 'bg-white/90 shadow-2xs'
                              : 'text-[#5B587B]'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Error & Retry Banner when reaction fails */}
                {reactionStatus === 'error' && reactionErrorMessage && (
                  <div className="mt-2 p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-start gap-1.5 min-w-0 flex-1">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span className="font-semibold leading-snug">{reactionErrorMessage}</span>
                    </div>
                    {lastFailedEmotion && (
                      <button
                        type="button"
                        disabled={isUpdatingEmotion}
                        onClick={() => handleSelectEmotion(lastFailedEmotion)}
                        className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] inline-flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Thử lại</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 6. BÌNH LUẬN (Ngay dưới thanh cảm xúc, rút gọn 3 bình luận mới nhất + Xem tất cả) */}
              <ArtverseCommunityComments
                artwork={artwork}
                currentRole={currentRole}
                fallbackComments={comments}
                compactMode={true}
                onShowToast={onShowToast}
              />
            </div>
          </div>

          {/* 7. TÁC PHẨM LIÊN QUAN */}
          {relatedArtworks.length > 0 && onSelectArtwork && (
            <div className="pt-6 border-t-2 border-[#E2D9F3] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[#1E1B4B]">
                  Tác phẩm liên quan ({normalizedGradeLabel})
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {relatedArtworks.map((rel) => {
                  const relHasPhoto = Boolean(
                    rel.imageUrl &&
                      (rel.imageUrl.startsWith('data:image') || rel.imageUrl.startsWith('http'))
                  );
                  return (
                    <div
                      key={rel.id}
                      onClick={() => onSelectArtwork(rel)}
                      className="group cursor-pointer bg-white rounded-2xl border-2 border-[#E2D9F3] hover:border-[#8B5CF6] p-2.5 space-y-2 shadow-xs hover:shadow-md transition-all"
                    >
                      <div className="aspect-[4/3] rounded-xl bg-[#FFF8EC] p-2 flex items-center justify-center overflow-hidden">
                        {relHasPhoto ? (
                          <img
                            src={rel.imageUrl}
                            alt={rel.title}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <ArtCanvasVisual
                            type={rel.visualType || 'watercolor'}
                            title={rel.title}
                            className="w-full h-full rounded-lg"
                          />
                        )}
                      </div>
                      <div className="px-1">
                        <h4 className="font-display text-sm font-extrabold text-[#1E1B4B] truncate group-hover:text-[#7C3AED] transition-colors">
                          {rel.title}
                        </h4>
                        <p className="text-[11px] text-[#5B587B] font-semibold truncate">
                          {rel.authorAlias || rel.creatorAnonymousPseudonym}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

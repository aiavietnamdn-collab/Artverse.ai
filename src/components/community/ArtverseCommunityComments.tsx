import React, { useState, useEffect, useCallback } from 'react';
import { ArtworkComment, CommunityArtwork, UserRole } from '../../types/communityArt';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../lib/platform';
import {
  MessageSquare,
  Send,
  Reply,
  Flag,
  Edit3,
  Trash2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lock,
  CheckCircle2,
  X,
  RefreshCw,
} from 'lucide-react';

interface ArtverseCommunityCommentsProps {
  artwork: CommunityArtwork;
  currentRole: UserRole;
  fallbackComments?: ArtworkComment[];
  compactMode?: boolean;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

const REPORT_REASONS = [
  'Ngôn từ thiếu lịch sự hoặc công kích cá nhân',
  'Chứa thông tin cá nhân (Số điện thoại, địa chỉ, Zalo...)',
  'Bắt nạt, trêu chọc hoặc miệt thị tác phẩm',
  'Quảng cáo, spam hoặc liên kết lạ',
  'Nội dung không phù hợp với lứa tuổi học sinh',
];

const INITIAL_VISIBLE_COMMENTS = 3;

export const ArtverseCommunityComments: React.FC<ArtverseCommunityCommentsProps> = ({
  artwork,
  currentRole,
  fallbackComments = [],
  onShowToast,
}) => {
  const {
    profile,
    verifiedRole,
    getValidBearerToken,
    setIsStudentLoginModalOpen,
    loginWithGoogle,
  } = useAuth();

  const [comments, setComments] = useState<ArtworkComment[]>([]);
  const [totalPublished, setTotalPublished] = useState<number>(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [showAllComments, setShowAllComments] = useState<boolean>(false);

  // New comment & reply state
  const [commentInput, setCommentInput] = useState<string>('');
  const [replyToComment, setReplyToComment] = useState<ArtworkComment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastFeedbackBanner, setLastFeedbackBanner] = useState<{
    severity: 'SAFE' | 'REVIEW' | 'BLOCKED' | 'CRITICAL';
    message: string;
    commentId?: string;
    canAppeal?: boolean;
  } | null>(null);

  // Edit comment state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Report modal state
  const [reportingComment, setReportingComment] = useState<ArtworkComment | null>(null);
  const [selectedReportReason, setSelectedReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);

  // Appeal modal state
  const [appealingCommentId, setAppealingCommentId] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState<string>('');
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState<boolean>(false);

  const effectiveRole = verifiedRole !== 'viewer' ? verifiedRole : currentRole;
  const isLoggedIn = Boolean(profile?.uid && verifiedRole !== 'viewer');

  const fetchComments = useCallback(
    async (offset = 0, append = false) => {
      try {
        if (offset === 0) setLoading(true);
        else setLoadingMore(true);

        const token = await getValidBearerToken();
        const headers: Record<string, string> = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const url = getApiUrl(
          `/api/community/comments?artworkId=${encodeURIComponent(artwork.id)}&limit=20&offset=${offset}`
        );
        const res = await fetch(url, { headers });
        if (!res.ok) {
          throw new Error('Không thể tải danh sách bình luận.');
        }
        const data = await res.json();
        const serverItems: ArtworkComment[] = Array.isArray(data.items) ? data.items : [];

        // Merge with initial seed comments for this artwork if server has none yet
        const seedPublished = fallbackComments.filter(
          (c) =>
            c.artworkId === artwork.id &&
            (c.status === 'published' || c.status === 'approved') &&
            !serverItems.some((s) => s.id === c.id)
        );

        if (append) {
          setComments((prev) => {
            const existingIds = new Set(prev.map((item) => item.id));
            const uniqueNew = serverItems.filter((item) => !existingIds.has(item.id));
            return [...prev, ...uniqueNew];
          });
        } else {
          setComments([...serverItems, ...seedPublished]);
        }

        setTotalPublished((Number(data.totalPublished) || 0) + seedPublished.length);
        setHasMore(Boolean(data.hasMore));
        setNextOffset(typeof data.nextOffset === 'number' ? data.nextOffset : null);
      } catch {
        const seedPublished = fallbackComments.filter(
          (c) => c.artworkId === artwork.id && (c.status === 'published' || c.status === 'approved')
        );
        setComments(seedPublished);
        setTotalPublished(seedPublished.length);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [artwork.id, fallbackComments, getValidBearerToken]
  );

  useEffect(() => {
    setLastFeedbackBanner(null);
    setReplyToComment(null);
    setEditingCommentId(null);
    setShowAllComments(false);
    fetchComments(0, false);
  }, [artwork.id, fetchComments]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const trimmed = commentInput.trim();
    if (!trimmed) return;

    if (!isLoggedIn) {
      onShowToast(
        'info',
        'Yêu cầu đăng nhập',
        'Vui lòng đăng nhập tài khoản Học sinh hoặc Giáo viên để gửi bình luận.'
      );
      setIsStudentLoginModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    setLastFeedbackBanner(null);

    try {
      const token = await getValidBearerToken();
      if (!token) {
        setIsStudentLoginModalOpen(true);
        return;
      }

      const res = await fetch(getApiUrl('/api/community/comments'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          artworkId: artwork.id,
          artworkTitle: artwork.title,
          classId: artwork.classId || artwork.className || profile?.classGroupId || '',
          classCode: profile?.classCode || '',
          content: trimmed,
          replyToId: replyToComment?.id,
          replyToNickname:
            replyToComment?.authorNickname || replyToComment?.anonymousNickname || undefined,
        }),
      });

      const data = await res.json();
      const resolvedSeverity = data.moderation?.severity || data.moderationSeverity;
      const resolvedMessage = data.moderation?.message || data.userMessage || data.error;

      if (!res.ok) {
        if (resolvedSeverity === 'BLOCKED' || resolvedSeverity === 'CRITICAL') {
          setLastFeedbackBanner({
            severity: resolvedSeverity,
            message:
              resolvedMessage ||
              'Bình luận chưa phù hợp với quy tắc cộng đồng tích cực của ARTVERSE AI.',
            commentId: data.comment?.id,
            canAppeal: Boolean((data.moderation?.canAppeal ?? data.canAppeal) && data.comment?.id),
          });
          setCommentInput('');
          setReplyToComment(null);
          await fetchComments(0, false);
          return;
        }
        onShowToast('error', 'Không thể gửi bình luận', data.error || 'Vui lòng thử lại sau.');
        return;
      }

      setCommentInput('');
      setReplyToComment(null);

      if (resolvedSeverity === 'REVIEW' || data.comment?.status === 'pending') {
        setLastFeedbackBanner({
          severity: 'REVIEW',
          message:
            resolvedMessage ||
            'Bình luận của em đã được ghi nhận và đang chờ giáo viên xem xét trước khi hiển thị công khai.',
          commentId: data.comment?.id,
          canAppeal: true,
        });
        onShowToast(
          'info',
          'Đang chờ giáo viên xem xét',
          'Bình luận có một số từ ngữ cần giáo viên kiểm tra thêm trước khi hiển thị.'
        );
      } else {
        setLastFeedbackBanner({
          severity: 'SAFE',
          message:
            resolvedMessage ||
            'Bình luận tích cực của bạn đã được hiển thị ngay dưới tác phẩm!',
        });
        onShowToast('success', 'Đã đăng bình luận', 'Cảm ơn bạn đã chia sẻ cảm nhận nghệ thuật!');
      }

      await fetchComments(0, false);
    } catch (err: any) {
      onShowToast(
        'error',
        'Lỗi kết nối',
        err?.message || 'Không thể kết nối máy chủ kiểm duyệt bình luận.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    if (isSavingEdit || !editContent.trim()) return;
    setIsSavingEdit(true);
    try {
      const token = await getValidBearerToken();
      if (!token) return;

      const res = await fetch(getApiUrl(`/api/community/comments/${encodeURIComponent(commentId)}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        onShowToast('error', 'Không thể chỉnh sửa', data.error || 'Đã hết thời gian chỉnh sửa.');
        return;
      }
      setEditingCommentId(null);
      setEditContent('');
      onShowToast('success', 'Đã cập nhật bình luận', data.userMessage || 'Đã lưu thay đổi.');
      await fetchComments(0, false);
    } catch {
      onShowToast('error', 'Lỗi cập nhật', 'Không thể lưu chỉnh sửa bình luận.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const token = await getValidBearerToken();
      if (!token) return;

      const res = await fetch(getApiUrl(`/api/community/comments/${encodeURIComponent(commentId)}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        onShowToast('error', 'Không thể xóa bình luận', data.error || 'Thao tác bị từ chối.');
        return;
      }
      onShowToast('info', 'Đã xóa bình luận', 'Bình luận đã được gỡ khỏi tác phẩm.');
      await fetchComments(0, false);
    } catch {
      onShowToast('error', 'Lỗi kết nối', 'Không thể xóa bình luận lúc này.');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingComment || isSubmittingReport) return;

    setIsSubmittingReport(true);
    try {
      const token = await getValidBearerToken();
      if (!token) {
        setIsStudentLoginModalOpen(true);
        return;
      }

      const res = await fetch(
        getApiUrl(`/api/community/comments/${encodeURIComponent(reportingComment.id)}/report`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reasonLabel: selectedReportReason,
            reasonDetails: reportDetails.trim() || selectedReportReason,
            details: reportDetails.trim() || selectedReportReason,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        onShowToast('error', 'Không thể gửi báo cáo', data.error || 'Vui lòng thử lại sau.');
        return;
      }

      setReportingComment(null);
      setReportDetails('');
      onShowToast(
        'success',
        'Đã gửi báo cáo bảo mật',
        data.message || 'Danh tính của bạn được bảo mật tuyệt đối.'
      );
    } catch {
      onShowToast('error', 'Lỗi gửi báo cáo', 'Không thể gửi báo cáo lúc này.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealingCommentId || !appealReason.trim() || isSubmittingAppeal) return;

    setIsSubmittingAppeal(true);
    try {
      const token = await getValidBearerToken();
      if (!token) return;

      const res = await fetch(
        getApiUrl(`/api/community/comments/${encodeURIComponent(appealingCommentId)}/appeal`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            appealReason: appealReason.trim(),
            reason: appealReason.trim(),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        onShowToast('error', 'Không thể gửi yêu cầu', data.error || 'Vui lòng thử lại.');
        return;
      }

      setAppealingCommentId(null);
      setAppealReason('');
      onShowToast(
        'success',
        'Đã gửi yêu cầu xem xét lại',
        data.message || 'Giáo viên phụ trách lớp sẽ kiểm tra lại bình luận của em.'
      );
      await fetchComments(0, false);
    } catch {
      onShowToast('error', 'Lỗi kết nối', 'Không thể gửi yêu cầu xem xét lại.');
    } finally {
      setIsSubmittingAppeal(false);
    }
  };

  const getRoleBadge = (role?: string) => {
    if (role === 'admin') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
          Quản trị
        </span>
      );
    }
    if (role === 'teacher') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
          Giáo viên
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
        Học sinh
      </span>
    );
  };

  // Organize top-level comments and replies
  const topLevelComments = comments.filter((c) => !c.replyToId);
  const repliesByParent = comments.reduce<Record<string, ArtworkComment[]>>((acc, c) => {
    if (c.replyToId) {
      if (!acc[c.replyToId]) acc[c.replyToId] = [];
      acc[c.replyToId].push(c);
    }
    return acc;
  }, {});

  // Display only the 3 newest top-level comments initially unless expanded
  const visibleTopLevelComments = showAllComments
    ? topLevelComments
    : topLevelComments.slice(0, INITIAL_VISIBLE_COMMENTS);
  const hiddenCommentCount = Math.max(0, topLevelComments.length - INITIAL_VISIBLE_COMMENTS);

  const formatTimestamp = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleExpandAllComments = () => {
    setShowAllComments(true);
    if (hasMore && nextOffset !== null) {
      fetchComments(nextOffset, true);
    }
  };

  return (
    <section
      aria-label="Bình luận tác phẩm"
      className="rounded-3xl bg-white border-2 border-[#E2D9F3] p-4 sm:p-5 space-y-4 shadow-sm"
    >
      {/* Compact Header: Title "Bình luận" + Total Count */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#F3E8FF] text-[#7C3AED] flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h3 className="font-display text-lg sm:text-xl font-extrabold text-[#1E1B4B]">
            Bình luận
          </h3>
          <span className="px-2.5 py-0.5 rounded-full bg-[#FFF8EC] border border-[#FDE68A] text-xs font-extrabold text-[#B45309]">
            {totalPublished}
          </span>
        </div>

        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5B587B] bg-[#F8FAFC] px-2.5 py-1 rounded-full border border-slate-200">
          <ShieldCheck className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
          <span className="hidden sm:inline">An toàn cho học sinh</span>
        </div>
      </div>

      {/* Moderation Feedback Banner after posting */}
      {lastFeedbackBanner && (
        <div
          className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
            lastFeedbackBanner.severity === 'SAFE'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : lastFeedbackBanner.severity === 'REVIEW'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-2">
            {lastFeedbackBanner.severity === 'SAFE' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : lastFeedbackBanner.severity === 'REVIEW' ? (
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <div className="font-bold">
                {lastFeedbackBanner.severity === 'SAFE'
                  ? 'Bình luận an toàn — Đã hiển thị ngay'
                  : lastFeedbackBanner.severity === 'REVIEW'
                    ? 'Đang chờ giáo viên xem xét'
                    : 'Bình luận chưa được đăng'}
              </div>
              <p className="leading-relaxed opacity-90">{lastFeedbackBanner.message}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {lastFeedbackBanner.canAppeal && lastFeedbackBanner.commentId && (
              <button
                type="button"
                onClick={() => {
                  setAppealingCommentId(lastFeedbackBanner.commentId || null);
                  setAppealReason(
                    'Em chỉ muốn góp ý xây dựng về bố cục/màu sắc của bức tranh, mong thầy cô xem xét lại giúp em ạ.'
                  );
                }}
                className="px-3 py-1 rounded-full bg-[#FFD93D] hover:bg-[#FBBF24] text-[#1E1B4B] font-extrabold text-[11px] cursor-pointer"
              >
                Yêu cầu xem xét lại
              </button>
            )}
            <button
              type="button"
              onClick={() => setLastFeedbackBanner(null)}
              className="p-1 text-slate-500 hover:text-slate-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Compact Comment Input Box or Login Prompt */}
      {isLoggedIn ? (
        <form onSubmit={handleSubmitComment} className="space-y-2.5">
          {replyToComment && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3E8FF] border border-[#D8B4FE] text-[11px] font-bold text-[#6D28D9]">
              <Reply className="w-3 h-3" />
              <span>
                Đang trả lời{' '}
                <strong>
                  {replyToComment.authorNickname || replyToComment.anonymousNickname}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setReplyToComment(null)}
                className="hover:text-[#1E1B4B] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-start gap-2">
            <textarea
              rows={2}
              maxLength={400}
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder={
                replyToComment
                  ? `Viết phản hồi gửi tới ${replyToComment.authorNickname || replyToComment.anonymousNickname}...`
                  : 'Viết cảm nhận hoặc lời khen dành cho tác phẩm...'
              }
              className="flex-1 px-3.5 py-2.5 rounded-2xl bg-[#FFFDF8] border-2 border-[#E2D9F3] focus:border-[#8B5CF6] text-xs sm:text-sm text-[#1E1B4B] placeholder-[#64748B] focus:outline-none resize-none"
            />
            <button
              type="submit"
              disabled={isSubmitting || !commentInput.trim()}
              className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-45 shrink-0 shadow-xs transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Đang gửi...' : 'Gửi'}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="p-3.5 rounded-2xl bg-[#FFF8EC] border border-[#FDE68A] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs text-[#1E1B4B]">
            <Lock className="w-4 h-4 text-[#F59E0B] shrink-0" />
            <span className="font-semibold">Đăng nhập để gửi bình luận khích lệ tác giả</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsStudentLoginModalOpen(true)}
              className="px-3 py-1.5 rounded-full bg-[#FFD93D] hover:bg-[#FBBF24] text-[#1E1B4B] font-extrabold text-[11px] cursor-pointer"
            >
              Học sinh (PIN)
            </button>
            <button
              type="button"
              onClick={() => loginWithGoogle()}
              className="px-3 py-1.5 rounded-full bg-white hover:bg-slate-50 text-[#1E1B4B] border border-slate-300 font-bold text-[11px] cursor-pointer"
            >
              Giáo viên
            </button>
          </div>
        </div>
      )}

      {/* Compact Comments List (3 newest shown initially) */}
      {loading ? (
        <div className="py-4 text-center text-xs text-[#5B587B] flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#8B5CF6]" />
          <span>Đang tải bình luận...</span>
        </div>
      ) : topLevelComments.length === 0 ? (
        <div className="py-4 px-3 rounded-2xl bg-[#FFFDF8] border border-dashed border-[#E2D9F3] text-center">
          <p className="text-xs text-[#5B587B] font-medium">
            Chưa có bình luận nào. Hãy là người đầu tiên gửi lời khích lệ cho bức tranh nhé!
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleTopLevelComments.map((cmt) => {
            const isOwn = Boolean(profile?.uid && cmt.authorUid === profile.uid);
            const isPending = cmt.status === 'pending';
            const isRejected = cmt.status === 'rejected';
            const childReplies = repliesByParent[cmt.id] || [];

            return (
              <div
                key={cmt.id}
                className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                  isPending
                    ? 'bg-amber-50/70 border-amber-300'
                    : isRejected
                      ? 'bg-rose-50/70 border-rose-300'
                      : 'bg-[#FFFDF8] border-[#EDE9FE] hover:border-[#C4B5FD]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-extrabold text-xs sm:text-sm text-[#1E1B4B]">
                      {cmt.authorNickname || cmt.anonymousNickname || 'Nghệ sĩ Nhí'}
                    </span>
                    {getRoleBadge(cmt.authorRole)}
                    <span className="text-[11px] text-[#64748B]">
                      {formatTimestamp(cmt.createdAt)}
                    </span>
                    {cmt.isEdited && (
                      <span className="text-[10px] italic text-[#64748B]">(đã sửa)</span>
                    )}
                  </div>

                  {/* Status Pill if Own Pending/Rejected */}
                  {(isPending || isRejected) && (
                    <div className="flex items-center gap-1">
                      {isPending && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Chờ duyệt</span>
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Chưa hiển thị</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Comment Content or Inline Editor */}
                {editingCommentId === cmt.id ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      rows={2}
                      maxLength={400}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white border-2 border-[#8B5CF6] text-xs text-[#1E1B4B]"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingCommentId(null)}
                        className="px-3 py-1 rounded-full text-xs text-[#64748B] hover:text-[#1E1B4B]"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={isSavingEdit}
                        onClick={() => handleSaveEdit(cmt.id)}
                        className="px-3.5 py-1 rounded-full bg-[#8B5CF6] text-white font-bold text-xs cursor-pointer"
                      >
                        {isSavingEdit ? 'Đang lưu...' : 'Lưu'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-[#1E1B4B] leading-relaxed whitespace-pre-line">
                    {cmt.content}
                  </p>
                )}

                {/* Appeal Notice if Pending or Rejected */}
                {isOwn && (isPending || isRejected) && (
                  <div className="pt-1.5 flex flex-wrap items-center justify-between gap-2 border-t border-amber-200/70 text-[11px]">
                    <span className="text-[#5B587B]">
                      {cmt.appeal?.status === 'open' || cmt.appeal?.status === 'pending'
                        ? 'Đã gửi yêu cầu xem xét lại tới giáo viên.'
                        : cmt.userFacingHint ||
                          'Nếu em thấy đây là nhận xét tích cực, em có thể gửi yêu cầu xem xét lại.'}
                    </span>
                    {cmt.appeal?.status !== 'open' && cmt.appeal?.status !== 'pending' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAppealingCommentId(cmt.id);
                          setAppealReason(
                            'Em góp ý xây dựng về kỹ thuật vẽ và màu sắc, mong thầy cô duyệt hiển thị giúp em ạ.'
                          );
                        }}
                        className="px-2.5 py-1 rounded-full bg-[#FFD93D] text-[#1E1B4B] font-bold text-[10px] cursor-pointer"
                      >
                        Yêu cầu xem xét lại
                      </button>
                    )}
                  </div>
                )}

                {/* Compact Action Bar: Reply, Edit, Delete, Report */}
                <div className="flex items-center gap-3 text-[11px] text-[#64748B]">
                  {isLoggedIn && cmt.status === 'published' && (
                    <button
                      type="button"
                      onClick={() => setReplyToComment(cmt)}
                      className="inline-flex items-center gap-1 hover:text-[#7C3AED] font-bold cursor-pointer"
                    >
                      <Reply className="w-3 h-3" />
                      <span>Trả lời</span>
                    </button>
                  )}

                  {isOwn && editingCommentId !== cmt.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCommentId(cmt.id);
                        setEditContent(cmt.content);
                      }}
                      className="inline-flex items-center gap-1 hover:text-[#1E1B4B] font-semibold cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Sửa</span>
                    </button>
                  )}

                  {(isOwn || effectiveRole === 'admin' || effectiveRole === 'teacher') && (
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(cmt.id)}
                      className="inline-flex items-center gap-1 hover:text-rose-600 font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Xóa</span>
                    </button>
                  )}

                  {!isOwn && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isLoggedIn) {
                          setIsStudentLoginModalOpen(true);
                          return;
                        }
                        setReportingComment(cmt);
                      }}
                      className="inline-flex items-center gap-1 hover:text-rose-600 ml-auto cursor-pointer"
                    >
                      <Flag className="w-3 h-3" />
                      <span>Báo cáo vi phạm</span>
                    </button>
                  )}
                </div>

                {/* Threaded Replies */}
                {childReplies.length > 0 && (
                  <div className="pl-3 sm:pl-4 mt-2 border-l-2 border-[#DDD6FE] space-y-2">
                    {childReplies.map((reply) => {
                      const isReplyOwn = Boolean(profile?.uid && reply.authorUid === profile.uid);
                      return (
                        <div
                          key={reply.id}
                          className="p-2.5 rounded-xl bg-white border border-[#EDE9FE] space-y-1"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-[#1E1B4B]">
                                {reply.authorNickname || reply.anonymousNickname || 'Nghệ sĩ Nhí'}
                              </span>
                              {getRoleBadge(reply.authorRole)}
                              <span className="text-[10px] text-[#64748B]">
                                {formatTimestamp(reply.createdAt)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-[#64748B]">
                              {(isReplyOwn ||
                                effectiveRole === 'admin' ||
                                effectiveRole === 'teacher') && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(reply.id)}
                                  className="hover:text-rose-600 cursor-pointer"
                                >
                                  Xóa
                                </button>
                              )}
                              {!isReplyOwn && (
                                <button
                                  type="button"
                                  onClick={() => setReportingComment(reply)}
                                  className="hover:text-rose-600 cursor-pointer"
                                >
                                  Báo cáo
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-[#1E1B4B] leading-relaxed">
                            {reply.replyToNickname && (
                              <span className="text-[#7C3AED] font-bold mr-1">
                                @{reply.replyToNickname}
                              </span>
                            )}
                            {reply.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Expand / Collapse all comments button ("Xem tất cả bình luận") */}
          {(hiddenCommentCount > 0 || (hasMore && nextOffset !== null)) && !showAllComments && (
            <button
              type="button"
              onClick={handleExpandAllComments}
              className="w-full py-2.5 px-4 rounded-2xl bg-[#F3E8FF] hover:bg-[#E9D5FF] text-[#6D28D9] font-extrabold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
              <span>
                Xem tất cả bình luận ({Math.max(totalPublished, topLevelComments.length)})
              </span>
            </button>
          )}

          {showAllComments && topLevelComments.length > INITIAL_VISIBLE_COMMENTS && (
            <div className="flex items-center justify-between gap-2 pt-1">
              {hasMore && nextOffset !== null ? (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => fetchComments(nextOffset, true)}
                  className="px-4 py-2 rounded-full bg-[#F3E8FF] hover:bg-[#E9D5FF] text-[#6D28D9] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>{loadingMore ? 'Đang tải thêm...' : 'Tải thêm bình luận'}</span>
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => setShowAllComments(false)}
                className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#5B587B] text-xs font-bold inline-flex items-center gap-1 cursor-pointer ml-auto"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Thu gọn</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confidential Report Comment Modal */}
      {reportingComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1B4B]/60 backdrop-blur-xs">
          <div className="bg-white border-2 border-[#E2D9F3] rounded-3xl max-w-md w-full p-6 space-y-4 text-[#1E1B4B] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-extrabold text-sm">
                <Flag className="w-4 h-4" />
                <span>Báo cáo bình luận vi phạm</span>
              </div>
              <button
                type="button"
                onClick={() => setReportingComment(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#FFF8EC] border border-[#FDE68A] text-[#5B587B]">
                Bình luận của{' '}
                <strong className="text-[#1E1B4B]">
                  {reportingComment.authorNickname || reportingComment.anonymousNickname}
                </strong>
                : “{reportingComment.content}”
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-[#1E1B4B]">Lý do báo cáo:</label>
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      checked={selectedReportReason === reason}
                      onChange={() => setSelectedReportReason(reason)}
                      className="accent-[#8B5CF6]"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              <div>
                <label className="block font-bold text-[#1E1B4B] mb-1">
                  Ghi chú thêm cho thầy cô (không bắt buộc):
                </label>
                <textarea
                  rows={2}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Mô tả thêm để giáo viên kiểm tra nhanh hơn..."
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-[#1E1B4B]"
                />
              </div>

              <p className="text-[11px] text-emerald-700 font-semibold">
                ✓ Danh tính của người báo cáo được bảo mật tuyệt đối.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportingComment(null)}
                  className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                >
                  {isSubmittingReport ? 'Đang gửi...' : 'Gửi báo cáo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Appeal Modal */}
      {appealingCommentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1B4B]/60 backdrop-blur-xs">
          <div className="bg-white border-2 border-[#E2D9F3] rounded-3xl max-w-md w-full p-6 space-y-4 text-[#1E1B4B] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="font-extrabold text-sm text-[#7C3AED]">
                Yêu cầu giáo viên xem xét lại bình luận
              </h4>
              <button
                type="button"
                onClick={() => setAppealingCommentId(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAppeal} className="space-y-4 text-xs">
              <p className="text-[#5B587B] leading-relaxed">
                Đôi khi hệ thống tự động có thể hiểu nhầm các thuật ngữ nhận xét mỹ thuật (như mảng tối, phối cảnh, nét đậm...). Em hãy ghi ngắn gọn ý của mình để thầy cô mở hiển thị nhé!
              </p>

              <textarea
                required
                rows={3}
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-[#1E1B4B]"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAppealingCommentId(null)}
                  className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-bold"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAppeal}
                  className="px-5 py-2 rounded-full bg-[#8B5CF6] text-white font-extrabold cursor-pointer"
                >
                  {isSubmittingAppeal ? 'Đang gửi...' : 'Gửi tới giáo viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

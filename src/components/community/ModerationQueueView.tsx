import React, { useState, useEffect, useCallback } from 'react';
import {
  CommunityArtwork,
  ArtworkComment,
  ContentReport,
  UserRole,
} from '../../types/communityArt';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../lib/platform';
import {
  ShieldAlert,
  Check,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  Trash2,
  MessageSquare,
  AlertOctagon,
  Clock,
  UserX,
  CheckCircle2,
  RotateCcw,
  Filter,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Sliders,
  FileText,
  Plus,
} from 'lucide-react';

interface ModerationQueueViewProps {
  artworks: CommunityArtwork[];
  comments: ArtworkComment[];
  reports: ContentReport[];
  currentRole: UserRole;
  currentModeratorName: string;
  onApproveArtwork: (artworkId: string, moderatorNote?: string) => void;
  onRejectArtwork: (artworkId: string, reason: string) => void;
  onHideArtwork: (artworkId: string) => void;
  onRemoveArtwork: (artworkId: string) => void;
  onApproveComment: (commentId: string) => void;
  onRejectComment: (commentId: string) => void;
  onResolveReport: (reportId: string, actionNote: string) => void;
  onUpdateReportStatus: (reportId: string, status: 'open' | 'reviewing' | 'resolved') => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

interface ModerationOverviewStats {
  totalComments: number;
  publishedCount: number;
  pendingCount: number;
  hiddenOrRejectedCount: number;
  criticalCount: number;
  appealedCount: number;
  openReportsCount: number;
  avgResolutionMinutes: number;
}

interface ModerationConfigState {
  customBlockedKeywords: string[];
  customReviewKeywords: string[];
  editWindowMinutes: number;
  aiOfflineSimulation?: boolean;
}

export const ModerationQueueView: React.FC<ModerationQueueViewProps> = ({
  artworks,
  comments: localComments,
  reports: localReports,
  currentRole,
  currentModeratorName,
  onApproveArtwork,
  onRejectArtwork,
  onHideArtwork,
  onRemoveArtwork,
  onApproveComment,
  onRejectComment,
  onResolveReport,
  onUpdateReportStatus,
  onShowToast,
}) => {
  const { verifiedRole, getValidBearerToken } = useAuth();
  const effectiveRole = verifiedRole !== 'viewer' ? verifiedRole : currentRole;
  const isAdmin = effectiveRole === 'admin';
  const canModerate =
    effectiveRole === 'teacher' || effectiveRole === 'moderator' || effectiveRole === 'admin';

  const [activeQueueTab, setActiveQueueTab] = useState<
    'comments' | 'artworks' | 'reports' | 'keywords' | 'audit'
  >('comments');

  // Backend Community Moderation State
  const [loadingBackend, setLoadingBackend] = useState<boolean>(false);
  const [stats, setStats] = useState<ModerationOverviewStats>({
    totalComments: 0,
    publishedCount: 0,
    pendingCount: 0,
    hiddenOrRejectedCount: 0,
    criticalCount: 0,
    appealedCount: 0,
    openReportsCount: 0,
    avgResolutionMinutes: 0,
  });
  const [serverComments, setServerComments] = useState<ArtworkComment[]>([]);
  const [serverReports, setServerReports] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [moderationConfig, setModerationConfig] = useState<ModerationConfigState>({
    customBlockedKeywords: [],
    customReviewKeywords: [],
    editWindowMinutes: 15,
    aiOfflineSimulation: false,
  });
  const [mutedUsers, setMutedUsers] = useState<Record<string, any>>({});

  // Filters for Comment Queue
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Action Note / Reason Modal State
  const [actionNoteInput, setActionNoteInput] = useState<Record<string, string>>({});

  // Artwork Rejection Modal State
  const [rejectingArtworkId, setRejectingArtworkId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Report Resolution Modal State
  const [resolvingReportId, setResolvingReportId] = useState<string | null>(null);
  const [resolvingReportIsServer, setResolvingReportIsServer] = useState<boolean>(false);
  const [resolutionActionInput, setResolutionActionInput] = useState(
    'Đã kiểm tra và xử lý nội dung theo quy chuẩn an toàn học đường.'
  );

  // Admin Keyword Management Inputs
  const [newBlockedKeyword, setNewBlockedKeyword] = useState('');
  const [newReviewKeyword, setNewReviewKeyword] = useState('');

  // Admin Temporary Mute Modal
  const [mutingUserTarget, setMutingUserTarget] = useState<{
    uid: string;
    nickname: string;
  } | null>(null);
  const [muteDurationHours, setMuteDurationHours] = useState<number>(24);
  const [muteReason, setMuteReason] = useState<string>(
    'Vi phạm nhiều lần quy tắc bình luận tích cực của bảo tàng.'
  );

  const fetchModerationOverview = useCallback(async () => {
    if (!canModerate) return;
    setLoadingBackend(true);
    try {
      const token = await getValidBearerToken();
      if (!token) return;

      const res = await fetch(getApiUrl('/api/community/moderation/overview'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.summary) {
        setStats({
          totalComments: data.summary.totalComments || 0,
          publishedCount: data.summary.publishedCount || 0,
          pendingCount: data.summary.pendingCount || 0,
          hiddenOrRejectedCount:
            (data.summary.hiddenCount || 0) +
            (data.summary.rejectedCount || 0) +
            (data.summary.deletedCount || 0),
          criticalCount: data.summary.criticalAlertCount || 0,
          appealedCount: data.summary.openAppealCount || 0,
          openReportsCount: data.summary.openReportCount || 0,
          avgResolutionMinutes: data.summary.avgResolutionMinutes || 0,
        });
      } else if (data.stats) {
        setStats(data.stats);
      }
      if (Array.isArray(data.comments)) setServerComments(data.comments);
      if (Array.isArray(data.reports)) setServerReports(data.reports);
      if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
      else if (Array.isArray(data.recentAuditLogs)) setAuditLogs(data.recentAuditLogs);
      if (data.moderationConfig) {
        setModerationConfig({
          customBlockedKeywords:
            data.moderationConfig.blockedKeywords ||
            data.moderationConfig.customBlockedKeywords ||
            [],
          customReviewKeywords:
            data.moderationConfig.reviewKeywords ||
            data.moderationConfig.customReviewKeywords ||
            [],
          editWindowMinutes: data.moderationConfig.editWindowMinutes || 15,
          aiOfflineSimulation: Boolean(data.moderationConfig.aiModerationOfflineSimulated),
        });
      }
      if (Array.isArray(data.mutedUsers)) {
        const map: Record<string, any> = {};
        for (const u of data.mutedUsers) {
          if (u?.uid) map[u.uid] = u;
        }
        setMutedUsers(map);
      } else if (data.mutedUsers) {
        setMutedUsers(data.mutedUsers);
      }
    } catch {
      // Keep fallback local state if offline
    } finally {
      setLoadingBackend(false);
    }
  }, [canModerate, getValidBearerToken]);

  useEffect(() => {
    fetchModerationOverview();
  }, [fetchModerationOverview]);

  if (!canModerate) {
    return (
      <div className="p-12 text-center bg-[#131314] rounded-3xl border border-[#F4F0EA]/12 shadow-xl space-y-3 text-[#F4F0EA]">
        <ShieldAlert className="w-12 h-12 text-[#E2B86B] mx-auto" />
        <h3 className="font-editorial-display text-2xl font-normal">
          Khu vực Giám tuyển &amp; Kiểm duyệt Cộng đồng
        </h3>
        <p className="text-xs text-[#A39E95] max-w-md mx-auto">
          Chỉ tài khoản Giáo viên và Quản trị viên mới có quyền truy cập Trung tâm Kiểm duyệt An toàn Học đường.
        </p>
      </div>
    );
  }

  const handleCommentAction = async (
    commentId: string,
    action:
      | 'approve'
      | 'hide'
      | 'reject'
      | 'soft_delete'
      | 'restore'
      | 'approve_appeal'
      | 'reject_appeal'
      | 'assign'
      | 'note'
  ) => {
    try {
      const token = await getValidBearerToken();
      if (!token) {
        if (action === 'approve') onApproveComment(commentId);
        if (action === 'reject' || action === 'soft_delete') onRejectComment(commentId);
        return;
      }

      const reason =
        actionNoteInput[commentId]?.trim() ||
        (action === 'approve'
          ? 'Giáo viên xác nhận bình luận tích cực, phù hợp hiển thị.'
          : action === 'restore'
            ? 'Khôi phục hiển thị bình luận sau khi kiểm tra lại.'
            : action === 'approve_appeal'
              ? 'Chấp nhận kiến nghị của học sinh và mở hiển thị công khai.'
              : 'Xử lý theo tiêu chuẩn an toàn cộng đồng ARTVERSE.');

      const res = await fetch(
        getApiUrl(`/api/community/moderation/comments/${encodeURIComponent(commentId)}/action`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action,
            reason,
            note: actionNoteInput[commentId]?.trim() || '',
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        onShowToast('error', 'Không thể thực hiện', data.error || 'Thao tác bị từ chối.');
        return;
      }

      onShowToast('success', 'Đã cập nhật trạng thái bình luận', `Thao tác "${action}" thành công.`);
      await fetchModerationOverview();
    } catch {
      onShowToast('error', 'Lỗi kết nối', 'Không thể kết nối máy chủ kiểm duyệt.');
    }
  };

  const handleSaveKeywordsConfig = async (updatedConfig: Partial<ModerationConfigState>) => {
    if (!isAdmin) return;
    try {
      const token = await getValidBearerToken();
      if (!token) return;

      const payload = {
        blockedKeywords:
          updatedConfig.customBlockedKeywords ?? moderationConfig.customBlockedKeywords,
        reviewKeywords:
          updatedConfig.customReviewKeywords ?? moderationConfig.customReviewKeywords,
        editWindowMinutes:
          updatedConfig.editWindowMinutes ?? moderationConfig.editWindowMinutes,
        aiModerationOfflineSimulated:
          updatedConfig.aiOfflineSimulation ?? moderationConfig.aiOfflineSimulation,
      };

      const res = await fetch(getApiUrl('/api/community/moderation/keywords'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        onShowToast('error', 'Lỗi lưu cấu hình', data.error || 'Chỉ Admin được phép cập nhật.');
        return;
      }
      if (data.moderationConfig) {
        setModerationConfig({
          customBlockedKeywords: data.moderationConfig.blockedKeywords || [],
          customReviewKeywords: data.moderationConfig.reviewKeywords || [],
          editWindowMinutes: data.moderationConfig.editWindowMinutes || 15,
          aiOfflineSimulation: Boolean(data.moderationConfig.aiModerationOfflineSimulated),
        });
      }
      onShowToast('success', 'Đã lưu cấu hình từ khóa', 'Bộ lọc 4 lớp đã được cập nhật tức thì.');
    } catch {
      onShowToast('error', 'Lỗi kết nối', 'Không thể lưu cấu hình từ khóa.');
    }
  };

  const handleConfirmMuteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mutingUserTarget || !isAdmin) return;
    try {
      const token = await getValidBearerToken();
      if (!token) return;

      const res = await fetch(getApiUrl('/api/community/moderation/mute-user'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUid: mutingUserTarget.uid,
          nickname: mutingUserTarget.nickname,
          durationMinutes: muteDurationHours * 60,
          reason: muteReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onShowToast('error', 'Không thể khóa bình luận', data.error || 'Thao tác thất bại.');
        return;
      }
      setMutingUserTarget(null);
      onShowToast(
        'info',
        'Đã tạm khóa quyền bình luận',
        `Đã tạm khóa quyền bình luận của ${mutingUserTarget.nickname} trong ${muteDurationHours} giờ.`
      );
      await fetchModerationOverview();
    } catch {
      onShowToast('error', 'Lỗi kết nối', 'Không thể thực hiện thao tác.');
    }
  };

  const handleUnmuteUser = async (targetUid: string) => {
    if (!isAdmin) return;
    try {
      const token = await getValidBearerToken();
      if (!token) return;
      await fetch(getApiUrl('/api/community/moderation/mute-user'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUid, durationMinutes: 0 }),
      });
      onShowToast('success', 'Đã mở lại quyền bình luận', 'Tài khoản có thể bình luận bình thường.');
      await fetchModerationOverview();
    } catch {
      onShowToast('error', 'Lỗi kết nối', 'Không thể mở khóa.');
    }
  };

  const handleConfirmRejectArtwork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingArtworkId || !rejectionReasonInput.trim()) return;
    onRejectArtwork(rejectingArtworkId, rejectionReasonInput.trim());
    setRejectingArtworkId(null);
    setRejectionReasonInput('');
    onShowToast(
      'info',
      'Đã từ chối tác phẩm',
      'Đã chuyển tác phẩm sang trạng thái từ chối kèm lý do phản hồi cho tác giả.'
    );
  };

  const handleConfirmResolveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingReportId) return;

    if (resolvingReportIsServer) {
      try {
        const token = await getValidBearerToken();
        if (token) {
          const res = await fetch(
            getApiUrl(
              `/api/community/moderation/reports/${encodeURIComponent(resolvingReportId)}/resolve`
            ),
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                status: 'resolved',
                resolutionAction: resolutionActionInput,
              }),
            }
          );
          if (res.ok) {
            setResolvingReportId(null);
            onShowToast('success', 'Đã xử lý báo cáo', 'Báo cáo vi phạm đã được giải quyết hoàn tất.');
            await fetchModerationOverview();
            return;
          }
        }
      } catch {
        // Fallback below
      }
    }

    onResolveReport(resolvingReportId, resolutionActionInput);
    setResolvingReportId(null);
    onShowToast('success', 'Đã xử lý xong báo cáo', 'Báo cáo vi phạm đã được đánh dấu hoàn tất.');
  };

  const pendingArtworks = artworks.filter((a) => a.status === 'pending');
  const allNonDraftArtworks = artworks.filter((a) => a.status !== 'draft');

  // Combine server comments and local comments
  const mergedComments: ArtworkComment[] = [
    ...serverComments,
    ...localComments.filter((lc) => !serverComments.some((sc) => sc.id === lc.id)),
  ];

  const filteredComments = mergedComments.filter((c) => {
    const resolvedSev = c.severity || c.moderationSeverity || 'SAFE';
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (severityFilter !== 'all' && resolvedSev !== severityFilter) return false;
    return true;
  });

  const mergedReports = [
    ...serverReports,
    ...localReports.filter((lr) => !serverReports.some((sr) => sr.id === lr.id)),
  ];

  const getSeverityBadge = (severity?: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white uppercase tracking-wider">
            CRITICAL · Cảnh báo khẩn
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wider">
            BLOCKED · Đã chặn
          </span>
        );
      case 'REVIEW':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E2B86B]/20 text-[#E2B86B] border border-[#E2B86B]/40 uppercase tracking-wider">
            REVIEW · Chờ giáo viên duyệt
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#8FA382]/20 text-[#8FA382] border border-[#8FA382]/40 uppercase tracking-wider">
            SAFE · An toàn
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 text-[#F4F0EA]">
      {/* Top Curatorial Header */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#131314] border border-[#F4F0EA]/12 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.26em] text-[#F3C1C6]">
            <ShieldCheck className="w-4 h-4 text-[#8FA382]" />
            <span>COMMUNITY MODERATION CENTER · TRUNG TÂM KIỂM DUYỆT AN TOÀN HỌC ĐƯỜNG</span>
          </div>
          <h2 className="font-editorial-display text-3xl sm:text-4xl font-normal text-[#F4F0EA]">
            Giám tuyển &amp; <span className="italic text-[#F3C1C6]">Bảo vệ Học sinh</span>
          </h2>
          <p className="text-xs text-[#A39E95] max-w-2xl leading-relaxed">
            Cơ chế vận hành chính thức:{' '}
            <strong className="text-[#F4F0EA]">
              TỰ ĐỘNG KIỂM DUYỆT — AN TOÀN HIỂN THỊ NGAY — RỦI RO CHỜ DUYỆT
            </strong>
            . Giáo viên xử lý bình luận thuộc phạm vi lớp phụ trách; Quản trị viên giám sát toàn trường.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2.5 rounded-2xl bg-[#0B0B0C] border border-[#F4F0EA]/12 text-xs">
            Người phụ trách:{' '}
            <strong className="text-[#F3C1C6]">{currentModeratorName}</strong> (
            {effectiveRole === 'admin' ? 'Quản trị viên toàn trường' : 'Giáo viên phụ trách lớp'})
          </div>
          <button
            type="button"
            onClick={fetchModerationOverview}
            className="px-4 py-2.5 rounded-full bg-[#1C1C1E] hover:bg-[#F3C1C6] hover:text-[#0B0B0C] text-[#F4F0EA] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingBackend ? 'animate-spin' : ''}`} />
            <span>Làm mới dữ liệu</span>
          </button>
        </div>
      </div>

      {/* A. OVERVIEW METRICS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-4 rounded-2xl bg-[#131314] border border-[#F4F0EA]/10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#A39E95] block">
            Tổng bình luận
          </span>
          <span className="font-editorial-display text-2xl text-[#F4F0EA] mt-1 block">
            {stats.totalComments || mergedComments.length}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-[#131314] border border-[#8FA382]/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8FA382] block">
            Đã hiển thị (SAFE)
          </span>
          <span className="font-editorial-display text-2xl text-[#8FA382] mt-1 block">
            {stats.publishedCount}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-[#131314] border border-[#E2B86B]/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#E2B86B] block">
            Chờ duyệt (REVIEW)
          </span>
          <span className="font-editorial-display text-2xl text-[#E2B86B] mt-1 block">
            {stats.pendingCount}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-[#131314] border border-rose-500/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 block">
            Đã ẩn / Từ chối
          </span>
          <span className="font-editorial-display text-2xl text-rose-300 mt-1 block">
            {stats.hiddenOrRejectedCount}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
            Cảnh báo CRITICAL
          </span>
          <span className="font-editorial-display text-2xl text-rose-400 mt-1 block">
            {stats.criticalCount}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-[#131314] border border-[#F3C1C6]/35">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#F3C1C6] block">
            Kiến nghị xem lại
          </span>
          <span className="font-editorial-display text-2xl text-[#F3C1C6] mt-1 block">
            {stats.appealedCount}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-[#131314] border border-[#F4F0EA]/10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#A39E95] block">
            Tốc độ xử lý TB
          </span>
          <span className="font-editorial-display text-2xl text-[#F4F0EA] mt-1 block">
            {stats.avgResolutionMinutes} phút
          </span>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveQueueTab('comments')}
          className={`px-5 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all border shrink-0 flex items-center gap-2 cursor-pointer ${
            activeQueueTab === 'comments'
              ? 'bg-[#F3C1C6] text-[#0B0B0C] border-[#F3C1C6]'
              : 'bg-[#131314] text-[#F4F0EA] border-[#F4F0EA]/15 hover:border-[#F3C1C6]/40'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Hàng đợi Bình luận</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#0B0B0C]/20">
            {mergedComments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveQueueTab('reports')}
          className={`px-5 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all border shrink-0 flex items-center gap-2 cursor-pointer ${
            activeQueueTab === 'reports'
              ? 'bg-[#F3C1C6] text-[#0B0B0C] border-[#F3C1C6]'
              : 'bg-[#131314] text-[#F4F0EA] border-[#F4F0EA]/15 hover:border-[#F3C1C6]/40'
          }`}
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>Báo cáo Vi phạm</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#0B0B0C]/20">
            {mergedReports.filter((r) => r.status !== 'resolved').length} mở
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveQueueTab('artworks')}
          className={`px-5 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all border shrink-0 flex items-center gap-2 cursor-pointer ${
            activeQueueTab === 'artworks'
              ? 'bg-[#F3C1C6] text-[#0B0B0C] border-[#F3C1C6]'
              : 'bg-[#131314] text-[#F4F0EA] border-[#F4F0EA]/15 hover:border-[#F3C1C6]/40'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Duyệt Tác phẩm</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#0B0B0C]/20">
            {pendingArtworks.length} chờ
          </span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveQueueTab('keywords')}
            className={`px-5 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all border shrink-0 flex items-center gap-2 cursor-pointer ${
              activeQueueTab === 'keywords'
                ? 'bg-[#E2B86B] text-[#0B0B0C] border-[#E2B86B]'
                : 'bg-[#131314] text-[#E2B86B] border-[#E2B86B]/30 hover:border-[#E2B86B]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Từ khóa &amp; Quy tắc (Admin)</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveQueueTab('audit')}
          className={`px-5 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all border shrink-0 flex items-center gap-2 cursor-pointer ${
            activeQueueTab === 'audit'
              ? 'bg-[#F3C1C6] text-[#0B0B0C] border-[#F3C1C6]'
              : 'bg-[#131314] text-[#F4F0EA] border-[#F4F0EA]/15 hover:border-[#F3C1C6]/40'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Nhật ký Kiểm duyệt</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PRIORITY COMMENT MODERATION QUEUE                 */}
      {/* ======================================================== */}
      {activeQueueTab === 'comments' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 rounded-2xl bg-[#131314] border border-[#F4F0EA]/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-[#F3C1C6]" />
              <span className="font-bold text-[#A39E95]">Lọc trạng thái:</span>
              {(['all', 'pending', 'published', 'hidden', 'rejected', 'deleted'] as const).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-full font-bold cursor-pointer ${
                      statusFilter === st
                        ? 'bg-[#F3C1C6] text-[#0B0B0C]'
                        : 'bg-[#0B0B0C] text-[#A39E95] hover:text-[#F4F0EA]'
                    }`}
                  >
                    {st === 'all' ? 'Tất cả' : st}
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#A39E95]">Mức độ rủi ro:</span>
              {(['all', 'CRITICAL', 'BLOCKED', 'REVIEW', 'SAFE'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-3 py-1 rounded-full font-bold cursor-pointer ${
                    severityFilter === sev
                      ? 'bg-[#E2B86B] text-[#0B0B0C]'
                      : 'bg-[#0B0B0C] text-[#A39E95] hover:text-[#F4F0EA]'
                  }`}
                >
                  {sev === 'all' ? 'Mọi mức' : sev}
                </button>
              ))}
            </div>
          </div>

          {filteredComments.length === 0 ? (
            <div className="p-12 text-center bg-[#131314] rounded-3xl border border-dashed border-[#F4F0EA]/15 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-[#8FA382] mx-auto" />
              <h4 className="text-sm font-bold text-[#F4F0EA]">
                Không có bình luận nào trong bộ lọc hiện tại
              </h4>
              <p className="text-xs text-[#A39E95] max-w-sm mx-auto">
                Mọi bình luận trong phạm vi lớp phụ trách đã được xử lý an toàn.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredComments.map((cmt) => {
                const resolvedSev = cmt.severity || cmt.moderationSeverity || 'SAFE';
                const resolvedConf = cmt.confidence ?? cmt.moderationConfidence;
                const resolvedCats = cmt.categories || cmt.moderationCategories || [];
                const isAppealed =
                  cmt.appeal?.status === 'open' || cmt.appeal?.status === 'pending';
                return (
                  <div
                    key={cmt.id}
                    className={`p-5 rounded-3xl border space-y-4 transition-all ${
                      resolvedSev === 'CRITICAL'
                        ? 'bg-rose-950/25 border-rose-500/60'
                        : isAppealed
                          ? 'bg-[#131314] border-[#F3C1C6]/60'
                          : cmt.status === 'pending'
                            ? 'bg-[#131314] border-[#E2B86B]/50'
                            : 'bg-[#131314] border-[#F4F0EA]/12'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[#F4F0EA]">
                            {cmt.authorNickname || cmt.anonymousNickname || 'Nghệ sĩ Nhí'}
                          </span>
                          <span className="text-[11px] font-mono text-[#A39E95]">
                            (Lớp: {cmt.classCode || cmt.classId || 'Chung'})
                          </span>
                          {getSeverityBadge(resolvedSev)}
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0B0B0C] border border-[#F4F0EA]/15 text-[#F4F0EA]">
                            Trạng thái: {cmt.status}
                          </span>
                          {typeof resolvedConf === 'number' && (
                            <span className="text-[10px] text-[#A39E95] font-mono">
                              Độ tin cậy AI/Rule: {Math.round(resolvedConf * 100)}%
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#A39E95]">
                          Tác phẩm: <strong className="text-[#F3C1C6]">{cmt.artworkTitle || cmt.artworkId}</strong> · Lúc: {cmt.createdAt}
                        </div>
                      </div>

                      {/* Admin Mute Button */}
                      {isAdmin && cmt.authorUid && (
                        <button
                          type="button"
                          onClick={() =>
                            setMutingUserTarget({
                              uid: cmt.authorUid!,
                              nickname:
                                cmt.authorNickname || cmt.anonymousNickname || cmt.authorUid!,
                            })
                          }
                          className="px-3 py-1 rounded-full bg-rose-950/60 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <UserX className="w-3 h-3" />
                          <span>Tạm khóa bình luận</span>
                        </button>
                      )}
                    </div>

                    {/* Comment Text */}
                    <div className="p-4 rounded-2xl bg-[#0B0B0C] border border-[#F4F0EA]/10 space-y-2">
                      <p className="text-sm text-[#F4F0EA] font-medium leading-relaxed">
                        “{cmt.content}”
                      </p>
                      {(cmt.moderationReason || resolvedCats.length > 0) && (
                        <div className="text-[11px] text-[#E2B86B] flex flex-wrap items-center gap-2 pt-1 border-t border-[#F4F0EA]/10">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Phân tích hệ thống: {cmt.moderationReason || 'Đã phân loại tự động'}
                          </span>
                          {resolvedCats.length > 0 && (
                            <span className="font-mono text-[10px] text-[#F3C1C6]">
                              [{resolvedCats.join(', ')}]
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Student Appeal Banner if Pending Appeal */}
                    {cmt.appeal && cmt.appeal.status !== 'none' && (
                      <div className="p-3.5 rounded-2xl bg-[#1C1C1E] border border-[#F3C1C6]/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#F3C1C6] block">
                            YÊU CẦU XEM XÉT LẠI TỪ HỌC SINH ({cmt.appeal.status.toUpperCase()})
                          </span>
                          <p className="text-[#F4F0EA] mt-0.5">
                            “{cmt.appeal.appealReason || cmt.appeal.reason}”
                          </p>
                        </div>
                        {isAppealed && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCommentAction(cmt.id, 'approve_appeal')}
                              className="px-3.5 py-1.5 rounded-full bg-[#8FA382] text-[#0B0B0C] font-extrabold text-xs cursor-pointer"
                            >
                              Chấp nhận &amp; Hiển thị
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCommentAction(cmt.id, 'reject_appeal')}
                              className="px-3.5 py-1.5 rounded-full bg-rose-600 text-white font-bold text-xs cursor-pointer"
                            >
                              Từ chối kiến nghị
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Moderator Note Input + Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-[#F4F0EA]/10">
                      <input
                        type="text"
                        value={actionNoteInput[cmt.id] || ''}
                        onChange={(e) =>
                          setActionNoteInput((prev) => ({ ...prev, [cmt.id]: e.target.value }))
                        }
                        placeholder="Ghi chú nội bộ hoặc lý do xử lý (lưu vào lịch sử kiểm duyệt)..."
                        className="flex-1 px-3.5 py-2 rounded-xl bg-[#0B0B0C] border border-[#F4F0EA]/15 text-xs text-[#F4F0EA]"
                      />

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {cmt.status !== 'published' && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCommentAction(
                                cmt.id,
                                cmt.status === 'hidden' || cmt.status === 'deleted'
                                  ? 'restore'
                                  : 'approve'
                              )
                            }
                            className="px-4 py-2 rounded-full bg-[#8FA382] hover:bg-[#9FB392] text-[#0B0B0C] font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {cmt.status === 'hidden' || cmt.status === 'deleted' ? (
                              <>
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Khôi phục hiển thị</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Duyệt hiển thị</span>
                              </>
                            )}
                          </button>
                        )}

                        {cmt.status !== 'hidden' && (
                          <button
                            type="button"
                            onClick={() => handleCommentAction(cmt.id, 'hide')}
                            className="px-3.5 py-2 rounded-full bg-[#1C1C1E] hover:bg-[#262629] text-[#E2B86B] border border-[#E2B86B]/30 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Tạm ẩn</span>
                          </button>
                        )}

                        {cmt.status !== 'deleted' && (
                          <button
                            type="button"
                            onClick={() => handleCommentAction(cmt.id, 'soft_delete')}
                            className="px-3.5 py-2 rounded-full bg-rose-950/60 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/30 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa mềm</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: VIOLATION REPORTS QUEUE                           */}
      {/* ======================================================== */}
      {activeQueueTab === 'reports' && (
        <div className="space-y-4">
          {mergedReports.length === 0 ? (
            <div className="p-12 text-center bg-[#131314] rounded-3xl border border-dashed border-[#F4F0EA]/15 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-[#8FA382] mx-auto" />
              <h4 className="text-sm font-bold text-[#F4F0EA]">Không có báo cáo vi phạm nào</h4>
              <p className="text-xs text-[#A39E95] max-w-sm mx-auto">
                Cộng đồng học sinh đang tương tác văn minh và tích cực.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {mergedReports.map((rep) => {
                const isServerReport = serverReports.some((sr) => sr.id === rep.id);
                return (
                  <div
                    key={rep.id}
                    className={`p-5 rounded-3xl border transition-all text-xs space-y-3 ${
                      rep.priority === 'critical'
                        ? 'bg-rose-950/30 border-rose-500'
                        : rep.status === 'open'
                          ? 'bg-[#131314] border-rose-400/50'
                          : 'bg-[#131314]/70 border-[#F4F0EA]/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            rep.status === 'open'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : rep.status === 'reviewing'
                                ? 'bg-[#E2B86B]/20 text-[#E2B86B]'
                                : 'bg-[#8FA382]/20 text-[#8FA382]'
                          }`}
                        >
                          {rep.status === 'open'
                            ? 'BÁO CÁO MỚI'
                            : rep.status === 'reviewing'
                              ? 'ĐANG XÁC MINH'
                              : 'ĐÃ GIẢI QUYẾT'}
                        </span>
                        {rep.priority === 'critical' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
                            ƯU TIÊN KHẨN CẤP (CRITICAL)
                          </span>
                        )}
                        <span className="font-bold text-sm text-[#F4F0EA]">{rep.reasonLabel}</span>
                      </div>

                      <div className="text-[11px] text-[#A39E95] font-mono">
                        Mã bảo mật người báo: {rep.reporterAnonymousCode} · {rep.createdAt}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#0B0B0C] border border-[#F4F0EA]/10 text-[#F4F0EA]/90 space-y-1">
                      <div>
                        <strong className="text-[#F3C1C6]">Chi tiết báo cáo:</strong> “
                        {rep.reasonDetails}”
                      </div>
                      {rep.commentContentSnapshot && (
                        <div className="text-[#A39E95]">
                          <strong>Nội dung bình luận:</strong> “{rep.commentContentSnapshot}” (Tác phẩm:{' '}
                          {rep.targetTitle})
                        </div>
                      )}
                    </div>

                    {rep.resolutionAction && (
                      <p className="text-[11px] text-[#8FA382] bg-[#8FA382]/10 p-3 rounded-xl border border-[#8FA382]/30 font-medium">
                        ✓ Kết quả xử lý: {rep.resolutionAction} (bởi{' '}
                        {rep.resolverName || rep.resolverRole || 'Kiểm duyệt viên'})
                      </p>
                    )}

                    {rep.status !== 'resolved' && (
                      <div className="pt-2 border-t border-[#F4F0EA]/10 flex items-center justify-end gap-2">
                        {!isServerReport && rep.status === 'open' && (
                          <button
                            type="button"
                            onClick={() => onUpdateReportStatus(rep.id, 'reviewing')}
                            className="px-3.5 py-1.5 text-xs font-bold text-[#E2B86B] bg-[#1C1C1E] rounded-full border border-[#E2B86B]/30 cursor-pointer"
                          >
                            Đánh dấu Đang xác minh
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setResolvingReportId(rep.id);
                            setResolvingReportIsServer(isServerReport);
                            setResolutionActionInput(
                              'Đã kiểm tra và xử lý nội dung vi phạm tiêu chuẩn cộng đồng.'
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-extrabold text-[#0B0B0C] bg-[#8FA382] hover:bg-[#9FB392] rounded-full cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Hoàn tất xử lý</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ARTWORKS MODERATION QUEUE                         */}
      {/* ======================================================== */}
      {activeQueueTab === 'artworks' && (
        <div className="space-y-6">
          {pendingArtworks.length === 0 ? (
            <div className="p-12 text-center bg-[#131314] rounded-3xl border border-dashed border-[#F4F0EA]/15 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-[#8FA382] mx-auto" />
              <h4 className="text-sm font-bold text-[#F4F0EA]">
                Không có tác phẩm nào đang chờ duyệt
              </h4>
              <p className="text-xs text-[#A39E95] max-w-sm mx-auto">
                Tất cả tác phẩm nộp lên đã được xem xét và trưng bày an toàn.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {pendingArtworks.map((art) => (
                <div
                  key={art.id}
                  className="bg-[#131314] rounded-3xl border border-[#E2B86B]/40 p-5 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold text-[#F3C1C6]">
                          {art.className}
                        </span>
                        <h4 className="font-editorial-display text-xl text-[#F4F0EA] mt-0.5">
                          {art.title}
                        </h4>
                        <span className="text-xs text-[#A39E95]">
                          Nghệ danh: <strong>{art.creatorAnonymousPseudonym}</strong>
                        </span>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-[#E2B86B]/20 text-[#E2B86B] border border-[#E2B86B]/40 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Chờ duyệt</span>
                      </span>
                    </div>

                    <div className="h-44 rounded-2xl overflow-hidden border border-[#F4F0EA]/10">
                      <ArtCanvasVisual visualType={art.visualType} title={art.title} />
                    </div>

                    <p className="text-xs text-[#F4F0EA]/85 bg-[#0B0B0C] p-3 rounded-xl border border-[#F4F0EA]/10 line-clamp-3">
                      <strong>Mô tả ý tưởng:</strong> {art.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#F4F0EA]/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingArtworkId(art.id);
                          setRejectionReasonInput(
                            'Hình ảnh hoặc nội dung cần chỉnh sửa để phù hợp với định hướng bài học.'
                          );
                        }}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-rose-300 bg-rose-950/50 rounded-full border border-rose-500/30 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Từ chối</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onHideArtwork(art.id)}
                        className="p-2 text-[#A39E95] hover:text-[#F4F0EA] rounded-full hover:bg-[#1C1C1E]"
                        title="Tạm ẩn tác phẩm"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onApproveArtwork(
                          art.id,
                          'Đã kiểm tra an toàn và phê duyệt đưa vào Phòng trưng bày.'
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-extrabold text-[#0B0B0C] bg-[#8FA382] rounded-full cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Phê duyệt ngay</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-[#F4F0EA]/10">
            <h4 className="text-xs font-bold text-[#A39E95] uppercase tracking-wider mb-3">
              Danh mục tác phẩm trong hệ thống ({allNonDraftArtworks.length})
            </h4>
            <div className="bg-[#131314] rounded-2xl border border-[#F4F0EA]/10 overflow-x-auto">
              <table className="w-full text-left text-xs text-[#F4F0EA]">
                <thead className="bg-[#0B0B0C] text-[10px] text-[#A39E95] uppercase font-bold border-b border-[#F4F0EA]/10">
                  <tr>
                    <th className="p-3.5">Tác phẩm</th>
                    <th className="p-3.5">Lớp</th>
                    <th className="p-3.5">Nghệ danh</th>
                    <th className="p-3.5">Trạng thái</th>
                    <th className="p-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F0EA]/10">
                  {allNonDraftArtworks.map((art) => (
                    <tr key={art.id} className="hover:bg-[#1C1C1E]/50">
                      <td className="p-3.5 font-semibold">{art.title}</td>
                      <td className="p-3.5 text-[#A39E95]">{art.className}</td>
                      <td className="p-3.5 font-mono text-[11px]">
                        {art.creatorAnonymousPseudonym}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0B0B0C] border border-[#F4F0EA]/15">
                          {art.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        {art.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => onApproveArtwork(art.id)}
                            className="text-[#8FA382] hover:underline font-bold cursor-pointer"
                          >
                            Duyệt
                          </button>
                        )}
                        {art.status !== 'removed' && (
                          <button
                            type="button"
                            onClick={() => onRemoveArtwork(art.id)}
                            className="text-rose-400 hover:underline font-bold cursor-pointer"
                          >
                            Gỡ bài
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: ADMIN KEYWORDS, RULES & MUTED USERS               */}
      {/* ======================================================== */}
      {activeQueueTab === 'keywords' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Blocked Keywords */}
          <div className="p-6 rounded-3xl bg-[#131314] border border-[#F4F0EA]/12 space-y-4">
            <h3 className="font-editorial-display text-xl text-[#F4F0EA]">
              Từ khóa Chặn Tự động (BLOCKED)
            </h3>
            <p className="text-xs text-[#A39E95]">
              Các từ khóa này (kể cả biến thể không dấu/leetspeak) sẽ bị từ chối đăng ngay lập tức.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newBlockedKeyword}
                onChange={(e) => setNewBlockedKeyword(e.target.value)}
                placeholder="Nhập từ khóa cần chặn..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-[#0B0B0C] border border-[#F4F0EA]/15 text-xs text-[#F4F0EA]"
              />
              <button
                type="button"
                onClick={() => {
                  const kw = newBlockedKeyword.trim().toLowerCase();
                  if (!kw) return;
                  setNewBlockedKeyword('');
                  handleSaveKeywordsConfig({
                    customBlockedKeywords: Array.from(
                      new Set([...moderationConfig.customBlockedKeywords, kw])
                    ),
                  });
                }}
                className="px-4 py-2 rounded-full bg-[#F3C1C6] text-[#0B0B0C] font-extrabold text-xs inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {moderationConfig.customBlockedKeywords.map((kw) => (
                <span
                  key={kw}
                  className="px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 inline-flex items-center gap-1.5"
                >
                  <span>{kw}</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleSaveKeywordsConfig({
                        customBlockedKeywords: moderationConfig.customBlockedKeywords.filter(
                          (item) => item !== kw
                        ),
                      })
                    }
                    className="hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Review Keywords */}
          <div className="p-6 rounded-3xl bg-[#131314] border border-[#F4F0EA]/12 space-y-4">
            <h3 className="font-editorial-display text-xl text-[#F4F0EA]">
              Từ khóa Đưa vào Hàng chờ Giáo viên (REVIEW)
            </h3>
            <p className="text-xs text-[#A39E95]">
              Bình luận chứa từ ngữ nhạy cảm nhẹ sẽ chuyển sang trạng thái <code>pending</code> để giáo viên duyệt.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newReviewKeyword}
                onChange={(e) => setNewReviewKeyword(e.target.value)}
                placeholder="Nhập từ khóa cần giáo viên xem xét..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-[#0B0B0C] border border-[#F4F0EA]/15 text-xs text-[#F4F0EA]"
              />
              <button
                type="button"
                onClick={() => {
                  const kw = newReviewKeyword.trim().toLowerCase();
                  if (!kw) return;
                  setNewReviewKeyword('');
                  handleSaveKeywordsConfig({
                    customReviewKeywords: Array.from(
                      new Set([...moderationConfig.customReviewKeywords, kw])
                    ),
                  });
                }}
                className="px-4 py-2 rounded-full bg-[#E2B86B] text-[#0B0B0C] font-extrabold text-xs inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {moderationConfig.customReviewKeywords.map((kw) => (
                <span
                  key={kw}
                  className="px-3 py-1 rounded-full bg-[#E2B86B]/20 border border-[#E2B86B]/40 text-xs text-[#E2B86B] inline-flex items-center gap-1.5"
                >
                  <span>{kw}</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleSaveKeywordsConfig({
                        customReviewKeywords: moderationConfig.customReviewKeywords.filter(
                          (item) => item !== kw
                        ),
                      })
                    }
                    className="hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Muted Users List */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-[#131314] border border-[#F4F0EA]/12 space-y-4">
            <h3 className="font-editorial-display text-xl text-[#F4F0EA]">
              Danh sách Tài khoản Đang Tạm khóa Quyền Bình luận
            </h3>
            {Object.keys(mutedUsers).length === 0 ? (
              <p className="text-xs text-[#A39E95]">
                Hiện không có tài khoản nào bị tạm khóa quyền bình luận.
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(mutedUsers).map(([uid, info]: [string, any]) => (
                  <div
                    key={uid}
                    className="p-3.5 rounded-2xl bg-[#0B0B0C] border border-[#F4F0EA]/10 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <strong className="text-[#F4F0EA]">UID: {uid}</strong> · Hết hạn:{' '}
                      <span className="text-[#E2B86B]">{info.mutedUntil}</span>
                      <p className="text-[#A39E95] mt-0.5">Lý do: {info.reason}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnmuteUser(uid)}
                      className="px-4 py-1.5 rounded-full bg-[#8FA382] text-[#0B0B0C] font-extrabold text-xs cursor-pointer"
                    >
                      Mở khóa ngay
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: IMMUTABLE MODERATION AUDIT TRAIL                  */}
      {/* ======================================================== */}
      {activeQueueTab === 'audit' && (
        <div className="p-6 rounded-3xl bg-[#131314] border border-[#F4F0EA]/12 space-y-4">
          <h3 className="font-editorial-display text-2xl text-[#F4F0EA]">
            Nhật ký Kiểm duyệt &amp; Cảnh báo An toàn (Audit Logs)
          </h3>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-[#A39E95]">Chưa có bản ghi nhật ký kiểm duyệt mới.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-[#0B0B0C] border border-[#F4F0EA]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#131314] text-[#F3C1C6] font-mono text-[10px] font-bold">
                        {log.action}
                      </span>
                      <strong className="text-[#F4F0EA]">{log.actorEmail}</strong>
                      <span className="text-[#A39E95]">→ {log.targetId}</span>
                    </div>
                    <p className="text-[#A39E95]">{log.details}</p>
                  </div>
                  <span className="text-[11px] font-mono text-[#A39E95] shrink-0">
                    {log.createdAt}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: REJECT ARTWORK WITH REASON */}
      {rejectingArtworkId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#131314] rounded-3xl max-w-md w-full border border-[#F4F0EA]/15 p-6 space-y-4 text-[#F4F0EA]">
            <div className="flex items-center justify-between pb-3 border-b border-[#F4F0EA]/10">
              <h3 className="text-sm font-bold">Từ chối / Yêu cầu chỉnh sửa tác phẩm</h3>
              <button
                type="button"
                onClick={() => setRejectingArtworkId(null)}
                className="p-1 text-[#A39E95] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRejectArtwork} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1">
                  Lý do từ chối (gửi phản hồi sư phạm cho học sinh): *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  className="w-full p-3 bg-[#0B0B0C] border border-[#F4F0EA]/15 rounded-xl text-[#F4F0EA]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingArtworkId(null)}
                  className="px-4 py-2 rounded-full bg-[#1C1C1E] text-[#A39E95] font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-rose-600 text-white font-bold cursor-pointer"
                >
                  Xác nhận Từ chối
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESOLVE REPORT */}
      {resolvingReportId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#131314] rounded-3xl max-w-md w-full border border-[#F4F0EA]/15 p-6 space-y-4 text-[#F4F0EA]">
            <div className="flex items-center justify-between pb-3 border-b border-[#F4F0EA]/10">
              <h3 className="text-sm font-bold">Kết luận xử lý báo cáo vi phạm</h3>
              <button
                type="button"
                onClick={() => setResolvingReportId(null)}
                className="p-1 text-[#A39E95] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmResolveReport} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1">Ghi chú hành động khắc phục:</label>
                <textarea
                  required
                  rows={3}
                  value={resolutionActionInput}
                  onChange={(e) => setResolutionActionInput(e.target.value)}
                  className="w-full p-3 bg-[#0B0B0C] border border-[#F4F0EA]/15 rounded-xl text-[#F4F0EA]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResolvingReportId(null)}
                  className="px-4 py-2 rounded-full bg-[#1C1C1E] text-[#A39E95] font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#8FA382] text-[#0B0B0C] font-extrabold cursor-pointer"
                >
                  Hoàn tất giải quyết
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN TEMPORARY MUTE USER */}
      {mutingUserTarget && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#131314] rounded-3xl max-w-md w-full border border-rose-500/40 p-6 space-y-4 text-[#F4F0EA]">
            <div className="flex items-center justify-between pb-3 border-b border-[#F4F0EA]/10">
              <h3 className="text-sm font-bold text-rose-400">
                Tạm khóa quyền bình luận ({mutingUserTarget.nickname})
              </h3>
              <button
                type="button"
                onClick={() => setMutingUserTarget(null)}
                className="p-1 text-[#A39E95] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmMuteUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1">Thời hạn tạm khóa (giờ):</label>
                <select
                  value={muteDurationHours}
                  onChange={(e) => setMuteDurationHours(Number(e.target.value))}
                  className="w-full p-3 rounded-xl bg-[#0B0B0C] border border-[#F4F0EA]/15 text-[#F4F0EA]"
                >
                  <option value={6}>6 giờ</option>
                  <option value={24}>24 giờ (1 ngày)</option>
                  <option value={72}>72 giờ (3 ngày)</option>
                  <option value={168}>168 giờ (7 ngày)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">Lý do bắt buộc (ghi vào nhật ký): *</label>
                <textarea
                  required
                  rows={3}
                  value={muteReason}
                  onChange={(e) => setMuteReason(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#0B0B0C] border border-[#F4F0EA]/15 text-[#F4F0EA]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMutingUserTarget(null)}
                  className="px-4 py-2 rounded-full bg-[#1C1C1E] text-[#A39E95] font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-rose-600 text-white font-bold cursor-pointer"
                >
                  Xác nhận Tạm khóa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

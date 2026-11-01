import React, { useState } from 'react';
import { 
  CommunityArtwork, 
  ArtworkComment, 
  ContentReport, 
  UserRole 
} from '../../types/communityArt';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import { 
  ShieldAlert, 
  Check, 
  X, 
  AlertTriangle, 
  Eye, 
  Trash2, 
  MessageSquare, 
  AlertOctagon, 
  Clock, 
  UserX, 
  CheckCircle2, 
  RotateCcw, 
  Filter 
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

export const ModerationQueueView: React.FC<ModerationQueueViewProps> = ({
  artworks,
  comments,
  reports,
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
  onShowToast
}) => {
  const [activeQueueTab, setActiveQueueTab] = useState<'artworks' | 'comments' | 'reports'>('artworks');

  // Rejection modal state
  const [rejectingArtworkId, setRejectingArtworkId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Report resolution modal state
  const [resolvingReportId, setResolvingReportId] = useState<string | null>(null);
  const [resolutionActionInput, setResolutionActionInput] = useState('Đã kiểm tra và gỡ nội dung vi phạm tiêu chuẩn cộng đồng.');

  const pendingArtworks = artworks.filter(a => a.status === 'pending');
  const allNonDraftArtworks = artworks.filter(a => a.status !== 'draft');
  const pendingComments = comments.filter(c => c.status === 'pending');
  const openReports = reports.filter(r => r.status !== 'resolved');

  const canModerate = currentRole === 'teacher' || currentRole === 'moderator' || currentRole === 'admin';

  if (!canModerate) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">Yêu cầu quyền Kiểm duyệt</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Khu vực Hàng chờ kiểm duyệt chỉ dành cho Giáo viên, Kiểm duyệt viên và Quản trị viên. 
          Vui lòng chọn vai trò phù hợp ở thanh kiểm thử phía trên để tiếp tục.
        </p>
      </div>
    );
  }

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingArtworkId || !rejectionReasonInput.trim()) return;

    onRejectArtwork(rejectingArtworkId, rejectionReasonInput.trim());
    setRejectingArtworkId(null);
    setRejectionReasonInput('');
    onShowToast('info', 'Đã từ chối tác phẩm', 'Đã chuyển tác phẩm sang trạng thái từ chối kèm lý do phản hồi cho tác giả.');
  };

  const handleConfirmResolveReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingReportId) return;

    onResolveReport(resolvingReportId, resolutionActionInput);
    setResolvingReportId(null);
    onShowToast('success', 'Đã xử lý xong báo cáo', 'Báo cáo vi phạm đã được đánh dấu giải quyết hoàn tất.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
              Không gian Giám sát An toàn
            </span>
            <span className="text-xs text-slate-500">Kiểm duyệt Nội dung Trẻ vị thành niên</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-xs text-slate-400 font-mono">
              {pendingArtworks.length} Bài chờ · {pendingComments.length} Bình luận chờ · {openReports.length} Báo cáo
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            Hàng chờ Kiểm duyệt (Moderation Queue)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Duyệt tác phẩm mới, bình luận an toàn và xử lý báo cáo vi phạm. Nội dung chỉ xuất hiện công khai sau khi được kiểm duyệt viên hoặc giáo viên phê duyệt.
          </p>
        </div>

        <div className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
          Người kiểm duyệt: <strong className="text-purple-700">{currentModeratorName}</strong> ({currentRole})
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveQueueTab('artworks')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all border shrink-0 flex items-center gap-2 ${
            activeQueueTab === 'artworks'
              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>Duyệt tác phẩm</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            activeQueueTab === 'artworks' ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            {pendingArtworks.length} chờ
          </span>
        </button>

        <button
          onClick={() => setActiveQueueTab('comments')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all border shrink-0 flex items-center gap-2 ${
            activeQueueTab === 'comments'
              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>Duyệt bình luận</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            activeQueueTab === 'comments' ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            {pendingComments.length} chờ
          </span>
        </button>

        <button
          onClick={() => setActiveQueueTab('reports')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all border shrink-0 flex items-center gap-2 ${
            activeQueueTab === 'reports'
              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>Báo cáo vi phạm</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            activeQueueTab === 'reports' ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            {openReports.length} đang mở
          </span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. ARTWORKS MODERATION QUEUE                             */}
      {/* ======================================================== */}
      {activeQueueTab === 'artworks' && (
        <div className="space-y-4">
          {pendingArtworks.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">Không có tác phẩm nào đang chờ duyệt</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Tất cả tác phẩm nộp lên đã được xem xét và xử lý an toàn.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {pendingArtworks.map((art) => (
                <div
                  key={art.id}
                  className="bg-white rounded-3xl border-2 border-amber-300 p-5 shadow-xs space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                          <span className="font-bold text-slate-800">{art.className}</span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900 mt-1">
                          {art.title}
                        </h4>
                        <span className="text-xs text-slate-400">
                          Tác giả ẩn danh: <strong>{art.creatorAnonymousPseudonym}</strong>
                        </span>
                      </div>

                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Chờ duyệt</span>
                      </span>
                    </div>

                    {/* Artwork Visual preview */}
                    <div className="h-44 rounded-2xl overflow-hidden border border-slate-200">
                      <ArtCanvasVisual visualType={art.visualType} title={art.title} />
                    </div>

                    <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 line-clamp-3">
                      <strong>Mô tả ý tưởng:</strong> {art.description}
                    </p>

                    {art.materialsUsed && (
                      <p className="text-[11px] text-slate-500">
                        <strong>Chất liệu:</strong> {art.materialsUsed}
                      </p>
                    )}
                  </div>

                  {/* Moderation Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setRejectingArtworkId(art.id);
                          setRejectionReasonInput('Hình ảnh hoặc nội dung cần chỉnh sửa để phù hợp với định hướng bài học.');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Từ chối</span>
                      </button>

                      <button
                        onClick={() => onHideArtwork(art.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                        title="Tạm ẩn tác phẩm"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => onApproveArtwork(art.id, 'Đã kiểm tra an toàn và phê duyệt đưa vào Thư viện.')}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      <span>Phê duyệt ngay</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All Artwork Status Reference */}
          <div className="pt-6 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 mb-3">
              Tất cả tác phẩm trong hệ thống ({allNonDraftArtworks.length})
            </h4>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] text-slate-400 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Tác phẩm</th>
                    <th className="p-3">Lớp</th>
                    <th className="p-3">Tác giả</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3">Kiểm duyệt bởi</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allNonDraftArtworks.map(art => (
                    <tr key={art.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-900">{art.title}</td>
                      <td className="p-3">{art.className}</td>
                      <td className="p-3 font-mono text-[11px]">{art.creatorAnonymousPseudonym}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          art.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          art.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          art.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {art.status}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-slate-400">
                        {art.moderation.moderatedBy || 'Chưa duyệt'}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {art.status !== 'approved' && (
                          <button
                            onClick={() => onApproveArtwork(art.id)}
                            className="text-emerald-600 hover:text-emerald-800 font-bold"
                          >
                            Duyệt
                          </button>
                        )}
                        {art.status !== 'removed' && (
                          <button
                            onClick={() => onRemoveArtwork(art.id)}
                            className="text-rose-600 hover:text-rose-800 font-bold ml-2"
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
      {/* 2. COMMENTS MODERATION QUEUE                             */}
      {/* ======================================================== */}
      {activeQueueTab === 'comments' && (
        <div className="space-y-4">
          {pendingComments.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">Không có bình luận nào đang chờ duyệt</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Tất cả bình luận học sinh gửi lên đã được duyệt hoặc xử lý an toàn.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingComments.map((cmt) => (
                <div
                  key={cmt.id}
                  className="p-4 bg-white rounded-2xl border border-amber-300 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-purple-800">{cmt.anonymousNickname}</span>
                      <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-semibold">
                        Chờ duyệt
                      </span>
                      <span className="text-[10px] text-slate-400">{cmt.createdAt}</span>
                    </div>
                    <p className="text-slate-800 font-medium leading-relaxed">
                      "{cmt.content}"
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onRejectComment(cmt.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200"
                    >
                      Xóa bỏ
                    </button>
                    <button
                      onClick={() => onApproveComment(cmt.id)}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Duyệt hiển thị</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. VIOLATION REPORTS QUEUE                               */}
      {/* ======================================================== */}
      {activeQueueTab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">Không có báo cáo vi phạm nào</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Cộng đồng học sinh đang tương tác văn minh và tích cực.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className={`p-4 rounded-2xl border transition-all text-xs space-y-2.5 ${
                    rep.status === 'open' ? 'bg-white border-rose-300 shadow-xs' :
                    rep.status === 'reviewing' ? 'bg-amber-50/50 border-amber-300' :
                    'bg-slate-50 border-slate-200 opacity-70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rep.status === 'open' ? 'bg-rose-100 text-rose-800' :
                        rep.status === 'reviewing' ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {rep.status === 'open' ? 'BÁO CÁO MỚI' : rep.status === 'reviewing' ? 'ĐANG XỬ LÝ' : 'ĐÃ GIẢI QUYẾT'}
                      </span>
                      <span className="font-bold text-slate-900">{rep.reasonLabel}</span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono">
                      Người báo: {rep.reporterAnonymousCode} · {rep.createdAt}
                    </div>
                  </div>

                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <strong>Nội dung báo cáo:</strong> "{rep.reasonDetails}" (Mục tiêu: {rep.targetTitle})
                  </p>

                  {rep.resolutionAction && (
                    <p className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-lg font-medium">
                      ✓ Kết quả xử lý: {rep.resolutionAction} (bởi {rep.resolverRole || 'Kiểm duyệt viên'})
                    </p>
                  )}

                  {rep.status !== 'resolved' && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                      {rep.status === 'open' && (
                        <button
                          onClick={() => onUpdateReportStatus(rep.id, 'reviewing')}
                          className="px-3 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200"
                        >
                          Chuyển sang "Đang xác minh"
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setResolvingReportId(rep.id);
                          setResolutionActionInput('Đã kiểm tra và gỡ nội dung vi phạm tiêu chuẩn cộng đồng.');
                        }}
                        className="inline-flex items-center gap-1 px-3.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Xử lý hoàn tất</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: REJECT ARTWORK WITH REASON */}
      {rejectingArtworkId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Từ chối / Yêu cầu chỉnh sửa tác phẩm
              </h3>
              <button
                onClick={() => setRejectingArtworkId(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-3.5 text-xs text-slate-800">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lý do từ chối (gửi phản hồi sư phạm cho tác giả): *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingArtworkId(null)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Kết luận xử lý báo cáo vi phạm
              </h3>
              <button
                onClick={() => setResolvingReportId(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmResolveReport} className="space-y-3.5 text-xs text-slate-800">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ghi chú hành động khắc phục:
                </label>
                <textarea
                  required
                  rows={3}
                  value={resolutionActionInput}
                  onChange={(e) => setResolutionActionInput(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResolvingReportId(null)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
                >
                  Hoàn tất giải quyết
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

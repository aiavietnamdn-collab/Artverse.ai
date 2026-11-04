import React, { useState } from 'react';
import { ContentReport } from '../../types/communityArt';
import { AlertOctagon, X, ShieldAlert, Send } from 'lucide-react';

interface ReportViolationModalProps {
  targetType: 'artwork' | 'comment' | 'story';
  targetId: string;
  targetTitle: string;
  onClose: () => void;
  onSubmitReport: (report: ContentReport) => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const ReportViolationModal: React.FC<ReportViolationModalProps> = ({
  targetType,
  targetId,
  targetTitle,
  onClose,
  onSubmitReport,
  onShowToast
}) => {
  const [reason, setReason] = useState<ContentReport['reason']>('inappropriate_language');
  const [reasonDetails, setReasonDetails] = useState('');

  const reasonLabels: Record<ContentReport['reason'], string> = {
    inappropriate_language: 'Từ ngữ chưa chuẩn mực / thiếu tôn trọng',
    bullying: 'Nội dung trêu chọc / mang tính bắt nạt',
    personal_info_leak: 'Lộ thông tin cá nhân (SĐT, họ tên thật, khuôn mặt)',
    dangerous_link: 'Chứa liên kết URL lạ / độc hại',
    copyright: 'Hình ảnh vi phạm bản quyền / sao chép không xin phép',
    other: 'Lý do an toàn khác'
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonDetails.trim()) {
      onShowToast('error', 'Thiếu chi tiết', 'Vui lòng mô tả ngắn gọn lý do bạn báo cáo vi phạm.');
      return;
    }

    const report: ContentReport = {
      id: `rep-${Date.now()}`,
      targetType,
      targetId,
      targetTitle,
      reason,
      reasonLabel: reasonLabels[reason],
      reasonDetails: reasonDetails.trim(),
      status: 'open',
      reporterAnonymousCode: `Ẩn danh #${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toLocaleDateString('vi-VN')
    };

    if (targetType === 'story') {
      fetch(`/api/stories/${encodeURIComponent(targetId)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          reasonDetails: reasonDetails.trim()
        })
      }).catch(() => {});
    }

    onSubmitReport(report);
    onClose();
    onShowToast(
      'success',
      'Đã gửi báo cáo vi phạm',
      'Báo cáo ẩn danh của bạn đã được chuyển tới Ban kiểm duyệt để xem xét xử lý theo quy định.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Báo cáo nội dung vi phạm
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-xs">
                Mục tiêu: {targetTitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs text-slate-800">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Lý do báo cáo vi phạm: *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:ring-2 focus:ring-rose-500"
            >
              <option value="inappropriate_language">Từ ngữ chưa chuẩn mực / thiếu tôn trọng</option>
              <option value="bullying">Nội dung trêu chọc / mang tính bắt nạt</option>
              <option value="personal_info_leak">Lộ thông tin cá nhân (SĐT, khuôn mặt, tên trường)</option>
              <option value="dangerous_link">Chứa liên kết URL nguy hiểm</option>
              <option value="copyright">Vi phạm bản quyền hình ảnh</option>
              <option value="other">Lý do an toàn khác</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Chi tiết vi phạm: *
            </label>
            <textarea
              required
              rows={3}
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              placeholder="Mô tả cụ thể vị trí hoặc câu từ có vấn đề để kiểm duyệt viên nắm rõ..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            Báo cáo được gửi hoàn toàn <strong>ẩn danh</strong>. Người bị báo cáo không thể biết danh tính của bạn.
          </p>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Gửi báo cáo ẩn danh</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

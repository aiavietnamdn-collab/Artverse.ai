import React, { useState } from 'react';
import { QrCode, Copy, Check, ExternalLink, ShieldCheck, AlertOctagon, Printer, Maximize2, Minimize2 } from 'lucide-react';

interface SessionQrCardProps {
  sessionToken: string;
  lessonTitle: string;
  grade: string;
  isRevoked: boolean;
  onRevoke?: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const SessionQrCard: React.FC<SessionQrCardProps> = ({
  sessionToken,
  lessonTitle,
  grade,
  isRevoked,
  onRevoke,
  onShowToast
}) => {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Unguessable join link
  const joinUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}${window.location.pathname}#student-portal?token=${sessionToken}`
    : `https://artverse.edu.vn/#student-portal?token=${sessionToken}`;

  const handleCopyToken = () => {
    navigator.clipboard.writeText(sessionToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
    onShowToast('success', 'Đã sao chép mã token', 'Mã tham gia ngẫu nhiên khó đoán đã được lưu vào bộ nhớ tạm.');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    onShowToast('success', 'Đã sao chép liên kết nộp bài', 'Đường dẫn nộp bài ẩn danh đã sẵn sàng để gửi cho học sinh.');
  };

  // Deterministic SVG QR-like visual based on token characters
  const generateQrMatrix = (str: string) => {
    const size = 21; // standard version 1 QR dimension
    const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    // Corner Finder Patterns
    const setFinder = (startX: number, startY: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            matrix[startY + r][startX + c] = true;
          }
        }
      }
    };
    setFinder(0, 0);
    setFinder(size - 7, 0);
    setFinder(0, size - 7);

    // Populate data cells deterministically from token
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Skip corner finder boxes
        if ((r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8)) continue;
        const bit = ((hash ^ (r * 13 + c * 17 + str.charCodeAt((r + c) % str.length))) % 3) === 0;
        matrix[r][c] = bit;
      }
    }
    return matrix;
  };

  const matrix = generateQrMatrix(sessionToken);

  return (
    <div className={`rounded-2xl border transition-all ${
      isRevoked 
        ? 'bg-rose-50/70 border-rose-200 text-rose-950' 
        : 'bg-white border-slate-200 shadow-sm'
    } ${isFullScreen ? 'fixed inset-0 z-50 p-8 flex flex-col items-center justify-center bg-white/95 backdrop-blur-md' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
              isRevoked ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {isRevoked ? 'ĐÃ THU HỒI MÃ' : 'MÃ THAM GIA ĐANG MỞ'}
            </span>
            <span className="text-xs text-slate-400 font-mono">GDPT 2018</span>
          </div>
          <h4 className="text-sm font-bold text-slate-900 mt-1">
            {lessonTitle} ({grade})
          </h4>
        </div>

        <button
          onClick={() => setIsFullScreen(!isFullScreen)}
          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          title={isFullScreen ? 'Thu nhỏ' : 'Phóng to chiếu máy chiếu lớp học'}
        >
          {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5 py-4">
        {/* QR Code Container */}
        <div className={`p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col items-center shrink-0 ${isRevoked ? 'opacity-40 grayscale' : ''}`}>
          <svg
            viewBox="0 0 21 21"
            className={`${isFullScreen ? 'w-64 h-64' : 'w-36 h-36'} shape-rendering-crisp`}
          >
            {matrix.map((row, r) =>
              row.map((active, c) =>
                active ? (
                  <rect
                    key={`${r}-${c}`}
                    x={c}
                    y={r}
                    width={1}
                    height={1}
                    fill={isRevoked ? '#94a3b8' : '#1e1b4b'}
                  />
                ) : null
              )
            )}
          </svg>
          <span className="text-[10px] text-slate-400 mt-1.5 font-mono">Quét mã nộp bài ẩn danh</span>
        </div>

        {/* Token Details & Privacy Statement */}
        <div className="space-y-3 flex-1 text-xs">
          <div>
            <span className="text-slate-500 font-medium">Token tham gia ngẫu nhiên khó đoán:</span>
            <div className="flex items-center gap-2 mt-1">
              <code className="bg-slate-100 px-2.5 py-1.5 rounded-lg text-slate-800 font-mono text-xs tracking-wider break-all border border-slate-200 select-all font-semibold">
                {sessionToken}
              </code>
              <button
                onClick={handleCopyToken}
                className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg border border-slate-200 shrink-0 transition-colors"
                title="Sao chép token"
              >
                {copiedToken ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Đã chép link' : 'Sao chép liên kết'}</span>
            </button>

            {!isRevoked && onRevoke && (
              <button
                onClick={onRevoke}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                title="Thu hồi quyền truy cập mã này ngay lập tức"
              >
                <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                <span>Thu hồi mã này</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Bảo mật ẩn danh:</strong> Mã token được sinh bằng hàm ngẫu nhiên mật mã 32 ký tự, không dùng số thứ tự hay mã lớp. Học sinh không cần khai báo họ tên hay email.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

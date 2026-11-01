import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, ShieldCheck, X } from 'lucide-react';

export const OfflineStatusBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showOfflineModal, setShowOfflineModal] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineModal(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineModal(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <>
      {/* Top Non-Intrusive Offline Status Bar */}
      <div className="bg-[#121316] text-white px-4 py-2 text-xs flex items-center justify-between gap-3 border-b border-stone-800 z-40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full bg-[#FBBF24] animate-pulse shrink-0" />
          <WifiOff className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
          <span className="truncate font-medium">
            Chế độ Ngoại tuyến — Đang hiển thị giao diện an toàn (không lưu cache dữ liệu riêng tư).
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowOfflineModal(true)}
          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-[#FBBF24] shrink-0 cursor-pointer"
        >
          Chi tiết
        </button>
      </div>

      {/* Dedicated Offline Screen Modal when connectivity drops */}
      {showOfflineModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#FAF8F5] border border-stone-200 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-[#D97706] flex items-center justify-center shrink-0">
                  <WifiOff className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D97706] block">
                    TRẠNG THÁI MẠNG
                  </span>
                  <h3 className="font-editorial text-lg font-bold text-[#121316]">
                    Đang mất kết nối Internet
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOfflineModal(false)}
                className="min-h-[36px] min-w-[36px] rounded-xl bg-stone-200/70 flex items-center justify-center text-stone-700 cursor-pointer"
                aria-label="Đóng thông báo ngoại tuyến"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Thiết bị của bạn hiện đang ngoại tuyến hoặc mạng yếu. Bạn vẫn có thể xem các nội dung đã mở trên màn hình và tham khảo danh mục bài học Khối 6, 7, 8, 9.
            </p>

            <div className="p-3.5 rounded-2xl bg-white border border-stone-200 flex items-start gap-2.5 text-[11px] text-stone-700">
              <ShieldCheck className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
              <span>
                <strong>Bảo vệ quyền riêng tư học sinh:</strong> ARTVERSE AI không lưu trữ dữ liệu cá nhân, phản hồi xác thực hoặc tác phẩm riêng tư vào bộ nhớ đệm công cộng của trình duyệt.
              </span>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowOfflineModal(false)}
                className="flex-1 min-h-[44px] rounded-xl bg-stone-200/80 hover:bg-stone-300 text-[#121316] text-xs font-bold transition-colors cursor-pointer"
              >
                Tiếp tục xem ngoại tuyến
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 min-h-[44px] rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử kết nối lại</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

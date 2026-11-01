import React, { useState } from 'react';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Hide button if already installed as PWA or running inside Capacitor iOS app
  if (isInstalled) {
    return null;
  }

  // Chromium / Desktop / Android direct install flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-xs font-bold text-[#121316] transition-colors cursor-pointer"
        title="Cài đặt ứng dụng ARTVERSE AI"
      >
        <Download className="w-3.5 h-3.5 text-[#1D4ED8]" />
        <span className="hidden sm:inline">Cài ứng dụng</span>
      </button>
    );
  }

  // iOS Safari guided installation flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[40px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-xs font-bold text-[#121316] transition-colors cursor-pointer"
          title="Cài đặt ARTVERSE AI lên màn hình chính iPhone"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#1D4ED8]" />
          <span className="hidden sm:inline">Cài trên iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#FAF8F5] border border-stone-200 p-6 shadow-2xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1D4ED8] block">
                    PWA CHO IPHONE SAFARI
                  </span>
                  <h3 className="font-editorial text-lg font-bold text-[#121316] mt-0.5">
                    Cài đặt ARTVERSE AI
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="min-h-[36px] min-w-[36px] rounded-xl bg-stone-200/70 flex items-center justify-center text-stone-700 hover:bg-stone-300 cursor-pointer"
                  aria-label="Đóng hướng dẫn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed">
                Thêm <strong>ARTVERSE AI</strong> vào Màn hình chính iPhone để mở toàn màn hình, hỗ trợ Safe Area và truy cập nhanh như ứng dụng iOS:
              </p>

              <div className="space-y-2.5 bg-white p-4 rounded-2xl border border-stone-200 text-xs text-[#121316]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1D4ED8] flex items-center justify-center shrink-0 font-bold">
                    <Share className="w-4 h-4" />
                  </div>
                  <span>
                    <strong>Bước 1:</strong> Nhấn nút <strong>Chia sẻ (Share)</strong> ở thanh công cụ phía dưới trình duyệt Safari.
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1D4ED8] flex items-center justify-center shrink-0 font-bold">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <span>
                    <strong>Bước 2:</strong> Cuộn xuống và chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>, sau đó nhấn <strong>Thêm</strong>.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-xl bg-[#121316] text-white text-xs font-bold hover:bg-stone-800 transition-colors cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

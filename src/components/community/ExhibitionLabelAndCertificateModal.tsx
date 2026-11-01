/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Exhibition QR Labels & Digital Exhibition Certificate Modal
 * In Thẻ Triển lãm kèm Mã QR & Cấp Chứng nhận Triển lãm Mĩ thuật Ẩn danh
 */

import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CommunityArtwork, POSITIVE_REACTIONS_META, PositiveReactionKey } from '../../types/communityArt';
import { ArtverseLogo } from '../common/ArtverseLogo';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import { 
  X, 
  QrCode, 
  Award, 
  Printer, 
  Download, 
  Copy, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  Palette,
  Calendar
} from 'lucide-react';

interface ExhibitionLabelAndCertificateModalProps {
  artwork: CommunityArtwork;
  initialTab?: 'qr-label' | 'certificate';
  onClose: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const ExhibitionLabelAndCertificateModal: React.FC<ExhibitionLabelAndCertificateModalProps> = ({
  artwork,
  initialTab = 'qr-label',
  onClose,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'qr-label' | 'certificate'>(initialTab);
  const [schoolName, setSchoolName] = useState<string>(() => {
    return localStorage.getItem('artverse_school_name') || 'Trường Tiểu học & THCS — Không gian Nghệ thuật Số ARTVERSE';
  });
  const [exhibitionName, setExhibitionName] = useState<string>(() => {
    return localStorage.getItem('artverse_exhibition_name') || 'Triển lãm Sáng tạo Mĩ thuật Học đường';
  });
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const shareUrl = `${window.location.origin}/#gallery?token=${artwork.shareToken}`;

  const totalReactions = (['unique_idea', 'striking_color', 'interesting_composition', 'noteworthy_detail', 'inspiring'] as PositiveReactionKey[])
    .reduce((sum, key) => sum + (artwork.reactions[key] || 0), 0);

  const handleSaveSchoolInfo = (nextSchool: string, nextExhib: string) => {
    setSchoolName(nextSchool);
    setExhibitionName(nextExhib);
    localStorage.setItem('artverse_school_name', nextSchool);
    localStorage.setItem('artverse_exhibition_name', nextExhib);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedUrl(true);
    onShowToast('success', 'Đã sao chép đường dẫn QR', 'Liên kết triển lãm của tác phẩm đã được lưu vào bộ nhớ tạm.');
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  // High-resolution Canvas PNG Generator for Certificate or QR Label
  const handleDownloadPng = async () => {
    setIsExportingPng(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Không thể khởi tạo Canvas');

      if (activeTab === 'certificate') {
        // Landscape Certificate 1600 x 1130
        canvas.width = 1600;
        canvas.height = 1130;

        // Background Ivory Museum Paper
        const bgGrad = ctx.createLinearGradient(0, 0, 1600, 1130);
        bgGrad.addColorStop(0, '#FFFDF9');
        bgGrad.addColorStop(1, '#F5F2EB');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1600, 1130);

        // Outer & Inner Museum Frame Borders
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 8;
        ctx.strokeRect(48, 48, 1504, 1034);

        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 3;
        ctx.strokeRect(68, 68, 1464, 994);

        // Decorative Corner Accents
        ctx.fillStyle = '#D97706';
        const corners = [
          [68, 68],
          [1516, 68],
          [68, 1046],
          [1516, 1046]
        ];
        corners.forEach(([cx, cy]) => {
          ctx.fillRect(cx, cy, 16, 16);
        });

        // Header Text
        ctx.textAlign = 'center';
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(schoolName.toUpperCase(), 800, 145);

        ctx.fillStyle = '#B45309';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(exhibitionName.toUpperCase(), 800, 185);

        // Main Title
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 54px serif';
        ctx.fillText('CHỨNG NHẬN TRIỂN LÃM NGHỆ THUẬT', 800, 270);

        ctx.fillStyle = '#64748B';
        ctx.font = 'italic 22px serif';
        ctx.fillText('Trao tặng sự sáng tạo, biểu đạt thẩm mĩ và góc nhìn nghệ thuật độc đáo', 800, 315);

        // Recipient Pseudonym
        ctx.fillStyle = '#475569';
        ctx.font = '22px sans-serif';
        ctx.fillText('Trân trọng ghi nhận Nghệ sĩ Nhí ẩn danh:', 800, 385);

        ctx.fillStyle = '#1D4ED8';
        ctx.font = 'bold 46px sans-serif';
        ctx.fillText(artwork.creatorAnonymousPseudonym, 800, 445);

        // Artwork Box
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 2;
        ctx.fillRect(220, 490, 1160, 370);
        ctx.strokeRect(220, 490, 1160, 370);

        // Draw Artwork Image if available
        const imgSrc = artwork.imageUrl;
        if (imgSrc && (imgSrc.startsWith('data:image') || imgSrc.startsWith('http'))) {
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject();
              img.src = imgSrc;
            });
            const boxX = 250;
            const boxY = 515;
            const boxW = 420;
            const boxH = 320;
            const ratio = Math.min(boxW / img.width, boxH / img.height);
            const drawW = img.width * ratio;
            const drawH = img.height * ratio;
            ctx.drawImage(img, boxX + (boxW - drawW) / 2, boxY + (boxH - drawH) / 2, drawW, drawH);
          } catch {
            // Fallback box
            ctx.fillStyle = '#EFF6FF';
            ctx.fillRect(250, 515, 420, 320);
          }
        } else {
          ctx.fillStyle = '#EFF6FF';
          ctx.fillRect(250, 515, 420, 320);
        }

        // Artwork Details inside Box
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 34px sans-serif';
        ctx.fillText(`Tác phẩm: "${artwork.title.substring(0, 38)}"`, 710, 575);

        ctx.fillStyle = '#1D4ED8';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(`Tác giả: ${artwork.creatorAnonymousPseudonym}`, 710, 630);

        ctx.fillStyle = '#334155';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(`Lớp: ${artwork.className}`, 710, 680);
        ctx.font = '22px sans-serif';
        ctx.fillText(`Lời động viên tích cực từ cộng đồng: ${totalReactions} lượt khen`, 710, 730);

        ctx.fillStyle = '#047857';
        ctx.font = 'bold 19px sans-serif';
        ctx.fillText('✓ Đạt chuẩn An toàn Không gian mạng & Bảo mật Học sinh', 710, 795);

        // Footer Signatures
        ctx.textAlign = 'center';
        ctx.fillStyle = '#475569';
        ctx.font = '20px sans-serif';
        ctx.fillText(`Ngày cấp: ${new Date().toLocaleDateString('vi-VN')}`, 420, 945);
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('BẢO TÀNG NGHỆ THUẬT SỐ ARTVERSE AI', 420, 980);

        ctx.font = '20px sans-serif';
        ctx.fillText('Giáo viên Phụ trách Triển lãm', 1180, 945);
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(artwork.teacherName || 'Giáo viên Mĩ thuật', 1180, 985);
      } else {
        // QR Label Card 900 x 600
        canvas.width = 900;
        canvas.height = 600;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 900, 600);

        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 6;
        ctx.strokeRect(24, 24, 852, 552);

        ctx.fillStyle = '#1E3A8A';
        ctx.fillRect(24, 24, 852, 85);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText('ARTVERSE AI · THẺ TRIỂN LÃM TÁC PHẨM MĨ THUẬT', 54, 76);

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 34px sans-serif';
        ctx.fillText(`Tác phẩm: ${artwork.title.substring(0, 32)}`, 54, 185);

        ctx.fillStyle = '#1D4ED8';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(`Tác giả: ${artwork.creatorAnonymousPseudonym}`, 54, 245);

        ctx.fillStyle = '#334155';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(`Lớp: ${artwork.className}`, 54, 305);

        ctx.fillStyle = '#64748B';
        ctx.font = '18px sans-serif';
        ctx.fillText(`Mã tác phẩm: #${artwork.id.slice(-8).toUpperCase()}`, 54, 430);
        ctx.fillText('Quét mã QR trên góc thẻ để ngắm tranh và gửi lời khen tích cực!', 54, 520);
      }

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${activeTab === 'certificate' ? 'Chung-nhan-Trien-lam' : 'The-QR-Trien-lam'}-${artwork.id.slice(-6)}.png`;
      link.href = dataUrl;
      link.click();

      onShowToast(
        'success',
        'Đã tải tệp ảnh chất lượng cao',
        activeTab === 'certificate'
          ? 'Đã xuất Chứng nhận Triển lãm định dạng PNG sắc nét.'
          : 'Đã xuất Thẻ Triển lãm thành tệp ảnh PNG.'
      );
    } catch (err) {
      console.error('Lỗi xuất ảnh:', err);
      onShowToast('error', 'Không thể xuất ảnh', 'Vui lòng sử dụng nút In ấn / Lưu PDF để xuất đầy đủ mã QR.');
    } finally {
      setIsExportingPng(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Top Modal Header (Hidden when printing) */}
        <div className="p-4 sm:px-6 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <ArtverseLogo className="w-9 h-9" />
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Ấn phẩm Triển lãm & Chứng nhận Sáng tạo
              </h2>
              <p className="text-xs text-slate-500">
                Tạo thẻ QR dán cạnh tranh thật tại trường hoặc cấp Giấy chứng nhận Triển lãm ẩn danh
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('qr-label')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'qr-label'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Thẻ QR Dán Tranh</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('certificate')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'certificate'
                  ? 'bg-white text-amber-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Chứng nhận Triển lãm</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customization Bar (Hidden when printing) */}
        <div className="px-6 py-3 bg-blue-50/60 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs print:hidden">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Tên Trường / Đơn vị tổ chức (in trên phôi):
            </label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => handleSaveSchoolInfo(e.target.value, exhibitionName)}
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
              placeholder="Nhập tên trường của bạn..."
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Tên Kỳ Triển lãm / Sự kiện:
            </label>
            <input
              type="text"
              value={exhibitionName}
              onChange={(e) => handleSaveSchoolInfo(schoolName, e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
              placeholder="VD: Triển lãm Mĩ thuật Học kỳ I..."
            />
          </div>
        </div>

        {/* Main Preview Container (Printable) */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100 flex items-center justify-center" ref={printAreaRef}>
          {activeTab === 'qr-label' ? (
            /* MUSEUM QR ARTWORK LABEL CARD */
            <div className="bg-white w-full max-w-2xl rounded-2xl border-2 border-slate-900 shadow-xl overflow-hidden print:shadow-none print:border-2">
              {/* Museum Top Strip */}
              <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ArtverseLogo className="w-7 h-7" />
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">
                      {schoolName}
                    </div>
                    <div className="text-xs font-extrabold tracking-wide">
                      THẺ ĐỊNH DANH TÁC PHẨM · BẢO TÀNG SỐ ARTVERSE
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono bg-white/10 px-2.5 py-1 rounded text-slate-200">
                  #{artwork.id.slice(-6).toUpperCase()}
                </span>
              </div>

              {/* Card Main Grid */}
              <div className="p-6 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                {/* Left Artwork Thumbnail + Info */}
                <div className="sm:col-span-8 space-y-3">
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      {artwork.imageUrl && (artwork.imageUrl.startsWith('data:image') || artwork.imageUrl.startsWith('http')) ? (
                        <img
                          src={artwork.imageUrl}
                          alt={artwork.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ArtCanvasVisual
                          type={artwork.visualType}
                          title={artwork.title}
                          className="w-full h-full"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <span className="inline-block text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                        Lớp: {artwork.className}
                      </span>
                      <h3 className="text-lg font-extrabold text-slate-900 leading-snug">
                        Tác phẩm: {artwork.title}
                      </h3>
                      <p className="text-xs font-bold text-indigo-700">
                        Tác giả: {artwork.creatorAnonymousPseudonym}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Bảo mật Học sinh Zero-Roster
                    </span>
                    <span>·</span>
                    <span>Ngày trưng bày: {new Date(artwork.createdAt).toLocaleDateString('vi-VN') !== 'Invalid Date' ? new Date(artwork.createdAt).toLocaleDateString('vi-VN') : artwork.createdAt}</span>
                  </div>
                </div>

                {/* Right QR Code Box */}
                <div className="sm:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <QRCodeSVG
                      value={shareUrl}
                      size={132}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <div className="text-[11px] font-bold text-slate-800">
                    QUÉT MÃ NGẮM TRANH
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Dùng Camera điện thoại hoặc Zalo quét mã để xem bản số hóa & thả tim động viên tác giả
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* DIGITAL EXHIBITION CERTIFICATE (GIẤY CHỨNG NHẬN TRIỂN LÃM) */
            <div className="bg-[#FFFDF9] w-full max-w-3xl rounded-2xl border-4 border-slate-900 p-3 shadow-2xl print:shadow-none">
              <div className="border-2 border-amber-600/80 rounded-xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
                
                {/* Certificate Header */}
                <div className="text-center space-y-1.5 border-b border-amber-200/80 pb-5">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <ArtverseLogo className="w-8 h-8" />
                  </div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-600">
                    {schoolName}
                  </div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-700">
                    {exhibitionName}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pt-1 font-serif">
                    CHỨNG NHẬN TRIỂN LÃM NGHỆ THUẬT
                  </h1>
                  <p className="text-xs text-slate-500 italic">
                    Tôn vinh trí tưởng tượng, cảm xúc thẩm mĩ và nỗ lực sáng tạo không ngừng
                  </p>
                </div>

                {/* Certificate Recipient */}
                <div className="text-center space-y-1">
                  <div className="text-xs text-slate-600">
                    Ban Tổ chức Không gian Nghệ thuật Số trân trọng trao tặng Nghệ sĩ Nhí ẩn danh:
                  </div>
                  <div className="text-2xl font-extrabold text-blue-700 tracking-wide py-1">
                    ✦ {artwork.creatorAnonymousPseudonym} ✦
                  </div>
                </div>

                {/* Featured Artwork Showcase inside Certificate */}
                <div className="bg-white rounded-2xl border border-amber-200/90 p-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center shadow-2xs">
                  <div className="sm:col-span-5 h-44 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                    {artwork.imageUrl && (artwork.imageUrl.startsWith('data:image') || artwork.imageUrl.startsWith('http')) ? (
                      <img
                        src={artwork.imageUrl}
                        alt={artwork.title}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ArtCanvasVisual
                        type={artwork.visualType}
                        title={artwork.title}
                        className="w-full h-full"
                      />
                    )}
                  </div>

                  <div className="sm:col-span-7 space-y-2 text-xs">
                    <div className="text-base font-extrabold text-slate-900">
                      Tác phẩm: "{artwork.title}"
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 text-slate-600">
                      <div>
                        <strong className="text-slate-800">Tác giả:</strong> {artwork.creatorAnonymousPseudonym}
                      </div>
                      <div>
                        <strong className="text-slate-800">Lớp:</strong> {artwork.className}
                      </div>
                    </div>

                    {/* Positive Community Cheers Summary (Non-ranking, non-scoring) */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[11px] font-bold text-amber-800 mb-1.5 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Dấu ấn Cảm xúc Tích cực từ Cộng đồng ({totalReactions} lời động viên):</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(['unique_idea', 'striking_color', 'interesting_composition', 'noteworthy_detail', 'inspiring'] as PositiveReactionKey[]).map((key) => {
                          const meta = POSITIVE_REACTIONS_META[key];
                          const count = artwork.reactions[key] || 0;
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-amber-50/80 border border-amber-200/70 px-2 py-0.5 rounded-md"
                            >
                              <span>{meta.icon}</span>
                              <span>{meta.label}: {count}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Certificate Footer with QR Verification & Teacher Signature */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                      <QRCodeSVG value={shareUrl} size={64} level="L" />
                    </div>
                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <div className="font-bold text-slate-800">Xác thực Triển lãm Số</div>
                      <div>Mã chứng nhận: #{artwork.id.slice(-8).toUpperCase()}</div>
                      <div>Bảo vệ quyền riêng tư trẻ em (Zero-Roster)</div>
                    </div>
                  </div>

                  <div className="text-center sm:text-right space-y-1">
                    <div className="text-[11px] text-slate-500">
                      Cấp ngày {new Date().toLocaleDateString('vi-VN')}
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      Giáo viên Phụ trách Triển lãm
                    </div>
                    <div className="text-sm font-extrabold text-blue-900 pt-1">
                      {artwork.teacherName || 'Giáo viên Mĩ thuật'}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions (Hidden when printing) */}
        <div className="p-4 sm:px-6 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={handleCopyUrl}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
          >
            {copiedUrl ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copiedUrl ? 'Đã chép liên kết QR' : 'Sao chép liên kết QR'}</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isExportingPng}
              onClick={handleDownloadPng}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>{isExportingPng ? 'Đang kết xuất ảnh...' : 'Tải ảnh PNG sắc nét'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>In ngay / Lưu PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

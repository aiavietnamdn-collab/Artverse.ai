/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Class Artbook & Exhibition Poster Export Modal
 * Xuất Poster Triển lãm Tổng hợp & Kỷ yếu Mĩ thuật của Lớp (In PDF / Tải ảnh PNG)
 */

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CommunityArtwork, ClassGroup, ArtLesson, PositiveReactionKey } from '../../types/communityArt';
import { ArtverseLogo } from '../common/ArtverseLogo';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import { 
  X, 
  BookOpen, 
  Printer, 
  Download, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  LayoutGrid,
  CheckCircle2
} from 'lucide-react';

interface ClassArtbookExportModalProps {
  artworks: CommunityArtwork[];
  classes: ClassGroup[];
  lessons: ArtLesson[];
  initialClassFilter?: string;
  initialLessonFilter?: string;
  onClose: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const ClassArtbookExportModal: React.FC<ClassArtbookExportModalProps> = ({
  artworks,
  classes,
  lessons,
  initialClassFilter = 'all',
  initialLessonFilter = 'all',
  onClose,
  onShowToast
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassFilter);
  const [selectedLessonId, setSelectedLessonId] = useState<string>(initialLessonFilter);
  const [posterTheme, setPosterTheme] = useState<'museum-light' | 'gallery-dark' | 'warm-ivory'>('warm-ivory');
  const [customTitle, setCustomTitle] = useState<string>('TRIỂN LÃM SÁNG TẠO MĨ THUẬT HỌC ĐƯỜNG');
  const [schoolName, setSchoolName] = useState<string>(() => {
    return localStorage.getItem('artverse_school_name') || 'Trường Tiểu học & THCS — Bảo tàng Nghệ thuật Số ARTVERSE';
  });
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);

  // Filter artworks for the poster
  const filteredArtworks = artworks.filter((art) => {
    if (art.status !== 'approved') return false;
    if (selectedClassId !== 'all' && art.classGroupId !== selectedClassId) return false;
    if (selectedLessonId !== 'all' && art.lessonId !== selectedLessonId) return false;
    return true;
  });

  const currentClass = classes.find((c) => c.id === selectedClassId);
  const currentLesson = lessons.find((l) => l.id === selectedLessonId);

  const galleryUrl = `${window.location.origin}/#gallery`;

  const totalReactionsCount = filteredArtworks.reduce((acc, art) => {
    const artSum = (['unique_idea', 'striking_color', 'interesting_composition', 'noteworthy_detail', 'inspiring'] as PositiveReactionKey[])
      .reduce((s, k) => s + (art.reactions[k] || 0), 0);
    return acc + artSum;
  }, 0);

  const handlePrintArtbook = () => {
    window.print();
  };

  // High-res Canvas Poster Generator (downloads composite PNG poster of the class exhibition)
  const handleDownloadPosterPng = async () => {
    if (filteredArtworks.length === 0) {
      onShowToast('error', 'Chưa có tác phẩm', 'Không có tác phẩm nào trong bộ lọc hiện tại để ghép Poster.');
      return;
    }

    setIsGeneratingPng(true);
    try {
      const itemsToDraw = filteredArtworks.slice(0, 12); // Up to 12 artworks on a single composite poster
      const cols = itemsToDraw.length <= 4 ? 2 : 3;
      const rows = Math.ceil(itemsToDraw.length / cols);

      const cardW = 440;
      const cardH = 420;
      const gap = 36;
      const paddingX = 80;
      const headerH = 260;
      const footerH = 140;

      const canvasW = paddingX * 2 + cols * cardW + (cols - 1) * gap;
      const canvasH = headerH + rows * cardH + Math.max(0, rows - 1) * gap + footerH;

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Không thể khởi tạo Canvas');

      // Background
      if (posterTheme === 'gallery-dark') {
        ctx.fillStyle = '#0F172A';
      } else if (posterTheme === 'warm-ivory') {
        ctx.fillStyle = '#FAF8F5';
      } else {
        ctx.fillStyle = '#FFFFFF';
      }
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Header Banner
      const isDark = posterTheme === 'gallery-dark';
      ctx.textAlign = 'center';
      ctx.fillStyle = isDark ? '#93C5FD' : '#1D4ED8';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(schoolName.toUpperCase(), canvasW / 2, 75);

      ctx.fillStyle = isDark ? '#FFFFFF' : '#0F172A';
      ctx.font = 'bold 46px serif';
      ctx.fillText(customTitle.toUpperCase(), canvasW / 2, 135);

      const subtitle = `${currentClass ? currentClass.name : 'Toàn Trường'} (${filteredArtworks.length} tác phẩm)`;
      ctx.fillStyle = isDark ? '#CBD5E1' : '#475569';
      ctx.font = '24px sans-serif';
      ctx.fillText(subtitle, canvasW / 2, 185);

      // Divider Line
      ctx.strokeStyle = isDark ? '#334155' : '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(paddingX, 220);
      ctx.lineTo(canvasW - paddingX, 220);
      ctx.stroke();

      // Draw Each Artwork Card
      for (let i = 0; i < itemsToDraw.length; i++) {
        const art = itemsToDraw[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = paddingX + col * (cardW + gap);
        const y = headerH + row * (cardH + gap);

        // Card Box
        ctx.fillStyle = isDark ? '#1E293B' : '#FFFFFF';
        ctx.strokeStyle = isDark ? '#334155' : '#CBD5E1';
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, cardW, cardH);
        ctx.strokeRect(x, y, cardW, cardH);

        // Artwork Image Area
        const imgBoxX = x + 16;
        const imgBoxY = y + 16;
        const imgBoxW = cardW - 32;
        const imgBoxH = 270;

        ctx.fillStyle = isDark ? '#0F172A' : '#F1F5F9';
        ctx.fillRect(imgBoxX, imgBoxY, imgBoxW, imgBoxH);

        const artImgSrc = art.imageUrl;
        if (artImgSrc && (artImgSrc.startsWith('data:image') || artImgSrc.startsWith('http'))) {
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject();
              img.src = artImgSrc;
            });
            const ratio = Math.min(imgBoxW / img.width, imgBoxH / img.height);
            const drawW = img.width * ratio;
            const drawH = img.height * ratio;
            ctx.drawImage(img, imgBoxX + (imgBoxW - drawW) / 2, imgBoxY + (imgBoxH - drawH) / 2, drawW, drawH);
          } catch {
            // Fallback
          }
        }

        // Card Text
        ctx.textAlign = 'left';
        ctx.fillStyle = isDark ? '#F8FAFC' : '#0F172A';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(art.title.substring(0, 28), x + 20, y + 322);

        ctx.fillStyle = isDark ? '#93C5FD' : '#2563EB';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`Tác giả: ${art.creatorAnonymousPseudonym}`, x + 20, y + 355);

        ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
        ctx.font = '16px sans-serif';
        ctx.fillText(`Lớp: ${art.className}`, x + 20, y + 388);
      }

      // Footer
      ctx.textAlign = 'center';
      ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
      ctx.font = '20px sans-serif';
      ctx.fillText(
        `BẢO TÀNG NGHỆ THUẬT SỐ ARTVERSE AI · Xuất bản ngày ${new Date().toLocaleDateString('vi-VN')} · Bảo mật Học sinh Zero-Roster`,
        canvasW / 2,
        canvasH - 55
      );

      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Poster-Trien-lam-${currentClass ? currentClass.code : 'Toan-truong'}-${Date.now().toString().slice(-4)}.png`;
      link.href = pngUrl;
      link.click();

      onShowToast('success', 'Đã tải Poster Triển lãm!', 'Tệp ảnh Poster ghép tranh độ phân giải cao đã được tải về máy.');
    } catch (err) {
      console.error('Lỗi tạo Poster PNG:', err);
      onShowToast('error', 'Lỗi kết xuất ảnh', 'Vui lòng sử dụng nút In Kỷ yếu / Lưu PDF.');
    } finally {
      setIsGeneratingPng(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Modal Header (Hidden on Print) */}
        <div className="p-4 sm:px-6 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Xuất Kỷ yếu Mĩ thuật & Poster Triển lãm Lớp học
              </h2>
              <p className="text-xs text-slate-500">
                Tổng hợp các bức tranh của lớp thành ấn phẩm Kỷ yếu PDF hoặc tải ảnh Poster ghép tranh chất lượng cao
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Theme Controls Bar (Hidden on Print) */}
        <div className="px-6 py-3.5 bg-slate-100/80 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs print:hidden">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Chọn Lớp triển lãm:</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedLessonId('all');
              }}
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800"
            >
              <option value="all">Tất cả các Lớp ({artworks.filter(a => a.status === 'approved').length} tranh)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Tiêu đề Poster / Kỷ yếu:</label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Phong cách Phông nền:</label>
            <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-300">
              <button
                type="button"
                onClick={() => setPosterTheme('warm-ivory')}
                className={`py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                  posterTheme === 'warm-ivory' ? 'bg-amber-100 text-amber-900' : 'text-slate-600'
                }`}
              >
                Giấy Kem
              </button>
              <button
                type="button"
                onClick={() => setPosterTheme('museum-light')}
                className={`py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                  posterTheme === 'museum-light' ? 'bg-blue-100 text-blue-900' : 'text-slate-600'
                }`}
              >
                Trắng Sáng
              </button>
              <button
                type="button"
                onClick={() => setPosterTheme('gallery-dark')}
                className={`py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                  posterTheme === 'gallery-dark' ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                Bảo tàng Tối
              </button>
            </div>
          </div>
        </div>

        {/* Printable Artbook / Poster Preview Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-200/70">
          <div
            className={`max-w-5xl mx-auto rounded-3xl p-8 shadow-xl border transition-colors print:shadow-none print:border-none ${
              posterTheme === 'gallery-dark'
                ? 'bg-slate-950 text-white border-slate-800'
                : posterTheme === 'warm-ivory'
                ? 'bg-[#FAF8F5] text-slate-900 border-amber-200/80'
                : 'bg-white text-slate-900 border-slate-200'
            }`}
          >
            {/* Poster Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-current/10 pb-6 mb-8">
              <div className="flex items-center gap-4">
                <ArtverseLogo className="w-14 h-14 shrink-0" />
                <div>
                  <div className={`text-xs font-bold uppercase tracking-widest ${posterTheme === 'gallery-dark' ? 'text-blue-400' : 'text-blue-700'}`}>
                    {schoolName}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5 font-serif">
                    {customTitle}
                  </h1>
                  <div className={`text-xs mt-1 flex flex-wrap items-center gap-2 ${posterTheme === 'gallery-dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    <span className="font-bold">
                      {currentClass ? currentClass.name : 'Triển lãm Liên khối'}
                    </span>
                    <span>·</span>
                    <span>{filteredArtworks.length} tác phẩm trưng bày</span>
                    <span>·</span>
                    <span>{totalReactionsCount} lượt khen tích cực</span>
                  </div>
                </div>
              </div>

              {/* QR Code to Full Online Exhibition */}
              <div className={`flex items-center gap-3 p-3 rounded-2xl border shrink-0 ${
                posterTheme === 'gallery-dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="p-1.5 bg-white rounded-lg">
                  <QRCodeSVG value={galleryUrl} size={68} level="L" />
                </div>
                <div className="text-[11px] max-w-[130px] leading-snug">
                  <div className="font-bold">Bảo tàng Trực tuyến</div>
                  <div className={posterTheme === 'gallery-dark' ? 'text-slate-400' : 'text-slate-500'}>
                    Quét mã QR để xem triển lãm số hóa toàn trường
                  </div>
                </div>
              </div>
            </div>

            {/* Artworks Grid in Poster */}
            {filteredArtworks.length === 0 ? (
              <div className="py-16 text-center text-sm opacity-60">
                Chưa có tác phẩm đã duyệt nào trong lớp / bài học này để đưa vào Kỷ yếu.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredArtworks.map((art) => (
                  <div
                    key={art.id}
                    className={`rounded-2xl overflow-hidden border flex flex-col ${
                      posterTheme === 'gallery-dark'
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-white border-slate-200/90 shadow-2xs'
                    }`}
                  >
                    <div className="h-44 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                      {art.imageUrl && (art.imageUrl.startsWith('data:image') || art.imageUrl.startsWith('http')) ? (
                        <img
                          src={art.imageUrl}
                          alt={art.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ArtCanvasVisual
                          type={art.visualType}
                          title={art.title}
                          className="w-full h-full"
                        />
                      )}
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-between space-y-1.5">
                      <div>
                        <div className="text-xs font-extrabold line-clamp-1">
                          {art.title}
                        </div>
                        <div className={`text-[11px] font-semibold ${posterTheme === 'gallery-dark' ? 'text-blue-400' : 'text-blue-700'}`}>
                          Tác giả: {art.creatorAnonymousPseudonym}
                        </div>
                      </div>
                      <div className={`text-[10px] pt-1 border-t flex items-center justify-between ${
                        posterTheme === 'gallery-dark' ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
                      }`}>
                        <span className="truncate font-semibold">Lớp: {art.className}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Poster Footer */}
            <div className="mt-8 pt-4 border-t border-current/10 flex flex-wrap items-center justify-between gap-2 text-[11px] opacity-75">
              <div>
                Ấn phẩm Kỷ yếu Nghệ thuật Số · Tạo bởi Hệ thống <strong>ARTVERSE AI</strong>
              </div>
              <div>
                Bảo mật danh tính học sinh theo tiêu chuẩn Sư phạm Zero-Roster · Ngày in: {new Date().toLocaleDateString('vi-VN')}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls (Hidden on Print) */}
        <div className="p-4 sm:px-6 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Sẵn sàng xuất <strong>{filteredArtworks.length}</strong> tác phẩm trong bộ sưu tập</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isGeneratingPng || filteredArtworks.length === 0}
              onClick={handleDownloadPosterPng}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              <span>{isGeneratingPng ? 'Đang ghép Poster PNG...' : 'Tải ảnh Poster Ghép Tranh (.PNG)'}</span>
            </button>

            <button
              type="button"
              disabled={filteredArtworks.length === 0}
              onClick={handlePrintArtbook}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>In Kỷ yếu / Lưu PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

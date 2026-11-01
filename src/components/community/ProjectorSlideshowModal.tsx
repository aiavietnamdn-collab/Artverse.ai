/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Projector Slideshow Mode (Chế độ Trình chiếu Máy chiếu Lớp học & Bảo tàng Số)
 * Hỗ trợ: Ken Burns Zoom nhẹ, Chọn tốc độ (5s/8s/12s), Nhạc nền Bảo tàng thư giãn (Web Audio), Mã QR trực tiếp trên màn chiếu
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CommunityArtwork, PositiveReactionKey, POSITIVE_REACTIONS_META } from '../../types/communityArt';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Maximize, 
  Minimize, 
  Sparkles, 
  Volume2,
  VolumeX,
  QrCode,
  Clock,
  ZoomIn
} from 'lucide-react';

interface ProjectorSlideshowModalProps {
  artworks: CommunityArtwork[];
  initialIndex?: number;
  onClose: () => void;
  onReact: (artworkId: string, reactionKey: PositiveReactionKey) => void;
}

export const ProjectorSlideshowModal: React.FC<ProjectorSlideshowModalProps> = ({
  artworks,
  initialIndex = 0,
  onClose,
  onReact
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [slideIntervalSec, setSlideIntervalSec] = useState<5 | 8 | 12>(8);
  const [kenBurnsEnabled, setKenBurnsEnabled] = useState(true);
  const [showQrOnScreen, setShowQrOnScreen] = useState(true);
  const [isMusicOn, setIsMusicOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const chimeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentArtwork = artworks[currentIndex] || artworks[0];

  const handleNext = useCallback(() => {
    if (artworks.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % artworks.length);
  }, [artworks.length]);

  const handlePrev = useCallback(() => {
    if (artworks.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + artworks.length) % artworks.length);
  }, [artworks.length]);

  // Web Audio API Ambient Museum Music Synthesizer (Gentle pentatonic harp/piano chords, zero external MP3 dependencies)
  const playGentleMuseumChord = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // C major / A minor pentatonic soothing frequencies
      const chordSets = [
        [261.63, 329.63, 392.00, 523.25], // C4, E4, G4, C5
        [220.00, 293.66, 349.23, 440.00], // A3, D4, F4, A4
        [196.00, 293.66, 392.00, 493.88], // G3, D4, G4, B4
        [174.61, 261.63, 329.63, 440.00]  // F3, C4, E4, A4
      ];
      const chord = chordSets[Math.floor(Math.random() * chordSets.length)];

      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.22);

        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + idx * 0.22 + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.22 + 3.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.22);
        osc.stop(ctx.currentTime + idx * 0.22 + 3.7);
      });
    } catch {
      // Ignore audio autoplay block if any
    }
  }, []);

  useEffect(() => {
    if (isMusicOn) {
      playGentleMuseumChord();
      chimeIntervalRef.current = setInterval(() => {
        playGentleMuseumChord();
      }, 4200);
    } else {
      if (chimeIntervalRef.current) {
        clearInterval(chimeIntervalRef.current);
      }
    }
    return () => {
      if (chimeIntervalRef.current) {
        clearInterval(chimeIntervalRef.current);
      }
    };
  }, [isMusicOn, playGentleMuseumChord]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Keyboard navigation (ArrowLeft, ArrowRight, Space for pause/play, Escape to exit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  // Auto-play timer with configurable speed (5s / 8s / 12s)
  useEffect(() => {
    if (!isPlaying || artworks.length <= 1) return;
    const interval = setInterval(() => {
      handleNext();
    }, slideIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [isPlaying, slideIntervalSec, handleNext, artworks.length]);

  // Auto-hide controls after inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3800);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, [isPlaying]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  if (!currentArtwork) return null;

  const shareUrl = `${window.location.origin}/#gallery?token=${currentArtwork.shareToken}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col select-none overflow-hidden">
      {/* Top Floating Control Bar */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 p-4 sm:p-6 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-b from-slate-950/90 via-slate-950/40 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/80 flex items-center justify-center text-white shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <span>BẢO TÀNG NGHỆ THUẬT SỐ ARTVERSE</span>
              <span className="text-[10px] bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full border border-blue-400/30">
                Trình chiếu Máy chiếu / TV
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
               Phím mũi tên để chuyển tranh · Phím cách (Space) để dừng/chạy
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Speed Selector (5s / 8s / 12s) */}
          <div className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-md p-1 rounded-xl border border-white/15 text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-300 ml-1.5 mr-0.5" />
            {([5, 8, 12] as const).map((sec) => (
              <button
                key={sec}
                onClick={() => setSlideIntervalSec(sec)}
                className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  slideIntervalSec === sec
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title={`Chuyển tranh mỗi ${sec} giây`}
              >
                {sec}s
              </button>
            ))}
          </div>

          {/* Ken Burns Effect Toggle */}
          <button
            onClick={() => setKenBurnsEnabled((k) => !k)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border transition-all cursor-pointer ${
              kenBurnsEnabled
                ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/40'
                : 'bg-white/10 text-slate-300 border-white/15'
            }`}
            title="Hiệu ứng phóng nhẹ điện ảnh (Ken Burns)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Thu phóng nhẹ</span>
          </button>

          {/* Ambient Museum Sound Toggle */}
          <button
            onClick={() => setIsMusicOn((m) => !m)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border transition-all cursor-pointer ${
              isMusicOn
                ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40'
                : 'bg-white/10 text-slate-300 border-white/15'
            }`}
            title="Bật/Tắt nhạc nền thư giãn Bảo tàng"
          >
            {isMusicOn ? <Volume2 className="w-3.5 h-3.5 text-emerald-300" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isMusicOn ? 'Nhạc nền: Bật' : 'Nhạc nền'}</span>
          </button>

          {/* Toggle QR on Screen */}
          <button
            onClick={() => setShowQrOnScreen((q) => !q)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border transition-all cursor-pointer ${
              showQrOnScreen
                ? 'bg-purple-500/30 text-purple-200 border-purple-400/40'
                : 'bg-white/10 text-slate-300 border-white/15'
            }`}
            title="Hiển thị mã QR trên góc màn hình máy chiếu"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mã QR</span>
          </button>

          {/* Play / Pause Auto-slide */}
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold backdrop-blur-md border transition-all cursor-pointer ${
              isPlaying
                ? 'bg-amber-500/25 text-amber-300 border-amber-400/40 hover:bg-amber-500/35'
                : 'bg-blue-600 text-white border-blue-400 hover:bg-blue-700'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? 'Đang chạy' : 'Tạm dừng'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer"
            title="Toàn màn hình máy chiếu"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Close / Exit Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-rose-600/80 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer"
            title="Thoát chế độ trình chiếu (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Artwork Stage */}
      <div className="flex-1 flex items-center justify-center relative p-4 sm:p-12 overflow-hidden">
        {/* Subtle Ambient Glow behind artwork */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-35">
          <div className="w-[65vw] h-[65vh] rounded-full bg-gradient-to-tr from-blue-600/25 via-indigo-600/20 to-purple-600/25 blur-3xl" />
        </div>

        {/* Center Artwork Visual with optional Ken Burns slow zoom */}
        <div
          key={currentArtwork.id}
          className={`relative max-w-5xl max-h-[75vh] w-full flex items-center justify-center transition-transform duration-[8000ms] ease-out ${
            kenBurnsEnabled && isPlaying ? 'scale-105' : 'scale-100'
          }`}
        >
          {currentArtwork.imageUrl && (currentArtwork.imageUrl.startsWith('data:image') || currentArtwork.imageUrl.startsWith('http')) ? (
            <img
              src={currentArtwork.imageUrl}
              alt={currentArtwork.title}
              className="max-h-[72vh] max-w-full object-contain rounded-2xl shadow-2xl border-2 border-white/15 bg-slate-900/40"
            />
          ) : (
            <div className="w-full max-w-2xl">
              <ArtCanvasVisual
                type={currentArtwork.visualType}
                title={currentArtwork.title}
                className="h-[60vh] w-full rounded-2xl shadow-2xl"
              />
            </div>
          )}
        </div>

        {/* Floating QR Code Card on Top-Right of Stage for Parents/Students to scan from Projector */}
        {showQrOnScreen && (
          <div className="hidden lg:flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-white/15 shadow-2xl absolute right-8 bottom-32 z-20">
            <div className="p-1.5 bg-white rounded-xl">
              <QRCodeSVG value={shareUrl} size={86} level="L" />
            </div>
            <span className="text-[10px] font-bold text-blue-300 tracking-wide">
              QUÉT MÃ NGẮM TRANH
            </span>
          </div>
        )}

        {/* Left Arrow Button */}
        <button
          onClick={handlePrev}
          className={`absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-black/40 hover:bg-blue-600/90 text-white backdrop-blur-md border border-white/15 transition-all active:scale-90 cursor-pointer ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          aria-label="Tác phẩm trước (Mũi tên trái)"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Right Arrow Button */}
        <button
          onClick={handleNext}
          className={`absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-black/40 hover:bg-blue-600/90 text-white backdrop-blur-md border border-white/15 transition-all active:scale-90 cursor-pointer ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          aria-label="Tác phẩm kế tiếp (Mũi tên phải)"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Editorial Caption Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 p-4 sm:p-6 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-85'
        }`}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-blue-300 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-400/30">
                Lớp: {currentArtwork.className}
              </span>
            </div>

            <h2 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
              {currentArtwork.title}
            </h2>

            <div className="flex items-center gap-2 text-xs text-slate-300 pt-0.5">
              <span>Tác giả: <strong className="text-amber-300">{currentArtwork.creatorAnonymousPseudonym}</strong></span>
            </div>
          </div>

          {/* Quick Reaction Cheers on Projector */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-[11px] text-slate-400 font-semibold">
              Tác phẩm {currentIndex + 1} / {artworks.length}
            </span>

            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/15">
              {(['unique_idea', 'striking_color', 'interesting_composition', 'noteworthy_detail', 'inspiring'] as PositiveReactionKey[]).map((key) => {
                const count = currentArtwork.reactions[key] || 0;
                const meta = POSITIVE_REACTIONS_META[key];
                return (
                  <button
                    key={key}
                    onClick={() => onReact(currentArtwork.id, key)}
                    title={`Gửi lời khen: ${meta.label}`}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-white/20 active:scale-95 transition-all text-xs cursor-pointer group"
                  >
                    <span className="group-hover:scale-125 transition-transform">{meta.icon}</span>
                    <span className="text-[11px] font-bold text-slate-200">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

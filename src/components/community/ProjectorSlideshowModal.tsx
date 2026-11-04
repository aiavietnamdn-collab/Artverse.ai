/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — LIVE PRESENTATION (Chức năng Trình chiếu Trực tiếp trong Triển lãm)
 * Tối ưu cho: Máy chiếu lớp học, Màn hình TV, Màn hình LED, Máy tính kết nối máy chiếu (16:9 Full HD & 4K)
 *
 * Hỗ trợ 3 giai đoạn:
 * - Giai đoạn 1: Trình chiếu Tự động (5s, 10s, 15s, 20s, 30s) & Thủ công (Chuột, Phím mũi tên, Space, Esc).
 * - Giai đoạn 2: Trình chiếu theo Bộ sưu tập (Lớp 1–9, Lớp học cụ thể, Chủ đề/Bài học, Chọn 1 hoặc nhiều tác phẩm).
 * - Giai đoạn 3: Đồng bộ Trình chiếu Trực tiếp đa thiết bị thời gian thực qua Firebase Firestore + Chống treo khi mất mạng.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArtLesson,
  ArtworkStory,
  ClassGroup,
  CommunityArtwork,
  LivePresentationBackdrop,
  LivePresentationInterval,
  LivePresentationMode,
  LivePresentationSession,
  PositiveReactionKey,
  POSITIVE_REACTIONS_META,
} from '../../types/communityArt';
import { STANDARD_GRADES, getArtworkNormalizedGrade, normalizeGrade } from '../../utils/gradeUtils';
import {
  ALLOWED_PRESENTATION_INTERVALS,
  buildSafeLivePresentationUrl,
  createLivePresentationSession,
  fetchLivePresentationSession,
  filterArtworksForPresentation,
  normalizeSessionCode,
  subscribeLivePresentationSession,
  updateLivePresentationState,
} from '../../services/livePresentationService';
import { useAuth } from '../../context/AuthContext';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Clock,
  Layers,
  Info,
  Eye,
  EyeOff,
  Radio,
  Copy,
  Check,
  Tv,
  Wifi,
  WifiOff,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Lock,
  Sparkles,
  Power,
  Share2,
  BookOpen,
  UserCheck,
} from 'lucide-react';

interface ProjectorSlideshowModalProps {
  artworks: CommunityArtwork[];
  stories?: ArtworkStory[];
  classes?: ClassGroup[];
  lessons?: ArtLesson[];
  initialIndex?: number;
  initialClassFilter?: string;
  initialLessonFilter?: string;
  initialJoinSessionCode?: string | null;
  onClose: () => void;
  onReact: (artworkId: string, reactionKey: PositiveReactionKey) => void;
  onShowToast?: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const ProjectorSlideshowModal: React.FC<ProjectorSlideshowModalProps> = ({
  artworks,
  stories = [],
  classes = [],
  lessons = [],
  initialIndex = 0,
  initialClassFilter = 'all',
  initialLessonFilter = 'all',
  initialJoinSessionCode = null,
  onClose,
  onReact,
  onShowToast,
}) => {
  const { user, profile, isTeacher, isAdmin, getValidBearerToken } = useAuth();

  // ---------------------------------------------------------------------------
  // 1. Presentation Mode & Collection State
  // ---------------------------------------------------------------------------
  const [presentationMode, setPresentationMode] = useState<LivePresentationMode>('auto');
  const [filterGrade, setFilterGrade] = useState<string>(() =>
    initialClassFilter && initialClassFilter !== 'all' ? initialClassFilter : 'all'
  );
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterLessonId, setFilterLessonId] = useState<string>(() =>
    initialLessonFilter && initialLessonFilter !== 'all' ? initialLessonFilter : 'all'
  );
  const [selectedArtworkIds, setSelectedArtworkIds] = useState<string[]>([]);

  // ---------------------------------------------------------------------------
  // 2. Playback & Aesthetic Controls
  // ---------------------------------------------------------------------------
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [slideIntervalSec, setSlideIntervalSec] = useState<LivePresentationInterval>(10);
  const [showArtworkInfo, setShowArtworkInfo] = useState<boolean>(true);
  const [showAuthorInfo, setShowAuthorInfo] = useState<boolean>(true);
  const [showArtworkStory, setShowArtworkStory] = useState<boolean>(true);
  const [pureArtworkOnly, setPureArtworkOnly] = useState<boolean>(false);
  const [backdropTheme, setBackdropTheme] = useState<LivePresentationBackdrop>('obsidian');
  const [isMusicOn, setIsMusicOn] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [transitionFadeKey, setTransitionFadeKey] = useState<number>(0);

  // ---------------------------------------------------------------------------
  // 3. Drawers / Modals inside Live Presentation
  // ---------------------------------------------------------------------------
  const [activeDrawer, setActiveDrawer] = useState<
    'none' | 'collection' | 'live_sync' | 'projector_guide'
  >('none');

  // ---------------------------------------------------------------------------
  // 4. Multi-device Live Session State (Firebase Firestore + Backend Sync)
  // ---------------------------------------------------------------------------
  const [liveSession, setLiveSession] = useState<LivePresentationSession | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState<string>(initialJoinSessionCode || '');
  const [isCreatingLive, setIsCreatingLive] = useState<boolean>(false);
  const [isJoiningLive, setIsJoiningLive] = useState<boolean>(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingResync, setPendingResync] = useState<boolean>(false);

  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine whether the current user is the authorized Host of an active live session
  const isLiveHost = useMemo(() => {
    if (!liveSession) return true; // Local presentation on own device
    if (isAdmin) return true;
    if (isTeacher && user?.uid && liveSession.hostUid === user.uid) return true;
    return false;
  }, [liveSession, isAdmin, isTeacher, user?.uid]);

  // If connected to a live session and NOT the host/admin, user is strictly Read-Only Viewer
  const isViewerReadOnly = Boolean(liveSession && !isLiveHost);

  // ---------------------------------------------------------------------------
  // 5. Filtered Collection Artworks (Strictly public & approved, no mixing)
  // ---------------------------------------------------------------------------
  const collectionArtworks = useMemo(() => {
    return filterArtworksForPresentation(artworks, {
      filterGrade,
      filterClassId,
      filterLessonId,
      selectedArtworkIds,
    });
  }, [artworks, filterGrade, filterClassId, filterLessonId, selectedArtworkIds]);

  // Candidate pool for the Collection Picker (filtered by grade/class/lesson before individual checkbox selection)
  const poolForSelection = useMemo(() => {
    return filterArtworksForPresentation(artworks, {
      filterGrade,
      filterClassId,
      filterLessonId,
      selectedArtworkIds: [],
    });
  }, [artworks, filterGrade, filterClassId, filterLessonId]);

  // Ensure currentIndex stays in bounds when collection changes
  useEffect(() => {
    if (collectionArtworks.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= collectionArtworks.length) {
      setCurrentIndex(0);
    }
  }, [collectionArtworks.length, currentIndex]);

  const currentArtwork = collectionArtworks[currentIndex] || collectionArtworks[0] || null;

  // Lookup approved story linked to currentArtwork
  const currentArtworkStory = useMemo(() => {
    if (!currentArtwork) return null;
    return (
      stories.find(
        (s) => s.artworkId === currentArtwork.id && s.status === 'approved'
      ) || null
    );
  }, [currentArtwork, stories]);

  // Lookup lesson topic for current artwork if available
  const currentLessonTopic = useMemo(() => {
    if (!currentArtwork) return '';
    if (currentArtwork.lessonTitle) return currentArtwork.lessonTitle;
    if (currentArtwork.lessonId) {
      const foundLesson = lessons.find((l) => l.id === currentArtwork.lessonId);
      if (foundLesson) return foundLesson.title || foundLesson.topic || '';
    }
    return '';
  }, [currentArtwork, lessons]);

  // ---------------------------------------------------------------------------
  // 6. Push Host State Changes to Firebase Live Session
  // ---------------------------------------------------------------------------
  const syncHostStateToCloud = useCallback(
    async (
      partialUpdates: Partial<
        Pick<
          LivePresentationSession,
          | 'status'
          | 'mode'
          | 'currentIndex'
          | 'isPlaying'
          | 'intervalSeconds'
          | 'showArtworkInfo'
          | 'showAuthorInfo'
          | 'showArtworkStory'
          | 'pureArtworkOnly'
          | 'backdropTheme'
          | 'filterGrade'
          | 'filterClassId'
          | 'filterLessonId'
          | 'selectedArtworkIds'
        >
      >
    ) => {
      if (!liveSession || !isLiveHost) return;
      const token = await getValidBearerToken();
      const updated = await updateLivePresentationState(
        liveSession.sessionCode,
        partialUpdates,
        liveSession,
        token
      );
      setLiveSession(updated);
    },
    [liveSession, isLiveHost, getValidBearerToken]
  );

  // ---------------------------------------------------------------------------
  // 7. Slide Navigation Handlers (Guarded against Viewer-Only manipulation)
  // ---------------------------------------------------------------------------
  const handleNext = useCallback(() => {
    if (isViewerReadOnly || collectionArtworks.length === 0) return;
    setCurrentIndex((prev) => {
      const nextIdx = (prev + 1) % collectionArtworks.length;
      setTransitionFadeKey((k) => k + 1);
      if (liveSession && isLiveHost) {
        void syncHostStateToCloud({ currentIndex: nextIdx });
      }
      return nextIdx;
    });
  }, [isViewerReadOnly, collectionArtworks.length, liveSession, isLiveHost, syncHostStateToCloud]);

  const handlePrev = useCallback(() => {
    if (isViewerReadOnly || collectionArtworks.length === 0) return;
    setCurrentIndex((prev) => {
      const prevIdx = (prev - 1 + collectionArtworks.length) % collectionArtworks.length;
      setTransitionFadeKey((k) => k + 1);
      if (liveSession && isLiveHost) {
        void syncHostStateToCloud({ currentIndex: prevIdx });
      }
      return prevIdx;
    });
  }, [isViewerReadOnly, collectionArtworks.length, liveSession, isLiveHost, syncHostStateToCloud]);

  const handleTogglePlayPause = useCallback(() => {
    if (isViewerReadOnly) return;
    setIsPlaying((prev) => {
      const nextPlay = !prev;
      const nextMode: LivePresentationMode = nextPlay ? 'auto' : 'manual';
      setPresentationMode(nextMode);
      if (liveSession && isLiveHost) {
        void syncHostStateToCloud({ isPlaying: nextPlay, mode: nextMode });
      }
      return nextPlay;
    });
  }, [isViewerReadOnly, liveSession, isLiveHost, syncHostStateToCloud]);

  const handleChangeInterval = useCallback(
    (sec: LivePresentationInterval) => {
      if (isViewerReadOnly) return;
      setSlideIntervalSec(sec);
      setIsPlaying(true);
      setPresentationMode('auto');
      if (liveSession && isLiveHost) {
        void syncHostStateToCloud({ intervalSeconds: sec, isPlaying: true, mode: 'auto' });
      }
    },
    [isViewerReadOnly, liveSession, isLiveHost, syncHostStateToCloud]
  );

  const handleToggleArtworkInfo = useCallback(() => {
    if (isViewerReadOnly) return;
    setShowArtworkInfo((prev) => {
      const nextVal = !prev;
      if (liveSession && isLiveHost) {
        void syncHostStateToCloud({ showArtworkInfo: nextVal });
      }
      return nextVal;
    });
  }, [isViewerReadOnly, liveSession, isLiveHost, syncHostStateToCloud]);

  const handleToggleAuthorInfo = useCallback(() => {
    if (isViewerReadOnly) return;
    setShowAuthorInfo((prev) => {
      const nextVal = !prev;
      if (liveSession && isLiveHost) {
        void syncHostStateToCloud({ showAuthorInfo: nextVal });
      }
      return nextVal;
    });
  }, [isViewerReadOnly, liveSession, isLiveHost, syncHostStateToCloud]);

  const handleToggleArtworkStory = useCallback(() => {
    if (isViewerReadOnly) return;
    setShowArtworkStory((prev) => {
      const nextVal = !prev;
      if (liveSession && isLiveHost) {
        void syncHostStateToCloud({ showArtworkStory: nextVal });
      }
      return nextVal;
    });
  }, [isViewerReadOnly, liveSession, isLiveHost, syncHostStateToCloud]);

  const handleTogglePureArtworkMode = useCallback(() => {
    setPureArtworkOnly((prev) => {
      const nextVal = !prev;
      if (liveSession && isLiveHost) {
        void syncHostStateToCloud({ pureArtworkOnly: nextVal });
      }
      return nextVal;
    });
  }, [liveSession, isLiveHost, syncHostStateToCloud]);

  // ---------------------------------------------------------------------------
  // 8. Network Connection & Offline/Online Auto-Resync Listener
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleOnline = async () => {
      setIsNetworkOnline(true);
      if (liveSession) {
        setPendingResync(true);
        const latest = await fetchLivePresentationSession(liveSession.sessionCode);
        if (latest) {
          setLiveSession(latest);
          setCurrentIndex(latest.currentIndex);
          setIsPlaying(latest.isPlaying);
          setSlideIntervalSec(latest.intervalSeconds);
          setShowArtworkInfo(latest.showArtworkInfo);
          setPureArtworkOnly(latest.pureArtworkOnly);
          setBackdropTheme(latest.backdropTheme);
          setFilterGrade(latest.filterGrade);
          setFilterClassId(latest.filterClassId);
          setFilterLessonId(latest.filterLessonId);
          setSelectedArtworkIds(latest.selectedArtworkIds);
        }
        setTimeout(() => setPendingResync(false), 1800);
      }
    };

    const handleOffline = () => {
      setIsNetworkOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [liveSession]);

  // ---------------------------------------------------------------------------
  // 9. Subscribe to Real-time Live Session Updates (Firebase Firestore + API)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!liveSession?.sessionCode) return;
    const unsub = subscribeLivePresentationSession(
      liveSession.sessionCode,
      (remote) => {
        setLiveSession(remote);
        // Apply synchronized state to viewer devices (or secondary screens)
        if (!isLiveHost || remote.status === 'ended') {
          setCurrentIndex((prev) => {
            if (prev !== remote.currentIndex) {
              setTransitionFadeKey((k) => k + 1);
            }
            return remote.currentIndex;
          });
          setIsPlaying(remote.isPlaying);
          setSlideIntervalSec(remote.intervalSeconds);
          setShowArtworkInfo(remote.showArtworkInfo);
          setPureArtworkOnly(remote.pureArtworkOnly);
          setBackdropTheme(remote.backdropTheme);
          setFilterGrade(remote.filterGrade);
          setFilterClassId(remote.filterClassId);
          setFilterLessonId(remote.filterLessonId);
          setSelectedArtworkIds(remote.selectedArtworkIds);
        }
      },
      (connected) => {
        setIsNetworkOnline(connected);
      }
    );
    return () => unsub();
  }, [liveSession?.sessionCode, isLiveHost]);

  // Auto-join session if initialJoinSessionCode was passed via URL (?liveSession=CODE)
  useEffect(() => {
    if (!initialJoinSessionCode) return;
    const clean = normalizeSessionCode(initialJoinSessionCode);
    if (!clean) return;
    let cancelled = false;
    (async () => {
      setIsJoiningLive(true);
      const found = await fetchLivePresentationSession(clean);
      if (cancelled) return;
      setIsJoiningLive(false);
      if (found) {
        setLiveSession(found);
        setCurrentIndex(found.currentIndex);
        setIsPlaying(found.isPlaying);
        setSlideIntervalSec(found.intervalSeconds);
        setShowArtworkInfo(found.showArtworkInfo);
        setPureArtworkOnly(found.pureArtworkOnly);
        setBackdropTheme(found.backdropTheme);
        setFilterGrade(found.filterGrade);
        setFilterClassId(found.filterClassId);
        setFilterLessonId(found.filterLessonId);
        setSelectedArtworkIds(found.selectedArtworkIds);
      } else {
        setLiveError(`Không tìm thấy phiên trình chiếu với mã "${clean}".`);
        setActiveDrawer('live_sync');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialJoinSessionCode]);

  // ---------------------------------------------------------------------------
  // 10. Create / Join / End Multi-Device Live Session Handlers
  // ---------------------------------------------------------------------------
  const handleStartLiveSession = async () => {
    if (!isTeacher && !isAdmin) {
      setLiveError('Chỉ tài khoản Giáo viên hoặc Quản trị viên mới có quyền tạo phiên trình chiếu trực tiếp.');
      return;
    }
    setIsCreatingLive(true);
    setLiveError(null);
    try {
      const token = await getValidBearerToken();
      const created = await createLivePresentationSession({
        title: 'Triển lãm Nghệ thuật Trực tiếp ARTVERSE AI',
        hostUid: user?.uid || profile?.uid || 'teacher-host',
        hostDisplayName: profile?.displayName || user?.displayName || 'Giáo viên Mĩ thuật',
        mode: presentationMode,
        currentIndex,
        isPlaying,
        intervalSeconds: slideIntervalSec,
        showArtworkInfo,
        pureArtworkOnly,
        backdropTheme,
        filterGrade,
        filterClassId,
        filterLessonId,
        selectedArtworkIds,
        bearerToken: token,
      });
      setLiveSession(created);
      if (onShowToast) {
        onShowToast(
          'success',
          'Đã phát trực tiếp phiên trình chiếu',
          `Mã phiên của bạn là ${created.sessionCode}. Mở mã này trên TV hoặc máy chiếu để đồng bộ!`
        );
      }
    } catch (err: any) {
      setLiveError(err?.message || 'Không thể khởi tạo phiên trình chiếu trực tiếp.');
    } finally {
      setIsCreatingLive(false);
    }
  };

  const handleJoinLiveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeSessionCode(joinCodeInput);
    if (!clean) {
      setLiveError('Vui lòng nhập mã phiên trình chiếu (ví dụ: 8K4M2P).');
      return;
    }
    setIsJoiningLive(true);
    setLiveError(null);
    try {
      const found = await fetchLivePresentationSession(clean);
      if (!found) {
        setLiveError(`Không tìm thấy phiên trình chiếu có mã "${clean}". Vui lòng kiểm tra lại!`);
        return;
      }
      if (found.status === 'ended') {
        setLiveError(`Phiên trình chiếu "${clean}" đã kết thúc.`);
        return;
      }
      setLiveSession(found);
      setCurrentIndex(found.currentIndex);
      setIsPlaying(found.isPlaying);
      setSlideIntervalSec(found.intervalSeconds);
      setShowArtworkInfo(found.showArtworkInfo);
      setPureArtworkOnly(found.pureArtworkOnly);
      setBackdropTheme(found.backdropTheme);
      setFilterGrade(found.filterGrade);
      setFilterClassId(found.filterClassId);
      setFilterLessonId(found.filterLessonId);
      setSelectedArtworkIds(found.selectedArtworkIds);
      setActiveDrawer('none');
      if (onShowToast) {
        onShowToast(
          'info',
          `Đã kết nối phiên ${found.sessionCode}`,
          `Đang đồng bộ trực tiếp với chủ phiên: ${found.hostDisplayName}`
        );
      }
    } finally {
      setIsJoiningLive(false);
    }
  };

  const handleEndLiveSession = async () => {
    if (!liveSession || !isLiveHost) return;
    await syncHostStateToCloud({ status: 'ended', isPlaying: false });
    setLiveSession(null);
    if (onShowToast) {
      onShowToast('info', 'Đã kết thúc phiên trình chiếu', 'Phiên trình chiếu trực tiếp đã đóng.');
    }
  };

  const handleLeaveLiveViewer = () => {
    setLiveSession(null);
    setLiveError(null);
  };

  // ---------------------------------------------------------------------------
  // 11. Legal Web Audio API Ambient Museum Sound Synthesizer
  // ---------------------------------------------------------------------------
  const playGentleMuseumChord = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const chordSets = [
        [261.63, 329.63, 392.0, 523.25],
        [220.0, 293.66, 349.23, 440.0],
        [196.0, 293.66, 392.0, 493.88],
        [174.61, 261.63, 329.63, 440.0],
      ];
      const chord = chordSets[Math.floor(Math.random() * chordSets.length)];

      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.24);

        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.24);
        gain.gain.exponentialRampToValueAtTime(0.03, ctx.currentTime + idx * 0.24 + 0.45);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.24 + 3.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.24);
        osc.stop(ctx.currentTime + idx * 0.24 + 3.9);
      });
    } catch {
      // Ignore autoplay restrictions
    }
  }, []);

  useEffect(() => {
    if (isMusicOn) {
      playGentleMuseumChord();
      chimeIntervalRef.current = setInterval(() => {
        playGentleMuseumChord();
      }, 4500);
    } else if (chimeIntervalRef.current) {
      clearInterval(chimeIntervalRef.current);
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

  // ---------------------------------------------------------------------------
  // 12. Keyboard Navigation (ArrowLeft, ArrowRight, Space, Escape)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts if typing in an input inside a drawer
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          setActiveDrawer('none');
        }
        return;
      }

      if (e.key === 'Escape') {
        if (activeDrawer !== 'none') {
          setActiveDrawer('none');
          return;
        }
        if (pureArtworkOnly) {
          setPureArtworkOnly(false);
          return;
        }
        onClose();
        return;
      }

      // Viewers connected to a live session cannot control slides with keyboard
      if (isViewerReadOnly) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        handleTogglePlayPause();
      } else if (e.key === 'i' || e.key === 'I') {
        handleToggleArtworkInfo();
      } else if (e.key === 'h' || e.key === 'H') {
        handleTogglePureArtworkMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeDrawer,
    pureArtworkOnly,
    isViewerReadOnly,
    handleNext,
    handlePrev,
    handleTogglePlayPause,
    handleToggleArtworkInfo,
    handleTogglePureArtworkMode,
    onClose,
  ]);

  // ---------------------------------------------------------------------------
  // 13. Auto-Play Timer with Loop at End (5, 10, 15, 20, 30 seconds)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // When in a live session, only the host advances the slide index or local timer advances smoothly
    if (!isPlaying || collectionArtworks.length <= 1) return;
    if (liveSession && !isLiveHost && isNetworkOnline) {
      // Remote viewer receives synchronized currentIndex from host via Firestore onSnapshot
      return;
    }

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        const nextIdx = (prev + 1) % collectionArtworks.length;
        setTransitionFadeKey((k) => k + 1);
        if (liveSession && isLiveHost) {
          void syncHostStateToCloud({ currentIndex: nextIdx });
        }
        return nextIdx;
      });
    }, slideIntervalSec * 1000);

    return () => clearInterval(timer);
  }, [
    isPlaying,
    slideIntervalSec,
    collectionArtworks.length,
    liveSession,
    isLiveHost,
    isNetworkOnline,
    syncHostStateToCloud,
  ]);

  // ---------------------------------------------------------------------------
  // 14. Auto-Hide Control Bar after 3.5s of Inactivity (Mouse & Touch)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const revealControls = () => {
      setShowControls(true);
      clearTimeout(timeout);
      if (activeDrawer === 'none') {
        timeout = setTimeout(() => {
          setShowControls(false);
        }, 3500);
      }
    };

    revealControls();
    window.addEventListener('mousemove', revealControls);
    window.addEventListener('touchstart', revealControls, { passive: true });
    window.addEventListener('click', revealControls);

    return () => {
      window.removeEventListener('mousemove', revealControls);
      window.removeEventListener('touchstart', revealControls);
      window.removeEventListener('click', revealControls);
      clearTimeout(timeout);
    };
  }, [activeDrawer]);

  // ---------------------------------------------------------------------------
  // 15. Fullscreen API Handler (Chrome, Edge, Safari)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const target = stageContainerRef.current || document.documentElement;
        if (target.requestFullscreen) {
          await target.requestFullscreen();
          setIsFullscreen(true);
        }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Ignore if browser blocks fullscreen
    }
  };

  const handleExitPresentation = async () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
    onClose();
  };

  // Toggle individual artwork in Custom Collection Picker
  const handleToggleSelectArtwork = (artId: string) => {
    if (isViewerReadOnly) return;
    setSelectedArtworkIds((prev) => {
      const exists = prev.includes(artId);
      const next = exists ? prev.filter((id) => id !== artId) : [...prev, artId];
      setPresentationMode('collection');
      setCurrentIndex(0);
      if (liveSession && isLiveHost) {
        void syncHostStateToCloud({
          selectedArtworkIds: next,
          mode: 'collection',
          currentIndex: 0,
        });
      }
      return next;
    });
  };

  const bgClass =
    backdropTheme === 'museum_stone'
      ? 'bg-[#1C1B19] text-[#FAF8F5]'
      : 'bg-[#090A0D] text-[#FAF8F5]';

  const liveShareUrl = liveSession ? buildSafeLivePresentationUrl(liveSession.sessionCode) : '';

  return (
    <div
      ref={stageContainerRef}
      className={`fixed inset-0 z-50 ${bgClass} flex flex-col select-none overflow-hidden transition-colors duration-500`}
    >
      {/* =====================================================================
          NETWORK STATUS & LIVE SESSION STATUS BANNER (Non-intrusive)
      ===================================================================== */}
      {(!isNetworkOnline || pendingResync || (liveSession && liveSession.status === 'ended')) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-stone-900/95 border border-amber-500/40 text-xs font-semibold text-amber-200 flex items-center gap-2 shadow-xl backdrop-blur-md">
          {!isNetworkOnline ? (
            <>
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
              <span>
                Mất kết nối mạng — Màn hình vẫn tiếp tục trình chiếu và sẽ tự đồng bộ lại khi có mạng
              </span>
            </>
          ) : pendingResync ? (
            <>
              <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Đã kết nối lại mạng — Đang đồng bộ trạng thái trình chiếu mới nhất...</span>
            </>
          ) : (
            <>
              <Power className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Phiên trình chiếu trực tiếp đã được giáo viên kết thúc.</span>
            </>
          )}
        </div>
      )}

      {/* =====================================================================
          TOP FLOATING CONTROL BAR (Auto-hides after 3.5s inactivity, hidden in Pure Artwork Mode)
      ===================================================================== */}
      {!pureArtworkOnly && (
        <header
          className={`absolute top-0 left-0 right-0 z-30 px-4 py-3 sm:px-8 sm:py-5 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-b from-black/85 via-black/45 to-transparent transition-opacity duration-300 ${
            showControls || activeDrawer !== 'none'
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Left: Exhibition Brand & Mode Status */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#FBBF24] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-editorial text-sm sm:text-base font-bold tracking-wide text-white truncate">
                  TRIỂN LÃM NGHỆ THUẬT ARTVERSE AI
                </span>
                {liveSession && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-0.5 rounded-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>LIVE: {liveSession.sessionCode}</span>
                    {isViewerReadOnly && (
                      <span className="text-amber-300 ml-1">(Chế độ Người xem)</span>
                    )}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400 truncate">
                {isViewerReadOnly
                  ? `Đang điều khiển bởi ${liveSession?.hostDisplayName} · Bạn đang ở chế độ chỉ xem`
                  : `Đang trình chiếu ${collectionArtworks.length} tác phẩm · Phím ←/→ chuyển tranh · Space tạm dừng · Esc thoát`}
              </p>
            </div>
          </div>

          {/* Right: Presentation Toolbar Controls */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* 1. Collection Picker Button (Mode C) */}
            {!isViewerReadOnly && (
              <button
                type="button"
                onClick={() =>
                  setActiveDrawer((d) => (d === 'collection' ? 'none' : 'collection'))
                }
                className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  activeDrawer === 'collection' ||
                  filterGrade !== 'all' ||
                  filterLessonId !== 'all' ||
                  selectedArtworkIds.length > 0
                    ? 'bg-[#1D4ED8] text-white border-blue-400'
                    : 'bg-white/10 hover:bg-white/15 text-stone-200 border-white/15'
                }`}
                title="Chọn bộ sưu tập trình chiếu (Lớp 1–9, Chủ đề, hoặc chọn từng tác phẩm)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>
                  Bộ sưu tập ({collectionArtworks.length})
                </span>
              </button>
            )}

            {/* 2. Interval Speed Selector (5, 10, 15, 20, 30s) */}
            {!isViewerReadOnly && (
              <div
                className="inline-flex items-center gap-0.5 bg-white/10 backdrop-blur-md p-1 rounded-xl border border-white/15 text-xs"
                title="Thời gian hiển thị mỗi tác phẩm (5, 10, 15, 20 hoặc 30 giây)"
              >
                <Clock className="w-3.5 h-3.5 text-stone-300 ml-1.5 mr-1" />
                {ALLOWED_PRESENTATION_INTERVALS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => handleChangeInterval(sec)}
                    className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      slideIntervalSec === sec
                        ? 'bg-[#1D4ED8] text-white'
                        : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            )}

            {/* 3. Toggle Artwork Info, Author Info & Story Display (PHẦN 4.2) */}
            {!isViewerReadOnly && (
              <>
                <button
                  type="button"
                  onClick={handleToggleArtworkInfo}
                  className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    showArtworkInfo
                      ? 'bg-white/15 text-white border-white/30'
                      : 'bg-white/5 text-stone-400 border-white/10'
                  }`}
                  title="Bật / Tắt thông tin tác phẩm (Phím I)"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Thông tin</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleAuthorInfo}
                  className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    showAuthorInfo
                      ? 'bg-amber-500/25 text-amber-200 border-amber-400/40'
                      : 'bg-white/5 text-stone-400 border-white/10'
                  }`}
                  title="Hiển thị hoặc ẩn thông tin biệt danh tác giả khi trình chiếu"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">
                    {showAuthorInfo ? 'Tác giả: Hiện' : 'Tác giả: Ẩn'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleArtworkStory}
                  className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    showArtworkStory
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/40'
                      : 'bg-white/5 text-stone-400 border-white/10'
                  }`}
                  title="Hiển thị hoặc ẩn Câu chuyện từ bức tranh sau khi trình chiếu tác phẩm"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">
                    {showArtworkStory ? 'Câu chuyện: Hiện' : 'Câu chuyện: Ẩn'}
                  </span>
                </button>
              </>
            )}

            {/* 4. Pure Artwork Only Mode (Hides all toolbars & captions) */}
            <button
              type="button"
              onClick={handleTogglePureArtworkMode}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-stone-200 border border-white/15 transition-all cursor-pointer"
              title="Chế độ chỉ hiển thị tác phẩm, ẩn toàn bộ thanh công cụ (Phím H)"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Chỉ hiện tranh</span>
            </button>

            {/* 5. Backdrop Theme Toggle (Dark Obsidian vs Neutral Museum Stone) */}
            {!isViewerReadOnly && (
              <button
                type="button"
                onClick={() => {
                  const nextTheme: LivePresentationBackdrop =
                    backdropTheme === 'obsidian' ? 'museum_stone' : 'obsidian';
                  setBackdropTheme(nextTheme);
                  if (liveSession && isLiveHost) {
                    void syncHostStateToCloud({ backdropTheme: nextTheme });
                  }
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-stone-200 border border-white/15 transition-all cursor-pointer hidden sm:inline-flex items-center gap-1.5"
                title="Đổi màu nền phòng trưng bày (Đen huyền / Đá trung tính)"
              >
                <span>{backdropTheme === 'obsidian' ? 'Nền tối' : 'Nền trung tính'}</span>
              </button>
            )}

            {/* 6. Ambient Sound Toggle */}
            <button
              type="button"
              onClick={() => setIsMusicOn((m) => !m)}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isMusicOn
                  ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/40'
                  : 'bg-white/10 text-stone-300 border-white/15'
              }`}
              title="Bật/Tắt âm thanh thư giãn bảo tàng hợp pháp (Web Audio)"
            >
              {isMusicOn ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
              <span className="hidden lg:inline">{isMusicOn ? 'Nhạc: Bật' : 'Nhạc nền'}</span>
            </button>

            {/* 7. Multi-Device Live Sync Session Button */}
            <button
              type="button"
              onClick={() =>
                setActiveDrawer((d) => (d === 'live_sync' ? 'none' : 'live_sync'))
              }
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                liveSession
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : activeDrawer === 'live_sync'
                    ? 'bg-[#1D4ED8] text-white border-blue-400'
                    : 'bg-white/10 hover:bg-white/20 text-stone-200 border-white/15'
              }`}
              title="Trình chiếu trực tiếp đồng bộ nhiều thiết bị (Firebase Live Session)"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{liveSession ? `Phiên: ${liveSession.sessionCode}` : 'Đồng bộ Thiết bị'}</span>
            </button>

            {/* 8. Projector / TV Setup Guide Button */}
            <button
              type="button"
              onClick={() =>
                setActiveDrawer((d) => (d === 'projector_guide' ? 'none' : 'projector_guide'))
              }
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                activeDrawer === 'projector_guide'
                  ? 'bg-[#1D4ED8] text-white border-blue-400'
                  : 'bg-white/10 hover:bg-white/20 text-stone-200 border-white/15'
              }`}
              title="Hướng dẫn trình chiếu lên Máy chiếu hoặc TV"
            >
              <Tv className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Máy chiếu / TV</span>
            </button>

            {/* 9. Play / Pause Auto-Advance Button */}
            {!isViewerReadOnly && (
              <button
                type="button"
                onClick={handleTogglePlayPause}
                className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isPlaying
                    ? 'bg-amber-500/25 text-amber-200 border-amber-400/40 hover:bg-amber-500/35'
                    : 'bg-[#1D4ED8] text-white border-blue-400 hover:bg-blue-700'
                }`}
                title="Phát tự động hoặc Tạm dừng (Phím Space)"
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>{isPlaying ? 'Tạm dừng' : 'Phát tự động'}</span>
              </button>
            )}

            {/* 10. Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer"
              title="Toàn màn hình (Fullscreen API)"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            {/* 11. Exit Presentation */}
            <button
              type="button"
              onClick={handleExitPresentation}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-600 text-white border border-white/20 text-xs font-bold inline-flex items-center gap-1 transition-all cursor-pointer"
              title="Thoát trình chiếu và quay lại Triển lãm (Phím Esc)"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Thoát</span>
            </button>
          </div>
        </header>
      )}

      {/* Subtle restore button when in Pure Artwork Mode (Chỉ hiện tác phẩm, không thanh công cụ) */}
      {pureArtworkOnly && (
        <div
          className={`absolute top-4 right-4 z-40 flex items-center gap-2 transition-opacity duration-300 ${
            showControls ? 'opacity-90' : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={() => setPureArtworkOnly(false)}
            className="px-3.5 py-2 rounded-xl bg-black/75 hover:bg-black text-white border border-white/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-lg backdrop-blur-md"
          >
            <EyeOff className="w-3.5 h-3.5 text-[#FBBF24]" />
            <span>Hiện lại thanh điều khiển (Esc)</span>
          </button>
        </div>
      )}

      {/* =====================================================================
          DRAWER 1: COLLECTION PICKER (Chế độ C - Chọn Lớp 1..9, Lớp học, Chủ đề, Tác phẩm)
      ===================================================================== */}
      {activeDrawer === 'collection' && !isViewerReadOnly && (
        <div className="absolute top-20 right-4 sm:right-8 z-40 w-[calc(100vw-2rem)] max-w-xl max-h-[78vh] bg-[#141519]/98 border border-white/15 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden text-white">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#60A5FA]" />
                <span>Chọn Bộ sưu tập Trình chiếu (Chế độ C)</span>
              </h3>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Trình chiếu đúng danh sách đã chọn, không tự ý trộn tác phẩm ngoài bộ lọc
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveDrawer('none')}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
            {/* Step 1: Select Standardized Grade (Lớp 1 -> Lớp 9) */}
            <div className="space-y-1.5">
              <label className="block font-bold text-stone-300">
                1. Chọn khối lớp (Lớp 1 đến Lớp 9):
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setFilterGrade('all');
                    setSelectedArtworkIds([]);
                    setCurrentIndex(0);
                    if (liveSession && isLiveHost) {
                      void syncHostStateToCloud({
                        filterGrade: 'all',
                        selectedArtworkIds: [],
                        currentIndex: 0,
                      });
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer ${
                    filterGrade === 'all'
                      ? 'bg-[#1D4ED8] text-white border-blue-400'
                      : 'bg-white/5 text-stone-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  Tất cả Lớp 1–9
                </button>
                {STANDARD_GRADES.map((g) => (
                  <button
                    key={g.classId}
                    type="button"
                    onClick={() => {
                      setFilterGrade(g.classId);
                      setSelectedArtworkIds([]);
                      setCurrentIndex(0);
                      setPresentationMode('collection');
                      if (liveSession && isLiveHost) {
                        void syncHostStateToCloud({
                          filterGrade: g.classId,
                          selectedArtworkIds: [],
                          mode: 'collection',
                          currentIndex: 0,
                        });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer ${
                      filterGrade === g.classId || normalizeGrade(filterGrade) === g.label
                        ? 'bg-[#1D4ED8] text-white border-blue-400'
                        : 'bg-white/5 text-stone-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Select Specific Class or Lesson/Topic */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-stone-300 mb-1">
                  2. Chọn lớp học cụ thể:
                </label>
                <select
                  value={filterClassId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterClassId(val);
                    setSelectedArtworkIds([]);
                    setCurrentIndex(0);
                    if (liveSession && isLiveHost) {
                      void syncHostStateToCloud({
                        filterClassId: val,
                        selectedArtworkIds: [],
                        currentIndex: 0,
                      });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-white/15 text-white font-semibold"
                >
                  <option value="all">Mọi lớp học trong khối</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.classCode ? `(${cls.classCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-300 mb-1">
                  3. Chọn chủ đề / bài học:
                </label>
                <select
                  value={filterLessonId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterLessonId(val);
                    setSelectedArtworkIds([]);
                    setCurrentIndex(0);
                    if (liveSession && isLiveHost) {
                      void syncHostStateToCloud({
                        filterLessonId: val,
                        selectedArtworkIds: [],
                        currentIndex: 0,
                      });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-white/15 text-white font-semibold"
                >
                  <option value="all">Tất cả chủ đề / bài học</option>
                  {lessons.map((les) => (
                    <option key={les.id} value={les.id}>
                      [{normalizeGrade(les.className || les.classGroupId)}] {les.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Step 3: Select 1 or Multiple Specific Artworks */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <label className="font-bold text-stone-300">
                  4. Chọn một hoặc nhiều tác phẩm cụ thể ({poolForSelection.length} tranh phù hợp):
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = poolForSelection.map((a) => a.id);
                      setSelectedArtworkIds(allIds);
                      setCurrentIndex(0);
                      if (liveSession && isLiveHost) {
                        void syncHostStateToCloud({ selectedArtworkIds: allIds, currentIndex: 0 });
                      }
                    }}
                    className="text-[11px] font-bold text-[#60A5FA] hover:underline cursor-pointer"
                  >
                    Chọn tất cả
                  </button>
                  <span className="text-stone-600">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedArtworkIds([]);
                      setCurrentIndex(0);
                      if (liveSession && isLiveHost) {
                        void syncHostStateToCloud({ selectedArtworkIds: [], currentIndex: 0 });
                      }
                    }}
                    className="text-[11px] font-bold text-stone-400 hover:text-white cursor-pointer"
                  >
                    Mặc định theo bộ lọc
                  </button>
                </div>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {poolForSelection.length === 0 ? (
                  <p className="text-stone-400 py-4 text-center">
                    Không có tác phẩm công khai nào khớp bộ lọc này.
                  </p>
                ) : (
                  poolForSelection.map((art) => {
                    const isChecked =
                      selectedArtworkIds.length === 0 || selectedArtworkIds.includes(art.id);
                    const isExplicitlyPicked = selectedArtworkIds.includes(art.id);
                    return (
                      <div
                        key={art.id}
                        onClick={() => handleToggleSelectArtwork(art.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isExplicitlyPicked
                            ? 'bg-blue-950/60 border-blue-500/50 text-white'
                            : isChecked
                              ? 'bg-white/5 border-white/10 text-stone-200 hover:bg-white/10'
                              : 'bg-black/40 border-white/5 text-stone-500'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isExplicitlyPicked ? (
                            <CheckSquare className="w-4 h-4 text-[#60A5FA] shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-stone-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold truncate">{art.title}</p>
                            <p className="text-[11px] text-stone-400 truncate">
                              {getArtworkNormalizedGrade(art)} · Bút danh:{' '}
                              {art.creatorAnonymousPseudonym}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/10 shrink-0">
                          {getArtworkNormalizedGrade(art)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="px-5 py-3 bg-black/50 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-stone-300">
              Danh sách trình chiếu: <strong>{collectionArtworks.length} tác phẩm</strong>
            </span>
            <button
              type="button"
              onClick={() => setActiveDrawer('none')}
              className="px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-blue-700 text-white font-bold cursor-pointer"
            >
              Áp dụng &amp; Đóng
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          DRAWER 2: MULTI-DEVICE LIVE SESSION SYNC (Giai đoạn 3 - Firebase Realtime)
      ===================================================================== */}
      {activeDrawer === 'live_sync' && (
        <div className="absolute top-20 right-4 sm:right-8 z-40 w-[calc(100vw-2rem)] max-w-md bg-[#141519]/98 border border-white/15 rounded-3xl shadow-2xl backdrop-blur-xl p-5 space-y-4 text-xs text-white">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold">
                Trình chiếu Trực tiếp từ Thiết bị khác (Firebase Live)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveDrawer('none')}
              className="p-1 rounded-lg text-stone-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {liveError && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs">
              {liveError}
            </div>
          )}

          {liveSession ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                    Mã Phiên Đang Hoạt Động
                  </span>
                  <span className="text-[11px] text-stone-300">
                    Chủ phiên: <strong>{liveSession.hostDisplayName}</strong>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-black/50 px-4 py-3 rounded-xl border border-white/10">
                  <span className="font-mono text-2xl font-extrabold tracking-widest text-[#FBBF24]">
                    {liveSession.sessionCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(liveSession.sessionCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Đã chép' : 'Chép mã'}</span>
                  </button>
                </div>

                {/* Share Link & QR */}
                <div className="pt-2 flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shrink-0">
                    <QRCodeSVG value={liveShareUrl} size={76} level="L" />
                  </div>
                  <div className="space-y-2 min-w-0 flex-1">
                    <p className="text-[11px] text-stone-300 leading-relaxed">
                      Mở đường dẫn này trên TV/Máy chiếu hoặc nhập mã{' '}
                      <strong>{liveSession.sessionCode}</strong> để đồng bộ màn hình theo thời gian
                      thực.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(liveShareUrl);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-[#1D4ED8] hover:bg-blue-700 text-white font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedUrl ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedUrl ? 'Đã sao chép đường dẫn' : 'Sao chép đường dẫn phiên'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                {isLiveHost ? (
                  <button
                    type="button"
                    onClick={handleEndLiveSession}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                  >
                    Kết thúc phiên trình chiếu trực tiếp
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLeaveLiveViewer}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                  >
                    Rời khỏi phiên đồng bộ (Chuyển về tự xem)
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Create Live Session (Teachers & Admins Only) */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                <h4 className="font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#FBBF24]" />
                  <span>Dành cho Giáo viên / Quản trị viên: Tạo phiên mới</span>
                </h4>
                <p className="text-[11px] text-stone-300 leading-relaxed">
                  Bắt đầu một phiên trình chiếu trực tiếp. Chỉ giáo viên chủ phiên mới được chuyển
                  tác phẩm, tạm dừng hoặc kết thúc.
                </p>
                {isTeacher || isAdmin ? (
                  <button
                    type="button"
                    disabled={isCreatingLive}
                    onClick={handleStartLiveSession}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-blue-700 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingLive ? 'Đang khởi tạo mã phiên...' : 'Bắt đầu Phiên Trình chiếu Trực tiếp'}
                  </button>
                ) : (
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-[11px] text-amber-300 flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>Đăng nhập tài khoản Giáo viên để tạo và điều khiển phiên từ xa.</span>
                  </div>
                )}
              </div>

              {/* Join Existing Live Session by Code (For Projector PC / Smart TV / Students) */}
              <form
                onSubmit={handleJoinLiveSession}
                className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5"
              >
                <h4 className="font-bold text-white">
                  Mở phiên trình chiếu từ thiết bị khác (Nhập mã phiên):
                </h4>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="Nhập mã 6 ký tự (VD: 8K4M2P)"
                    maxLength={12}
                    className="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white font-mono uppercase tracking-wider text-xs focus:outline-none focus:border-blue-400"
                  />
                  <button
                    type="submit"
                    disabled={isJoiningLive}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shrink-0"
                  >
                    {isJoiningLive ? 'Đang mở...' : 'Kết nối'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          DRAWER 3: PROJECTOR & TV SETUP GUIDE (Mục 6 - Chia sẻ màn hình & Fullscreen API)
      ===================================================================== */}
      {activeDrawer === 'projector_guide' && (
        <div className="absolute top-20 right-4 sm:right-8 z-40 w-[calc(100vw-2rem)] max-w-md bg-[#141519]/98 border border-white/15 rounded-3xl shadow-2xl backdrop-blur-xl p-5 space-y-4 text-xs text-white">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-[#60A5FA]" />
              <h3 className="text-sm font-bold">
                Hướng dẫn Trình chiếu trên Máy chiếu, TV &amp; Màn hình LED
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveDrawer('none')}
              className="p-1 rounded-lg text-stone-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 text-stone-300 leading-relaxed">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <p className="font-bold text-white">
                Cách 1: Kết nối cáp HDMI / USB-C &amp; Toàn màn hình (Khuyên dùng)
              </p>
              <p className="text-[11px]">
                Kết nối máy tính với máy chiếu hoặc TV, mở trình duyệt <strong>Google Chrome</strong>{' '}
                hoặc <strong>Microsoft Edge</strong>, sau đó nhấn nút bên dưới để kích hoạt{' '}
                <strong>Fullscreen API</strong> chuẩn 16:9 (Full HD / 4K).
              </p>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="mt-1.5 w-full py-2 px-3 rounded-xl bg-[#1D4ED8] hover:bg-blue-700 text-white font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Maximize className="w-3.5 h-3.5" />
                <span>{isFullscreen ? 'Thoát Toàn màn hình' : 'Bật Toàn màn hình ngay'}</span>
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <p className="font-bold text-white">
                Cách 2: Điều khiển từ xa qua Mã phiên Trực tiếp (Firebase Sync)
              </p>
              <p className="text-[11px]">
                Mở ARTVERSE AI trên máy tính gắn máy chiếu hoặc trình duyệt Smart TV, nhập{' '}
                <strong>Mã phiên</strong> tại mục <em>Đồng bộ Thiết bị</em>. Giáo viên có thể đi
                quanh lớp và chuyển tác phẩm từ điện thoại hoặc iPad.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <p className="font-bold text-white">
                Cách 3: Truyền màn hình không dây trên Chrome / Edge
              </p>
              <p className="text-[11px]">
                Trên trình duyệt Chrome hoặc Edge, mở menu góc phải <strong>(⋮) → Lưu và chia sẻ → Truyền (Cast...)</strong> để phát tab triển lãm lên TV trong cùng mạng Wi-Fi.
              </p>
            </div>

            <p className="text-[11px] text-stone-400 italic pt-1">
              Lưu ý kỹ thuật: Ứng dụng sử dụng chuẩn Fullscreen API của trình duyệt và đồng bộ dữ
              liệu qua mạng; không tự động đòi quyền chia sẻ màn hình và không tự bật nguồn hay điều
              khiển phần cứng máy chiếu bên ngoài.
            </p>
          </div>
        </div>
      )}

      {/* =====================================================================
          MAIN CONTEMPORARY ART GALLERY STAGE (16:9 Full HD / 4K, Uncropped Portrait/Landscape/Square)
      ===================================================================== */}
      <div className="flex-1 flex items-center justify-center relative px-4 sm:px-14 py-6 overflow-hidden">
        {collectionArtworks.length === 0 || !currentArtwork ? (
          <div className="max-w-md text-center space-y-4 p-8 rounded-3xl bg-white/5 border border-white/10">
            <Layers className="w-10 h-10 text-stone-400 mx-auto" />
            <h3 className="font-editorial text-xl font-bold text-white">
              Không có tác phẩm nào trong bộ sưu tập này
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Hãy mở mục <strong>Bộ sưu tập</strong> ở thanh công cụ phía trên để chọn khối lớp hoặc
              chủ đề khác.
            </p>
            {!isViewerReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setFilterGrade('all');
                  setFilterClassId('all');
                  setFilterLessonId('all');
                  setSelectedArtworkIds([]);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#1D4ED8] text-white text-xs font-bold cursor-pointer"
              >
                Hiển thị toàn bộ tác phẩm triển lãm
              </button>
            )}
          </div>
        ) : (
          <div
            key={`${currentArtwork.id}-${transitionFadeKey}`}
            className={`relative w-full h-full flex items-center justify-center transition-all duration-700 ease-out animate-in fade-in ${
              showArtworkInfo && !pureArtworkOnly ? 'max-h-[76vh]' : 'max-h-[88vh]'
            }`}
          >
            {currentArtwork.imageUrl &&
            (currentArtwork.imageUrl.startsWith('data:image') ||
              currentArtwork.imageUrl.startsWith('http')) ? (
              <img
                src={currentArtwork.imageUrl}
                alt={currentArtwork.title}
                className={`w-auto h-auto max-w-[92vw] ${
                  showArtworkInfo && !pureArtworkOnly ? 'max-h-[75vh]' : 'max-h-[88vh]'
                } object-contain rounded-lg shadow-[0_24px_80px_rgba(0,0,0,0.85)] border border-white/10 bg-black/20`}
              />
            ) : (
              <div className="w-full max-w-3xl">
                <ArtCanvasVisual
                  type={currentArtwork.visualType || 'watercolor'}
                  title={currentArtwork.title}
                  badgeText={getArtworkNormalizedGrade(currentArtwork)}
                  className="h-[64vh] w-full rounded-2xl shadow-2xl"
                />
              </div>
            )}
          </div>
        )}

        {/* Left / Right Manual Navigation Buttons (Hidden for Read-Only Viewers & Pure Artwork Mode) */}
        {!pureArtworkOnly && !isViewerReadOnly && collectionArtworks.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className={`absolute left-3 sm:left-7 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-black/50 hover:bg-[#1D4ED8] text-white border border-white/15 transition-all active:scale-95 cursor-pointer ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              aria-label="Tác phẩm trước (Phím mũi tên trái)"
              title="Tác phẩm trước (Phím ←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              className={`absolute right-3 sm:right-7 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-black/50 hover:bg-[#1D4ED8] text-white border border-white/15 transition-all active:scale-95 cursor-pointer ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              aria-label="Tác phẩm tiếp theo (Phím mũi tên phải)"
              title="Tác phẩm tiếp theo (Phím →)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* =====================================================================
          BOTTOM ARTWORK PLACARD / CAPTION OVERLAY
          Displays ONLY: Artwork Title, Grade (Lớp 1–9), Topic/Lesson, Short Description.
          Strictly NO email, NO studentCode, NO personal student data.
      ===================================================================== */}
      {!pureArtworkOnly && showArtworkInfo && currentArtwork && (
        <footer
          className={`px-6 py-4 sm:px-12 sm:py-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-90'
          }`}
        >
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            {/* Museum Label Metadata (Clean unboxed typography, zero PII) */}
            <div className="space-y-1 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300 font-medium">
                <span className="text-[#60A5FA] font-bold">
                  {getArtworkNormalizedGrade(currentArtwork)}
                </span>
                {showAuthorInfo && (
                  <>
                    <span aria-hidden="true" className="text-stone-500">
                      ·
                    </span>
                    <span className="text-amber-300 font-bold">
                      Biệt danh tác giả: ✨{' '}
                      {currentArtworkStory?.authorNickname ||
                        currentArtwork.creatorAnonymousPseudonym ||
                        'Nghệ sĩ Nhí'}
                    </span>
                  </>
                )}
                {currentLessonTopic && (
                  <>
                    <span aria-hidden="true" className="text-stone-500">
                      ·
                    </span>
                    <span className="text-stone-300">Chủ đề: {currentLessonTopic}</span>
                  </>
                )}
                {currentArtwork.materialsUsed && (
                  <>
                    <span aria-hidden="true" className="text-stone-500">
                      ·
                    </span>
                    <span className="text-stone-400">Chất liệu: {currentArtwork.materialsUsed}</span>
                  </>
                )}
              </div>

              <h2 className="font-editorial text-xl sm:text-3xl font-bold text-white tracking-tight">
                {currentArtwork.title}
              </h2>

              {showArtworkStory && currentArtworkStory ? (
                <div className="mt-2 p-3.5 rounded-2xl bg-white/10 border border-amber-400/30 backdrop-blur-md space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Câu chuyện từ bức tranh: “{currentArtworkStory.storyTitle}”</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-100 line-clamp-2 leading-relaxed">
                    {currentArtworkStory.storyContent}
                  </p>
                  {currentArtworkStory.viewerMessage && (
                    <p className="text-[11px] text-amber-200 italic">
                      Thông điệp gửi người xem: “{currentArtworkStory.viewerMessage}”
                    </p>
                  )}
                </div>
              ) : (
                showArtworkStory &&
                currentArtwork.description && (
                  <p className="text-xs sm:text-sm text-stone-300 line-clamp-2 leading-relaxed pt-0.5">
                    {currentArtwork.description}
                  </p>
                )
              )}
            </div>

            {/* Slide Counter & Positive Appreciation Reactions */}
            <div className="flex flex-col sm:items-end gap-2 shrink-0">
              <div className="text-xs font-mono text-stone-400 flex items-center gap-2">
                <span>
                  Tác phẩm {currentIndex + 1} / {collectionArtworks.length}
                </span>
                <span>·</span>
                <span>{isPlaying ? `Tự động (${slideIntervalSec}s)` : 'Thủ công'}</span>
              </div>

              <div
                className={`flex items-center gap-1.5 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 transition-opacity ${
                  showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                {(
                  [
                    'unique_idea',
                    'striking_color',
                    'interesting_composition',
                    'noteworthy_detail',
                    'inspiring',
                  ] as PositiveReactionKey[]
                ).map((key) => {
                  const count = currentArtwork.reactions?.[key] || 0;
                  const meta = POSITIVE_REACTIONS_META[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onReact(currentArtwork.id, key)}
                      title={`Khích lệ: ${meta.label}`}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-white/20 active:scale-95 transition-all text-xs cursor-pointer"
                    >
                      <span>{meta.icon}</span>
                      <span className="text-[11px] font-bold text-stone-200">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

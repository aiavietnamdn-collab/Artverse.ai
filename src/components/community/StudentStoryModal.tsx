/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — ARTVERSE STORIES ("KỂ CÂU CHUYỆN CỦA EM")
 * Contemporary Creative Gallery Editorial Storytelling Studio
 * - Links to Artwork Image, Creative Process Video (Firebase Storage only, never Base64/blob), or Standalone
 * - Gentle Guided Prompts + 4 AI Writing Facilitator Modes (Questions, Structure, Spellcheck, Titles)
 * - Draft & Pending Submission with Dual Firestore + Backend Persistence
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Sparkles,
  Save,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  MessageSquareHeart,
  Palette,
  Wand2,
  HelpCircle,
  Film,
  Image as ImageIcon,
  SpellCheck,
  ListTree,
  Heading,
  Award,
} from 'lucide-react';
import { ArtworkStory, CommunityArtwork } from '../../types/communityArt';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../lib/platform';
import { normalizeGrade } from '../../utils/gradeUtils';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import { saveArtworkStoryInFirestore } from '../../services/communityFirestoreService';

interface StudentStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialArtwork?: CommunityArtwork | null;
  initialStory?: ArtworkStory | null;
  studentArtworks?: CommunityArtwork[];
  artworks?: CommunityArtwork[];
  existingStories: ArtworkStory[];
  onStorySaved: (savedStory: ArtworkStory) => void;
  onShowToast?: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

type AssistAction = 'questions' | 'structure' | 'spellcheck' | 'titles';

export const StudentStoryModal: React.FC<StudentStoryModalProps> = ({
  isOpen,
  onClose,
  initialArtwork,
  initialStory,
  studentArtworks = [],
  artworks = [],
  existingStories,
  onStorySaved,
  onShowToast,
}) => {
  const {
    user,
    profile,
    isStudent,
    isTeacher,
    isAdmin,
    getValidBearerToken,
    setIsStudentLoginModalOpen,
  } = useAuth();

  const activeUid = profile?.uid || user?.uid || '';
  const canWriteStory = Boolean(activeUid && (isStudent || isTeacher || isAdmin));

  const selectableArtworks = useMemo(() => {
    const map = new Map<string, CommunityArtwork>();
    if (initialArtwork) map.set(initialArtwork.id, initialArtwork);
    const sourceList = studentArtworks.length > 0 ? studentArtworks : artworks;
    for (const art of sourceList) {
      if (
        !activeUid ||
        art.authorAccountId === activeUid ||
        art.authorUid === activeUid ||
        (profile?.nickname &&
          art.creatorAnonymousPseudonym.trim().toLowerCase() ===
            profile.nickname.trim().toLowerCase()) ||
        isTeacher ||
        isAdmin ||
        sourceList.length <= 20
      ) {
        map.set(art.id, art);
      }
    }
    return Array.from(map.values());
  }, [initialArtwork, studentArtworks, artworks, activeUid, profile?.nickname, isTeacher, isAdmin]);

  const [selectedArtworkId, setSelectedArtworkId] = useState<string>(
    initialStory?.artworkId || initialArtwork?.id || selectableArtworks[0]?.id || ''
  );
  const [storyTitle, setStoryTitle] = useState<string>('');
  const [storyContent, setStoryContent] = useState<string>('');
  const [inspirationText, setInspirationText] = useState<string>('');
  const [feelingText, setFeelingText] = useState<string>('');
  const [viewerMessage, setViewerMessage] = useState<string>('');
  const [showGuidedPrompts, setShowGuidedPrompts] = useState<boolean>(true);

  const [assistLoadingAction, setAssistLoadingAction] = useState<AssistAction | null>(null);
  const [assistActiveAction, setAssistActiveAction] = useState<AssistAction | null>(null);
  const [assistSuggestions, setAssistSuggestions] = useState<string[]>([]);
  const [assistNote, setAssistNote] = useState<string>('');

  const [savingMode, setSavingMode] = useState<'draft' | 'pending' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const selectedArtwork = useMemo(() => {
    if (!selectedArtworkId || selectedArtworkId === '__standalone__') return null;
    return (
      selectableArtworks.find((a) => a.id === selectedArtworkId) ||
      initialArtwork ||
      null
    );
  }, [selectableArtworks, selectedArtworkId, initialArtwork]);

  const existingStoryForTarget = useMemo(() => {
    if (initialStory) return initialStory;
    if (!selectedArtwork) return null;
    return (
      existingStories.find(
        (s) =>
          s.artworkId === selectedArtwork.id &&
          (!activeUid || !s.authorAccountId || s.authorAccountId === activeUid)
      ) || null
    );
  }, [initialStory, existingStories, selectedArtwork, activeUid]);

  useEffect(() => {
    if (!isOpen) return;
    const targetId =
      initialStory?.artworkId || initialArtwork?.id || selectableArtworks[0]?.id || '';
    setSelectedArtworkId(targetId);
    setErrorMessage(null);
    setStatusNotice(null);
    setAssistSuggestions([]);
    setAssistNote('');
  }, [isOpen, initialArtwork, initialStory, selectableArtworks]);

  // Populate existing story or local draft when selection changes
  useEffect(() => {
    if (!isOpen) return;

    if (existingStoryForTarget) {
      setStoryTitle(existingStoryForTarget.storyTitle || '');
      setStoryContent(existingStoryForTarget.storyContent || '');
      setInspirationText(existingStoryForTarget.inspirationText || '');
      setFeelingText(existingStoryForTarget.feelingText || '');
      setViewerMessage(existingStoryForTarget.viewerMessage || '');
      return;
    }

    const draftKey = `artverse_story_draft_${activeUid || 'anon'}_${selectedArtwork?.id || 'standalone'}`;
    try {
      const savedLocal = localStorage.getItem(draftKey);
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        setStoryTitle(parsed.storyTitle || '');
        setStoryContent(parsed.storyContent || '');
        setInspirationText(parsed.inspirationText || '');
        setFeelingText(parsed.feelingText || '');
        setViewerMessage(parsed.viewerMessage || '');
        return;
      }
    } catch {
      // ignore
    }

    setStoryTitle('');
    setStoryContent('');
    setInspirationText('');
    setFeelingText('');
    setViewerMessage('');
  }, [isOpen, selectedArtwork, existingStoryForTarget, activeUid]);

  // Persist local draft automatically while typing so student never loses work
  useEffect(() => {
    if (!isOpen) return;
    const draftKey = `artverse_story_draft_${activeUid || 'anon'}_${selectedArtwork?.id || 'standalone'}`;
    if (
      storyTitle.trim() ||
      storyContent.trim() ||
      inspirationText.trim() ||
      feelingText.trim() ||
      viewerMessage.trim()
    ) {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            storyTitle,
            storyContent,
            inspirationText,
            feelingText,
            viewerMessage,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch {
        // ignore storage quota
      }
    }
  }, [
    isOpen,
    selectedArtwork,
    storyTitle,
    storyContent,
    inspirationText,
    feelingText,
    viewerMessage,
    activeUid,
  ]);

  if (!isOpen) return null;

  if (!canWriteStory) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#20243A]/70 backdrop-blur-sm p-4">
        <div className="bg-[#F7F3EA] border border-[#20243A]/20 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl text-[#20243A]">
          <div className="w-12 h-12 rounded-xl bg-[#3457D5]/10 text-[#3457D5] flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="font-display text-xl font-black tracking-tight mb-2">
            KỂ CÂU CHUYỆN CỦA EM
          </h3>
          <p className="text-xs sm:text-sm text-[#20243A]/75 mb-5 leading-relaxed">
            Em hãy đăng nhập bằng <strong>Mã lớp + Mã học sinh + Mã PIN</strong> để viết và lưu câu chuyện cho tác phẩm mĩ thuật của mình nhé!
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-[#20243A]/25 text-[#20243A] font-bold text-xs cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                setIsStudentLoginModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] font-bold text-xs cursor-pointer transition-colors"
            >
              Đăng nhập Học sinh
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleRequestAiAssist = async (action: AssistAction) => {
    setAssistLoadingAction(action);
    setAssistActiveAction(action);
    setErrorMessage(null);
    try {
      const token = await getValidBearerToken();
      const res = await fetch(getApiUrl('/api/ai/story-assist'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action,
          artworkTitle: selectedArtwork?.title || storyTitle || 'Tác phẩm của em',
          lessonTitle: selectedArtwork?.lessonTitle || '',
          materialsUsed: selectedArtwork?.materialsUsed || '',
          currentTitle: storyTitle,
          currentDraft: [storyContent, inspirationText, feelingText].filter(Boolean).join('\n'),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMessage(data.error || 'Không thể kết nối tới Trợ lý Kể chuyện lúc này.');
        return;
      }
      if (Array.isArray(data.suggestions)) {
        setAssistSuggestions(data.suggestions);
        setAssistNote(data.note || '');
      }
    } catch {
      setErrorMessage('Không thể kết nối tới Trợ lý Kể chuyện lúc này.');
    } finally {
      setAssistLoadingAction(null);
    }
  };

  const isSelectedArtworkVideo =
    selectedArtwork?.mediaType === 'video' ||
    Boolean(selectedArtwork?.videoUrl) ||
    Boolean(selectedArtwork?.mimeType && selectedArtwork.mimeType.startsWith('video/'));

  const resolvedVideoUrl =
    selectedArtwork?.videoUrl ||
    (isSelectedArtworkVideo ? selectedArtwork?.downloadURL : '') ||
    '';

  const handleSave = async (targetStatus: 'draft' | 'pending') => {
    setErrorMessage(null);
    setStatusNotice(null);

    // Validate video storage rule: never link unuploaded blob: or Base64 video
    if (isSelectedArtworkVideo && resolvedVideoUrl) {
      if (
        resolvedVideoUrl.startsWith('blob:') ||
        resolvedVideoUrl.startsWith('local_idb://') ||
        resolvedVideoUrl.startsWith('data:video/')
      ) {
        setErrorMessage(
          'Video của tác phẩm này chưa hoàn tất tải lên Firebase Storage. Vui lòng hoàn tất tải video trước khi liên kết với câu chuyện.'
        );
        return;
      }
    }

    const combinedBody = storyContent.trim();

    if (targetStatus === 'pending') {
      if (storyTitle.trim().length < 2) {
        setErrorMessage('Em hãy đặt tên cho câu chuyện (ít nhất 2 ký tự) nhé!');
        return;
      }
      if (
        combinedBody.length < 5 &&
        inspirationText.trim().length < 5 &&
        feelingText.trim().length < 5
      ) {
        setErrorMessage('Em hãy chia sẻ vài dòng về câu chuyện hoặc cảm hứng của mình nhé!');
        return;
      }
    } else if (
      !storyTitle.trim() &&
      !combinedBody &&
      !inspirationText.trim() &&
      !feelingText.trim() &&
      !viewerMessage.trim()
    ) {
      setErrorMessage('Em hãy viết ít nhất một ý tưởng để lưu bản nháp nhé!');
      return;
    }

    setSavingMode(targetStatus);
    try {
      const token = await getValidBearerToken();
      const safeImageUrl =
        selectedArtwork?.thumbnailUrl ||
        selectedArtwork?.imageUrl ||
        selectedArtwork?.downloadURL ||
        '';

      const payload = {
        id: existingStoryForTarget?.id,
        artworkId: selectedArtwork?.id || 'standalone',
        artworkTitle: selectedArtwork?.title || storyTitle.trim() || 'Tác phẩm tự sự',
        artworkImageUrl: safeImageUrl.startsWith('data:video/') ? '' : safeImageUrl,
        artworkVideoUrl: isSelectedArtworkVideo ? resolvedVideoUrl : '',
        mediaType: isSelectedArtworkVideo
          ? ('video' as const)
          : selectedArtwork
            ? ('image' as const)
            : ('none' as const),
        artworkVisualType: selectedArtwork?.visualType || 'watercolor',
        classGroupId:
          selectedArtwork?.classGroupId || profile?.classGroupId || 'cls-6',
        gradeLabel: normalizeGrade(
          selectedArtwork?.className ||
            selectedArtwork?.classGroupId ||
            profile?.className ||
            profile?.classGroupId ||
            'Lớp 6'
        ),
        lessonId: selectedArtwork?.lessonId || '',
        lessonTitle: selectedArtwork?.lessonTitle || '',
        topic: selectedArtwork?.topic || selectedArtwork?.lessonTitle || '',
        storyTitle:
          storyTitle.trim() ||
          `Câu chuyện về ${selectedArtwork?.title || 'tác phẩm của em'}`,
        storyContent:
          combinedBody ||
          [inspirationText.trim(), feelingText.trim()].filter(Boolean).join('\n\n'),
        inspirationText: inspirationText.trim(),
        feelingText: feelingText.trim(),
        viewerMessage: viewerMessage.trim(),
        status: targetStatus,
      };

      const res = await fetch(getApiUrl('/api/stories'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMessage(data.error || 'Không thể lưu câu chuyện. Em vui lòng thử lại nhé!');
        return;
      }

      const savedStory = data.story as ArtworkStory;

      // Also persist directly to Firestore collection `artworkStories` when client auth permits
      try {
        await saveArtworkStoryInFirestore(savedStory);
      } catch (fsErr) {
        console.warn('Firestore story mirror warning:', fsErr);
      }

      // Clear local temp draft once saved to server
      try {
        localStorage.removeItem(
          `artverse_story_draft_${activeUid || 'anon'}_${selectedArtwork?.id || 'standalone'}`
        );
      } catch {
        // ignore
      }

      onStorySaved(savedStory);
      const msg =
        targetStatus === 'draft'
          ? 'Đã lưu bản nháp câu chuyện! Em có thể tiếp tục viết bất cứ lúc nào.'
          : 'Đã gửi câu chuyện tới Giáo viên Mĩ thuật để duyệt xuất bản!';
      setStatusNotice(msg);
      onShowToast?.('success', targetStatus === 'draft' ? 'Đã lưu bản nháp' : 'Đã gửi chờ duyệt', msg);

      if (targetStatus === 'pending') {
        setTimeout(() => {
          onClose();
        }, 900);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lỗi kết nối khi lưu câu chuyện.');
    } finally {
      setSavingMode(null);
    }
  };

  const displayNickname =
    profile?.nickname || profile?.alias || profile?.displayName || 'Nghệ sĩ Trẻ';
  const displayGrade = normalizeGrade(
    profile?.className || profile?.classGroupId || selectedArtwork?.className || 'Lớp 6'
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#20243A]/75 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#F7F3EA] border border-[#20243A]/20 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-[#20243A]">
        {/* Editorial Top Header */}
        <div className="px-6 py-4 bg-[#20243A] text-[#F7F3EA] flex items-center justify-between border-b border-[#20243A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#3457D5] flex items-center justify-center text-white shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base sm:text-lg font-black tracking-tight text-[#F7F3EA]">
                  KỂ CÂU CHUYỆN CỦA EM
                </h3>
                <span className="px-2 py-0.5 rounded-sm bg-[#F2D64B] text-[#20243A] text-[10px] font-bold uppercase tracking-wider">
                  ARTVERSE STORIES
                </span>
              </div>
              <p className="text-xs text-[#F7F3EA]/75">
                Biệt danh nghệ sĩ: <strong className="text-[#F2D64B]">{displayNickname}</strong> ·{' '}
                {displayGrade}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#F7F3EA]/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Editorial Form */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Teacher Revision Note Banner if story needs revision */}
          {existingStoryForTarget?.teacherNote && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3 text-xs">
              <Award className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-extrabold uppercase tracking-wider block text-[11px] text-amber-800">
                  Góp ý & khích lệ từ Giáo viên Mĩ thuật ({existingStoryForTarget.status === 'revision_required' ? 'Cần chỉnh sửa thêm' : existingStoryForTarget.status})
                </span>
                <p className="font-medium leading-relaxed">{existingStoryForTarget.teacherNote}</p>
              </div>
            </div>
          )}

          {/* 1. Liên kết Tác phẩm Ảnh hoặc Video */}
          <div className="bg-white border border-[#20243A]/15 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#20243A]">
                1. Tác phẩm Ảnh / Video gắn với câu chuyện
              </label>
              <span className="text-[11px] font-semibold text-[#3457D5]">
                {isSelectedArtworkVideo ? '🎬 Video quá trình sáng tạo' : '🖼️ Tranh / Tác phẩm'}
              </span>
            </div>

            {selectableArtworks.length > 0 && !initialArtwork && (
              <select
                value={selectedArtworkId}
                onChange={(e) => setSelectedArtworkId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#20243A]/20 text-xs sm:text-sm font-bold text-[#20243A] bg-[#F7F3EA]"
              >
                {selectableArtworks.map((art) => {
                  const isVid =
                    art.mediaType === 'video' ||
                    Boolean(art.videoUrl) ||
                    Boolean(art.mimeType && art.mimeType.startsWith('video/'));
                  return (
                    <option key={art.id} value={art.id}>
                      {isVid ? '🎬 [VIDEO] ' : '🖼️ [ẢNH] '}
                      {art.title} ({normalizeGrade(art.className || art.classGroupId)})
                    </option>
                  );
                })}
                <option value="__standalone__">
                  ✍️ Câu chuyện độc lập (Chưa gắn tác phẩm cụ thể)
                </option>
              </select>
            )}

            {selectedArtwork ? (
              <div className="flex items-center gap-4 pt-1">
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#20243A]/15 shrink-0 bg-[#20243A]">
                  {selectedArtwork.thumbnailUrl || selectedArtwork.imageUrl ? (
                    <img
                      src={selectedArtwork.thumbnailUrl || selectedArtwork.imageUrl}
                      alt={selectedArtwork.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ArtCanvasVisual
                      type={selectedArtwork.visualType || 'watercolor'}
                      title={selectedArtwork.title}
                      className="w-full h-full"
                    />
                  )}
                  <span
                    className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase text-white inline-flex items-center gap-0.5 ${
                      isSelectedArtworkVideo ? 'bg-[#F15B3D]' : 'bg-[#3457D5]'
                    }`}
                  >
                    {isSelectedArtworkVideo ? (
                      <>
                        <Film className="w-2.5 h-2.5" /> VIDEO
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-2.5 h-2.5" /> ẢNH
                      </>
                    )}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-sm bg-[#20243A] text-[#F7F3EA]">
                      {normalizeGrade(selectedArtwork.className || selectedArtwork.classGroupId)}
                    </span>
                    {selectedArtwork.lessonTitle && (
                      <span className="text-[11px] font-medium text-[#20243A]/65 truncate">
                        Chủ đề: {selectedArtwork.lessonTitle}
                      </span>
                    )}
                  </div>
                  <h4 className="font-display font-bold text-[#20243A] text-sm sm:text-base truncate">
                    {selectedArtwork.title}
                  </h4>
                  <p className="text-xs text-[#20243A]/65 mt-0.5 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-[#F15B3D]" />
                    Chất liệu: {selectedArtwork.materialsUsed || 'Màu tổng hợp'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#20243A]/75 bg-[#F7F3EA] p-3 rounded-lg border border-[#20243A]/15">
                Em đang viết câu chuyện sáng tạo độc lập. Em cũng có thể chọn một bức tranh hoặc video đã tải lên để liên kết.
              </p>
            )}
          </div>

          {/* 2. Trợ lý Gợi mở Kể chuyện (AI Writing Facilitator — Không viết thay) */}
          <div className="bg-white border border-[#3457D5]/25 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#3457D5] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#3457D5]" />
                  Trợ lý Gợi mở Kể chuyện (AI Writing Facilitator)
                </h4>
                <p className="text-[11px] text-[#20243A]/70 mt-0.5">
                  Hỗ trợ gợi ý câu hỏi, bố cục, tiêu đề và kiểm tra chính tả — giữ nguyên giọng văn thật của em.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleRequestAiAssist('questions')}
                disabled={assistLoadingAction !== null}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  assistActiveAction === 'questions'
                    ? 'bg-[#3457D5] text-white border-[#3457D5]'
                    : 'bg-[#F7F3EA] hover:bg-[#3457D5]/10 text-[#20243A] border-[#20243A]/15'
                }`}
              >
                <Wand2
                  className={`w-3.5 h-3.5 ${
                    assistLoadingAction === 'questions' ? 'animate-spin' : ''
                  }`}
                />
                <span>Gợi ý câu hỏi ý tưởng</span>
              </button>

              <button
                type="button"
                onClick={() => handleRequestAiAssist('structure')}
                disabled={assistLoadingAction !== null}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  assistActiveAction === 'structure'
                    ? 'bg-[#3457D5] text-white border-[#3457D5]'
                    : 'bg-[#F7F3EA] hover:bg-[#3457D5]/10 text-[#20243A] border-[#20243A]/15'
                }`}
              >
                <ListTree
                  className={`w-3.5 h-3.5 ${
                    assistLoadingAction === 'structure' ? 'animate-spin' : ''
                  }`}
                />
                <span>Gợi ý bố cục kể chuyện</span>
              </button>

              <button
                type="button"
                onClick={() => handleRequestAiAssist('titles')}
                disabled={assistLoadingAction !== null}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  assistActiveAction === 'titles'
                    ? 'bg-[#3457D5] text-white border-[#3457D5]'
                    : 'bg-[#F7F3EA] hover:bg-[#3457D5]/10 text-[#20243A] border-[#20243A]/15'
                }`}
              >
                <Heading
                  className={`w-3.5 h-3.5 ${
                    assistLoadingAction === 'titles' ? 'animate-spin' : ''
                  }`}
                />
                <span>Gợi ý đặt tiêu đề</span>
              </button>

              <button
                type="button"
                onClick={() => handleRequestAiAssist('spellcheck')}
                disabled={assistLoadingAction !== null}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  assistActiveAction === 'spellcheck'
                    ? 'bg-[#3457D5] text-white border-[#3457D5]'
                    : 'bg-[#F7F3EA] hover:bg-[#3457D5]/10 text-[#20243A] border-[#20243A]/15'
                }`}
              >
                <SpellCheck
                  className={`w-3.5 h-3.5 ${
                    assistLoadingAction === 'spellcheck' ? 'animate-spin' : ''
                  }`}
                />
                <span>Kiểm tra chính tả & diễn đạt</span>
              </button>
            </div>

            {assistSuggestions.length > 0 && (
              <div className="pt-2 border-t border-[#20243A]/10 space-y-1.5">
                {assistNote && (
                  <p className="text-[11px] font-bold text-[#3457D5]">{assistNote}</p>
                )}
                {assistSuggestions.map((q, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      if (assistActiveAction === 'titles' && !storyTitle.trim()) {
                        setStoryTitle(q.replace(/^["“”'-]+|["“”'-]+$/g, '').trim());
                      }
                    }}
                    className={`flex items-start gap-2 text-xs text-[#20243A] bg-[#F7F3EA] px-3 py-2 rounded-lg border border-[#20243A]/12 ${
                      assistActiveAction === 'titles' ? 'cursor-pointer hover:border-[#3457D5]' : ''
                    }`}
                  >
                    <HelpCircle className="w-4 h-4 text-[#3457D5] shrink-0 mt-0.5" />
                    <span>{q}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Tên câu chuyện */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#20243A] mb-1.5">
              2. Tên câu chuyện của em <span className="text-[#F15B3D]">*</span>
            </label>
            <input
              type="text"
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
              maxLength={150}
              placeholder="Ví dụ: Đêm trăng rằm bên cầu Rồng, Sắc màu khu vườn tuổi thơ..."
              className="w-full px-4 py-2.5 rounded-lg bg-white border border-[#20243A]/20 text-[#20243A] font-bold text-sm focus:outline-none focus:border-[#3457D5]"
            />
          </div>

          {/* 4. Em muốn kể điều gì? (Nội dung chính) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#20243A]">
                3. Em muốn kể điều gì về tác phẩm này? <span className="text-[#F15B3D]">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowGuidedPrompts((v) => !v)}
                className="text-[11px] font-bold text-[#3457D5] hover:underline cursor-pointer"
              >
                {showGuidedPrompts ? 'Thu gọn gợi ý chi tiết' : 'Mở gợi ý cảm hứng & cảm xúc'}
              </button>
            </div>
            <textarea
              value={storyContent}
              onChange={(e) => setStoryContent(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="Hãy kể tự nhiên bằng giọng văn của em: Bức tranh hay video này ghi lại khoảnh khắc, kỷ niệm hoặc ý tưởng gì đặc biệt?..."
              className="w-full px-4 py-3 rounded-lg bg-white border border-[#20243A]/20 text-[#20243A] text-sm leading-relaxed focus:outline-none focus:border-[#3457D5]"
            />
          </div>

          {/* 5. Câu hỏi gợi mở tùy chọn: Cảm hứng & Cảm xúc */}
          {showGuidedPrompts && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#20243A]/80 mb-1">
                  Điều gì khiến em tạo ra tác phẩm này? (Tùy chọn)
                </label>
                <textarea
                  value={inspirationText}
                  onChange={(e) => setInspirationText(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="Một cảnh đẹp, một câu chuyện, hay một buổi học thú vị..."
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-[#20243A]/20 text-[#20243A] text-xs leading-relaxed focus:outline-none focus:border-[#3457D5]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#20243A]/80 mb-1">
                  Em cảm thấy thế nào khi thực hiện? (Tùy chọn)
                </label>
                <textarea
                  value={feelingText}
                  onChange={(e) => setFeelingText(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="Hào hứng khi pha màu, kiên nhẫn khi tỉa từng nét cọ..."
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-[#20243A]/20 text-[#20243A] text-xs leading-relaxed focus:outline-none focus:border-[#3457D5]"
                />
              </div>
            </div>
          )}

          {/* 6. Thông điệp gửi người xem */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#20243A] mb-1.5 flex items-center gap-1.5">
              <MessageSquareHeart className="w-4 h-4 text-[#F15B3D]" />
              4. Thông điệp gửi người xem (Tùy chọn)
            </label>
            <textarea
              value={viewerMessage}
              onChange={(e) => setViewerMessage(e.target.value)}
              rows={2}
              maxLength={800}
              placeholder="Lời nhắn nhủ em muốn gửi tới thầy cô, bạn bè và người thưởng lãm..."
              className="w-full px-4 py-2.5 rounded-lg bg-white border border-[#20243A]/20 text-[#20243A] text-sm focus:outline-none focus:border-[#3457D5]"
            />
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 text-xs font-bold bg-rose-50 text-rose-900 border border-rose-200 px-4 py-3 rounded-lg">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusNotice && (
            <div className="flex items-start gap-2 text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 px-4 py-3 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{statusNotice}</span>
            </div>
          )}
        </div>

        {/* Footer Actions: Lưu bản nháp & Gửi câu chuyện */}
        <div className="px-6 py-4 bg-white border-t border-[#20243A]/15 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-[#20243A]/65 font-medium">
            Chỉ hiển thị biệt danh và khối lớp công khai. Câu chuyện sẽ được giáo viên duyệt trước khi đăng.
          </p>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleSave('draft')}
              disabled={savingMode !== null}
              className="px-4 py-2.5 rounded-lg bg-[#F7F3EA] hover:bg-[#20243A]/5 border border-[#20243A]/20 text-[#20243A] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-[#20243A]" />
              <span>{savingMode === 'draft' ? 'Đang lưu nháp...' : 'Lưu bản nháp'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSave('pending')}
              disabled={savingMode !== null}
              className="px-5 py-2.5 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{savingMode === 'pending' ? 'Đang gửi...' : 'Gửi câu chuyện'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

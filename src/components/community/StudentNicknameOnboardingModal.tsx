/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Hộp thoại Học sinh Tự tạo Biệt danh Sáng tạo khi Đăng nhập Lần đầu
 * ("EM MUỐN ĐƯỢC GỌI LÀ GÌ?")
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Palette,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Frame,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CREATIVE_NICKNAME_SUGGESTIONS } from '../../types/communityArt';
import { getApiUrl } from '../../lib/platform';
import { normalizeGrade } from '../../utils/gradeUtils';

interface StudentNicknameOnboardingModalProps {
  isOpen: boolean;
  onNicknameSaved?: (newNickname: string) => void;
  allowCloseIfAlreadySet?: boolean;
  onClose?: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const StudentNicknameOnboardingModal: React.FC<StudentNicknameOnboardingModalProps> = ({
  isOpen,
  onNicknameSaved,
  allowCloseIfAlreadySet = false,
  onClose,
}) => {
  const { profile, isStudent, updateStudentNickname, getValidBearerToken } = useAuth();
  const [nicknameInput, setNicknameInput] = useState<string>(profile?.nickname || '');
  const [suggestions, setSuggestions] = useState<string[]>(CREATIVE_NICKNAME_SUGGESTIONS);
  const [checking, setChecking] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [validationState, setValidationState] = useState<{
    valid: boolean;
    available: boolean;
    reason?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && profile?.nickname) {
      setNicknameInput(profile.nickname);
    }
  }, [isOpen, profile?.nickname]);

  // Real-time debounced validation & duplicate check
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = nicknameInput.trim();
    if (!trimmed) {
      setValidationState(null);
      setErrorMessage(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setChecking(true);
        const token = await getValidBearerToken();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(
          getApiUrl(`/api/student/nickname/check?nickname=${encodeURIComponent(trimmed)}`),
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          setValidationState({
            valid: Boolean(data.valid),
            available: Boolean(data.available),
            reason: data.reason,
          });
          if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
            setSuggestions(
              Array.from(new Set([...CREATIVE_NICKNAME_SUGGESTIONS, ...data.suggestions])).slice(
                0,
                10
              )
            );
          }
        }
      } catch {
        // Ignore network hiccup during typing
      } finally {
        setChecking(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [nicknameInput, isOpen, getValidBearerToken]);

  if (!isOpen || !isStudent || !profile) return null;

  const previewNickname = nicknameInput.trim() || 'Mây Màu';
  const normalizedGradeLabel = normalizeGrade(profile.className || profile.classGroupId || 'Lớp 6');

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmed = nicknameInput.trim();
    if (!trimmed) {
      setErrorMessage('Em hãy nhập hoặc chọn một biệt danh sáng tạo nhé!');
      return;
    }

    setSubmitting(true);
    try {
      const result = await updateStudentNickname(trimmed);
      if (!result.success) {
        setErrorMessage(result.error || 'Biệt danh chưa hợp lệ. Em hãy thử tên khác nhé!');
        if (result.suggestions && result.suggestions.length > 0) {
          setSuggestions(
            Array.from(new Set([...result.suggestions, ...CREATIVE_NICKNAME_SUGGESTIONS])).slice(
              0,
              10
            )
          );
        }
        return;
      }

      const finalNick = result.profile?.nickname || trimmed;
      setSuccessMessage(`Tuyệt vời! Chào mừng nghệ sĩ “${finalNick}” đến với ARTVERSE AI!`);
      if (onNicknameSaved) {
        onNicknameSaved(finalNick);
      }
      if (onClose) {
        setTimeout(() => onClose(), 600);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-stone-950/75 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#FAF8F5] border border-stone-200 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Decorative top accent */}
        <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

        <div className="p-6 sm:p-8">
          {/* Header badge */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100/80 border border-amber-300/70 text-amber-900 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Không gian Nghệ thuật Học đường ARTVERSE AI
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 bg-stone-100 px-3 py-1 rounded-lg border border-stone-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Bảo mật tên thật & mã học sinh
            </div>
          </div>

          {/* Exact Mandatory Heading & Quote from Specification */}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight mb-2">
            EM MUỐN ĐƯỢC GỌI LÀ GÌ?
          </h2>
          <p className="text-stone-700 text-sm sm:text-base italic leading-relaxed bg-amber-50/70 border-l-4 border-amber-500 pl-4 py-2.5 rounded-r-xl mb-6">
            “Mỗi nghệ sĩ đều có một cái tên riêng. Hãy chọn cho mình một biệt danh thật sáng tạo để xuất hiện trong không gian nghệ thuật ARTVERSE AI nhé!”
          </p>

          <form onSubmit={handleConfirmSave} className="space-y-6">
            {/* Nickname Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                Nhập biệt danh nghệ sĩ của em (2 – 30 ký tự)
              </label>
              <div className="relative">
                <Palette className="w-5 h-5 text-amber-600 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => {
                    setNicknameInput(e.target.value);
                    setErrorMessage(null);
                  }}
                  maxLength={30}
                  placeholder="Ví dụ: Mây Màu, Cọ Nhỏ, Mặt Trời Xanh..."
                  className="w-full pl-12 pr-24 py-3.5 rounded-2xl bg-white border-2 border-stone-300 text-stone-900 font-bold text-base focus:outline-none focus:border-amber-600 transition-colors"
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-400">
                  {nicknameInput.trim().length}/30
                </span>
              </div>

              {/* Validation Feedback */}
              {checking && (
                <p className="mt-2 text-xs text-stone-500 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  Đang kiểm tra biệt danh...
                </p>
              )}
              {!checking && validationState && !errorMessage && (
                <div
                  className={`mt-2.5 flex items-start gap-2 text-xs font-medium px-3.5 py-2 rounded-xl border ${
                    validationState.valid && validationState.available
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-900 border-amber-200'
                  }`}
                >
                  {validationState.valid && validationState.available ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        Biệt danh <strong>“{nicknameInput.trim()}”</strong> rất đẹp và sẵn sàng sử dụng!
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{validationState.reason}</span>
                    </>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="mt-2.5 flex items-start gap-2 text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 px-3.5 py-2.5 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="mt-2.5 flex items-center gap-2 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-2.5 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}
            </div>

            {/* Creative Nickname Suggestions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  Gợi ý biệt danh sáng tạo (chạm để chọn nhanh):
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((sug) => {
                  const isSelected =
                    nicknameInput.trim().toLowerCase() === sug.toLowerCase();
                  return (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => {
                        setNicknameInput(sug);
                        setErrorMessage(null);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        isSelected
                          ? 'bg-stone-900 text-amber-300 border-stone-900 shadow-sm'
                          : 'bg-white text-stone-700 border-stone-200 hover:border-amber-400 hover:bg-amber-50/60'
                      }`}
                    >
                      ✨ {sug}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Dual Preview: Artwork Card & Story Card */}
            <div className="bg-stone-100/90 border border-stone-200/90 rounded-2xl p-4 sm:p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3 flex items-center gap-2">
                <Frame className="w-4 h-4 text-amber-700" />
                Xem trước cách biệt danh xuất hiện trên tác phẩm & câu chuyện
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Preview 1: Artwork Plaque */}
                <div className="bg-white border border-stone-200 rounded-xl p-3.5 shadow-xs">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 mb-1.5">
                    <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Triển lãm tác phẩm
                    </span>
                    <span>{normalizedGradeLabel}</span>
                  </div>
                  <p className="font-bold text-stone-900 text-sm truncate">
                    Bức tranh ước mơ của em
                  </p>
                  <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="text-stone-500">Nghệ sĩ sáng tác:</span>
                    <span className="font-extrabold text-stone-900 bg-stone-100 px-2.5 py-0.5 rounded-md">
                      🎨 {previewNickname}
                    </span>
                  </div>
                </div>

                {/* Preview 2: Story Card Plaque */}
                <div className="bg-white border border-stone-200 rounded-xl p-3.5 shadow-xs">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 mb-1.5">
                    <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <BookOpen className="w-3 h-3" />
                      Câu chuyện từ bức tranh
                    </span>
                    <span>{normalizedGradeLabel}</span>
                  </div>
                  <p className="text-xs text-stone-600 italic line-clamp-2">
                    “Mỗi nét cọ là một kỷ niệm đẹp mà em muốn gửi tới người xem...”
                  </p>
                  <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="text-stone-500">Biệt danh tác giả:</span>
                    <span className="font-extrabold text-amber-800">
                      ✨ {previewNickname}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-[11px] text-stone-500">
                Lưu ý: Biệt danh chỉ dùng để hiển thị công khai trên phòng trưng bày. Khi đăng nhập, em vẫn dùng <strong>Mã lớp + Mã học sinh + Mã PIN</strong> trên thẻ đăng nhập của mình.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              {allowCloseIfAlreadySet && profile.nickname && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl border border-stone-300 text-stone-700 font-bold text-sm hover:bg-stone-100 transition-colors"
                >
                  Đóng
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || !nicknameInput.trim()}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-amber-300 font-extrabold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {submitting ? 'Đang lưu biệt danh...' : 'Xác nhận và lưu biệt danh'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

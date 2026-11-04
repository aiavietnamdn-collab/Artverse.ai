/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Màn hình Học sinh Đăng nhập bằng Mã lớp + Mã HS + Mã PIN (Phương án A)
 * - Giữ nguyên số 0 ở đầu Mã HS (ví dụ: 001, 002)
 * - Nếu cột Bí danh (Cột B trong Excel) để trống, yêu cầu học sinh tự tạo Bí danh nghệ thuật trong lần đăng nhập đầu tiên
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  KeyRound,
  Eye,
  EyeOff,
  LogIn,
  X,
  Sparkles,
  School,
  UserCheck,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Palette,
  CheckCircle2,
} from 'lucide-react';

interface StudentPinLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

const SUGGESTED_ALIASES = [
  'Cọ Nhỏ Mùa Thu',
  'Màu Xanh Hy Vọng',
  'Nắng Vàng Rực Rỡ',
  'Họa Sĩ Ánh Sao',
  'Gió Biển Xanh',
  'Mây Trắng Đồng Quê',
];

export const StudentPinLoginModal: React.FC<StudentPinLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const { loginStudentWithPin, updateStudentAlias, profile, verifiedRole } = useAuth();

  const [classCode, setClassCode] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // First-time Alias Setup State (when Cột B: Bí danh was empty in Excel)
  const [aliasStepActive, setAliasStepActive] = useState(false);
  const [aliasInput, setAliasInput] = useState('');
  const [savingAlias, setSavingAlias] = useState(false);

  const mustSetupAlias =
    aliasStepActive || (verifiedRole === 'student' && Boolean(profile?.needsAliasSetup));

  if (!isOpen && !mustSetupAlias) return null;

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedClass = classCode.trim().toUpperCase();
    const trimmedStudent = studentCode.trim().toUpperCase();
    const trimmedPin = pin.trim();

    if (!trimmedClass) {
      setErrorMessage('Em vui lòng nhập Mã lớp (ví dụ: LOP6 hoặc LOP6A) nhé!');
      return;
    }
    if (!trimmedStudent) {
      setErrorMessage('Em vui lòng nhập Mã HS (ví dụ: 001 hoặc HS01) nhé!');
      return;
    }
    if (!trimmedPin || trimmedPin.length < 4) {
      setErrorMessage('Em vui lòng nhập đầy đủ Mã PIN gồm 6 chữ số trên thẻ nhé!');
      return;
    }

    setSubmitting(true);
    try {
      const result = await loginStudentWithPin(trimmedClass, trimmedStudent, trimmedPin);
      if (!result.success) {
        setErrorMessage(
          result.error ||
            'Mã lớp, mã học sinh hoặc mã PIN chưa đúng. Em hãy kiểm tra lại thẻ đăng nhập nhé!'
        );
        return;
      }

      setClassCode('');
      setStudentCode('');
      setPin('');

      // Check if student needs first-time alias setup
      const savedSessionRaw = localStorage.getItem('artverse_student_pin_session_v1');
      let needsSetup = false;
      if (savedSessionRaw) {
        try {
          const parsed = JSON.parse(savedSessionRaw);
          needsSetup = Boolean(parsed?.student?.needsAliasSetup);
        } catch {
          needsSetup = false;
        }
      }

      if (needsSetup) {
        setAliasStepActive(true);
      } else {
        onLoginSuccess?.();
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitFirstAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanAlias = aliasInput.trim();
    if (!cleanAlias || cleanAlias.length < 2) {
      setErrorMessage('Em hãy nhập Bí danh nghệ thuật từ 2 ký tự trở lên nhé!');
      return;
    }

    setSavingAlias(true);
    try {
      const res = await updateStudentAlias(cleanAlias);
      if (!res.success) {
        setErrorMessage(res.error || 'Không thể lưu bí danh. Em vui lòng thử lại nhé!');
        return;
      }
      setAliasStepActive(false);
      setAliasInput('');
      onLoginSuccess?.();
      onClose();
    } finally {
      setSavingAlias(false);
    }
  };

  if (mustSetupAlias) {
    return (
      <div
        className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-alias-setup-title"
      >
        <div className="bg-[#FAF8F5] w-full max-w-md rounded-3xl border border-stone-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-gradient-to-r from-emerald-700 to-teal-700 px-6 py-5 text-white">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-amber-200 text-[11px] font-bold mb-2">
              <Palette className="w-3.5 h-3.5" />
              <span>Bước Khởi Tạo Lần Đầu · Bảo Mật Danh Tính</span>
            </div>
            <h2 id="student-alias-setup-title" className="font-editorial text-2xl font-bold leading-tight">
              Tạo Bí Danh Nghệ Thuật Của Em
            </h2>
            <p className="text-xs text-emerald-100 mt-1 leading-relaxed">
              Bí danh này sẽ hiển thị dưới các bức tranh của em trong Triển lãm. Không sử dụng họ tên thật để bảo vệ quyền riêng tư!
            </p>
          </div>

          <form onSubmit={handleSubmitFirstAlias} className="p-6 space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                Bí danh nghệ thuật của em <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={40}
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                placeholder="Ví dụ: Cọ Nhỏ 01, Màu Xanh 02..."
                className="w-full px-4 py-3 rounded-2xl bg-white border border-stone-300 text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-stone-600 block">
                Gợi ý bí danh đẹp (chạm để chọn):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_ALIASES.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setAliasInput(sug)}
                    className="px-2.5 py-1 rounded-xl bg-white hover:bg-emerald-50 border border-stone-200 hover:border-emerald-300 text-[11px] font-semibold text-stone-700 hover:text-emerald-800 cursor-pointer transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={savingAlias}
              className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {savingAlias ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu bí danh...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-amber-300" />
                  <span>Lưu Bí Danh &amp; Vào Triển Lãm</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-login-title"
    >
      <div className="bg-[#FAF8F5] w-full max-w-md rounded-3xl border border-stone-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1D4ED8] to-indigo-700 px-6 py-5 text-white relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ đăng nhập"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-amber-200 text-[11px] font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ART VERSE AI · Dành cho Học sinh (Lớp 1 – Lớp 9)</span>
          </div>

          <h2 id="student-login-title" className="font-editorial text-2xl font-bold leading-tight">
            Đăng nhập Không gian Mĩ thuật ART VERSE AI
          </h2>
          <p className="text-xs text-blue-100 mt-1 flex items-center gap-1.5 font-medium">
            <KeyRound className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Nhận thẻ Mã lớp + Mã HS + Mã PIN từ giáo viên</span>
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmitLogin} className="p-6 space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Trường 1: Mã lớp */}
          <div>
            <label
              htmlFor="student-login-class-code"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              1. Mã lớp <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <School className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="student-login-class-code"
                type="text"
                autoComplete="off"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                placeholder="Ví dụ: LOP6, LOP6A, LOP1..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-stone-300 text-sm font-bold text-stone-900 uppercase placeholder:normal-case placeholder:font-normal placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>
          </div>

          {/* Trường 2: Mã HS (Giữ nguyên số 0 ở đầu) */}
          <div>
            <label
              htmlFor="student-login-student-code"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              2. Mã HS (Giữ nguyên số 0 ở đầu nếu có) <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <UserCheck className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="student-login-student-code"
                type="text"
                autoComplete="off"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                placeholder="Ví dụ: 001, 002, HS01..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-stone-300 text-sm font-mono font-bold text-stone-900 uppercase placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>
          </div>

          {/* Trường 3: Mã PIN (có nút hiển thị/ẩn) */}
          <div>
            <label
              htmlFor="student-login-pin"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              3. Mã PIN <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="student-login-pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\s+/g, ''))}
                placeholder="Nhập mã PIN 6 chữ số trên thẻ..."
                className="w-full pl-10 pr-24 py-3 rounded-2xl bg-white border border-stone-300 text-sm font-bold tracking-widest text-stone-900 placeholder:tracking-normal placeholder:font-normal placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
              <button
                type="button"
                onClick={() => setShowPin((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                aria-label={showPin ? 'Ẩn mã PIN' : 'Hiện mã PIN'}
              >
                {showPin ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Ẩn</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Hiện</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Nút Đăng nhập */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl bg-[#1D4ED8] hover:bg-[#1E40AF] active:scale-[0.99] text-white text-sm font-extrabold shadow-md shadow-[#1D4ED8]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang kiểm tra thẻ đăng nhập...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 text-[#FBBF24]" />
                <span>Đăng nhập</span>
              </>
            )}
          </button>

          {/* Privacy & Safety reassurance */}
          <div className="pt-2 border-t border-stone-200/80 flex items-start gap-2 text-[11px] text-stone-500 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              An toàn cho học sinh: Triển lãm chỉ hiển thị Bí danh nghệ thuật, không công khai họ tên thật. Nếu quên mã PIN, em hãy nhờ Giáo viên Mĩ thuật cấp lại mã mới nhé!
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};

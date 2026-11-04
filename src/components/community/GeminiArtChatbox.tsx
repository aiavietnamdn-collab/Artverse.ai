/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Trợ lý Mĩ thuật Gemini (Dành riêng cho Học sinh) & Bảng Quản trị Gemini (Dành cho Admin)
 *
 * NGUYÊN TẮC PHÂN QUYỀN BẮT BUỘC:
 * - Học sinh (role = 'student'): Được trò chuyện văn bản & gửi ảnh, giới hạn 10 lượt/ngày.
 * - Giáo viên (role = 'teacher'): Không hiển thị nút/giao diện trò chuyện AI, bị chặn ở backend.
 * - Quản trị viên (role = 'admin'): Không trò chuyện; chỉ quản lý cấu hình, bật/tắt, hạn mức, ngân sách, phân quyền GV và xem thống kê.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArtLesson } from '../../types/communityArt';
import { STANDARD_GRADES, normalizeGrade } from '../../utils/gradeUtils';
import { getApiUrl } from '../../lib/platform';
import { useAuth } from '../../context/AuthContext';
import {
  Sparkles,
  Send,
  X,
  Maximize2,
  Minimize2,
  Trash2,
  Image as ImageIcon,
  Bot,
  User,
  Copy,
  Check,
  Loader2,
  Palette,
  BookOpen,
  MessageSquareHeart,
  ChevronDown,
  KeyRound,
  ShieldCheck,
  BarChart3,
  Power,
  Clock,
  AlertCircle,
  UserPlus,
} from 'lucide-react';

export interface ChatTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  imagePreviewUrl?: string;
  gradeContext?: string;
  lessonContext?: string;
}

interface GeminiArtChatboxProps {
  lessons: ArtLesson[];
  isFullPage?: boolean;
  isOpenFloating?: boolean;
  onToggleFloating?: (open: boolean) => void;
  onShowToast?: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

interface StudentQuotaState {
  geminiEnabled: boolean;
  usedToday: number;
  dailyLimit: number;
  remainingQuota: number;
  resetAt: string;
  resetTimeText: string;
}

interface AdminGeminiStatsResponse {
  config: {
    geminiEnabled: boolean;
    dailyLimitPerStudent: number;
    monthlyBudgetUsd: number;
    updatedAt: string;
  };
  apiKeyStatus: {
    configured: boolean;
    maskedPreview: string;
  };
  stats: {
    dateKey: string;
    resetAt: string;
    resetTimeText: string;
    totalStudentsRegistered: number;
    totalStudentsUsedToday: number;
    totalStudentsAllTime: number;
    totalRequestsToday: number;
    totalRequestsAllTime: number;
    totalTokensToday: number;
    totalPromptTokensAllTime: number;
    totalCandidateTokensAllTime: number;
    totalTokensAllTime: number;
    estimatedCostUsd: number;
  };
}

const STORAGE_KEY = 'artverse_gemini_chat_history_v2';

const INITIAL_WELCOME_MESSAGE: ChatTurn = {
  id: 'welcome-msg',
  role: 'model',
  text:
    'Xin chào! Mình là **Trợ lý Mĩ thuật Artverse AI** (kết nối với **Google Gemini**), người bạn đồng hành sáng tạo dành riêng cho **Học sinh từ Lớp 1 đến Lớp 9**.\n\n' +
    'Mình có thể giúp em:\n' +
    '- 🎨 **Gợi ý ý tưởng vẽ tranh**, phối màu (nóng/lạnh, bổ túc, tương phản) và sắp xếp bố cục cho **Lớp 1 đến Lớp 9**.\n' +
    '- 🖼️ **Nhận xét tích cực & gợi mở sáng tạo** khi em đính kèm ảnh chụp bức tranh của mình (tuân thủ nguyên tắc *Không chấm điểm*).\n\n' +
    'Hôm nay em đang thực hành bài vẽ thuộc lớp nào, hay muốn mình góp ý cho tác phẩm nào?',
  timestamp: 'Hôm nay',
};

const QUICK_PROMPTS = [
  {
    label: '🎨 Gợi ý ý tưởng vẽ tranh',
    prompt:
      'Hãy gợi ý cho em 3 ý tưởng sáng tạo và độc đáo để vẽ tranh theo chủ đề bài học đang chọn, kèm chất liệu phù hợp.',
  },
  {
    label: '🌈 Cách phối màu nổi bật',
    prompt:
      'Hướng dẫn em cách phối màu hài hòa, sử dụng cặp màu bổ túc hoặc tương phản để làm nổi bật hình ảnh chính trong tranh.',
  },
  {
    label: '📐 Mẹo sắp xếp bố cục',
    prompt:
      'Làm thế nào để sắp xếp bố cục mảng chính và mảng phụ cân đối, có chiều sâu xa gần mà không bị rời rạc?',
  },
  {
    label: '💬 Nhận xét tích cực cho tranh',
    prompt:
      'Hãy quan sát bức tranh em gửi kèm và khích lệ điểm sáng màu sắc, đường nét cũng như gợi mở hướng phát triển thêm (không chấm điểm).',
  },
];

export const GeminiArtChatbox: React.FC<GeminiArtChatboxProps> = ({
  lessons,
  isFullPage = false,
  isOpenFloating = false,
  onToggleFloating,
  onShowToast,
}) => {
  const {
    profile,
    isAdmin,
    isTeacher,
    isStudent,
    setIsStudentLoginModalOpen,
    getValidBearerToken,
  } = useAuth();

  // Teacher (non-admin) is strictly forbidden from using or seeing Gemini Chatbox
  const isStrictlyTeacher = isTeacher && !isAdmin;

  const [messages, setMessages] = useState<ChatTurn[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [INITIAL_WELCOME_MESSAGE];
  });

  const [inputText, setInputText] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>(
    profile?.className ? normalizeGrade(profile.className) : 'Lớp 6'
  );
  const [selectedLessonTitle, setSelectedLessonTitle] = useState<string>('');
  const [attachedImage, setAttachedImage] = useState<{
    dataUrl: string;
    mimeType: string;
    fileName: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpandedModal, setIsExpandedModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Student Daily Quota State
  const [quota, setQuota] = useState<StudentQuotaState>({
    geminiEnabled: true,
    usedToday: 0,
    dailyLimit: 10,
    remainingQuota: 10,
    resetAt: '',
    resetTimeText: '00:00 ngày mai',
  });

  // Admin Management State
  const [adminStats, setAdminStats] = useState<AdminGeminiStatsResponse | null>(null);
  const [adminDailyLimitInput, setAdminDailyLimitInput] = useState<number>(10);
  const [adminBudgetInput, setAdminBudgetInput] = useState<number>(25);
  const [savingAdminConfig, setSavingAdminConfig] = useState<boolean>(false);
  const [teachersList, setTeachersList] = useState<
    Array<{ id: string; email: string; displayName: string; createdAt: string }>
  >([]);
  const [newTeacherEmail, setNewTeacherEmail] = useState<string>('');
  const [newTeacherName, setNewTeacherName] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile?.className) {
      const norm = normalizeGrade(profile.className);
      if (norm !== 'Chưa xác định') {
        setSelectedGrade(norm);
      }
    }
  }, [profile?.className]);

  // Fetch Student Quota
  const fetchStudentQuota = useCallback(async () => {
    if (!isStudent) return;
    try {
      const token = await getValidBearerToken();
      if (!token) return;
      const res = await fetch(getApiUrl('/api/gemini/quota'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setQuota(data);
      }
    } catch {
      // ignore
    }
  }, [isStudent, getValidBearerToken]);

  // Fetch Admin Gemini Stats & Teacher Registry
  const fetchAdminDashboard = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const token = await getValidBearerToken();
      if (!token) return;
      const [statsRes, teachersRes] = await Promise.all([
        fetch(getApiUrl('/api/gemini/admin/stats'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(getApiUrl('/api/admin/teachers'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (statsRes.ok) {
        const data = (await statsRes.json()) as AdminGeminiStatsResponse;
        setAdminStats(data);
        setAdminDailyLimitInput(data.config.dailyLimitPerStudent);
        setAdminBudgetInput(data.config.monthlyBudgetUsd);
      }
      if (teachersRes.ok) {
        const tData = await teachersRes.json();
        if (Array.isArray(tData.teachers)) {
          setTeachersList(tData.teachers);
        }
      }
    } catch {
      // ignore
    }
  }, [isAdmin, getValidBearerToken]);

  useEffect(() => {
    if (isStudent) {
      fetchStudentQuota();
    } else if (isAdmin) {
      fetchAdminDashboard();
    }
  }, [isStudent, isAdmin, fetchStudentQuota, fetchAdminDashboard]);

  // Save chat history to localStorage
  useEffect(() => {
    try {
      const lightHistory = messages.slice(-20).map((m) => ({
        ...m,
        imagePreviewUrl: undefined,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lightHistory));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    if (isFullPage || isOpenFloating) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isFullPage, isOpenFloating]);

  // Strictly hide floating widget for Teachers and Admins
  if (isStrictlyTeacher) {
    if (!isFullPage) return null;
    return (
      <div className="bg-white rounded-3xl border border-stone-200 p-8 text-center space-y-3 max-w-xl mx-auto my-6">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="font-editorial text-xl font-bold text-[#121316]">
          Tính năng Trợ lý Gemini AI chỉ dành riêng cho Học sinh
        </h2>
        <p className="text-xs text-stone-600 leading-relaxed">
          Theo quy định phân quyền của ARTVERSE AI, tài khoản Giáo viên được quyền tạo lớp, phát
          hành thẻ PIN học sinh và quản lý triển lãm nhưng không sử dụng tính năng trò chuyện
          Gemini AI của học sinh.
        </p>
      </div>
    );
  }

  // Render Admin Gemini Control & Statistics Dashboard when user is Admin
  if (isAdmin) {
    if (!isFullPage && !isOpenFloating) {
      return null;
    }

    const handleSaveAdminConfig = async (overrideEnabled?: boolean) => {
      setSavingAdminConfig(true);
      try {
        const token = await getValidBearerToken();
        const res = await fetch(getApiUrl('/api/gemini/admin/config'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            geminiEnabled:
              typeof overrideEnabled === 'boolean'
                ? overrideEnabled
                : adminStats?.config.geminiEnabled ?? true,
            dailyLimitPerStudent: adminDailyLimitInput,
            monthlyBudgetUsd: adminBudgetInput,
          }),
        });
        if (res.ok) {
          await fetchAdminDashboard();
          onShowToast?.(
            'success',
            'Đã lưu cấu hình Gemini AI',
            'Cấu hình hạn mức học sinh và trạng thái hệ thống đã được cập nhật.'
          );
        }
      } finally {
        setSavingAdminConfig(false);
      }
    };

    const handleAuthorizeTeacher = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTeacherEmail.trim()) return;
      const token = await getValidBearerToken();
      const res = await fetch(getApiUrl('/api/admin/teachers'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: newTeacherEmail.trim(),
          displayName: newTeacherName.trim() || newTeacherEmail.trim(),
        }),
      });
      if (res.ok) {
        setNewTeacherEmail('');
        setNewTeacherName('');
        await fetchAdminDashboard();
        onShowToast?.(
          'success',
          'Đã cấp quyền Giáo viên',
          'Tài khoản giáo viên đã được phép tạo lớp và quản lý học sinh.'
        );
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-200 mb-2">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Quản trị Hệ thống Gemini AI &amp; Phân quyền Giáo viên (Admin Only)</span>
              </div>
              <h1 className="font-editorial text-2xl font-bold text-[#121316]">
                Bảng Điều khiển Hạn mức, Ngân sách &amp; Thống kê Gemini AI
              </h1>
              <p className="text-xs text-stone-600 mt-1">
                Quản trị viên quản lý API key, bật/tắt hệ thống, hạn mức câu hỏi mỗi ngày của học
                sinh và phân quyền giáo viên. Quản trị viên không sử dụng cửa sổ trò chuyện của học
                sinh.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleSaveAdminConfig(!adminStats?.config.geminiEnabled)}
              disabled={savingAdminConfig}
              className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer transition-all ${
                adminStats?.config.geminiEnabled !== false
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>
                {adminStats?.config.geminiEnabled !== false
                  ? 'Gemini AI: Đang BẬT cho Học sinh'
                  : 'Gemini AI: Đang TẮT toàn hệ thống'}
              </span>
            </button>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-bold text-stone-500 uppercase">
                Trạng thái Server API Key
              </span>
              <p className="text-sm font-extrabold text-stone-900 mt-1">
                {adminStats?.apiKeyStatus.configured ? 'Đã cấu hình an toàn' : 'Chế độ Dự phòng'}
              </p>
              <span className="text-[11px] font-mono text-stone-500">
                {adminStats?.apiKeyStatus.maskedPreview || 'Server-side Only'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200">
              <span className="text-[11px] font-bold text-blue-800 uppercase">
                Học sinh sử dụng hôm nay
              </span>
              <p className="text-2xl font-extrabold text-[#1D4ED8] mt-1">
                {adminStats?.stats.totalStudentsUsedToday ?? 0}{' '}
                <span className="text-xs font-semibold text-stone-600">
                  / {adminStats?.stats.totalStudentsRegistered ?? 0} tài khoản HS
                </span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200">
              <span className="text-[11px] font-bold text-purple-800 uppercase">
                Tổng lượt gọi Gemini
              </span>
              <p className="text-2xl font-extrabold text-purple-900 mt-1">
                {adminStats?.stats.totalRequestsToday ?? 0}{' '}
                <span className="text-xs font-semibold text-purple-700">
                  hôm nay ({adminStats?.stats.totalRequestsAllTime ?? 0} tích lũy)
                </span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
              <span className="text-[11px] font-bold text-amber-900 uppercase">
                Token &amp; Chi phí ước tính
              </span>
              <p className="text-lg font-extrabold text-amber-950 mt-1">
                {(adminStats?.stats.totalTokensAllTime ?? 0).toLocaleString('vi-VN')} tokens
              </p>
              <span className="text-[11px] font-bold text-amber-800">
                ~${adminStats?.stats.estimatedCostUsd ?? 0} / Ngân sách $
                {adminStats?.config.monthlyBudgetUsd ?? 25}
              </span>
            </div>
          </div>

          {/* Quota & Budget Form */}
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Hạn mức câu hỏi mỗi học sinh / ngày:
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={adminDailyLimitInput}
                onChange={(e) => setAdminDailyLimitInput(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Ngân sách cảnh báo hàng tháng (USD):
              </label>
              <input
                type="number"
                min={1}
                max={5000}
                value={adminBudgetInput}
                onChange={(e) => setAdminBudgetInput(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-900"
              />
            </div>

            <button
              type="button"
              onClick={() => handleSaveAdminConfig()}
              disabled={savingAdminConfig}
              className="min-h-[40px] px-4 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold cursor-pointer"
            >
              {savingAdminConfig ? 'Đang lưu...' : 'Cập nhật Hạn mức & Ngân sách'}
            </button>
          </div>

          {/* Admin Teacher Authorization Section */}
          <div className="pt-4 border-t border-stone-200 space-y-3">
            <h3 className="text-sm font-bold text-[#121316] flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#1D4ED8]" />
              <span>Phân quyền Giáo viên (Chỉ Quản trị viên được cấp quyền Giáo viên)</span>
            </h3>
            <form
              onSubmit={handleAuthorizeTeacher}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <input
                type="email"
                value={newTeacherEmail}
                onChange={(e) => setNewTeacherEmail(e.target.value)}
                placeholder="Email Google của giáo viên..."
                className="px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-300 text-xs text-stone-900"
              />
              <input
                type="text"
                value={newTeacherName}
                onChange={(e) => setNewTeacherName(e.target.value)}
                placeholder="Họ tên hiển thị giáo viên..."
                className="px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-300 text-xs text-stone-900"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold cursor-pointer"
              >
                + Cấp quyền Giáo viên
              </button>
            </form>

            {teachersList.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {teachersList.map((t) => (
                  <span
                    key={t.id}
                    className="px-3 py-1 rounded-xl bg-stone-100 border border-stone-200 text-xs font-semibold text-stone-800"
                  >
                    {t.displayName} ({t.email})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Filter lessons by standardized grade (Lớp 1 .. Lớp 9)
  const filteredLessons = lessons.filter((l) => {
    if (selectedGrade === 'all') return true;
    return normalizeGrade(l.className || l.classGroupId) === selectedGrade;
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast?.(
        'error',
        'Định dạng không hỗ trợ',
        'Vui lòng chọn tệp hình ảnh (JPG, PNG, WEBP).'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1024;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setAttachedImage({
            dataUrl: compressedDataUrl,
            mimeType: 'image/jpeg',
            fileName: file.name,
          });
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendMessage = async (customPrompt?: string) => {
    if (!isStudent) {
      setIsStudentLoginModalOpen(true);
      return;
    }

    if (quota.remainingQuota <= 0) {
      onShowToast?.(
        'info',
        'Đã hết lượt hỏi hôm nay',
        `Em đã dùng hết ${quota.dailyLimit} lượt hôm nay. Em hãy quay lại vào ${quota.resetTimeText} hoặc liên hệ giáo viên nhé!`
      );
      return;
    }

    const textToSend = (customPrompt ?? inputText).trim();
    if ((!textToSend && !attachedImage) || isLoading) return;

    const finalUserText =
      textToSend ||
      'Hãy quan sát bức tranh này và đưa ra nhận xét khích lệ tích cực, gợi mở sáng tạo giúp em nhé!';

    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: finalUserText,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      imagePreviewUrl: attachedImage?.dataUrl,
      gradeContext: selectedGrade !== 'all' ? selectedGrade : undefined,
      lessonContext: selectedLessonTitle || undefined,
    };

    const currentAttachment = attachedImage;
    const updatedMessages = [...messages, userTurn];

    setMessages(updatedMessages);
    if (!customPrompt) setInputText('');
    setAttachedImage(null);
    setIsLoading(true);

    try {
      const token = await getValidBearerToken();
      const apiMessages = updatedMessages
        .filter((m) => m.id !== 'welcome-msg')
        .slice(-10)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const response = await fetch(getApiUrl('/api/gemini/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: apiMessages,
          gradeContext: selectedGrade,
          lessonContext: selectedLessonTitle || undefined,
          imageBase64: currentAttachment?.dataUrl,
          imageMimeType: currentAttachment?.mimeType,
        }),
      });

      const data = await response.json();

      if (data.quota) {
        setQuota((prev) => ({
          ...prev,
          ...data.quota,
        }));
      }

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Lỗi phản hồi từ máy chủ Gemini AI.');
      }

      const modelTurn: ChatTurn = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, modelTurn]);
    } catch (err: any) {
      const errorTurn: ChatTurn = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: `⚠️ ${err.message || 'Vui lòng thử lại sau giây lát.'}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorTurn]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([INITIAL_WELCOME_MESSAGE]);
    localStorage.removeItem(STORAGE_KEY);
    onShowToast?.(
      'info',
      'Đã làm mới đoạn chat',
      'Lịch sử trò chuyện với Trợ lý AI Gemini đã được đặt lại.'
    );
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderFormattedText = (raw: string) => {
    const lines = raw.split('\n');
    return lines.map((line, lineIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p
          key={lineIdx}
          className={`${line.trim() === '' ? 'h-2' : 'mb-1.5 last:mb-0'} leading-relaxed`}
        >
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={partIdx} className="font-bold text-slate-900">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <span key={partIdx}>{part}</span>;
          })}
        </p>
      );
    });
  };

  const chatBoxBody = (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 px-4 py-3.5 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center border border-white/30 shrink-0">
            <Sparkles className="w-5 h-5 text-amber-200" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold truncate">Trợ lý Mĩ thuật · Gemini AI</h3>
              {isStudent && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-300/25 text-amber-100 border border-amber-200/40 rounded-full">
                  Còn {quota.remainingQuota}/{quota.dailyLimit} lượt hôm nay
                </span>
              )}
            </div>
            <p className="text-[11px] text-blue-100 truncate">
              {isStudent && profile
                ? `Học sinh: ${profile.displayName} (${profile.classCode} · ${normalizeGrade(
                    profile.className
                  )})`
                : 'Dành riêng cho Học sinh (Lớp 1 – Lớp 9) · Không chấm điểm'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleClearChat}
            title="Làm mới cuộc trò chuyện"
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {!isFullPage && (
            <>
              <button
                onClick={() => setIsExpandedModal(!isExpandedModal)}
                title={isExpandedModal ? 'Thu nhỏ cửa sổ' : 'Phóng to cửa sổ'}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
              >
                {isExpandedModal ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => onToggleFloating?.(false)}
                title="Đóng cửa sổ chat"
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Standardized Grade Selector Bar: Lớp 1 -> Lớp 9 */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs overflow-x-auto no-scrollbar max-w-full">
          {STANDARD_GRADES.map((g) => (
            <button
              key={g.label}
              onClick={() => {
                setSelectedGrade(g.label);
                setSelectedLessonTitle('');
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedGrade === g.label
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {g.label}
            </button>
          ))}
          <button
            onClick={() => {
              setSelectedGrade('all');
              setSelectedLessonTitle('');
            }}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedGrade === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả lớp
          </button>
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <select
            value={selectedLessonTitle}
            onChange={(e) => setSelectedLessonTitle(e.target.value)}
            className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer truncate"
          >
            <option value="">-- Chọn bài học cụ thể để hỏi AI (Tùy chọn) --</option>
            {filteredLessons.map((lesson) => (
              <option key={lesson.id} value={lesson.title}>
                {lesson.title}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Student Login Prompt Banner if not logged in as Student */}
      {!isStudent && (
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] font-semibold text-amber-950 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>
              Chỉ Học sinh được sử dụng Gemini AI. Em hãy đăng nhập bằng{' '}
              <strong>Mã lớp + Mã học sinh + Mã PIN</strong> nhé!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsStudentLoginModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#FBBF24]" />
            <span>Đăng nhập Học sinh</span>
          </button>
        </div>
      )}

      {/* Quota Exhausted Banner when 0 remaining */}
      {isStudent && quota.remainingQuota <= 0 && (
        <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between gap-2 text-xs text-rose-900 font-semibold shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Em đã dùng hết {quota.dailyLimit}/{quota.dailyLimit} lượt hỏi hôm nay. Lượt mới sẽ mở
              lại vào <strong>{quota.resetTimeText}</strong>. Nếu cần hỗ trợ thêm, em hãy liên hệ
              giáo viên Mĩ thuật của lớp nhé!
            </span>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF9F5]/70">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[82%] rounded-2xl p-3.5 text-xs shadow-2xs ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-tr-xs'
                    : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                }`}
              >
                {isUser && (msg.gradeContext || msg.lessonContext) && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2 pb-1.5 border-b border-blue-500/50 text-[10px] text-blue-100">
                    {msg.gradeContext && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-700/70 font-semibold">
                        {normalizeGrade(msg.gradeContext)}
                      </span>
                    )}
                    {msg.lessonContext && (
                      <span className="truncate max-w-[220px] opacity-90">
                        · {msg.lessonContext}
                      </span>
                    )}
                  </div>
                )}

                {msg.imagePreviewUrl && (
                  <div className="mb-2.5 rounded-xl overflow-hidden border border-white/20 max-w-[240px]">
                    <img
                      src={msg.imagePreviewUrl}
                      alt="Tranh đính kèm"
                      className="w-full h-auto object-cover max-h-48"
                    />
                  </div>
                )}

                <div className={isUser ? 'text-white leading-relaxed' : 'text-slate-700'}>
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    renderFormattedText(msg.text)
                  )}
                </div>

                <div
                  className={`flex items-center justify-between gap-3 mt-2 pt-1.5 border-t text-[10px] ${
                    isUser
                      ? 'border-blue-500/40 text-blue-100'
                      : 'border-slate-100 text-slate-400'
                  }`}
                >
                  <span>{msg.timestamp}</span>
                  {!isUser && (
                    <button
                      onClick={() => handleCopyText(msg.id, msg.text)}
                      className="inline-flex items-center gap-1 text-slate-400 hover:text-blue-600 font-medium cursor-pointer"
                      title="Sao chép câu trả lời"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-3 text-xs text-slate-600 flex items-center gap-2 shadow-2xs">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              <span>Gemini đang suy nghĩ ý tưởng mĩ thuật cho em...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Prompts */}
      <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {QUICK_PROMPTS.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(item.prompt)}
            disabled={isLoading || (isStudent && quota.remainingQuota <= 0)}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Attached Image Preview Bar */}
      {attachedImage && (
        <div className="px-4 py-2 bg-blue-50/90 border-t border-blue-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={attachedImage.dataUrl}
              alt="Preview"
              className="w-10 h-10 rounded-lg object-cover border border-blue-300 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-900 truncate">{attachedImage.fileName}</p>
              <p className="text-[10px] text-blue-700">
                Đính kèm tranh để Gemini nhận xét tích cực &amp; gợi ý bố cục, màu sắc
              </p>
            </div>
          </div>
          <button
            onClick={() => setAttachedImage(null)}
            className="p-1 text-blue-700 hover:bg-blue-100 rounded-lg cursor-pointer"
            title="Gỡ ảnh đính kèm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-white border-t border-slate-200 flex items-end gap-2 shrink-0"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || (isStudent && quota.remainingQuota <= 0)}
          title="Đính kèm ảnh tác phẩm để nhờ AI nhận xét tích cực"
          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
        >
          <ImageIcon className="w-4 h-4 text-indigo-600" />
        </button>

        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          rows={1}
          disabled={isStudent && quota.remainingQuota <= 0}
          placeholder={
            isStudent && quota.remainingQuota <= 0
              ? `Đã hết lượt hỏi hôm nay (Mở lại lúc ${quota.resetTimeText})`
              : `Hỏi Gemini về bài vẽ ${
                  selectedGrade === 'all' ? 'Lớp 1 – Lớp 9' : selectedGrade
                }, cách phối màu, bố cục...`
          }
          className="flex-1 resize-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white max-h-28 disabled:opacity-60"
        />

        <button
          type="submit"
          disabled={
            isLoading ||
            (!inputText.trim() && !attachedImage) ||
            (isStudent && quota.remainingQuota <= 0)
          }
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Gửi</span>
        </button>
      </form>
    </div>
  );

  // 1. Render as Full-Page Tab View
  if (isFullPage) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-200">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Dành riêng cho Học sinh · Hạn mức {quota.dailyLimit} lượt/ngày</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">
              Trợ lý Chatbox AI Mĩ thuật (Lớp 1 – Lớp 9)
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl">
              Hỏi đáp tức thì về ý tưởng vẽ tranh, cách pha màu, bố cục hoặc gửi ảnh tác phẩm để
              nhận lời khuyên khích lệ sáng tạo.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 shrink-0 text-center">
            <div className="px-3 py-2 rounded-2xl bg-blue-50 border border-blue-100">
              <Palette className="w-4 h-4 text-blue-600 mx-auto mb-0.5" />
              <span className="text-[11px] font-bold text-blue-900 block">Gợi ý Phối màu</span>
            </div>
            <div className="px-3 py-2 rounded-2xl bg-purple-50 border border-purple-100">
              <BookOpen className="w-4 h-4 text-purple-600 mx-auto mb-0.5" />
              <span className="text-[11px] font-bold text-purple-900 block">Lớp 1 – Lớp 9</span>
            </div>
            <div className="px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-100">
              <MessageSquareHeart className="w-4 h-4 text-emerald-600 mx-auto mb-0.5" />
              <span className="text-[11px] font-bold text-emerald-900 block">
                Còn {quota.remainingQuota}/{quota.dailyLimit} lượt
              </span>
            </div>
          </div>
        </div>

        <div className="h-[640px] rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
          {chatBoxBody}
        </div>
      </div>
    );
  }

  // 2. Render as Floating Bottom-Right Widget (Only for Students or unauthenticated visitors who want to log in as Student)
  return (
    <>
      {!isOpenFloating && (
        <button
          onClick={() => onToggleFloating?.(true)}
          className="hidden lg:inline-flex fixed bottom-5 right-5 z-40 items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#121316] hover:bg-stone-800 text-white shadow-xl transition-all cursor-pointer group border border-stone-700"
        >
          <div className="w-8 h-8 rounded-xl bg-[#1D4ED8] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#FBBF24] group-hover:rotate-12 transition-transform" />
          </div>
          <div className="text-left pr-1">
            <div className="text-xs font-extrabold leading-tight flex items-center gap-1.5">
              <span>Trợ lý AI Học sinh</span>
              {isStudent && (
                <span className="px-1.5 py-0.2 rounded bg-blue-600 text-[9px] text-white">
                  {quota.remainingQuota}/{quota.dailyLimit}
                </span>
              )}
            </div>
            <div className="text-[10px] text-stone-300 leading-tight">
              Hỏi đáp Mĩ thuật Lớp 1 – Lớp 9
            </div>
          </div>
        </button>
      )}

      {isOpenFloating && (
        <div
          className={`fixed z-50 transition-all duration-200 ${
            isExpandedModal
              ? 'inset-4 md:inset-10 rounded-3xl shadow-2xl border border-stone-300 overflow-hidden'
              : 'bottom-20 lg:bottom-4 right-3 sm:right-4 w-[94vw] sm:w-[430px] h-[560px] max-h-[80dvh] rounded-3xl shadow-2xl border border-stone-200 overflow-hidden'
          }`}
        >
          {chatBoxBody}
        </div>
      )}
    </>
  );
};

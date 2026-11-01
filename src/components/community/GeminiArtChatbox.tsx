/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Trợ lý Chatbox AI Mĩ thuật kết nối Google Gemini
 */

import React, { useState, useRef, useEffect } from 'react';
import { ArtLesson } from '../../types/communityArt';
import { getApiUrl } from '../../lib/platform';
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
  ChevronDown
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

const STORAGE_KEY = 'artverse_gemini_chat_history_v1';

const INITIAL_WELCOME_MESSAGE: ChatTurn = {
  id: 'welcome-msg',
  role: 'model',
  text:
    'Xin chào! Mình là **Trợ lý AI Mĩ thuật Artverse** (được kết nối với **Google Gemini**).\n\n' +
    'Mình có thể hỗ trợ Giáo viên và Học sinh:\n' +
    '- 🎨 **Gợi ý ý tưởng vẽ tranh**, phối màu (nóng/lạnh, bổ túc, tương phản) và bố cục cho **Khối 6, Khối 7, Khối 8, Khối 9**.\n' +
    '- 🖼️ **Nhận xét tích cực & gợi mở sáng tạo** khi bạn đính kèm ảnh chụp bức tranh (tuân thủ nguyên tắc *Không chấm điểm*).\n' +
    '- 🎬 **Gợi ý kịch bản Video & Slide** tham khảo bài học theo Chương trình GDPT 2018.\n\n' +
    'Bạn đang tìm hiểu bài học thuộc khối lớp nào, hay muốn mình góp ý cho tác phẩm nào hôm nay?',
  timestamp: 'Hôm nay'
};

const QUICK_PROMPTS = [
  {
    label: '🎨 Gợi ý ý tưởng vẽ tranh',
    prompt: 'Hãy gợi ý cho mình 3 ý tưởng sáng tạo và độc đáo để vẽ tranh theo chủ đề bài học đang chọn, kèm chất liệu phù hợp.'
  },
  {
    label: '🌈 Cách phối màu nổi bật',
    prompt: 'Hướng dẫn mình cách phối màu hài hòa, sử dụng cặp màu bổ túc hoặc tương phản để làm nổi bật hình ảnh chính trong tranh.'
  },
  {
    label: '📐 Mẹo sắp xếp bố cục',
    prompt: 'Làm thế nào để sắp xếp bố cục mảng chính và mảng phụ cân đối, có chiều sâu xa gần mà không bị rời rạc?'
  },
  {
    label: '🎬 Kịch bản Video & Slide bài học',
    prompt: 'Gợi ý giúp mình cấu trúc Slide trình chiếu và kịch bản Video hướng dẫn thực hành ngắn gọn, hấp dẫn cho bài học Mĩ thuật này.'
  },
  {
    label: '💬 Nhận xét tích cực cho tranh',
    prompt: 'Hãy quan sát bức tranh mình gửi kèm (hoặc gợi ý mẫu lời nhận xét sư phạm) theo hướng khích lệ điểm sáng màu sắc, đường nét và gợi mở phát triển thêm (không chấm điểm).'
  }
];

export const GeminiArtChatbox: React.FC<GeminiArtChatboxProps> = ({
  lessons,
  isFullPage = false,
  isOpenFloating = false,
  onToggleFloating,
  onShowToast
}) => {
  const [messages, setMessages] = useState<ChatTurn[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage error
    }
    return [INITIAL_WELCOME_MESSAGE];
  });

  const [inputText, setInputText] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('Khối 6');
  const [selectedLessonTitle, setSelectedLessonTitle] = useState<string>('');
  const [attachedImage, setAttachedImage] = useState<{
    dataUrl: string;
    mimeType: string;
    fileName: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpandedModal, setIsExpandedModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save chat history to localStorage (excluding large base64 previews to keep storage light)
  useEffect(() => {
    try {
      const lightHistory = messages.slice(-20).map((m) => ({
        ...m,
        imagePreviewUrl: undefined
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lightHistory));
    } catch {
      // ignore quota errors
    }
  }, [messages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (isFullPage || isOpenFloating) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isFullPage, isOpenFloating]);

  // Filter lessons by selected grade
  const gradeNumber = selectedGrade.replace('Khối ', '').trim();
  const filteredLessons = lessons.filter((l) => {
    if (selectedGrade === 'all') return true;
    return l.classGroupId === `class-grade-${gradeNumber}`;
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast?.('error', 'Định dạng không hỗ trợ', 'Vui lòng chọn tệp hình ảnh (JPG, PNG, WEBP).');
      return;
    }

    // Compress image on canvas so payload stays small and fast
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
            fileName: file.name
          });
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt ?? inputText).trim();
    if ((!textToSend && !attachedImage) || isLoading) return;

    const finalUserText =
      textToSend || 'Hãy quan sát bức tranh này và đưa ra nhận xét khích lệ tích cực, gợi mở sáng tạo giúp mình nhé!';

    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: finalUserText,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      imagePreviewUrl: attachedImage?.dataUrl,
      gradeContext: selectedGrade !== 'all' ? selectedGrade : undefined,
      lessonContext: selectedLessonTitle || undefined
    };

    const currentAttachment = attachedImage;
    const updatedMessages = [...messages, userTurn];

    setMessages(updatedMessages);
    if (!customPrompt) setInputText('');
    setAttachedImage(null);
    setIsLoading(true);

    try {
      // Prepare conversation history for backend Gemini endpoint
      const apiMessages = updatedMessages
        .filter((m) => m.id !== 'welcome-msg')
        .slice(-10)
        .map((m) => ({
          role: m.role,
          text: m.text
        }));

      const response = await fetch(getApiUrl('/api/gemini/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: apiMessages,
          gradeContext: selectedGrade,
          lessonContext: selectedLessonTitle || undefined,
          imageBase64: currentAttachment?.dataUrl,
          imageMimeType: currentAttachment?.mimeType
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Lỗi phản hồi từ máy chủ Gemini AI.');
      }

      const modelTurn: ChatTurn = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, modelTurn]);
    } catch (err: any) {
      console.error('Lỗi gọi Gemini API:', err);
      const errorTurn: ChatTurn = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: `⚠️ Không thể kết nối tới Gemini lúc này: ${err.message || 'Vui lòng thử lại sau giây lát.'}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorTurn]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([INITIAL_WELCOME_MESSAGE]);
    localStorage.removeItem(STORAGE_KEY);
    onShowToast?.('info', 'Đã làm mới đoạn chat', 'Lịch sử trò chuyện với Trợ lý AI Gemini đã được đặt lại.');
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Format basic markdown bold & linebreaks cleanly
  const renderFormattedText = (raw: string) => {
    const lines = raw.split('\n');
    return lines.map((line, lineIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={lineIdx} className={`${line.trim() === '' ? 'h-2' : 'mb-1.5 last:mb-0'} leading-relaxed`}>
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

  // Shared Chat Interface Content
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
              <h3 className="text-sm font-bold truncate">Chatbox AI Mĩ thuật · Gemini</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-400/25 text-emerald-100 border border-emerald-300/30 rounded-full">
                Trực tuyến
              </span>
            </div>
            <p className="text-[11px] text-blue-100 truncate">
              Tư vấn ý tưởng, bố cục, phối màu Khối 6, 7, 8, 9 · Không chấm điểm
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
                {isExpandedModal ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
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

      {/* Context Selector Bar: Grade 6, 7, 8, 9 & Lesson */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
          {['Khối 6', 'Khối 7', 'Khối 8', 'Khối 9', 'all'].map((g) => (
            <button
              key={g}
              onClick={() => {
                setSelectedGrade(g);
                setSelectedLessonTitle('');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                selectedGrade === g
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {g === 'all' ? 'Tất cả khối' : g}
            </button>
          ))}
        </div>

        {/* Optional Lesson Context Dropdown */}
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

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF9F5]/70">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[82%] rounded-2xl p-3.5 text-xs shadow-2xs ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-tr-xs'
                    : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                }`}
              >
                {/* Context Tag if present */}
                {isUser && (msg.gradeContext || msg.lessonContext) && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2 pb-1.5 border-b border-blue-500/50 text-[10px] text-blue-100">
                    {msg.gradeContext && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-700/70 font-semibold">
                        {msg.gradeContext}
                      </span>
                    )}
                    {msg.lessonContext && (
                      <span className="truncate max-w-[220px] opacity-90">
                        · {msg.lessonContext}
                      </span>
                    )}
                  </div>
                )}

                {/* Attached Artwork Image Preview */}
                {msg.imagePreviewUrl && (
                  <div className="mb-2.5 rounded-xl overflow-hidden border border-white/20 max-w-[240px]">
                    <img
                      src={msg.imagePreviewUrl}
                      alt="Tranh đính kèm"
                      className="w-full h-auto object-cover max-h-48"
                    />
                  </div>
                )}

                {/* Message Text */}
                <div className={isUser ? 'text-white leading-relaxed' : 'text-slate-700'}>
                  {isUser ? <p className="whitespace-pre-wrap">{msg.text}</p> : renderFormattedText(msg.text)}
                </div>

                {/* Footer: Timestamp & Copy */}
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
              <span>Gemini đang suy nghĩ ý tưởng mĩ thuật cho bạn...</span>
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
            disabled={isLoading}
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
                Đính kèm tranh để Gemini nhận xét tích cực & gợi ý bố cục, màu sắc
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
          disabled={isLoading}
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
          placeholder={`Hỏi Gemini về bài học ${selectedGrade === 'all' ? 'Khối 6, 7, 8, 9' : selectedGrade}, cách phối màu, bố cục...`}
          className="flex-1 resize-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white max-h-28"
        />

        <button
          type="submit"
          disabled={isLoading || (!inputText.trim() && !attachedImage)}
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
              <span>Kết nối trực tiếp Google Gemini AI</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">
              Trợ lý Chatbox AI Mĩ thuật (Khối 6, 7, 8, 9)
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl">
              Hỏi đáp tức thì về ý tưởng vẽ tranh, cách pha màu, bố cục, kịch bản Video & Slide bài giảng hoặc gửi ảnh tác phẩm để nhận lời khuyên khích lệ sáng tạo.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 shrink-0 text-center">
            <div className="px-3 py-2 rounded-2xl bg-blue-50 border border-blue-100">
              <Palette className="w-4 h-4 text-blue-600 mx-auto mb-0.5" />
              <span className="text-[11px] font-bold text-blue-900 block">Gợi ý Phối màu</span>
            </div>
            <div className="px-3 py-2 rounded-2xl bg-purple-50 border border-purple-100">
              <BookOpen className="w-4 h-4 text-purple-600 mx-auto mb-0.5" />
              <span className="text-[11px] font-bold text-purple-900 block">Khối 6, 7, 8, 9</span>
            </div>
            <div className="px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-100">
              <MessageSquareHeart className="w-4 h-4 text-emerald-600 mx-auto mb-0.5" />
              <span className="text-[11px] font-bold text-emerald-900 block">Không chấm điểm</span>
            </div>
          </div>
        </div>

        <div className="h-[640px] rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
          {chatBoxBody}
        </div>
      </div>
    );
  }

  // 2. Render as Floating Bottom-Right Widget
  return (
    <>
      {/* Floating Action Button when closed (Desktop only; on iPhone accessible via Header & Cá nhân) */}
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
              <span>Chatbox AI · Gemini</span>
            </div>
            <div className="text-[10px] text-stone-300 leading-tight">
              Hỏi đáp Mĩ thuật Khối 6, 7, 8, 9
            </div>
          </div>
        </button>
      )}

      {/* Floating Chat Window when open */}
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

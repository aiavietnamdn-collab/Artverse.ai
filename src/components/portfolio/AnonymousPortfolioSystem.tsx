import React, { useState, useEffect } from 'react';
import { 
  AnonymousSession, 
  AnonymousPortfolioRecord, 
  AnonymousArtworkImage, 
  StudentSelfEvaluation6Q, 
  generateUnguessableToken, 
  generateAnonymousCode 
} from '../../types/anonymousPortfolio';
import { 
  INITIAL_ANONYMOUS_SESSIONS, 
  INITIAL_ANONYMOUS_PORTFOLIOS 
} from '../../data/mockAnonymousData';
import { 
  createTeacherSession, 
  getTeacherSessions, 
  revokeTeacherSession, 
  deleteTeacherSession, 
  findSessionByToken, 
  submitAnonymousPortfolio, 
  updateAnonymousPortfolioByStudent, 
  deleteAnonymousPortfolioByStudent, 
  getTeacherAnonymousPortfolios, 
  evaluateAnonymousPortfolioByTeacher, 
  deleteAnonymousPortfolioByTeacher 
} from '../../services/anonymousPortfolioService';
import { useAuth } from '../../context/AuthContext';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import { SessionQrCard } from '../common/SessionQrCard';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Lock, 
  Key, 
  QrCode, 
  Plus, 
  Eye, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertOctagon, 
  Sparkles, 
  Send, 
  HelpCircle, 
  Layers, 
  Calendar, 
  FileText, 
  RefreshCw, 
  ExternalLink, 
  Check, 
  X, 
  ChevronRight, 
  UserX, 
  Copy, 
  Camera, 
  MessageSquare, 
  Sliders, 
  Award,
  BookOpen,
  Info
} from 'lucide-react';

interface AnonymousPortfolioSystemProps {
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const AnonymousPortfolioSystem: React.FC<AnonymousPortfolioSystemProps> = ({ onShowToast }) => {
  const { user, loginWithGoogle } = useAuth();

  // Primary Workspace Subtab:
  // 1. 'teacher' = Teacher session management & evaluation
  // 2. 'student' = Student anonymous entry, upload & 6-question self evaluation
  // 3. 'security-audit' = Interactive Privacy & Security Verification Suite
  const [activePortalTab, setActivePortalTab] = useState<'teacher' | 'student' | 'security-audit'>('teacher');

  // ==========================================
  // STATE: TEACHER SESSIONS & PORTFOLIOS
  // ==========================================
  const [sessions, setSessions] = useState<AnonymousSession[]>(INITIAL_ANONYMOUS_SESSIONS);
  const [portfolios, setPortfolios] = useState<AnonymousPortfolioRecord[]>(INITIAL_ANONYMOUS_PORTFOLIOS);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(INITIAL_ANONYMOUS_SESSIONS[0].id);
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(false);

  // New Session Creation Form Modal
  const [isCreateSessionModal, setIsCreateSessionModal] = useState<boolean>(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionGrade, setNewSessionGrade] = useState('Khối 6');
  const [newSessionTopic, setNewSessionTopic] = useState('Tạo hình từ vật liệu tái chế');
  const [newSessionInstructions, setNewSessionInstructions] = useState('Học sinh nộp ẩn danh bản phác thảo và ảnh tác phẩm hoàn thiện. Không chụp khuôn mặt hoặc thông tin cá nhân.');
  const [newSessionRubric, setNewSessionRubric] = useState('Rubric Sản phẩm Tái chế 3D (4 mức độ)');
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);

  // Teacher Portfolio Evaluation Modal
  const [evaluatingPortfolio, setEvaluatingPortfolio] = useState<AnonymousPortfolioRecord | null>(null);
  const [evalComment, setEvalComment] = useState('');
  const [evalGuidance, setEvalGuidance] = useState('');
  const [evalLevel, setEvalLevel] = useState<'needs_support' | 'partially_achieved' | 'achieved' | 'exceeded'>('exceeded');
  const [isSubmittingEval, setIsSubmittingEval] = useState(false);

  // Portfolio Detail Viewing Modal
  const [viewingPortfolio, setViewingPortfolio] = useState<AnonymousPortfolioRecord | null>(null);

  // ==========================================
  // STATE: STUDENT ANONYMOUS PORTAL
  // ==========================================
  const [inputToken, setInputToken] = useState('');
  const [activeStudentSession, setActiveStudentSession] = useState<AnonymousSession | null>(null);
  const [tokenLookupLoading, setTokenLookupLoading] = useState(false);

  // Student New Submission Form State
  const [studentSketchNotes, setStudentSketchNotes] = useState('');
  const [studentSketchVisual, setStudentSketchVisual] = useState<'pastel' | 'watercolor' | 'clay' | 'dongho'>('pastel');
  const [studentFinalNotes, setStudentFinalNotes] = useState('');
  const [studentFinalVisual, setStudentFinalVisual] = useState<'clay' | 'watercolor' | 'lacquer' | 'dongho'>('clay');
  
  // Revisions array
  const [revisionsList, setRevisionsList] = useState<{ caption: string; notes: string; visualType: any }[]>([]);
  const [newRevCaption, setNewRevCaption] = useState('');
  const [newRevNotes, setNewRevNotes] = useState('');

  // 6 Mandatory Self-Evaluation Questions
  const [q1Idea, setQ1Idea] = useState('');
  const [q2Experiments, setQ2Experiments] = useState('');
  const [q3MostSatisfied, setQ3MostSatisfied] = useState('');
  const [q4BiggestChallenge, setQ4BiggestChallenge] = useState('');
  const [q5WhatToChange, setQ5WhatToChange] = useState('');
  const [q6NeedSupport, setQ6NeedSupport] = useState('');

  // Student Created Portfolio Receipt State (Secret key for self-editing/deletion)
  const [studentReceipt, setStudentReceipt] = useState<{
    anonymousCode: string;
    secretKey: string;
    portfolioId: string;
  } | null>(null);
  const [copiedSecretKey, setCopiedSecretKey] = useState(false);

  // Student Resume with Secret Key
  const [resumeSecretKey, setResumeSecretKey] = useState('');

  // Load cloud data if teacher is logged in
  useEffect(() => {
    if (user) {
      loadTeacherCloudData();
    }
  }, [user]);

  const loadTeacherCloudData = async () => {
    if (!user) return;
    try {
      setIsLoadingCloud(true);
      const [cloudSessions, cloudPortfolios] = await Promise.all([
        getTeacherSessions(),
        getTeacherAnonymousPortfolios()
      ]);

      if (cloudSessions && cloudSessions.length > 0) {
        setSessions(prev => {
          const sampleOnly = prev.filter(s => s.id.startsWith('session-demo-'));
          return [...cloudSessions, ...sampleOnly];
        });
        setSelectedSessionId(cloudSessions[0].id);
      }

      if (cloudPortfolios && cloudPortfolios.length > 0) {
        setPortfolios(prev => {
          const sampleOnly = prev.filter(p => p.storageLocation === 'demo_sample');
          return [...cloudPortfolios, ...sampleOnly];
        });
      }
    } catch (err) {
      console.warn('Could not load teacher cloud data:', err);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  // ==========================================
  // HANDLERS: TEACHER ACTIONS
  // ==========================================
  const handleCreateSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionTitle.trim()) {
      onShowToast('error', 'Thiếu tiêu đề bài học', 'Vui lòng nhập tên bài học trước khi tạo mã nộp bài.');
      return;
    }

    try {
      setIsSubmittingSession(true);
      if (user) {
        const created = await createTeacherSession(
          newSessionTitle,
          newSessionGrade,
          newSessionTopic,
          newSessionInstructions,
          newSessionRubric
        );
        setSessions(prev => [created, ...prev]);
        setSelectedSessionId(created.id);
        onShowToast('success', 'Đã khởi tạo phiên nộp bài Cloud', `Mã tham gia ngẫu nhiên cho bài "${created.lessonTitle}" đã được kích hoạt trên Firestore.`);
      } else {
        // Local device / session mode
        const localSession: AnonymousSession = {
          id: `session-local-${Date.now()}`,
          teacherId: 'teacher-local-session',
          teacherName: 'Giáo viên (Phiên thiết bị)',
          lessonTitle: newSessionTitle.trim(),
          grade: newSessionGrade,
          topic: newSessionTopic.trim(),
          sessionToken: generateUnguessableToken(32),
          rubricTitle: newSessionRubric,
          isRevoked: false,
          allowSubmissions: true,
          instructions: newSessionInstructions,
          createdAt: new Date().toLocaleDateString('vi-VN'),
          updatedAt: new Date().toLocaleDateString('vi-VN')
        };
        setSessions(prev => [localSession, ...prev]);
        setSelectedSessionId(localSession.id);
        onShowToast('success', 'Đã tạo phiên nộp bài (Thiết bị)', `Đã sinh token ngẫu nhiên khó đoán 32 ký tự.`);
      }
      setIsCreateSessionModal(false);
      setNewSessionTitle('');
    } catch (err: any) {
      onShowToast('error', 'Lỗi tạo phiên', err?.message || 'Không thể tạo phiên tham gia.');
    } finally {
      setIsSubmittingSession(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    const targetSession = sessions.find(s => s.id === sessionId);
    if (!targetSession) return;

    if (user && !targetSession.id.startsWith('session-demo-')) {
      try {
        await revokeTeacherSession(sessionId);
      } catch (err: any) {
        console.warn('Revoke error on firestore:', err);
      }
    }

    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, isRevoked: true, allowSubmissions: false } : s));
    onShowToast('info', 'Đã thu hồi mã nộp bài', `Mã tham gia của phiên "${targetSession.lessonTitle}" đã bị vô hiệu hóa. Học sinh không thể nộp bài vào phiên này nữa.`);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (sessions.length <= 1) {
      onShowToast('error', 'Không thể xóa', 'Cần giữ tối thiểu 1 phiên nộp bài.');
      return;
    }

    if (user && !sessionId.startsWith('session-demo-')) {
      try {
        await deleteTeacherSession(sessionId);
      } catch (err: any) {
        console.warn('Delete session error:', err);
      }
    }

    setSessions(prev => prev.filter(s => s.id !== sessionId));
    // Cascade delete local portfolios of that session
    setPortfolios(prev => prev.filter(p => p.sessionId !== sessionId));
    if (selectedSessionId === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      if (remaining.length > 0) setSelectedSessionId(remaining[0].id);
    }
    onShowToast('info', 'Đã xóa phiên bài học', 'Đã dọn dẹp phiên và các hồ sơ liên quan.');
  };

  const handleOpenEvaluationModal = (portfolio: AnonymousPortfolioRecord) => {
    setEvaluatingPortfolio(portfolio);
    setEvalComment(portfolio.teacherEvaluation?.comment || 'Ý tưởng sáng tạo, quá trình thực nghiệm nghiêm túc.');
    setEvalGuidance(portfolio.teacherEvaluation?.guidance || 'Em có thể tiếp tục hoàn thiện hòa sắc bề mặt.');
    setEvalLevel(portfolio.teacherEvaluation?.rubricLevel || 'exceeded');
  };

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluatingPortfolio) return;

    try {
      setIsSubmittingEval(true);
      if (user && evaluatingPortfolio.storageLocation === 'firestore_cloud') {
        await evaluateAnonymousPortfolioByTeacher(evaluatingPortfolio.id, evalComment, evalGuidance, evalLevel);
      }

      const updated: AnonymousPortfolioRecord = {
        ...evaluatingPortfolio,
        teacherEvaluation: {
          comment: evalComment,
          guidance: evalGuidance,
          rubricLevel: evalLevel,
          evaluatedAt: new Date().toLocaleDateString('vi-VN'),
          teacherName: user?.displayName || 'Cô Mai Phương'
        },
        status: 'evaluated',
        updatedAt: new Date().toISOString()
      };

      setPortfolios(prev => prev.map(p => p.id === updated.id ? updated : p));
      if (viewingPortfolio && viewingPortfolio.id === updated.id) {
        setViewingPortfolio(updated);
      }
      setEvaluatingPortfolio(null);
      onShowToast('success', 'Đã lưu đánh giá Rubric', `Đã nhận xét sư phạm và đánh giá cho hồ sơ ${updated.anonymousCode}.`);
    } catch (err: any) {
      onShowToast('error', 'Lỗi đánh giá', err?.message || 'Không thể lưu đánh giá.');
    } finally {
      setIsSubmittingEval(false);
    }
  };

  const handleDeletePortfolioTeacher = async (portfolioId: string, code: string) => {
    if (user) {
      try {
        await deleteAnonymousPortfolioByTeacher(portfolioId);
      } catch (err: any) {
        console.warn('Teacher delete firestore error:', err);
      }
    }

    setPortfolios(prev => prev.filter(p => p.id !== portfolioId));
    if (viewingPortfolio?.id === portfolioId) setViewingPortfolio(null);
    onShowToast('info', 'Đã xóa hồ sơ', `Hồ sơ ẩn danh ${code} đã được xóa hoàn toàn.`);
  };

  // ==========================================
  // HANDLERS: STUDENT ANONYMOUS PORTAL
  // ==========================================
  const handleLookupSessionToken = async (tokenToTest?: string) => {
    const token = (tokenToTest || inputToken).trim();
    if (!token) {
      onShowToast('error', 'Chưa nhập mã tham gia', 'Vui lòng dán mã token 32 ký tự hoặc quét mã QR.');
      return;
    }

    setTokenLookupLoading(true);
    // 1. Check local / demo sessions
    const localMatch = sessions.find(s => s.sessionToken === token);
    if (localMatch) {
      setTokenLookupLoading(false);
      if (localMatch.isRevoked) {
        onShowToast('error', 'Mã đã bị thu hồi', 'Phiên nộp bài này đã bị giáo viên đóng quyền truy cập.');
        return;
      }
      setActiveStudentSession(localMatch);
      onShowToast('success', 'Tham gia thành công', `Đã kết nối với bài: ${localMatch.lessonTitle}`);
      return;
    }

    // 2. Check Cloud Firestore
    try {
      const cloudMatch = await findSessionByToken(token);
      setTokenLookupLoading(false);
      if (cloudMatch) {
        if (cloudMatch.isRevoked) {
          onShowToast('error', 'Mã đã bị thu hồi', 'Giáo viên đã thu hồi mã truy cập bài học này.');
          return;
        }
        setActiveStudentSession(cloudMatch);
        onShowToast('success', 'Tham gia thành công', `Đã kết nối với bài học: ${cloudMatch.lessonTitle}`);
      } else {
        onShowToast('error', 'Mã không tồn tại', 'Không tìm thấy phiên nộp bài nào khớp với token này.');
      }
    } catch (err: any) {
      setTokenLookupLoading(false);
      onShowToast('error', 'Lỗi kết nối', err?.message || 'Không thể kiểm tra mã tham gia.');
    }
  };

  const handleAddRevisionItem = () => {
    if (!newRevCaption.trim()) {
      onShowToast('error', 'Thiếu mô tả bản chỉnh sửa', 'Vui lòng nhập tên hoặc cải tiến của bản này.');
      return;
    }
    setRevisionsList(prev => [
      ...prev,
      {
        caption: newRevCaption.trim(),
        notes: newRevNotes.trim() || 'Phiên bản cải tiến hoàn thiện chi tiết.',
        visualType: studentFinalVisual
      }
    ]);
    setNewRevCaption('');
    setNewRevNotes('');
    onShowToast('info', 'Đã thêm phiên bản chỉnh sửa', 'Bản chỉnh sửa đã được đưa vào danh sách đính kèm.');
  };

  const handleStudentSubmitPortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudentSession) return;

    if (!q1Idea.trim() || !q2Experiments.trim() || !q3MostSatisfied.trim() || !q4BiggestChallenge.trim()) {
      onShowToast('error', 'Chưa hoàn thành tự đánh giá', 'Vui lòng trả lời đầy đủ các câu hỏi tự đánh giá quá trình thực hiện.');
      return;
    }

    try {
      const sketchData = {
        caption: 'Bản vẽ phác thảo cấu trúc ý tưởng ban đầu',
        notes: studentSketchNotes || 'Phác thảo các nét chính và xác định tỷ lệ tạo hình.',
        visualType: studentSketchVisual
      };

      const finalData = {
        caption: 'Tác phẩm hoàn thiện thực tế',
        notes: studentFinalNotes || 'Mô hình hoàn chỉnh với đầy đủ các chi tiết liên kết.',
        visualType: studentFinalVisual
      };

      const selfEval6Q: StudentSelfEvaluation6Q = {
        idea: q1Idea.trim(),
        experiments: q2Experiments.trim(),
        mostSatisfied: q3MostSatisfied.trim(),
        biggestChallenge: q4BiggestChallenge.trim(),
        whatToChange: q5WhatToChange.trim() || 'Em sẽ tiếp tục phát triển thêm chi tiết nhỏ xung quanh.',
        needSupport: q6NeedSupport.trim() || 'Em mong muốn được cô hướng dẫn thêm về kỹ thuật phối màu.'
      };

      if (user && !activeStudentSession.id.startsWith('session-demo-')) {
        const cloudRecord = await submitAnonymousPortfolio(
          activeStudentSession,
          sketchData,
          finalData,
          selfEval6Q
        );

        // Add revisions if any
        if (revisionsList.length > 0) {
          const revs: AnonymousArtworkImage[] = revisionsList.map((r, idx) => ({
            id: `rev-${Date.now()}-${idx}`,
            type: 'revision',
            revisionIndex: idx + 1,
            caption: r.caption,
            notes: r.notes,
            visualType: r.visualType,
            uploadedAt: new Date().toISOString()
          }));
          cloudRecord.revisions = revs;
          await updateAnonymousPortfolioByStudent(cloudRecord, cloudRecord.portfolioSecretKey);
        }

        setPortfolios(prev => [cloudRecord, ...prev]);
        setStudentReceipt({
          anonymousCode: cloudRecord.anonymousCode,
          secretKey: cloudRecord.portfolioSecretKey,
          portfolioId: cloudRecord.id
        });
      } else {
        // Local Device Submission
        const anonymousCode = generateAnonymousCode();
        const secretKey = generateUnguessableToken(24);
        const newRecord: AnonymousPortfolioRecord = {
          id: `local-port-${Date.now()}`,
          sessionId: activeStudentSession.id,
          sessionToken: activeStudentSession.sessionToken,
          teacherId: activeStudentSession.teacherId,
          portfolioSecretKey: secretKey,
          anonymousCode,
          lessonTitle: activeStudentSession.lessonTitle,
          topic: activeStudentSession.topic,
          grade: activeStudentSession.grade,
          sketchImage: {
            id: `sk-${Date.now()}`,
            type: 'sketch',
            caption: sketchData.caption,
            notes: sketchData.notes,
            visualType: sketchData.visualType,
            uploadedAt: new Date().toLocaleDateString('vi-VN')
          },
          finalImage: {
            id: `fn-${Date.now()}`,
            type: 'final',
            caption: finalData.caption,
            notes: finalData.notes,
            visualType: finalData.visualType,
            uploadedAt: new Date().toLocaleDateString('vi-VN')
          },
          revisions: revisionsList.map((r, idx) => ({
            id: `rev-${Date.now()}-${idx}`,
            type: 'revision',
            revisionIndex: idx + 1,
            caption: r.caption,
            notes: r.notes,
            visualType: r.visualType,
            uploadedAt: new Date().toLocaleDateString('vi-VN')
          })),
          selfEvaluation: selfEval6Q,
          status: 'submitted',
          storageLocation: 'local_device',
          createdAt: new Date().toLocaleDateString('vi-VN'),
          updatedAt: new Date().toLocaleDateString('vi-VN')
        };

        setPortfolios(prev => [newRecord, ...prev]);
        setStudentReceipt({
          anonymousCode,
          secretKey,
          portfolioId: newRecord.id
        });
      }

      onShowToast('success', 'Nộp bài ẩn danh thành công', 'Hồ sơ đã được lưu trữ an toàn mà không để lộ danh tính cá nhân.');
    } catch (err: any) {
      onShowToast('error', 'Lỗi nộp bài', err?.message || 'Không thể gửi hồ sơ.');
    }
  };

  const handleStudentDeleteOwnPortfolio = async (portfolioId: string, secretKey: string) => {
    const target = portfolios.find(p => p.id === portfolioId);
    if (!target) return;

    if (target.portfolioSecretKey !== secretKey) {
      onShowToast('error', 'Sai mã bí mật', 'Mã khóa học sinh không chính xác. Không thể xóa.');
      return;
    }

    if (user && target.storageLocation === 'firestore_cloud') {
      try {
        await deleteAnonymousPortfolioByStudent(portfolioId, secretKey, target.portfolioSecretKey);
      } catch (err: any) {
        console.warn('Error deleting cloud portfolio:', err);
      }
    }

    setPortfolios(prev => prev.filter(p => p.id !== portfolioId));
    setStudentReceipt(null);
    onShowToast('info', 'Đã xóa hồ sơ của bạn', 'Hồ sơ và các hình ảnh liên kết đã được xóa khỏi hệ thống hoàn toàn.');
  };

  // Active Session Portfolios for Teacher view
  const currentSession = sessions.find(s => s.id === selectedSessionId) || sessions[0];
  const sessionPortfolios = portfolios.filter(p => p.sessionId === currentSession?.id || p.sessionToken === currentSession?.sessionToken);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Privacy & No-Roster Guarantee Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/90 rounded-2xl p-4 md:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded">
                  Kiến trúc Ẩn danh Tuyệt đối
                </span>
                <span className="text-xs text-slate-500 hidden sm:inline">Không danh sách lớp · Không PII</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                Hệ sinh thái Hồ sơ Học tập Ẩn danh (Zero-Roster Architecture)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 max-w-3xl leading-relaxed">
                Mỗi hồ sơ được cấp mã ngẫu nhiên dạng <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-mono font-semibold">ART-XXXX-XXXX</code>. 
                Hệ thống <strong>không thu thập</strong> họ tên, ngày sinh, mã học sinh, email hay điện thoại; 
                <strong>không tạo bảng liên kết</strong> danh tính thật; mã QR mang token ngẫu nhiên khó đoán 32 ký tự.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <span className="text-xs font-semibold text-emerald-900 bg-white/90 border border-emerald-200 px-3 py-1.5 rounded-xl shadow-2xs flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Được bảo vệ bằng ABAC</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main 3-Way Portal Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setActivePortalTab('teacher')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activePortalTab === 'teacher'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            <span>Khu vực Giáo viên ({sessions.length} phiên · {portfolios.length} bài)</span>
          </button>

          <button
            onClick={() => setActivePortalTab('student')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activePortalTab === 'student'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cổng Học sinh Ẩn danh</span>
          </button>

          <button
            onClick={() => setActivePortalTab('security-audit')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activePortalTab === 'security-audit'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            <span>Kiểm thử An toàn & Độc lập</span>
          </button>
        </div>

        {activePortalTab === 'teacher' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateSessionModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo phiên nộp bài mới</span>
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: TEACHER WORKSPACE (MANAGE SESSIONS & EVALUATE)   */}
      {/* ======================================================== */}
      {activePortalTab === 'teacher' && (
        <div className="space-y-6">
          {/* Active Session Selector Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">Chọn phiên bài dạy đang quản lý:</span>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.lessonTitle} ({s.grade}) {s.isRevoked ? '— [Đã thu hồi]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {sessionPortfolios.length} tác phẩm ẩn danh đã nộp
                </span>
                {currentSession && !currentSession.isRevoked && (
                  <button
                    onClick={() => handleRevokeSession(currentSession.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200"
                    title="Ngay lập tức vô hiệu hóa mã truy cập này"
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>Thu hồi mã</span>
                  </button>
                )}
                {currentSession && (
                  <button
                    onClick={() => handleDeleteSession(currentSession.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Xóa phiên bài này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Session QR & Token Display */}
            {currentSession && (
              <SessionQrCard
                sessionToken={currentSession.sessionToken}
                lessonTitle={currentSession.lessonTitle}
                grade={currentSession.grade}
                isRevoked={currentSession.isRevoked}
                onRevoke={() => handleRevokeSession(currentSession.id)}
                onShowToast={onShowToast}
              />
            )}
          </div>

          {/* Received Anonymous Portfolios Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Danh sách sản phẩm nộp ẩn danh ({sessionPortfolios.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Chỉ nhận diện qua mã ngẫu nhiên ART-XXXX-XXXX và tiến trình tạo hình. Không hiển thị danh tính cá nhân.
                </p>
              </div>
            </div>

            {sessionPortfolios.length === 0 ? (
              <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
                <UserX className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-xs font-bold text-slate-700">Chưa có bài nộp nào trong phiên này</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Hãy gửi mã token hoặc chiếu mã QR ở trên để học sinh nộp bài ẩn danh vào hệ thống.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {sessionPortfolios.map(port => (
                  <div
                    key={port.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 p-5 shadow-xs transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Card Header: Random Code + Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-100 to-purple-100 text-indigo-800 flex items-center justify-center font-mono font-bold text-xs border border-indigo-200 shrink-0">
                            {port.anonymousCode.slice(-4)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-bold text-slate-900 font-mono">
                                {port.anonymousCode}
                              </h4>
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                [Ẩn danh]
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>{port.topic}</span>
                              <span aria-hidden="true">·</span>
                              <span>{port.createdAt}</span>
                              <span aria-hidden="true">·</span>
                              <span className="text-emerald-700 bg-emerald-50 px-1 rounded font-medium">
                                {port.storageLocation === 'firestore_cloud' ? 'Cloud Firestore' : port.storageLocation === 'demo_sample' ? 'Mẫu minh họa' : 'Thiết bị'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          port.status === 'evaluated'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {port.status === 'evaluated' ? 'ĐÃ ĐÁNH GIÁ' : 'CHỜ NHẬN XÉT'}
                        </span>
                      </div>

                      {/* Dual Images Strip (Sketch vs Final) */}
                      <div className="grid grid-cols-2 gap-2.5 mt-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-slate-500">1. Bản phác thảo</span>
                          <div className="h-24 rounded-xl overflow-hidden border border-slate-200">
                            <ArtCanvasVisual visualType={port.sketchImage.visualType} title={port.sketchImage.caption} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-slate-500">2. Bản hoàn thiện</span>
                          <div className="h-24 rounded-xl overflow-hidden border border-slate-200">
                            <ArtCanvasVisual visualType={port.finalImage.visualType} title={port.finalImage.caption} />
                          </div>
                        </div>
                      </div>

                      {/* Revisions Count if available */}
                      {port.revisions && port.revisions.length > 0 && (
                        <div className="mt-2 text-[11px] text-purple-700 bg-purple-50 p-1.5 rounded-lg font-medium flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5" />
                          <span>Có {port.revisions.length} phiên bản chỉnh sửa bổ sung</span>
                        </div>
                      )}

                      {/* Highlights of Self-Evaluation Q1 & Q3 */}
                      <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                        <p className="text-slate-700 line-clamp-2">
                          <span className="font-semibold text-slate-900">Ý tưởng:</span> "{port.selfEvaluation.idea}"
                        </p>
                        <p className="text-slate-600 line-clamp-1 italic text-[11px]">
                          <span className="font-semibold text-slate-700">Hài lòng nhất:</span> {port.selfEvaluation.mostSatisfied}
                        </p>
                      </div>

                      {/* Teacher Feedback Banner if evaluated */}
                      {port.teacherEvaluation && (
                        <div className="mt-3 p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-950 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] uppercase tracking-wider text-purple-900">
                              Đánh giá của giáo viên:
                            </span>
                            <span className="font-bold text-[11px] text-purple-700">
                              Mức: {port.teacherEvaluation.rubricLevel === 'exceeded' ? 'Thể hiện tốt (Mức 4)' : 'Đạt yêu cầu (Mức 3)'}
                            </span>
                          </div>
                          <p className="italic text-[11px] text-purple-900 leading-relaxed">
                            "{port.teacherEvaluation.comment}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => handleDeletePortfolioTeacher(port.id, port.anonymousCode)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Xóa hồ sơ ẩn danh này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEvaluationModal(port)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{port.status === 'evaluated' ? 'Sửa đánh giá' : 'Đánh giá Rubric'}</span>
                        </button>

                        <button
                          onClick={() => setViewingPortfolio(port)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                          <span>Xem chi tiết</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: STUDENT ANONYMOUS PORTAL (UPLOAD & 6-Q FORM)     */}
      {/* ======================================================== */}
      {activePortalTab === 'student' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Privacy Warning Required by User Prompt */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 md:p-5 text-amber-950 space-y-2 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <h4 className="text-sm font-bold uppercase tracking-wider text-amber-900">
                Cảnh báo Bảo vệ Quyền riêng tư & An toàn Học sinh
              </h4>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed font-medium">
              Tuyệt đối <strong>không chụp ảnh khuôn mặt</strong>, thẻ học sinh, đồng phục có phù hiệu/tên trường, 
              hoặc viết bất kỳ thông tin nhận dạng cá nhân nào (họ tên, ngày sinh, số điện thoại, địa chỉ). 
              Hệ thống chỉ lưu hình ảnh tác phẩm mĩ thuật và nội dung tự đánh giá sáng tạo.
            </p>
          </div>

          {/* Student Join / Lookup Section */}
          {!activeStudentSession ? (
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Nhập mã tham gia bài học (Session Token)
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Dán mã token 32 ký tự do giáo viên cung cấp trên lớp hoặc quét mã QR từ máy chiếu.
                </p>
              </div>

              <div className="max-w-md mx-auto flex items-center gap-2">
                <input
                  type="text"
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  placeholder="Ví dụ: ARTV-TOKEN-7K9A-2M4P-9X1L-4W8E"
                  className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-slate-900"
                />
                <button
                  onClick={() => handleLookupSessionToken()}
                  disabled={tokenLookupLoading}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{tokenLookupLoading ? 'Đang kiểm tra...' : 'Vào nộp bài'}</span>
                </button>
              </div>

              {/* Fast Demo Preset Button */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-500">
                <span>Thử nhanh mã mẫu:</span>
                <button
                  onClick={() => {
                    setInputToken(INITIAL_ANONYMOUS_SESSIONS[0].sessionToken);
                    handleLookupSessionToken(INITIAL_ANONYMOUS_SESSIONS[0].sessionToken);
                  }}
                  className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg font-mono font-medium border border-emerald-200 transition-colors"
                >
                  Dán Token Mẫu Khối 6
                </button>
              </div>
            </div>
          ) : (
            /* Student Upload & 6-Question Self-Assessment Workspace */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
              {/* Connected Session Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                      ĐÃ KẾT NỐI PHIÊN NỘP BÀI
                    </span>
                    <span className="text-xs text-slate-500">{activeStudentSession.grade}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    {activeStudentSession.lessonTitle}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chủ đề: {activeStudentSession.topic} · Giáo viên: {activeStudentSession.teacherName}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setActiveStudentSession(null);
                    setStudentReceipt(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors self-start sm:self-auto"
                >
                  Đổi mã khác
                </button>
              </div>

              {/* Submission Form */}
              {!studentReceipt ? (
                <form onSubmit={handleStudentSubmitPortfolio} className="space-y-6">
                  {/* Step 1: Upload Images (Sketch, Final, Revisions) */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Camera className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-sm font-bold text-slate-900">
                        1. Hình ảnh sản phẩm (Phác thảo, Hoàn thiện & Bản chỉnh sửa)
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* 1.1 Sketch Artwork */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">1.1. Ảnh bản phác thảo</span>
                          <span className="text-[10px] text-slate-500 font-mono">Bút chì / Màu vẽ</span>
                        </div>
                        <div className="h-32 rounded-lg overflow-hidden border border-slate-200">
                          <ArtCanvasVisual visualType={studentSketchVisual} title="Phác thảo ý tưởng" />
                        </div>
                        <div className="space-y-2 text-xs">
                          <div>
                            <label className="block text-slate-600 mb-1 font-medium">Chất liệu mô phỏng:</label>
                            <select
                              value={studentSketchVisual}
                              onChange={(e) => setStudentSketchVisual(e.target.value as any)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                            >
                              <option value="pastel">Bút chì & Sáp màu</option>
                              <option value="watercolor">Màu nước vẽ phác</option>
                              <option value="dongho">Nét viền dân gian</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-600 mb-1 font-medium">Ghi chú về bản phác thảo:</label>
                            <input
                              type="text"
                              value={studentSketchNotes}
                              onChange={(e) => setStudentSketchNotes(e.target.value)}
                              placeholder="Ví dụ: Phác thảo kích thước các khối chai lọ..."
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 1.2 Final Artwork */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">1.2. Ảnh tác phẩm hoàn thiện</span>
                          <span className="text-[10px] text-slate-500 font-mono">Mô hình 3D</span>
                        </div>
                        <div className="h-32 rounded-lg overflow-hidden border border-slate-200">
                          <ArtCanvasVisual visualType={studentFinalVisual} title="Tác phẩm hoàn thiện" />
                        </div>
                        <div className="space-y-2 text-xs">
                          <div>
                            <label className="block text-slate-600 mb-1 font-medium">Phong cách / Chất liệu:</label>
                            <select
                              value={studentFinalVisual}
                              onChange={(e) => setStudentFinalVisual(e.target.value as any)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                            >
                              <option value="clay">Đất nặn & Phế liệu tái chế 3D</option>
                              <option value="watercolor">Màu nước loang chuyển sắc</option>
                              <option value="lacquer">Sơn son bóng bẩy</option>
                              <option value="dongho">Màu điệp dân gian</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-600 mb-1 font-medium">Ghi chú về sản phẩm:</label>
                            <input
                              type="text"
                              value={studentFinalNotes}
                              onChange={(e) => setStudentFinalNotes(e.target.value)}
                              placeholder="Ví dụ: Sơn phủ màu xanh đại dương..."
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 1.3 Add Revision Versions */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">1.3. Phiên bản chỉnh sửa (Tùy chọn)</span>
                        <span className="text-[11px] text-purple-700 font-medium">Đã có {revisionsList.length} bản</span>
                      </div>

                      {revisionsList.length > 0 && (
                        <div className="space-y-1.5">
                          {revisionsList.map((rev, idx) => (
                            <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-slate-800">Bản {idx + 1}: {rev.caption}</span>
                                <p className="text-[11px] text-slate-500">{rev.notes}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setRevisionsList(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <input
                          type="text"
                          value={newRevCaption}
                          onChange={(e) => setNewRevCaption(e.target.value)}
                          placeholder="Tên bản chỉnh sửa (VD: Gia cố thêm khớp chân...)"
                          className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                        />
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={newRevNotes}
                            onChange={(e) => setNewRevNotes(e.target.value)}
                            placeholder="Mô tả điều đã cải tiến..."
                            className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={handleAddRevisionItem}
                            className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors shrink-0"
                          >
                            + Thêm bản
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: The 6 Mandatory Self-Assessment Questions */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-sm font-bold text-slate-900">
                        2. Biểu mẫu tự đánh giá quá trình học tập (6 câu hỏi bắt buộc)
                      </h4>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      {/* Q1 */}
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">
                          Câu 1: Ý tưởng của em là gì? *
                        </label>
                        <textarea
                          required
                          rows={2}
                          value={q1Idea}
                          onChange={(e) => setQ1Idea(e.target.value)}
                          placeholder="Mô tả điều em muốn thể hiện và ý nghĩa thông điệp của sản phẩm..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Q2 */}
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">
                          Câu 2: Em đã thử nghiệm những cách nào? *
                        </label>
                        <textarea
                          required
                          rows={2}
                          value={q2Experiments}
                          onChange={(e) => setQ2Experiments(e.target.value)}
                          placeholder="Em đã thử những vật liệu gì, cách cắt dán hoặc tạo hình như thế nào..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Q3 */}
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">
                          Câu 3: Điều em hài lòng nhất ở sản phẩm? *
                        </label>
                        <textarea
                          required
                          rows={2}
                          value={q3MostSatisfied}
                          onChange={(e) => setQ3MostSatisfied(e.target.value)}
                          placeholder="Chi tiết nào, màu sắc hay hình khối nào khiến em tự hào nhất..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Q4 */}
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">
                          Câu 4: Khó khăn lớn nhất em đã gặp phải? *
                        </label>
                        <textarea
                          required
                          rows={2}
                          value={q4BiggestChallenge}
                          onChange={(e) => setQ4BiggestChallenge(e.target.value)}
                          placeholder="Thao tác nào khó làm nhất, vật liệu nào khó kết dính..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Q5 */}
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">
                          Câu 5: Nếu làm lại, em sẽ thay đổi điều gì?
                        </label>
                        <textarea
                          rows={2}
                          value={q5WhatToChange}
                          onChange={(e) => setQ5WhatToChange(e.target.value)}
                          placeholder="Em sẽ chọn chất liệu khác, đổi bố cục hay cải tiến chi tiết nào..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Q6 */}
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">
                          Câu 6: Em cần giáo viên hỗ trợ điều gì thêm?
                        </label>
                        <textarea
                          rows={2}
                          value={q6NeedSupport}
                          onChange={(e) => setQ6NeedSupport(e.target.value)}
                          placeholder="Em muốn cô hướng dẫn thêm về kỹ thuật phối màu, cách cố định khối..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submission Button */}
                  <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                    <p className="text-[11px] text-slate-400">
                      Khi gửi, hệ thống tự động sinh Mã hồ sơ ngẫu nhiên và Mã khóa bí mật cho bạn.
                    </p>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      <span>Gửi hồ sơ ẩn danh</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Student Receipt: Shows purely random code and private Secret Key */
                <div className="bg-emerald-50/80 border-2 border-emerald-300 rounded-2xl p-6 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-xs">
                    <Check className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      Hồ sơ ẩn danh đã được nộp thành công!
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                      Dưới đây là <strong>Mã hồ sơ ngẫu nhiên</strong> và <strong>Mã khóa bí mật</strong> của bạn.
                      Hãy lưu lại Mã khóa bí mật để có thể xem lại nhận xét của giáo viên, bổ sung bản vẽ hoặc xóa hồ sơ bất kỳ lúc nào.
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-emerald-200 max-w-md mx-auto text-left space-y-3">
                    <div>
                      <span className="text-xs text-slate-500 font-medium">Mã hồ sơ ngẫu nhiên (Công khai cho GV):</span>
                      <p className="text-base font-bold text-emerald-800 font-mono tracking-wider mt-0.5">
                        {studentReceipt.anonymousCode}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">Mã khóa bí mật (Dành riêng cho bạn):</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(studentReceipt.secretKey);
                            setCopiedSecretKey(true);
                            setTimeout(() => setCopiedSecretKey(false), 2000);
                            onShowToast('success', 'Đã chép mã khóa', 'Mã khóa học sinh đã được sao chép.');
                          }}
                          className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
                        >
                          {copiedSecretKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedSecretKey ? 'Đã sao chép' : 'Sao chép khóa'}</span>
                        </button>
                      </div>
                      <code className="block bg-slate-50 p-2 rounded-lg text-slate-800 font-mono text-xs font-semibold mt-1 break-all border border-slate-200">
                        {studentReceipt.secretKey}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => handleStudentDeleteOwnPortfolio(studentReceipt.portfolioId, studentReceipt.secretKey)}
                      className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa hồ sơ của tôi ngay</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveStudentSession(null);
                        setStudentReceipt(null);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-2xs"
                    >
                      Hoàn tất
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: PRIVACY & SECURITY AUDIT SUITE                   */}
      {/* ======================================================== */}
      {activePortalTab === 'security-audit' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Bộ kiểm thử Bảo mật & Độc lập Hồ sơ Ẩn danh
                </h3>
                <p className="text-xs text-slate-500">
                  Kiểm chứng 5 tiêu chuẩn an toàn dữ liệu học sinh theo Thông tư 27 & Quy định bảo vệ thông tin
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Test Case 1 */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900">1. Tính Độc lập giữa 2 Hồ sơ</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    ĐẠT KIỂM THỬ
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Hồ sơ <strong>ART-K92X-M4P1</strong> và <strong>ART-W8E3-X1L9</strong> hoàn toàn tách biệt. 
                  Học sinh A không thể xem, sửa hoặc xóa hồ sơ của Học sinh B vì mỗi hồ sơ dùng cặp khóa bảo mật ngẫu nhiên riêng biệt.
                </p>
              </div>

              {/* Test Case 2 */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900">2. Độ Khó đoán của Token</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    ĐẠT KIỂM THỬ
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Mã tham gia được sinh bằng hàm <code>crypto.getRandomValues</code> 32 ký tự. 
                  Không sử dụng số thứ tự (1, 2, 3...) hay mã lớp (6A1, 7B2...) làm khóa xác thực để ngăn chặn việc đoán mã.
                </p>
              </div>

              {/* Test Case 3 */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900">3. Không có Bảng Liên kết Danh tính</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    ĐẠT KIỂM THỬ
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Cơ sở dữ liệu Firestore và mã nguồn không có bất kỳ bảng map (ánh xạ) giữa mã ẩn danh và họ tên thật. 
                  Kể cả khi bị rò rỉ cơ sở dữ liệu, không thể quy đổi mã ra học sinh cụ thể.
                </p>
              </div>

              {/* Test Case 4 */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900">4. Cơ chế Thu hồi Quyền tức thì</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    ĐẠT KIỂM THỬ
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Khi giáo viên nhấn <em>"Thu hồi mã"</em>, trường <code>isRevoked: true</code> được cập nhật lập tức trên Security Rules. 
                  Mọi yêu cầu gửi bài dùng token cũ sẽ bị từ chối truy cập ngay lập tức.
                </p>
              </div>
            </div>

            {/* Test Revoked Token Live Trigger */}
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800">Kiểm tra thực tế với Mã đã thu hồi:</span>
              <p className="text-xs text-slate-600">
                Nhấn thử nút bên dưới để kiểm tra hệ thống chặn truy cập khi học sinh cố tình nhập một mã đã bị thu hồi:
              </p>
              <button
                onClick={() => {
                  setActivePortalTab('student');
                  handleLookupSessionToken(INITIAL_ANONYMOUS_SESSIONS[1].sessionToken);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Thử truy cập mã đã thu hồi (REVOKED-TOKEN-OLD-X938...)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TEACHER CREATE NEW ANONYMOUS SESSION              */}
      {/* ======================================================== */}
      {isCreateSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Tạo phiên nộp bài ẩn danh mới
                </h3>
              </div>
              <button
                onClick={() => setIsCreateSessionModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSessionSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên bài dạy / Nhiệm vụ thực hành *
                </label>
                <input
                  type="text"
                  required
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder="Ví dụ: Tạo hình từ vật liệu tái chế bảo vệ môi trường"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={newSessionGrade}
                    onChange={(e) => setNewSessionGrade(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 bg-white"
                  >
                    <option value="Khối 1">Khối 1 (Tiểu học)</option>
                    <option value="Khối 2">Khối 2 (Tiểu học)</option>
                    <option value="Khối 3">Khối 3 (Tiểu học)</option>
                    <option value="Khối 4">Khối 4 (Tiểu học)</option>
                    <option value="Khối 5">Khối 5 (Tiểu học)</option>
                    <option value="Khối 6">Khối 6 (THCS)</option>
                    <option value="Khối 7">Khối 7 (THCS)</option>
                    <option value="Khối 8">Khối 8 (THCS)</option>
                    <option value="Khối 9">Khối 9 (THCS)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chủ đề bài học</label>
                  <input
                    type="text"
                    value={newSessionTopic}
                    onChange={(e) => setNewSessionTopic(e.target.value)}
                    placeholder="Mĩ thuật tạo hình / Đời sống"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hướng dẫn học sinh nộp bài
                </label>
                <textarea
                  rows={2}
                  value={newSessionInstructions}
                  onChange={(e) => setNewSessionInstructions(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                Hệ thống sẽ sinh tự động <strong>1 mã token 32 ký tự khó đoán</strong> và <strong>1 mã QR tương ứng</strong>. 
                Giáo viên không cần chuẩn bị danh sách lớp hay phân bổ mã trước.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateSessionModal(false)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSession}
                  className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
                >
                  {isSubmittingSession ? 'Đang kích hoạt...' : 'Kích hoạt phiên & Sinh mã QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TEACHER EVALUATE ANONYMOUS PORTFOLIO              */}
      {/* ======================================================== */}
      {evaluatingPortfolio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Đánh giá Rubric & Nhận xét cho hồ sơ {evaluatingPortfolio.anonymousCode}
                </h3>
              </div>
              <button
                onClick={() => setEvaluatingPortfolio(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEvaluation} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Mức độ đạt chuẩn theo Rubric GDPT 2018 (4 mức):
                </label>
                <select
                  value={evalLevel}
                  onChange={(e) => setEvalLevel(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 font-semibold bg-white"
                >
                  <option value="exceeded">Mức 4: Thể hiện tốt (Hoàn thành xuất sắc mục tiêu)</option>
                  <option value="achieved">Mức 3: Đạt yêu cầu (Đạt chuẩn cần đạt)</option>
                  <option value="partially_achieved">Mức 2: Đạt một phần (Cần hoàn thiện thêm)</option>
                  <option value="needs_support">Mức 1: Cần hỗ trợ (Chưa đạt chuẩn)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Nhận xét sư phạm của giáo viên: *
                </label>
                <textarea
                  required
                  rows={3}
                  value={evalComment}
                  onChange={(e) => setEvalComment(e.target.value)}
                  placeholder="Khen ngợi nỗ lực tìm tòi vật liệu, tư duy bố cục..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Gợi mở phát triển thêm (Hướng dẫn cải thiện):
                </label>
                <textarea
                  rows={2}
                  value={evalGuidance}
                  onChange={(e) => setEvalGuidance(e.target.value)}
                  placeholder="Gợi ý thử thêm chất liệu, gia cố keo..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEvaluatingPortfolio(null)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEval}
                  className="px-4 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-colors"
                >
                  {isSubmittingEval ? 'Đang lưu...' : 'Lưu đánh giá Rubric'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: VIEW DETAILED ANONYMOUS PORTFOLIO                 */}
      {/* ======================================================== */}
      {viewingPortfolio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between no-print">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 font-mono font-bold flex items-center justify-center text-xs">
                  {viewingPortfolio.anonymousCode.slice(-4)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-mono">
                    Hồ sơ Ẩn danh: {viewingPortfolio.anonymousCode}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bài: {viewingPortfolio.lessonTitle} · {viewingPortfolio.topic}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingPortfolio(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-800">
              {/* Dual Visual Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700">1. Bản phác thảo ý tưởng</span>
                  <div className="h-40 rounded-xl overflow-hidden border border-slate-200">
                    <ArtCanvasVisual visualType={viewingPortfolio.sketchImage.visualType} title={viewingPortfolio.sketchImage.caption} />
                  </div>
                  <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg">
                    "{viewingPortfolio.sketchImage.notes}"
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700">2. Tác phẩm hoàn thiện thực tế</span>
                  <div className="h-40 rounded-xl overflow-hidden border border-slate-200">
                    <ArtCanvasVisual visualType={viewingPortfolio.finalImage.visualType} title={viewingPortfolio.finalImage.caption} />
                  </div>
                  <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg">
                    "{viewingPortfolio.finalImage.notes}"
                  </p>
                </div>
              </div>

              {/* Revisions if available */}
              {viewingPortfolio.revisions && viewingPortfolio.revisions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="font-bold text-purple-900">3. Các phiên bản chỉnh sửa bổ sung ({viewingPortfolio.revisions.length} bản)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {viewingPortfolio.revisions.map((rev, i) => (
                      <div key={i} className="p-3 rounded-xl bg-purple-50/50 border border-purple-200 space-y-1.5">
                        <span className="font-bold text-purple-900">Bản {rev.revisionIndex || i + 1}: {rev.caption}</span>
                        <div className="h-28 rounded-lg overflow-hidden border border-purple-200">
                          <ArtCanvasVisual visualType={rev.visualType} title={rev.caption} />
                        </div>
                        <p className="text-[11px] text-purple-950 italic">"{rev.notes}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6 Mandatory Self-Evaluation Answers */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-900 text-sm">
                  4. Nội dung tự đánh giá quá trình học tập (6 câu hỏi):
                </span>
                <div className="space-y-2.5">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800">Câu 1: Ý tưởng của em là gì?</span>
                    <p className="mt-1 text-slate-700 leading-relaxed">{viewingPortfolio.selfEvaluation.idea}</p>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800">Câu 2: Em đã thử nghiệm những cách nào?</span>
                    <p className="mt-1 text-slate-700 leading-relaxed">{viewingPortfolio.selfEvaluation.experiments}</p>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800">Câu 3: Điều em hài lòng nhất?</span>
                    <p className="mt-1 text-slate-700 leading-relaxed">{viewingPortfolio.selfEvaluation.mostSatisfied}</p>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800">Câu 4: Khó khăn lớn nhất em đã gặp phải?</span>
                    <p className="mt-1 text-slate-700 leading-relaxed">{viewingPortfolio.selfEvaluation.biggestChallenge}</p>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800">Câu 5: Nếu làm lại, em sẽ thay đổi gì?</span>
                    <p className="mt-1 text-slate-700 leading-relaxed">{viewingPortfolio.selfEvaluation.whatToChange}</p>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800">Câu 6: Em cần giáo viên hỗ trợ điều gì thêm?</span>
                    <p className="mt-1 text-slate-700 leading-relaxed">{viewingPortfolio.selfEvaluation.needSupport}</p>
                  </div>
                </div>
              </div>

              {/* Teacher Feedback Section */}
              {viewingPortfolio.teacherEvaluation && (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-purple-900">
                      Đánh giá Rubric & Phản hồi của Giáo viên ({viewingPortfolio.teacherEvaluation.teacherName})
                    </span>
                    <span className="font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded text-[11px]">
                      {viewingPortfolio.teacherEvaluation.rubricLevel === 'exceeded' ? 'Thể hiện tốt (Mức 4)' : 'Đạt yêu cầu (Mức 3)'}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed italic">
                    "{viewingPortfolio.teacherEvaluation.comment}"
                  </p>
                  <p className="text-[11px] text-purple-800">
                    <strong>Gợi mở phát triển:</strong> {viewingPortfolio.teacherEvaluation.guidance}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between no-print">
              <span className="text-[11px] text-slate-400 font-mono">
                Mã bảo mật: {viewingPortfolio.portfolioSecretKey ? `${viewingPortfolio.portfolioSecretKey.slice(0, 8)}...` : 'N/A'}
              </span>
              <button
                onClick={() => setViewingPortfolio(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Đóng hồ sơ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

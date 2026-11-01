import React, { useState } from 'react';
import { ArtPortfolioRecord, RubricLevelKey } from '../../types/artverse';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import { LEVEL_LABELS, LEVEL_COLORS } from '../../services/artRubricService';
import { 
  FolderHeart, 
  Search, 
  Plus, 
  Sparkles, 
  Eye, 
  Edit3, 
  Trash2, 
  Filter, 
  SplitSquareVertical, 
  BarChart3, 
  Printer, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  ShieldCheck, 
  Calendar, 
  ChevronRight, 
  X, 
  Save, 
  Sliders, 
  TrendingUp, 
  ArrowLeftRight,
  Upload,
  UserCheck,
  Cloud,
  Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { savePortfolioToFirestore } from '../../services/firestoreService';

interface ArtPortfolioWorkspaceProps {
  portfolioRecords: ArtPortfolioRecord[];
  onAddRecord: (record: ArtPortfolioRecord) => void;
  onUpdateRecord: (record: ArtPortfolioRecord) => void;
  onDeleteRecord: (id: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const ArtPortfolioWorkspace: React.FC<ArtPortfolioWorkspaceProps> = ({
  portfolioRecords,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  onShowToast
}) => {
  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  // Modals & Active Views
  const [viewingRecord, setViewingRecord] = useState<ArtPortfolioRecord | null>(null);
  const [comparingRecord, setComparingRecord] = useState<ArtPortfolioRecord | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditingRecord, setIsEditingRecord] = useState<ArtPortfolioRecord | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Firestore Cloud Persistence State
  const { user, loginWithGoogle } = useAuth();
  const [isSavingCloudId, setIsSavingCloudId] = useState<string | null>(null);
  const [confirmSaveCloudRecord, setConfirmSaveCloudRecord] = useState<ArtPortfolioRecord | null>(null);

  const handleConfirmSaveToCloud = async () => {
    if (!confirmSaveCloudRecord) return;
    if (!user) {
      onShowToast('info', 'Yêu cầu đăng nhập', 'Vui lòng đăng nhập Google để lưu trữ hồ sơ học sinh lên Cloud Firestore.');
      loginWithGoogle();
      return;
    }

    try {
      setIsSavingCloudId(confirmSaveCloudRecord.id);
      const savedDoc = await savePortfolioToFirestore(confirmSaveCloudRecord);
      const updatedRecord: ArtPortfolioRecord = {
        ...confirmSaveCloudRecord,
        id: savedDoc.id,
        isSampleData: false,
        storageType: 'persistent_mock',
      };
      onUpdateRecord(updatedRecord);
      if (viewingRecord && viewingRecord.id === confirmSaveCloudRecord.id) {
        setViewingRecord(updatedRecord);
      }
      setConfirmSaveCloudRecord(null);
      onShowToast(
        'success',
        'Đã lưu hồ sơ lên Cloud Firestore',
        `Hồ sơ ${updatedRecord.studentCode} (${updatedRecord.studentPseudonym}) đã được lưu trữ an toàn trên đám mây cô lập của giáo viên.`
      );
    } catch (err: any) {
      console.error('Error saving portfolio to firestore:', err);
      onShowToast('error', 'Lỗi lưu Firestore', err?.message || 'Không thể lưu hồ sơ lên đám mây.');
    } finally {
      setIsSavingCloudId(null);
    }
  };

  // New / Edit Record Form State
  const [formStudentCode, setFormStudentCode] = useState('');
  const [formPseudonym, setFormPseudonym] = useState('');
  const [formClassGroup, setFormClassGroup] = useState('6A1');
  const [formTopic, setFormTopic] = useState('Tạo hình từ vật liệu tái chế');
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('28/10/2026');
  const [formPeriod, setFormPeriod] = useState('Tháng 10/2026');
  const [formStudentIdea, setFormStudentIdea] = useState('');
  const [formSelfLevel, setFormSelfLevel] = useState<RubricLevelKey>('achieved');
  const [formSelfReflection, setFormSelfReflection] = useState('');
  const [formFavoriteElement, setFormFavoriteElement] = useState('');
  const [formTeacherComment, setFormTeacherComment] = useState('');
  const [formTeacherGuidance, setFormTeacherGuidance] = useState('');
  const [formOverallLevel, setFormOverallLevel] = useState<RubricLevelKey>('exceeded');
  const [formSketchNote, setFormSketchNote] = useState('');
  const [formFinalNote, setFormFinalNote] = useState('');
  const [formVisualType, setFormVisualType] = useState<'dongho' | 'watercolor' | 'lacquer' | 'clay' | 'collage' | 'pastel'>('clay');

  // Comparison layout switch (Side-by-side or stacked)
  const [comparisonLayout, setComparisonLayout] = useState<'side-by-side' | 'overlay'>('side-by-side');

  // Filter Unique Options
  const classOptions = Array.from(new Set(portfolioRecords.map(r => r.classGroup)));
  const topicOptions = Array.from(new Set(portfolioRecords.map(r => r.topic)));
  const periodOptions = Array.from(new Set(portfolioRecords.map(r => r.timePeriod)));

  // Filtered Records
  const filteredRecords = portfolioRecords.filter(r => {
    const matchesSearch = 
      r.studentCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.studentPseudonym.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.studentWrittenIdea.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesClass = selectedClass === 'all' || r.classGroup === selectedClass;
    const matchesTopic = selectedTopic === 'all' || r.topic === selectedTopic;
    const matchesPeriod = selectedPeriod === 'all' || r.timePeriod === selectedPeriod;

    return matchesSearch && matchesClass && matchesTopic && matchesPeriod;
  });

  // Open Create Modal with auto-generated non-identifying code
  const handleOpenCreate = () => {
    const randomNum = Math.floor(10 + Math.random() * 89);
    setFormStudentCode(`HS-6A1-${randomNum}`);
    setFormPseudonym(`Em H.S. (${randomNum})`);
    setFormClassGroup('6A1');
    setFormTopic('Tạo hình từ vật liệu tái chế');
    setFormTitle('Mô hình ngôi nhà thông minh từ bìa carton');
    setFormDate(new Date().toLocaleDateString('vi-VN'));
    setFormPeriod('Tháng 10/2026');
    setFormStudentIdea('Em muốn tạo ra một ngôi nhà năng lượng mặt trời bằng bìa carton và ống hút giấy để bảo vệ môi trường.');
    setFormSelfLevel('achieved');
    setFormSelfReflection('Em đã dựng được khung nhà 2 tầng đứng vững, phần mái nhà em dán cẩn thận không bị hở keo.');
    setFormFavoriteElement('Phần ban công bằng que kem gỗ và mái ngói màu xanh.');
    setFormTeacherComment('Ý tưởng thiết thực và giàu ý nghĩa bảo vệ hành tinh. Thao tác dán ghép cẩn thận, an toàn.');
    setFormTeacherGuidance('Em có thể trang trí thêm cây xanh nhỏ xung quanh sân nhà.');
    setFormOverallLevel('exceeded');
    setFormSketchNote('Bản vẽ phác thảo hình khối 2 tầng, cửa sổ và cầu thang nối.');
    setFormFinalNote('Mô hình 3D hoàn chỉnh được sơn phủ màu gouache bền đẹp.');
    setFormVisualType('clay');
    setIsEditingRecord(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (record: ArtPortfolioRecord) => {
    setIsEditingRecord(record);
    setFormStudentCode(record.studentCode);
    setFormPseudonym(record.studentPseudonym);
    setFormClassGroup(record.classGroup);
    setFormTopic(record.topic);
    setFormTitle(record.title);
    setFormDate(record.executionDate);
    setFormPeriod(record.timePeriod);
    setFormStudentIdea(record.studentWrittenIdea);
    setFormSelfLevel(record.studentSelfAssessment.level);
    setFormSelfReflection(record.studentSelfAssessment.reflection);
    setFormFavoriteElement(record.studentSelfAssessment.favoriteElement);
    setFormTeacherComment(record.teacherFeedback.comment);
    setFormTeacherGuidance(record.teacherFeedback.guidance);
    setFormOverallLevel(record.rubricResult.overallLevel);
    setFormSketchNote(record.sketchImage.notes);
    setFormFinalNote(record.finalImage.notes);
    setFormVisualType(record.finalImage.visualType);
    setIsCreateModalOpen(true);
  };

  // Submit Create / Edit Record
  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formStudentCode.trim()) {
      onShowToast('error', 'Thiếu dữ liệu', 'Vui lòng nhập mã học sinh và tiêu đề tác phẩm.');
      return;
    }

    if (isEditingRecord) {
      const updated: ArtPortfolioRecord = {
        ...isEditingRecord,
        studentCode: formStudentCode,
        studentPseudonym: formPseudonym,
        classGroup: formClassGroup,
        topic: formTopic,
        title: formTitle,
        executionDate: formDate,
        timePeriod: formPeriod,
        sketchImage: {
          ...isEditingRecord.sketchImage,
          notes: formSketchNote,
          visualType: 'pastel'
        },
        finalImage: {
          ...isEditingRecord.finalImage,
          notes: formFinalNote,
          visualType: formVisualType
        },
        studentWrittenIdea: formStudentIdea,
        studentSelfAssessment: {
          level: formSelfLevel,
          levelLabel: LEVEL_LABELS[formSelfLevel],
          reflection: formSelfReflection,
          favoriteElement: formFavoriteElement
        },
        teacherFeedback: {
          ...isEditingRecord.teacherFeedback,
          comment: formTeacherComment,
          guidance: formTeacherGuidance,
          verifiedDate: new Date().toLocaleDateString('vi-VN')
        },
        rubricResult: {
          ...isEditingRecord.rubricResult,
          overallLevel: formOverallLevel,
          overallLabel: LEVEL_LABELS[formOverallLevel],
          isTeacherVerified: true
        },
        storageType: 'session_temp'
      };

      onUpdateRecord(updated);
      onShowToast('success', 'Đã cập nhật hồ sơ', `Hồ sơ ${updated.studentCode} đã được lưu vào phiên làm việc.`);
    } else {
      const newRec: ArtPortfolioRecord = {
        id: `port-${Date.now()}`,
        studentCode: formStudentCode,
        studentPseudonym: formPseudonym || `HS-${formClassGroup}`,
        classGroup: formClassGroup,
        topic: formTopic,
        title: formTitle,
        executionDate: formDate,
        timePeriod: formPeriod,
        sketchImage: {
          caption: 'Bản vẽ phác thảo cấu trúc ý tưởng ban đầu',
          visualType: 'pastel',
          notes: formSketchNote || 'Phác thảo các nét chính và sắp xếp tỷ lệ bố cục.'
        },
        finalImage: {
          caption: 'Tác phẩm hoàn chỉnh thực tế',
          visualType: formVisualType,
          notes: formFinalNote || 'Sản phẩm hoàn thiện có kết cấu vững chắc.'
        },
        studentWrittenIdea: formStudentIdea,
        studentSelfAssessment: {
          level: formSelfLevel,
          levelLabel: LEVEL_LABELS[formSelfLevel],
          reflection: formSelfReflection,
          favoriteElement: formFavoriteElement
        },
        teacherFeedback: {
          comment: formTeacherComment,
          guidance: formTeacherGuidance,
          teacherName: 'Cô Mai Phương',
          verifiedDate: new Date().toLocaleDateString('vi-VN')
        },
        rubricResult: {
          rubricTitle: `Rubric Mĩ thuật (${formClassGroup})`,
          overallLevel: formOverallLevel,
          overallLabel: LEVEL_LABELS[formOverallLevel],
          isTeacherVerified: true,
          criteriaScores: [
            { criterionName: 'Ý tưởng & Bố cục', level: formOverallLevel, note: 'Thể hiện rõ chủ đề bài học.' },
            { criterionName: 'Kỹ thuật & Độ hoàn thiện', level: formOverallLevel, note: 'Thao tác khéo léo, an toàn.' }
          ]
        },
        isSampleData: false,
        storageType: 'session_temp'
      };

      onAddRecord(newRec);
      onShowToast('success', 'Đã tạo hồ sơ mĩ thuật mới', `Đã lưu hồ sơ không định danh ${newRec.studentCode} vào phiên làm việc.`);
    }

    setIsCreateModalOpen(false);
  };

  // Delete Record
  const handleDelete = (id: string, code: string) => {
    onDeleteRecord(id);
    onShowToast('info', 'Đã xóa hồ sơ', `Đã loại bỏ hồ sơ ${code} khỏi danh sách.`);
  };

  // Real data progress calculation
  const totalCount = portfolioRecords.length;
  const selfExceededCount = portfolioRecords.filter(r => r.studentSelfAssessment.level === 'exceeded').length;
  const selfAchievedCount = portfolioRecords.filter(r => r.studentSelfAssessment.level === 'achieved').length;
  const teacherExceededCount = portfolioRecords.filter(r => r.rubricResult.overallLevel === 'exceeded').length;
  const teacherAchievedCount = portfolioRecords.filter(r => r.rubricResult.overallLevel === 'achieved').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Privacy, Storage Transparency & Verification Banner */}
      <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 text-xs text-amber-950 space-y-1.5 shadow-xs no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="font-bold uppercase tracking-wider text-[11px] text-amber-900">
              Chính sách Bảo vệ Dữ liệu & Tính Minh bạch Sư phạm
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded font-semibold">
              Mã hóa không định danh
            </span>
            <span className="bg-white text-slate-700 px-2 py-0.5 rounded border border-amber-200">
              Lưu phiên tạm thời (Session)
            </span>
          </div>
        </div>

        <p className="opacity-90 leading-relaxed text-[11px]">
          <strong>Minh bạch lưu trữ:</strong> Dữ liệu hiện được lưu trữ trong phiên làm việc của trình duyệt (Local/Session state). Hệ thống chưa kết nối cơ sở dữ liệu đám mây bền vững — vui lòng xuất PDF hoặc in ấn khi cần lưu trữ lâu dài cho hồ sơ nhà trường.
          <span className="block mt-0.5 text-amber-800">
            <strong>Bảo vệ học sinh:</strong> Toàn bộ hồ sơ sử dụng <em>Mã học sinh giả lập không định danh</em> (VD: <code>HS-6A1-08</code>) và viết tắt để bảo vệ quyền riêng tư theo đúng Thông tư 27 & 22 của Bộ GD&ĐT. Các tác phẩm mẫu được ghi rõ <strong>[DỮ LIỆU MINH HỌA SƯ PHẠM]</strong>.
          </span>
        </p>
      </div>

      {/* Main Workspace Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded flex items-center gap-1">
              <FolderHeart className="w-3.5 h-3.5" />
              ArtPortfolio
            </span>
            <span className="text-xs text-slate-500">Hồ sơ Học tập & So sánh Phiên bản Sản phẩm</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-xs text-slate-400 font-mono tabular-nums">{filteredRecords.length} hồ sơ hiển thị</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            Quản lý Hồ sơ Mĩ thuật Cá nhân hóa
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors"
          >
            <BarChart3 className="w-4 h-4 text-purple-600" />
            <span>Báo cáo tiến bộ thực tế</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm hồ sơ mĩ thuật</span>
          </button>
        </div>
      </div>

      {/* Search & Multi-criteria Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-3 no-print">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã học sinh (HS-6A1...), chủ đề, ý tưởng, tên tác phẩm..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filter Dropdowns Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {/* Filter by Class */}
          <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-medium shrink-0">Lớp:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none w-full"
            >
              <option value="all">Tất cả các lớp</option>
              {classOptions.map(cls => (
                <option key={cls} value={cls}>Lớp {cls}</option>
              ))}
            </select>
          </div>

          {/* Filter by Topic */}
          <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-medium shrink-0">Chủ đề:</span>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none w-full truncate"
            >
              <option value="all">Tất cả chủ đề</option>
              {topicOptions.map(top => (
                <option key={top} value={top}>{top}</option>
              ))}
            </select>
          </div>

          {/* Filter by Period */}
          <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-medium shrink-0">Thời gian:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none w-full"
            >
              <option value="all">Tất cả thời gian</option>
              {periodOptions.map(per => (
                <option key={per} value={per}>{per}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Portfolio Grid Cards */}
      {filteredRecords.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-3">
          <FolderHeart className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">Không tìm thấy hồ sơ phù hợp</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Không có hồ sơ học sinh nào khớp với bộ lọc hoặc từ khóa tìm kiếm "{searchQuery}".
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedClass('all');
              setSelectedTopic('all');
              setSelectedPeriod('all');
            }}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100"
          >
            Bỏ tất cả bộ lọc
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
          {filteredRecords.map((record) => {
            const levelStyle = LEVEL_COLORS[record.rubricResult.overallLevel];

            return (
              <div
                key={record.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 p-5 shadow-xs transition-all flex flex-col justify-between group space-y-4"
              >
                <div>
                  {/* Card Header: Student Code + Anonymous badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-100 to-teal-100 text-emerald-800 flex items-center justify-center font-bold text-xs font-mono border border-emerald-200 shrink-0">
                        {record.studentCode.slice(-2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors font-mono">
                            {record.studentCode}
                          </h4>
                          <span className="text-[11px] text-slate-500 font-sans">
                            ({record.studentPseudonym})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span>Lớp {record.classGroup}</span>
                          <span aria-hidden="true">·</span>
                          <span>{record.executionDate}</span>
                          <span aria-hidden="true">·</span>
                          {record.storageType === 'persistent_mock' && !record.isSampleData ? (
                            <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                              <Cloud className="w-2.5 h-2.5 text-blue-600" />
                              <span>Cloud Firestore</span>
                            </span>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-1 rounded text-[10px] font-medium">
                              {record.isSampleData ? 'Dữ liệu minh họa' : 'Phiên làm việc'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${levelStyle.bg} ${levelStyle.text} ${levelStyle.border}`}>
                      {record.rubricResult.overallLabel}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mt-3 leading-snug">
                    {record.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chủ đề: <span className="font-medium text-slate-700">{record.topic}</span>
                  </p>

                  {/* Dual Thumbnail Comparison Strip (Sketch vs Final) */}
                  <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                        <span>1. Bản phác thảo</span>
                        <span className="text-slate-400 font-mono">Bút chì/Chì màu</span>
                      </div>
                      <div className="rounded-xl overflow-hidden border border-slate-200">
                        <ArtCanvasVisual
                          type={record.sketchImage.visualType}
                          title="Bản phác thảo ý tưởng"
                          className="h-24 w-full"
                          badgeText="Phác thảo"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                        <span>2. Tác phẩm hoàn thiện</span>
                        <span className="text-emerald-700 font-semibold">Đã xác nhận</span>
                      </div>
                      <div className="rounded-xl overflow-hidden border border-slate-200">
                        <ArtCanvasVisual
                          type={record.finalImage.visualType}
                          title={record.title}
                          className="h-24 w-full"
                          badgeText="Hoàn thiện"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Student written statement snippet */}
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 line-clamp-2 italic leading-relaxed">
                    "{record.studentWrittenIdea}"
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setComparingRecord(record)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                    title="So sánh chi tiết bản phác thảo và sản phẩm hoàn thiện"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>So sánh 2 bản</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Cloud Save Action */}
                    {record.storageType !== 'persistent_mock' && (
                      <button
                        onClick={() => setConfirmSaveCloudRecord(record)}
                        disabled={isSavingCloudId === record.id}
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Lưu hồ sơ này lên Cloud Firestore"
                      >
                        <Cloud className={`w-3.5 h-3.5 ${isSavingCloudId === record.id ? 'animate-bounce' : ''}`} />
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenEdit(record)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Chỉnh sửa hồ sơ"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(record.id, record.studentCode)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Xóa hồ sơ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setViewingRecord(record)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                    >
                      <span>Xem hồ sơ</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Dual Version Comparison (Sketch vs Final Artwork) */}
      {comparingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 md:p-5 border-b border-slate-200 flex items-center justify-between no-print">
              <div>
                <div className="flex items-center gap-2 text-xs text-purple-700 font-bold uppercase tracking-wider">
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>So sánh Tiến trình Tạo hình Sản phẩm</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {comparingRecord.title} — {comparingRecord.studentCode} ({comparingRecord.studentPseudonym})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs">
                  <button
                    onClick={() => setComparisonLayout('side-by-side')}
                    className={`px-2.5 py-1 rounded font-medium ${comparisonLayout === 'side-by-side' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
                  >
                    Song song
                  </button>
                  <button
                    onClick={() => setComparisonLayout('overlay')}
                    className={`px-2.5 py-1 rounded font-medium ${comparisonLayout === 'overlay' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
                  >
                    Xếp lớp
                  </button>
                </div>

                <button
                  onClick={() => setComparingRecord(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Comparison Canvas */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs printable-area text-slate-800">
              {/* Dual Visual Slots */}
              <div className={`grid ${comparisonLayout === 'side-by-side' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-6`}>
                {/* Slot 1: Sketch */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span>Phiên bản 1: Bản vẽ phác thảo ý tưởng</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Khởi đầu dự án</span>
                  </div>

                  <ArtCanvasVisual
                    type={comparingRecord.sketchImage.visualType}
                    title="Phác thảo ý tưởng"
                    className="h-52 w-full"
                    badgeText="Phác thảo"
                  />

                  <p className="text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                    <strong>Ghi chú phác thảo:</strong> {comparingRecord.sketchImage.notes}
                  </p>
                </div>

                {/* Slot 2: Final Artwork */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>Phiên bản 2: Tác phẩm hoàn thiện thực tế</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded">
                      {comparingRecord.rubricResult.overallLabel}
                    </span>
                  </div>

                  <ArtCanvasVisual
                    type={comparingRecord.finalImage.visualType}
                    title={comparingRecord.title}
                    className="h-52 w-full"
                    badgeText="Hoàn thiện"
                  />

                  <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-emerald-100">
                    <strong>Hiện thực hóa:</strong> {comparingRecord.finalImage.notes}
                  </p>
                </div>
              </div>

              {/* Evolution Pedagogical Analysis Table */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Phân tích Sự phát triển Năng lực từ Bản phác thảo đến Tác phẩm:
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-lg border border-slate-100">
                    <strong className="text-blue-900 block mb-1">1. Chuyển biến hình thể:</strong>
                    <p className="text-slate-600 leading-relaxed">
                      Từ các hình khối phác chì 2D trên giấy đã được chuyển hóa thành khối 3D vững chãi, cân đối và đứng vững trên mặt bàn.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-100">
                    <strong className="text-purple-900 block mb-1">2. Giải pháp vật liệu:</strong>
                    <p className="text-slate-600 leading-relaxed">
                      Biết gia cố thêm keo nến và các khớp nối thông minh khi phát hiện tay mô hình bị lỏng trong quá trình thực hành.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-100">
                    <strong className="text-emerald-900 block mb-1">3. Hoàn thiện thẩm mĩ:</strong>
                    <p className="text-slate-600 leading-relaxed">
                      Phối màu tươi sáng có điểm nhấn, thể hiện rõ thông điệp bảo vệ môi trường theo đúng ý tưởng ban đầu của học sinh.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between no-print">
              <span className="text-[11px] text-slate-500">
                Hồ sơ lưu trữ có xác thực sư phạm môn Mĩ thuật
              </span>
              <button
                onClick={() => setComparingRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Đóng so sánh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: View Full Detailed Portfolio Record */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between no-print">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                  {viewingRecord.studentCode} ({viewingRecord.studentPseudonym})
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{viewingRecord.title}</h3>
                <p className="text-xs text-slate-500">
                  Lớp: {viewingRecord.classGroup} · Chủ đề: {viewingRecord.topic} · {viewingRecord.executionDate}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In hồ sơ</span>
                </button>

                <button
                  onClick={() => setViewingRecord(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-xs printable-area text-slate-800">
              {/* Document Header in Print */}
              <div className="text-center border-b pb-4 border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  HỒ SƠ HỌC TẬP MĨ THUẬT (ARTPORTFOLIO) · GDPT 2018
                </p>
                <h1 className="text-xl font-bold text-slate-900 mt-1">{viewingRecord.title}</h1>
                <div className="flex items-center justify-center gap-3 text-xs text-slate-500 mt-1 font-mono">
                  <span>Mã định danh: <strong>{viewingRecord.studentCode}</strong></span>
                  <span>·</span>
                  <span>Lớp: {viewingRecord.classGroup}</span>
                  <span>·</span>
                  <span>Ngày: {viewingRecord.executionDate}</span>
                </div>
              </div>

              {/* Dual Visual Showcase */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 text-[11px] block">1. Ảnh phác thảo ý tưởng:</span>
                  <ArtCanvasVisual
                    type={viewingRecord.sketchImage.visualType}
                    title="Bản phác thảo"
                    className="h-40 w-full"
                    badgeText="Phác thảo"
                  />
                  <p className="text-[11px] text-slate-500 italic mt-1">"{viewingRecord.sketchImage.notes}"</p>
                </div>

                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 text-[11px] block">2. Tác phẩm hoàn thiện:</span>
                  <ArtCanvasVisual
                    type={viewingRecord.finalImage.visualType}
                    title={viewingRecord.title}
                    className="h-40 w-full"
                    badgeText="Hoàn thiện"
                  />
                  <p className="text-[11px] text-slate-500 italic mt-1">"{viewingRecord.finalImage.notes}"</p>
                </div>
              </div>

              {/* Student Voice: Written Idea & Self Assessment */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider mb-1">
                    Ý tưởng nghệ thuật do học sinh tự viết:
                  </h4>
                  <p className="text-slate-700 leading-relaxed italic bg-white p-3 rounded-lg border border-slate-100">
                    "{viewingRecord.studentWrittenIdea}"
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                      Học sinh tự đánh giá sản phẩm:
                    </h4>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {viewingRecord.studentSelfAssessment.levelLabel}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                    {viewingRecord.studentSelfAssessment.reflection}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    <strong>Chi tiết em thích nhất:</strong> {viewingRecord.studentSelfAssessment.favoriteElement}
                  </p>
                </div>
              </div>

              {/* Teacher Formative Verification & Feedback */}
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-emerald-950 uppercase text-[10px] tracking-wider">
                    Nhận xét & Kết quả Giáo viên bộ môn xác nhận:
                  </h4>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded border border-emerald-200">
                    {viewingRecord.rubricResult.overallLabel}
                  </span>
                </div>

                <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-emerald-100 italic">
                  "{viewingRecord.teacherFeedback.comment}"
                </p>

                <div className="text-[11px] text-emerald-900 pt-1">
                  <strong>Định hướng sư phạm tiếp theo:</strong> {viewingRecord.teacherFeedback.guidance}
                </div>
              </div>

              {/* Verified Rubric Criteria Breakdown */}
              <div>
                <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider mb-2">
                  Kết quả theo Tiêu chí Rubric môn học:
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
                  {viewingRecord.rubricResult.criteriaScores.map((score, i) => (
                    <div key={i} className="p-3 flex items-center justify-between gap-4">
                      <span className="font-semibold text-slate-800">{score.criterionName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">{score.note}</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          {LEVEL_LABELS[score.level]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-6 border-t border-slate-300 flex items-center justify-between text-xs text-center text-slate-700">
                <div>
                  <p className="font-semibold">Học sinh xác nhận hồ sơ</p>
                  <p className="text-[10px] font-mono text-slate-400 mt-8">{viewingRecord.studentCode}</p>
                </div>
                <div>
                  <p className="text-slate-500">Xác nhận ngày {viewingRecord.teacherFeedback.verifiedDate}</p>
                  <p className="font-bold mt-0.5">GIÁO VIÊN BỘ MÔN MĨ THUẬT</p>
                  <p className="text-purple-700 font-bold mt-7">{viewingRecord.teacherFeedback.teacherName}</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end no-print">
              <button
                onClick={() => setViewingRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Create / Edit Portfolio Record */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isEditingRecord ? 'Chỉnh sửa Hồ sơ Học tập' : 'Tạo Hồ sơ Học tập Mĩ thuật Mới'}
                </h3>
                <p className="text-xs text-slate-500">Mã hóa không định danh danh tính học sinh</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Row 1: Student Code (Pseudonym) & Class */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã học sinh <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formStudentCode}
                    onChange={(e) => setFormStudentCode(e.target.value)}
                    placeholder="VD: HS-6A1-08"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400">Không ghi họ tên thật</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tên viết tắt / Ký hiệu
                  </label>
                  <input
                    type="text"
                    value={formPseudonym}
                    onChange={(e) => setFormPseudonym(e.target.value)}
                    placeholder="VD: Em M. (6A1)"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lớp
                  </label>
                  <select
                    value={formClassGroup}
                    onChange={(e) => setFormClassGroup(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-900 bg-slate-50"
                  >
                    <option value="6A1">6A1</option>
                    <option value="6A2">6A2</option>
                    <option value="7B2">7B2</option>
                    <option value="4A3">4A3</option>
                    <option value="5A2">5A2</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Title & Topic */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tên tác phẩm <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="VD: Robot thám hiểm bảo vệ môi trường"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Chủ đề bài học
                  </label>
                  <input
                    type="text"
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {/* Row 3: Notes for Sketch and Final */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mô tả Bản vẽ phác thảo (Sketch)
                  </label>
                  <textarea
                    rows={2}
                    value={formSketchNote}
                    onChange={(e) => setFormSketchNote(e.target.value)}
                    placeholder="Phác thảo ý tưởng ban đầu, kích thước khối..."
                    className="w-full p-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mô tả Tác phẩm hoàn thiện
                  </label>
                  <textarea
                    rows={2}
                    value={formFinalNote}
                    onChange={(e) => setFormFinalNote(e.target.value)}
                    placeholder="Sản phẩm hoàn thiện, kỹ thuật cắt dán..."
                    className="w-full p-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {/* Row 4: Student Written Idea */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ý tưởng nghệ thuật do học sinh tự viết
                </label>
                <textarea
                  rows={2}
                  value={formStudentIdea}
                  onChange={(e) => setFormStudentIdea(e.target.value)}
                  placeholder="Học sinh chia sẻ về lý do chọn đề tài và thông điệp tác phẩm..."
                  className="w-full p-2 border border-slate-200 rounded-lg text-slate-900 leading-relaxed"
                />
              </div>

              {/* Row 5: Student Self Assessment */}
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-blue-900">
                    Học sinh tự đánh giá mức đạt được:
                  </label>
                  <select
                    value={formSelfLevel}
                    onChange={(e) => setFormSelfLevel(e.target.value as RubricLevelKey)}
                    className="px-2 py-1 bg-white border border-blue-200 rounded text-xs font-semibold text-blue-900"
                  >
                    <option value="needs_support">Mức 1: Cần hỗ trợ</option>
                    <option value="partially_achieved">Mức 2: Đạt một phần</option>
                    <option value="achieved">Mức 3: Đạt yêu cầu</option>
                    <option value="exceeded">Mức 4: Thể hiện tốt</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  value={formSelfReflection}
                  onChange={(e) => setFormSelfReflection(e.target.value)}
                  placeholder="Cảm nghĩ tự nhận xét của học sinh về sản phẩm..."
                  className="w-full p-2 bg-white border border-blue-200 rounded-lg text-slate-900"
                />
              </div>

              {/* Row 6: Teacher Verification & Feedback */}
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-emerald-950">
                    Kết quả Giáo viên bộ môn xác nhận:
                  </label>
                  <select
                    value={formOverallLevel}
                    onChange={(e) => setFormOverallLevel(e.target.value as RubricLevelKey)}
                    className="px-2 py-1 bg-white border border-emerald-200 rounded text-xs font-semibold text-emerald-900"
                  >
                    <option value="needs_support">Mức 1: Cần hỗ trợ</option>
                    <option value="partially_achieved">Mức 2: Đạt một phần</option>
                    <option value="achieved">Mức 3: Đạt yêu cầu</option>
                    <option value="exceeded">Mức 4: Thể hiện tốt</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  value={formTeacherComment}
                  onChange={(e) => setFormTeacherComment(e.target.value)}
                  placeholder="Nhận xét khích lệ của giáo viên..."
                  className="w-full p-2 bg-white border border-emerald-200 rounded-lg text-slate-900"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                >
                  {isEditingRecord ? 'Lưu thay đổi' : 'Tạo hồ sơ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Real Data Progress Report (Based on existing portfolios) */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between no-print">
              <div>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded uppercase">
                  Báo cáo Tiến bộ Thực tế
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Tổng hợp Năng lực Mĩ thuật từ Hồ sơ Học tập Hiện có
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In báo cáo</span>
                </button>

                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Report Canvas */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-xs printable-area text-slate-800">
              <div className="text-center border-b pb-4 border-slate-300">
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  PHÒNG GD&ĐT · TỔ CHUYÊN MÔN MĨ THUẬT
                </p>
                <h1 className="text-lg md:text-xl font-bold uppercase tracking-tight text-slate-900 mt-1">
                  Báo Cáo Tiến Bộ Thẩm Mĩ Dựa Trên Dữ Liệu Hồ Sơ ArtPortfolio
                </h1>
                <p className="text-slate-500 mt-1">
                  Căn cứ tổng hợp trên <strong>{totalCount}</strong> hồ sơ mĩ thuật không định danh đã số hóa
                </p>
              </div>

              {/* Comparative Alignment: Student Self Assessment vs Teacher Verification */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Đối chiếu: Học sinh Tự đánh giá vs Giáo viên Xác nhận
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">Độ tương thích năng lực</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Self assessment */}
                  <div className="p-3.5 bg-white rounded-xl border border-blue-200 space-y-2">
                    <span className="font-bold text-blue-900 block text-xs">
                      1. Học sinh Tự đánh giá:
                    </span>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span>Mức 4 (Thể hiện tốt):</span>
                        <strong className="font-mono text-emerald-700">{selfExceededCount} HS ({Math.round(selfExceededCount / (totalCount || 1) * 100)}%)</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Mức 3 (Đạt yêu cầu):</span>
                        <strong className="font-mono text-blue-700">{selfAchievedCount} HS ({Math.round(selfAchievedCount / (totalCount || 1) * 100)}%)</strong>
                      </div>
                    </div>
                  </div>

                  {/* Teacher verification */}
                  <div className="p-3.5 bg-white rounded-xl border border-emerald-200 space-y-2">
                    <span className="font-bold text-emerald-950 block text-xs">
                      2. Giáo viên Xác nhận (Rubric):
                    </span>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span>Mức 4 (Thể hiện tốt):</span>
                        <strong className="font-mono text-emerald-700">{teacherExceededCount} HS ({Math.round(teacherExceededCount / (totalCount || 1) * 100)}%)</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Mức 3 (Đạt yêu cầu):</span>
                        <strong className="font-mono text-blue-700">{teacherAchievedCount} HS ({Math.round(teacherAchievedCount / (totalCount || 1) * 100)}%)</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed italic bg-white p-2.5 rounded-lg border border-slate-100">
                  * Nhận xét chuyên môn: Học sinh có ý thức tự nhận thức năng lực tốt, khiêm tốn trong khâu tự đánh giá và hào hứng khi được giáo viên ghi nhận nỗ lực vượt khó trong khâu thực hành.
                </p>
              </div>

              {/* Individual Student Records Summary Table */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                  Danh sách Chi tiết Tiến trình Cá nhân hóa:
                </h4>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Mã HS (Không định danh)</th>
                        <th className="p-2.5">Lớp</th>
                        <th className="p-2.5">Tác phẩm</th>
                        <th className="p-2.5 text-center">Tự đánh giá</th>
                        <th className="p-2.5 text-center">GV xác nhận</th>
                        <th className="p-2.5 text-right">Ngày ghi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {portfolioRecords.map((r) => (
                        <tr key={r.id}>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{r.studentCode}</td>
                          <td className="p-2.5">{r.classGroup}</td>
                          <td className="p-2.5 font-medium text-slate-800">{r.title}</td>
                          <td className="p-2.5 text-center">
                            <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-semibold">
                              {r.studentSelfAssessment.levelLabel.slice(0, 6)}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                              {r.rubricResult.overallLabel}
                            </span>
                          </td>
                          <td className="p-2.5 text-right text-slate-400 font-mono text-[11px]">{r.executionDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-6 border-t border-slate-300 flex items-center justify-between text-xs text-center text-slate-700">
                <div>
                  <p className="font-semibold">BAN GIÁM HIỆU DUYỆT</p>
                  <p className="text-[10px] text-slate-400 mt-8">(Ký và ghi rõ họ tên)</p>
                </div>
                <div>
                  <p className="text-slate-500">Hà Nội, ngày 28 tháng 10 năm 2026</p>
                  <p className="font-bold mt-0.5">GIÁO VIÊN BỘ MÔN MĨ THUẬT</p>
                  <p className="text-purple-700 font-bold mt-7">Cô Mai Phương</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end no-print">
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Đóng báo cáo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cloud Firestore Confirmation Modal */}
      {confirmSaveCloudRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Xác nhận lưu hồ sơ lên Cloud Firestore
                </h3>
                <p className="text-xs text-slate-500">
                  Lưu trữ tiến trình mĩ thuật & bảo vệ quyền riêng tư học sinh
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Mã học sinh:</span>
                <span className="font-mono font-bold text-slate-900">{confirmSaveCloudRecord.studentCode} ({confirmSaveCloudRecord.studentPseudonym})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tác phẩm:</span>
                <span className="font-semibold text-slate-900 text-right">{confirmSaveCloudRecord.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lớp & Chủ đề:</span>
                <span className="font-medium">Lớp {confirmSaveCloudRecord.classGroup} · {confirmSaveCloudRecord.topic}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tài khoản giáo viên:</span>
                <span className="font-semibold text-blue-600">{user?.email || 'Chưa đăng nhập'}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 leading-relaxed flex items-start gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Bảo vệ dữ liệu học sinh:</strong> ARTVERSE AI áp dụng mã định danh giả lập ({confirmSaveCloudRecord.studentCode}) và tên viết tắt. Tuyệt đối không lưu họ tên thật hoặc thông tin định danh cá nhân (PII) trên máy chủ.
                </span>
              </div>
            </div>

            {!user && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                Bạn cần đăng nhập Google để lưu trữ hồ sơ vào Cloud Firestore. Nhấn xác nhận sẽ mở cửa sổ đăng nhập an toàn.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSaveCloudRecord(null)}
                disabled={Boolean(isSavingCloudId)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveToCloud}
                disabled={Boolean(isSavingCloudId)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{isSavingCloudId ? 'Đang lưu Cloud...' : user ? 'Xác nhận Lưu Firestore' : 'Đăng nhập & Lưu'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

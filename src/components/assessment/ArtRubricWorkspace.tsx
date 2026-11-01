import React, { useState } from 'react';
import { 
  ArtRubricTemplate, 
  ArtRubricCriterion4Levels, 
  ArtProductFeedback, 
  RubricLevelKey 
} from '../../types/artverse';
import { 
  DEFAULT_RUBRIC_TEMPLATES, 
  LEVEL_LABELS, 
  LEVEL_COLORS, 
  generateAIPedagogicalFeedback 
} from '../../services/artRubricService';
import { 
  Sliders, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  Sparkles, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Printer, 
  Copy, 
  Info, 
  Check, 
  RotateCcw, 
  ArrowLeft,
  Image as ImageIcon,
  ShieldAlert,
  FileCheck2,
  HelpCircle,
  Cloud,
  Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { saveRubricToFirestore, getTeacherRubrics } from '../../services/firestoreService';

interface ArtRubricWorkspaceProps {
  onBackToAssessment: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const ArtRubricWorkspace: React.FC<ArtRubricWorkspaceProps> = ({
  onBackToAssessment,
  onShowToast
}) => {
  // Rubric Selection & Active Template State
  const [rubricTemplates, setRubricTemplates] = useState<ArtRubricTemplate[]>(DEFAULT_RUBRIC_TEMPLATES);
  const [selectedRubricId, setSelectedRubricId] = useState<string>(DEFAULT_RUBRIC_TEMPLATES[0].id);

  // Active rubric being edited
  const currentRubric = rubricTemplates.find(r => r.id === selectedRubricId) || rubricTemplates[0];

  // Rubric form metadata
  const [title, setTitle] = useState(currentRubric.title);
  const [grade, setGrade] = useState(currentRubric.grade);
  const [topic, setTopic] = useState(currentRubric.topic);
  const [productType, setProductType] = useState(currentRubric.productType);
  const [evaluationMode, setEvaluationMode] = useState<'weighted' | 'qualitative'>(currentRubric.evaluationMode);
  const [criteria, setCriteria] = useState<ArtRubricCriterion4Levels[]>(currentRubric.criteria);

  // Cloud Firestore Persistence State
  const { user, loginWithGoogle } = useAuth();
  const [isSavingCloud, setIsSavingCloud] = useState<boolean>(false);
  const [showCloudModal, setShowCloudModal] = useState<boolean>(false);
  const [cloudSavedId, setCloudSavedId] = useState<string | null>(null);

  // Load teacher's saved rubrics from Firestore
  React.useEffect(() => {
    if (user) {
      loadCloudRubrics();
    }
  }, [user]);

  const loadCloudRubrics = async () => {
    if (!user) return;
    try {
      const docs = await getTeacherRubrics();
      if (docs && docs.length > 0) {
        const cloudTemplates: ArtRubricTemplate[] = docs.map(d => ({
          ...d.rawRubricData,
          id: d.id,
          title: `${d.title} (Cloud)`,
          createdAt: `${new Date(d.updatedAt).toLocaleDateString('vi-VN')} (Cloud)`,
          author: user.displayName || 'Giáo viên'
        }));
        setRubricTemplates(prev => {
          const defaults = prev.filter(p => !p.id.startsWith('cloud-'));
          return [...cloudTemplates, ...defaults];
        });
      }
    } catch (err) {
      console.warn('Could not load cloud rubrics:', err);
    }
  };

  const handleConfirmCloudSaveRubric = async () => {
    const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
    if (evaluationMode === 'weighted' && totalWeight !== 100) {
      onShowToast('error', 'Tổng trọng số chưa bằng 100%', `Tổng trọng số hiện tại là ${totalWeight}%. Vui lòng điều chỉnh lại.`);
      return;
    }

    if (!user) {
      onShowToast('info', 'Yêu cầu đăng nhập', 'Vui lòng đăng nhập Google để lưu trữ Rubric lên Cloud Firestore.');
      loginWithGoogle();
      return;
    }

    const currentTmpl: ArtRubricTemplate = {
      id: `cloud-rubric-${Date.now()}`,
      title,
      grade,
      topic,
      productType,
      evaluationMode,
      criteria,
      createdAt: new Date().toLocaleDateString('vi-VN'),
      author: user.displayName || 'Giáo viên'
    };

    try {
      setIsSavingCloud(true);
      const saved = await saveRubricToFirestore(currentTmpl);
      setCloudSavedId(saved.id);
      setRubricTemplates(prev => [currentTmpl, ...prev]);
      setShowCloudModal(false);
      onShowToast(
        'success',
        'Đã lưu Rubric lên Cloud Firestore',
        `Bảng tiêu chí "${saved.title}" đã được lưu trữ an toàn và cô lập cho tài khoản ${user.email}.`
      );
    } catch (err: any) {
      console.error('Error saving rubric to firestore:', err);
      onShowToast('error', 'Lỗi lưu Firestore', err?.message || 'Không thể lưu Rubric lên đám mây.');
    } finally {
      setIsSavingCloud(false);
    }
  };

  // Criterion Editing Modal / Drawer State
  const [editingCriterion, setEditingCriterion] = useState<ArtRubricCriterion4Levels | null>(null);
  const [isNewCriterionModal, setIsNewCriterionModal] = useState(false);

  // Form fields for adding/editing a criterion
  const [critName, setCritName] = useState('');
  const [critWeight, setCritWeight] = useState(25);
  const [critL1, setCritL1] = useState('');
  const [critL2, setCritL2] = useState('');
  const [critL3, setCritL3] = useState('');
  const [critL4, setCritL4] = useState('');

  // Student Product & Process Input State
  const [studentName, setStudentName] = useState('Lê Hoàng Minh');
  const [classGroup, setClassGroup] = useState('6A1');
  const [productTitle, setProductTitle] = useState('Robot thám hiểm bảo vệ môi trường từ hộp sữa và nắp chai');
  const [teacherProcessNotes, setTeacherProcessNotes] = useState(
    'Học sinh tích cực chuẩn bị vỏ hộp sữa sạch và nắp chai từ nhà. Trong giờ thực hành, em biết dùng súng bắn keo nến an toàn, dán giữ mối ghép kiên nhẫn. Làm việc nhóm vui vẻ và chủ động hỗ trợ bạn cùng bàn thu dọn mẩu bìa thừa.'
  );

  // Image Upload State
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);

  // AI Feedback Generation State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<ArtProductFeedback | null>(null);

  // Sync state when switching rubric templates
  const handleSelectTemplate = (id: string) => {
    setSelectedRubricId(id);
    const tmpl = rubricTemplates.find(r => r.id === id);
    if (tmpl) {
      setTitle(tmpl.title);
      setGrade(tmpl.grade);
      setTopic(tmpl.topic);
      setProductType(tmpl.productType);
      setEvaluationMode(tmpl.evaluationMode);
      setCriteria(tmpl.criteria);
    }
  };

  // Image upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImagePreview(reader.result as string);
        onShowToast('success', 'Đã tải ảnh lên', `Tệp ảnh "${file.name}" đã sẵn sàng để đối chiếu tiêu chí.`);
      };
      reader.readAsDataURL(file);
    }
  };

  // Criterion Management: Add / Edit / Delete
  const handleOpenAddCriterion = () => {
    setCritName('');
    setCritWeight(25);
    setCritL1('Chưa nắm được kỹ thuật cơ bản, cần giáo viên cầm tay chỉ việc.');
    setCritL2('Thực hiện được một phần yêu cầu nhưng cấu trúc còn lỏng lẻo.');
    setCritL3('Đạt đầy đủ các yêu cầu cơ bản về kỹ thuật và hình thức.');
    setCritL4('Thể hiện vượt trội, sáng tạo cá nhân xuất sắc và hoàn thiện tinh tế.');
    setEditingCriterion(null);
    setIsNewCriterionModal(true);
  };

  const handleOpenEditCriterion = (item: ArtRubricCriterion4Levels) => {
    setEditingCriterion(item);
    setCritName(item.name);
    setCritWeight(item.weight);
    setCritL1(item.levels.needs_support);
    setCritL2(item.levels.partially_achieved);
    setCritL3(item.levels.achieved);
    setCritL4(item.levels.exceeded);
    setIsNewCriterionModal(true);
  };

  const handleSaveCriterion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!critName.trim()) {
      onShowToast('error', 'Chưa nhập tên tiêu chí', 'Vui lòng đặt tên cho tiêu chí đánh giá.');
      return;
    }

    if (editingCriterion) {
      // Edit existing
      setCriteria(prev => prev.map(c => c.id === editingCriterion.id ? {
        ...c,
        name: critName,
        weight: critWeight,
        levels: {
          needs_support: critL1,
          partially_achieved: critL2,
          achieved: critL3,
          exceeded: critL4
        }
      } : c));
      onShowToast('success', 'Đã cập nhật tiêu chí', `Đã lưu thay đổi cho tiêu chí "${critName}".`);
    } else {
      // Add new
      const newCrit: ArtRubricCriterion4Levels = {
        id: `crit-${Date.now()}`,
        name: critName,
        weight: critWeight,
        levels: {
          needs_support: critL1,
          partially_achieved: critL2,
          achieved: critL3,
          exceeded: critL4
        }
      };
      setCriteria(prev => [...prev, newCrit]);
      onShowToast('success', 'Đã thêm tiêu chí mới', `Tiêu chí "${critName}" đã được đưa vào bảng Rubric.`);
    }

    setIsNewCriterionModal(false);
  };

  const handleDeleteCriterion = (id: string, name: string) => {
    if (criteria.length <= 1) {
      onShowToast('error', 'Không thể xóa', 'Bảng Rubric cần có tối thiểu 1 tiêu chí đánh giá.');
      return;
    }
    setCriteria(prev => prev.filter(c => c.id !== id));
    onShowToast('info', 'Đã xóa tiêu chí', `Đã loại bỏ tiêu chí "${name}" khỏi bảng.`);
  };

  // Save modified rubric as a template
  const handleSaveRubricTemplate = () => {
    const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
    if (evaluationMode === 'weighted' && totalWeight !== 100) {
      onShowToast('error', 'Tổng trọng số chưa bằng 100%', `Tổng trọng số hiện tại là ${totalWeight}%. Vui lòng điều chỉnh lại.`);
      return;
    }

    const updatedTmpl: ArtRubricTemplate = {
      id: currentRubric.id.startsWith('custom-') ? currentRubric.id : `custom-${Date.now()}`,
      title,
      grade,
      topic,
      productType,
      evaluationMode,
      criteria,
      createdAt: 'Hôm nay',
      author: 'Cô Mai Phương'
    };

    setRubricTemplates(prev => {
      const exists = prev.some(t => t.id === updatedTmpl.id);
      if (exists) {
        return prev.map(t => t.id === updatedTmpl.id ? updatedTmpl : t);
      }
      return [updatedTmpl, ...prev];
    });

    onShowToast('success', 'Đã lưu mẫu Rubric', `Bảng Rubric "${title}" đã được lưu trữ thành công.`);
  };

  // Generate AI Feedback for student product
  const handleGenerateFeedback = () => {
    if (!studentName.trim() || !productTitle.trim()) {
      onShowToast('error', 'Thiếu thông tin sản phẩm', 'Vui lòng nhập tên học sinh và tên sản phẩm.');
      return;
    }

    setIsAnalyzing(true);
    setTimeout(() => {
      const feedback = generateAIPedagogicalFeedback(
        {
          ...currentRubric,
          title,
          grade,
          topic,
          productType,
          evaluationMode,
          criteria
        },
        studentName,
        classGroup,
        productTitle,
        teacherProcessNotes,
        Boolean(uploadedImagePreview),
        imageFileName || undefined
      );

      setFeedbackResult(feedback);
      setIsAnalyzing(false);
      onShowToast(
        'success',
        'Phân tích đối chiếu hoàn tất',
        'AI đã đối chiếu sản phẩm với Rubric. Giáo viên vui lòng duyệt hoặc chỉnh sửa các mức gợi ý.'
      );
    }, 1000);
  };

  // Teacher feedback item control: Accept / Override / Reject
  const handleAcceptItem = (critId: string) => {
    if (!feedbackResult) return;
    setFeedbackResult({
      ...feedbackResult,
      aiObservations: {
        ...feedbackResult.aiObservations,
        criteriaAlignment: feedbackResult.aiObservations.criteriaAlignment.map(item => 
          item.criterionId === critId ? { ...item, isAccepted: true } : item
        )
      }
    });
    onShowToast('success', 'Đã chấp thuận', 'Đã xác nhận mức gợi ý của AI cho tiêu chí này.');
  };

  const handleOverrideItem = (critId: string, level: RubricLevelKey) => {
    if (!feedbackResult) return;
    setFeedbackResult({
      ...feedbackResult,
      aiObservations: {
        ...feedbackResult.aiObservations,
        criteriaAlignment: feedbackResult.aiObservations.criteriaAlignment.map(item => 
          item.criterionId === critId ? {
            ...item,
            teacherOverrideLevel: level,
            isAccepted: true
          } : item
        )
      }
    });
    onShowToast('info', 'Đã điều chỉnh mức', `Giáo viên đã thay đổi đánh giá sang: ${LEVEL_LABELS[level]}.`);
  };

  const handleRejectItem = (critId: string) => {
    if (!feedbackResult) return;
    setFeedbackResult({
      ...feedbackResult,
      aiObservations: {
        ...feedbackResult.aiObservations,
        criteriaAlignment: feedbackResult.aiObservations.criteriaAlignment.map(item => 
          item.criterionId === critId ? { ...item, isAccepted: false } : item
        )
      }
    });
    onShowToast('info', 'Đã từ chối gợi ý', 'Đã loại bỏ đề xuất AI cho tiêu chí này.');
  };

  const handlePrintFeedbackSlip = () => {
    window.print();
  };

  const handleCopyFeedbackText = () => {
    if (!feedbackResult) return;
    const text = `
PHIẾU PHẢN HỒI ĐÁNH GIÁ SẢN PHẨM MĨ THUẬT (ARTRUBRIC)
Học sinh: ${feedbackResult.studentName} - Lớp: ${feedbackResult.classGroup}
Tác phẩm: ${feedbackResult.productTitle}
Bảng Rubric: ${title} (${grade})
Trạng thái phân tích ảnh: ${feedbackResult.imageAnalysisStatus === 'real_image_uploaded' ? 'Đã tải ảnh thực tế' : 'Dựa trên nhật ký mô tả giáo viên'}

1. ĐẶC ĐIỂM THỊ GIÁC QUAN SÁT ĐƯỢC:
${feedbackResult.aiObservations.visualFeatures.map(f => '- ' + f).join('\n')}

2. ĐỐI CHIẾU TIÊU CHÍ RUBRIC:
${feedbackResult.aiObservations.criteriaAlignment.map(c => `
- ${c.criterionName}: ${c.teacherOverrideLevel ? LEVEL_LABELS[c.teacherOverrideLevel] + ' (GV điều chỉnh)' : c.suggestedLevelLabel}
  Căn cứ: ${c.explanation}
`).join('\n')}

3. ĐIỀU CHƯA THỂ XÁC ĐỊNH QUA ẢNH PHẲNG:
${feedbackResult.aiObservations.unverifiableAspects.map(u => '- ' + u).join('\n')}

4. GỢI Ý CẢI THIỆN PHÙ HỢP LỨA TUỔI:
${feedbackResult.aiObservations.pedagogicalSuggestions.map(s => '- ' + s).join('\n')}

5. NHẬN XÉT CHUNG CỦA GIÁO VIÊN:
${feedbackResult.teacherFinalDecision.finalSummaryComment}
    `.trim();

    navigator.clipboard.writeText(text);
    onShowToast('success', 'Đã sao chép phản hồi', 'Toàn bộ nội dung đối chiếu đã được sao chép vào bộ nhớ tạm.');
  };

  const totalCalculatedWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToAssessment}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            title="Quay lại danh mục đánh giá"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" />
                ArtRubric
              </span>
              <span className="text-xs text-slate-500">Xây dựng Rubric & Hỗ trợ Phản hồi Sản phẩm</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="text-xs text-emerald-700 font-medium">4 Mức Chuẩn mực</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
              Bộ công cụ ArtRubric & Đánh giá Sản phẩm Mĩ thuật
            </h2>
          </div>
        </div>

        {/* Template Selector dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 hidden sm:inline">Mẫu có sẵn:</span>
          <select
            value={selectedRubricId}
            onChange={(e) => handleSelectTemplate(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500 shadow-xs"
          >
            {rubricTemplates.map(tmpl => (
              <option key={tmpl.id} value={tmpl.id}>
                {tmpl.title} ({tmpl.grade})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Left Column (Rubric Builder & Criteria Management) + Right Column (Product Feedback Studio) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (6 cols): Rubric Builder & Criteria */}
        <div className="lg:col-span-6 space-y-5 no-print">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Cấu hình Bảng Rubric
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveRubricTemplate}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Lưu vào phiên làm việc hiện tại"
                >
                  <Save className="w-3.5 h-3.5 text-slate-500" />
                  <span>Lưu tạm phiên</span>
                </button>

                <button
                  onClick={() => setShowCloudModal(true)}
                  disabled={isSavingCloud}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-xs transition-colors ${
                    cloudSavedId
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
                  }`}
                  title="Lưu bền vững lên cơ sở dữ liệu Cloud Firestore"
                >
                  <Cloud className={`w-3.5 h-3.5 ${isSavingCloud ? 'animate-bounce' : ''}`} />
                  <span>{isSavingCloud ? 'Đang lưu...' : cloudSavedId ? 'Đã lưu Firestore' : 'Lưu Cloud Firestore'}</span>
                </button>
              </div>
            </div>

            {/* Rubric Metadata Inputs */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Tên bảng Rubric</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Khối lớp</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-900 bg-slate-50"
                >
                  {['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5', 'Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Loại sản phẩm</label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-900 bg-slate-50"
                >
                  <option value="Hội họa 2D">Hội họa 2D / Vẽ tranh</option>
                  <option value="Mô hình 3D / Tái chế">Mô hình 3D / Vật liệu tái chế</option>
                  <option value="Thủ công xé dán">Thủ công / Xé dán / Gấp giấy</option>
                  <option value="Đất nặn / Gốm">Đất nặn / Gốm / Tò he</option>
                  <option value="In độc bản">Tranh in hoa lá / In độc bản</option>
                  <option value="Thiết kế đồ họa">Thiết kế đồ họa / Typography</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Chủ đề bài học</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              {/* Evaluation Mode toggle: Weighted vs Qualitative */}
              <div className="col-span-2 pt-1">
                <label className="block font-semibold text-slate-700 mb-1.5">Hình thức đánh giá</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setEvaluationMode('weighted')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                      evaluationMode === 'weighted' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Đặt trọng số (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvaluationMode('qualitative')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                      evaluationMode === 'qualitative' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Đánh giá định tính
                  </button>
                </div>
              </div>
            </div>

            {/* Criteria List Section */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Danh sách Tiêu chí ({criteria.length})
                  </h4>
                  {evaluationMode === 'weighted' && (
                    <span className={`text-[11px] font-mono font-medium ${
                      totalCalculatedWeight === 100 ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      Tổng trọng số: {totalCalculatedWeight}% {totalCalculatedWeight === 100 ? '✓' : '(Cần đúng 100%)'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddCriterion}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm tiêu chí</span>
                </button>
              </div>

              {/* Criteria Cards */}
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {criteria.map((crit, idx) => (
                  <div
                    key={crit.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <h5 className="font-bold text-slate-900">{crit.name}</h5>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {evaluationMode === 'weighted' && (
                          <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
                            {crit.weight}%
                          </span>
                        )}
                        <button
                          onClick={() => handleOpenEditCriterion(crit)}
                          className="p-1 text-slate-500 hover:text-purple-700 rounded hover:bg-slate-200/60"
                          title="Sửa tiêu chí"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCriterion(crit.id, crit.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                          title="Xóa tiêu chí"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 4 Levels Preview */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/80">
                      <div className="p-1.5 rounded bg-amber-50/70 border border-amber-200/60">
                        <strong className="text-amber-900 block text-[10px]">1. Cần hỗ trợ:</strong>
                        <p className="text-slate-600 line-clamp-2 mt-0.5">{crit.levels.needs_support}</p>
                      </div>
                      <div className="p-1.5 rounded bg-blue-50/70 border border-blue-200/60">
                        <strong className="text-blue-900 block text-[10px]">2. Đạt một phần:</strong>
                        <p className="text-slate-600 line-clamp-2 mt-0.5">{crit.levels.partially_achieved}</p>
                      </div>
                      <div className="p-1.5 rounded bg-indigo-50/70 border border-indigo-200/60">
                        <strong className="text-indigo-900 block text-[10px]">3. Đạt yêu cầu:</strong>
                        <p className="text-slate-600 line-clamp-2 mt-0.5">{crit.levels.achieved}</p>
                      </div>
                      <div className="p-1.5 rounded bg-emerald-50/70 border border-emerald-200/60">
                        <strong className="text-emerald-900 block text-[10px]">4. Thể hiện tốt:</strong>
                        <p className="text-slate-600 line-clamp-2 mt-0.5">{crit.levels.exceeded}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (6 cols): Student Product Input & AI Feedback Studio */}
        <div className="lg:col-span-6 space-y-5">
          {/* Student Product & Process Observation Input Form */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 no-print">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Thông tin Sản phẩm & Nhật ký Quan sát
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">Dữ liệu đối chiếu AI</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên học sinh</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lớp</label>
                <input
                  type="text"
                  value={classGroup}
                  onChange={(e) => setClassGroup(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Tên tác phẩm / sản phẩm</label>
                <input
                  type="text"
                  value={productTitle}
                  onChange={(e) => setProductTitle(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-medium"
                />
              </div>

              {/* Image Upload Area */}
              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Tải ảnh sản phẩm học sinh (Ảnh thực tế)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/30 rounded-xl cursor-pointer transition-colors text-xs text-purple-700 font-medium">
                    <Upload className="w-4 h-4" />
                    <span>{imageFileName ? `Đã chọn: ${imageFileName}` : 'Nhấn để chọn ảnh từ máy tính / điện thoại'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>

                  {uploadedImagePreview && (
                    <div className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 shrink-0 relative group">
                      <img
                        src={uploadedImagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedImagePreview(null);
                          setImageFileName(null);
                        }}
                        className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Xóa ảnh"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Teacher Process Notes */}
              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Mô tả quá trình học tập & Nhận xét của giáo viên (Nhật ký quan sát)
                </label>
                <textarea
                  rows={3}
                  value={teacherProcessNotes}
                  onChange={(e) => setTeacherProcessNotes(e.target.value)}
                  placeholder="Ghi nhận thái độ làm việc, kỹ năng cầm dụng cụ, tinh thần hợp tác và sự tiến bộ trong 90 phút thực hành..."
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900 leading-relaxed"
                />
              </div>
            </div>

            {/* Generate Feedback Button */}
            <button
              type="button"
              onClick={handleGenerateFeedback}
              disabled={isAnalyzing}
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAnalyzing ? 'Đang đối chiếu sản phẩm với Rubric...' : 'Tạo phản hồi hỗ trợ (ArtRubric AI)'}</span>
            </button>
          </div>

          {/* AI Pedagogical Feedback Output Area */}
          {feedbackResult && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs printable-area text-slate-800 space-y-5">
              {/* Header of Feedback Slip */}
              <div className="border-b pb-4 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded uppercase">
                    Phiếu phản hồi đối chiếu Rubric
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    {feedbackResult.productTitle}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Học sinh: <strong>{feedbackResult.studentName}</strong> ({feedbackResult.classGroup}) · Bảng Rubric: {title}
                  </p>
                </div>

                <div className="flex items-center gap-2 no-print">
                  <button
                    onClick={handleCopyFeedbackText}
                    className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 bg-slate-50"
                    title="Sao chép toàn bộ phiếu"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handlePrintFeedbackSlip}
                    className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 bg-slate-50"
                    title="In phiếu phản hồi"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Image Transparency Alert Badge (Mandatory Requirement) */}
              <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                feedbackResult.imageAnalysisStatus === 'real_image_uploaded'
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                <div>
                  <strong className="block font-bold">
                    {feedbackResult.imageAnalysisStatus === 'real_image_uploaded'
                      ? `Đã tiếp nhận tệp ảnh thực tế [${feedbackResult.imageFileName}]`
                      : 'Chưa có ảnh tải lên — Phân tích dựa trên mô tả sư phạm của Giáo viên'}
                  </strong>
                  <p className="mt-0.5 opacity-90 leading-relaxed">
                    {feedbackResult.imageAnalysisStatus === 'real_image_uploaded'
                      ? 'AI kết hợp phân tích các yếu tố thị giác quan sát được từ ảnh và nhật ký quá trình của giáo viên. Các đề xuất chỉ mang tính hỗ trợ, giáo viên có quyền quyết định cuối cùng.'
                      : 'Hệ thống tuyệt đối không bịa đặt việc đã quét ảnh khi chưa có tệp ảnh thật; mọi đối chiếu hoàn toàn dựa trên nhật ký và mô tả do giáo viên nhập.'}
                  </p>
                </div>
              </div>

              {/* 1. Đặc điểm quan sát được */}
              <div className="space-y-1.5 text-xs">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-600" />
                  <span>1. Đặc điểm thị giác quan sát được:</span>
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {feedbackResult.aiObservations.visualFeatures.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>

              {/* 2. Điều CHƯA THỂ XÁC ĐỊNH qua ảnh phẳng (Mandatory Limitation Notice) */}
              <div className="space-y-1.5 text-xs">
                <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span>2. Những điều chưa thể xác định qua ảnh chụp 2D (Cần GV trực tiếp kiểm tra):</span>
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-600 bg-amber-50/50 p-3 rounded-xl border border-amber-200/60">
                  {feedbackResult.aiObservations.unverifiableAspects.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>

              {/* 3. Đối chiếu từng tiêu chí Rubric & Quyền duyệt của Giáo viên */}
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    <span>3. Đối chiếu từng tiêu chí Rubric & Quyền quyết định của Giáo viên:</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 no-print">GV duyệt hoặc chỉnh sửa</span>
                </div>

                <div className="space-y-3">
                  {feedbackResult.aiObservations.criteriaAlignment.map((item) => {
                    const activeLevelKey = item.teacherOverrideLevel || item.suggestedLevel;
                    const colorStyle = LEVEL_COLORS[activeLevelKey];

                    return (
                      <div
                        key={item.criterionId}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 text-xs">
                            {item.criterionName}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}>
                              {LEVEL_LABELS[activeLevelKey]}
                            </span>
                            {item.teacherOverrideLevel && (
                              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-semibold">
                                GV đã sửa
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-slate-700 leading-relaxed text-[11px] bg-white p-2.5 rounded-lg border border-slate-100">
                          <strong>Căn cứ đối chiếu:</strong> {item.explanation}
                        </p>

                        {/* Teacher decision buttons on this criterion */}
                        <div className="pt-1.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 no-print text-[11px]">
                          <span className="text-slate-500 font-medium">Quyết định của GV:</span>
                          
                          <div className="flex items-center gap-1.5">
                            {/* Override dropdown */}
                            <select
                              value={activeLevelKey}
                              onChange={(e) => handleOverrideItem(item.criterionId, e.target.value as RubricLevelKey)}
                              className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-800 font-medium"
                            >
                              <option value="needs_support">Cần hỗ trợ (Mức 1)</option>
                              <option value="partially_achieved">Đạt một phần (Mức 2)</option>
                              <option value="achieved">Đạt yêu cầu (Mức 3)</option>
                              <option value="exceeded">Thể hiện tốt (Mức 4)</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleAcceptItem(item.criterionId)}
                              className={`px-2.5 py-1 rounded font-semibold transition-colors flex items-center gap-1 ${
                                item.isAccepted === true
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              <span>Chấp nhận</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRejectItem(item.criterionId)}
                              className={`px-2.5 py-1 rounded font-semibold transition-colors flex items-center gap-1 ${
                                item.isAccepted === false
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                              }`}
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Từ chối</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Gợi ý cải thiện phù hợp lứa tuổi */}
              <div className="space-y-1.5 text-xs">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-600" />
                  <span>4. Lời nhận xét khích lệ & Gợi ý cải thiện phù hợp lứa tuổi:</span>
                </h4>
                <div className="space-y-1.5 bg-blue-50/50 p-3 rounded-xl border border-blue-200/60 text-slate-700 text-xs">
                  {feedbackResult.aiObservations.pedagogicalSuggestions.map((sug, i) => (
                    <p key={i} className="italic leading-relaxed">{sug}</p>
                  ))}
                </div>
              </div>

              {/* 5. Cam kết đạo đức sư phạm */}
              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 space-y-0.5">
                {feedbackResult.aiObservations.ethicalGuarantees.map((g, i) => (
                  <p key={i}>{g}</p>
                ))}
              </div>

              {/* Final Teacher Sign-off */}
              <div className="pt-6 border-t border-slate-300 flex items-center justify-between text-xs text-center text-slate-700">
                <div>
                  <p className="font-semibold">Học sinh xác nhận</p>
                  <p className="text-[11px] text-slate-400 mt-8">(Ký tên)</p>
                </div>
                <div>
                  <p className="text-slate-500">Ngày 28 tháng 10 năm 2026</p>
                  <p className="font-bold mt-0.5">GIÁO VIÊN BỘ MÔN</p>
                  <p className="text-purple-700 font-bold mt-7">Cô Mai Phương</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Add / Edit Criterion */}
      {isNewCriterionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingCriterion ? 'Sửa Tiêu chí Đánh giá' : 'Thêm Tiêu chí Rubric Mới'}
              </h3>
              <button
                onClick={() => setIsNewCriterionModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCriterion} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tên tiêu chí <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={critName}
                    onChange={(e) => setCritName(e.target.value)}
                    placeholder="VD: Kỹ thuật xử lý vật liệu & Độ bền"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Trọng số (%)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={critWeight}
                    onChange={(e) => setCritWeight(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* 4 Levels Input Fields */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-slate-900 border-b pb-1 border-slate-100">
                  Mô tả cụ thể 4 mức biểu hiện chuẩn mực:
                </h4>

                <div>
                  <label className="block font-medium text-amber-900 mb-1">
                    Mức 1: Cần hỗ trợ (Needs Support)
                  </label>
                  <textarea
                    rows={2}
                    value={critL1}
                    onChange={(e) => setCritL1(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-blue-900 mb-1">
                    Mức 2: Đạt một phần (Partially Achieved)
                  </label>
                  <textarea
                    rows={2}
                    value={critL2}
                    onChange={(e) => setCritL2(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-indigo-900 mb-1">
                    Mức 3: Đạt yêu cầu (Achieved)
                  </label>
                  <textarea
                    rows={2}
                    value={critL3}
                    onChange={(e) => setCritL3(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-emerald-900 mb-1">
                    Mức 4: Thể hiện tốt (Exceeded / Well-Demonstrated)
                  </label>
                  <textarea
                    rows={2}
                    value={critL4}
                    onChange={(e) => setCritL4(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCriterionModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs"
                >
                  Lưu tiêu chí
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cloud Rubric Confirmation Modal */}
      {showCloudModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Xác nhận lưu Rubric lên Cloud Firestore
                </h3>
                <p className="text-xs text-slate-500">
                  Lưu trữ tiêu chí đánh giá chuẩn 4 mức bền vững
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Tên Rubric:</span>
                <span className="font-semibold text-slate-900 text-right">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Khối & Chế độ:</span>
                <span className="font-semibold">{grade} · {evaluationMode === 'weighted' ? 'Trọng số %' : 'Định tính'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số lượng tiêu chí:</span>
                <span className="font-semibold text-purple-700">{criteria.length} tiêu chí (4 mức độ)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tài khoản lưu:</span>
                <span className="font-semibold text-blue-600">{user?.email || 'Chưa đăng nhập'}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 leading-relaxed flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Cô lập an toàn: Chỉ tài khoản của bạn mới có quyền chỉnh sửa Rubric này.</span>
              </div>
            </div>

            {!user && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                Bạn cần đăng nhập Google để lưu trữ Rubric vào Cloud Firestore. Nhấn xác nhận sẽ mở cửa sổ đăng nhập an toàn.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloudModal(false)}
                disabled={isSavingCloud}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmCloudSaveRubric}
                disabled={isSavingCloud}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs transition-colors"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{isSavingCloud ? 'Đang ghi dữ liệu...' : user ? 'Xác nhận Lưu Rubric' : 'Đăng nhập & Lưu'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

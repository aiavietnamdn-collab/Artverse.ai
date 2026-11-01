import React, { useState } from 'react';
import { StudentArtwork, SchoolLevel } from '../../types/artverse';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import { EmptyState } from '../common/EmptyState';
import { ArtRubricWorkspace } from './ArtRubricWorkspace';
import { 
  Palette, 
  Search, 
  Sparkles, 
  FileCheck, 
  Printer, 
  X, 
  ChevronRight, 
  Plus,
  Sliders,
  CheckCircle2,
  Info
} from 'lucide-react';

interface AssessmentViewProps {
  artworks: StudentArtwork[];
  schoolLevel: SchoolLevel;
  selectedArtwork: StudentArtwork | null;
  onSelectArtwork: (artwork: StudentArtwork) => void;
  onUpdateArtwork: (updated: StudentArtwork) => void;
  isEmpty: boolean;
  onResetData: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const AssessmentView: React.FC<AssessmentViewProps> = ({
  artworks,
  schoolLevel,
  selectedArtwork,
  onSelectArtwork,
  onUpdateArtwork,
  isEmpty,
  onResetData,
  onShowToast
}) => {
  const [assessmentSubTab, setAssessmentSubTab] = useState<'artrubric' | 'standard'>('artrubric');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'rubric' | 'feedback' | 'slip'>('rubric');
  const [isExportSlipModal, setIsExportSlipModal] = useState(false);

  // Active artwork being assessed (default to selected or first item)
  const currentArt = selectedArtwork || (artworks.length > 0 ? artworks[0] : null);

  // Rubric local editable state
  const [lineScore, setLineScore] = useState<number>(currentArt?.rubricScores.lineShape || 8.5);
  const [colorScore, setColorScore] = useState<number>(currentArt?.rubricScores.colorValue || 9.0);
  const [compScore, setCompScore] = useState<number>(currentArt?.rubricScores.composition || 8.5);
  const [creatScore, setCreatScore] = useState<number>(currentArt?.rubricScores.creativity || 9.0);
  const [exprScore, setExprScore] = useState<number>(currentArt?.rubricScores.expression || 9.0);
  const [feedbackText, setFeedbackText] = useState<string>(currentArt?.teacherFeedback || '');
  const [suggestionText, setSuggestionText] = useState<string>(currentArt?.pedagogicalSuggestion || '');

  // Keep in sync when switching artwork
  React.useEffect(() => {
    if (currentArt) {
      setLineScore(currentArt.rubricScores.lineShape);
      setColorScore(currentArt.rubricScores.colorValue);
      setCompScore(currentArt.rubricScores.composition);
      setCreatScore(currentArt.rubricScores.creativity);
      setExprScore(currentArt.rubricScores.expression);
      setFeedbackText(currentArt.teacherFeedback);
      setSuggestionText(currentArt.pedagogicalSuggestion);
    }
  }, [currentArt?.id]);

  // Compute calculated average score
  const computedAverage = Number(((lineScore + colorScore + compScore + creatScore + exprScore) / 5).toFixed(1));
  const computedRating: 'excellent' | 'proficient' | 'developing' = 
    computedAverage >= 8.5 ? 'excellent' : computedAverage >= 6.5 ? 'proficient' : 'developing';

  // Quick pedagogical comments presets (Thông tư 27 & 22)
  const COMMENT_PRESETS = [
    'Bài vẽ giàu cảm xúc, đường nét tự tin, phối hợp hòa sắc ấm lạnh rất nhịp nhàng và có chiều sâu.',
    'Bố cục cân đối, hình mảng chính phụ rõ ràng. Biết tạo điểm nhấn tương phản ấn tượng cho tác phẩm.',
    'Em rất sáng tạo trong cách thử nghiệm chất liệu và hoa văn dân gian. Tinh thần học tập chủ động.',
    'Hình thể con vật/nhân vật rất ngộ nghĩnh và sinh động. Nét vẽ tự nhiên, không bị gò bó khuôn mẫu.',
    'Bài làm chăm chỉ, đạt yêu cầu kỹ thuật cơ bản. Em hãy mạnh dạn dùng màu đậm hơn để tạo độ nổi bật.'
  ];

  const handleApplyPreset = (comment: string) => {
    setFeedbackText(comment);
    onShowToast('info', 'Đã áp dụng mẫu nhận xét', 'Đã chèn câu nhận xét sư phạm chuẩn Thông tư vào phiếu.');
  };

  const handleSaveAssessment = () => {
    if (!currentArt) return;

    const updated: StudentArtwork = {
      ...currentArt,
      rubricScores: {
        lineShape: lineScore,
        colorValue: colorScore,
        composition: compScore,
        creativity: creatScore,
        expression: exprScore
      },
      totalScore: computedAverage,
      ratingLevel: computedRating,
      teacherFeedback: feedbackText,
      pedagogicalSuggestion: suggestionText
    };

    onUpdateArtwork(updated);
    onShowToast(
      'success',
      'Đã lưu kết quả đánh giá!',
      `Đã cập nhật phiếu đánh giá cho học sinh ${updated.studentName} (${computedAverage}đ - ${computedRating === 'excellent' ? 'Hoàn thành tốt' : computedRating === 'proficient' ? 'Hoàn thành' : 'Cần cố gắng'}).`
    );
  };

  const handlePrintSlip = () => {
    window.print();
  };

  if (isEmpty) {
    return (
      <div className="py-8">
        <EmptyState
          title="Chưa có bài vẽ nào để đánh giá"
          description="Hiện chưa có sản phẩm mĩ thuật nào được tải lên hoặc danh sách đang trống. Bạn có thể nạp lại dữ liệu mẫu để thử nghiệm bộ tiêu chí Rubric."
          actionText="Nạp lại dữ liệu bài vẽ mẫu"
          onAction={onResetData}
        />
      </div>
    );
  }

  // Filter artworks
  const filtered = artworks.filter((a) => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || a.classGroup === selectedClass;
    const matchesLevel = schoolLevel === 'all' ||
      (schoolLevel === 'primary' ? (a.classGroup.startsWith('4') || a.classGroup.startsWith('5')) : (a.classGroup.startsWith('6') || a.classGroup.startsWith('7')));
    
    return matchesSearch && matchesClass && matchesLevel;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Subtab Switcher: ArtRubric vs Standard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 no-print">
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl w-fit">
          <button
            onClick={() => setAssessmentSubTab('artrubric')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              assessmentSubTab === 'artrubric'
                ? 'bg-white text-purple-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-purple-600" />
            <span>ArtRubric — Xây dựng Rubric & AI Phản hồi</span>
          </button>
          <button
            onClick={() => setAssessmentSubTab('standard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              assessmentSubTab === 'standard'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-blue-600" />
            <span>Chấm điểm trực quan ({filtered.length} bài)</span>
          </button>
        </div>
      </div>

      {assessmentSubTab === 'artrubric' ? (
        <ArtRubricWorkspace
          onBackToAssessment={() => setAssessmentSubTab('standard')}
          onShowToast={onShowToast}
        />
      ) : (
        <div className="space-y-6">
          {/* Header bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                  Thông tư 27 & 22
                </span>
                <span className="text-xs text-slate-500">Đánh giá theo Năng lực Mĩ thuật</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-xs text-slate-400 font-mono tabular-nums">{filtered.length} bài nộp</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
                Đánh giá Sản phẩm Mĩ thuật & Rubric Tiêu chí
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Đánh giá đa chiều 5 tiêu chuẩn: Đường nét · Màu sắc · Bố cục · Sáng tạo · Biểu cảm
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExportSlipModal(true)}
                disabled={!currentArt}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Xuất phiếu nhận xét</span>
              </button>
              
              <button
                onClick={handleSaveAssessment}
                disabled={!currentArt}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl shadow-xs transition-colors"
              >
                <FileCheck className="w-4 h-4" />
                <span>Lưu đánh giá</span>
              </button>
            </div>
          </div>

      {/* Main Split Layout: Left Artwork Selector (1 col) + Right Rubric Workbench (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (4 cols on lg): Artworks List & Filter */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên học sinh, tác phẩm..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto text-xs pb-1">
              <button
                onClick={() => setSelectedClass('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  selectedClass === 'all' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Tất cả lớp
              </button>
              {['6A1', '7B2', '4A3'].map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedClass(c)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    selectedClass === c ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Lớp {c}
                </button>
              ))}
            </div>
          </div>

          {/* Artwork Cards Vertical Scroll */}
          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {filtered.map((art) => {
              const isSelected = currentArt?.id === art.id;
              return (
                <div
                  key={art.id}
                  onClick={() => onSelectArtwork(art)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-50/80 border-purple-400 shadow-xs ring-1 ring-purple-400'
                      : 'bg-white border-slate-200 hover:border-purple-200 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-16 shrink-0 rounded-lg overflow-hidden">
                      <ArtCanvasVisual
                        type={art.visualType}
                        title={art.title}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-900 truncate">{art.studentName}</span>
                        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                          {art.classGroup}
                        </span>
                      </div>
                      <h4 className="text-xs text-slate-600 truncate mt-0.5">{art.title}</h4>
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className="text-slate-400 truncate">{art.medium}</span>
                        <span className="font-mono font-bold text-purple-700 tabular-nums">
                          {art.totalScore.toFixed(1)} đ
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (7 cols on lg): Active Rubric Workbench */}
        {currentArt ? (
          <div className="lg:col-span-7 space-y-4">
            {/* Artwork Focus Showcase Card */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="sm:w-52 shrink-0">
                  <ArtCanvasVisual
                    type={currentArt.visualType}
                    title={currentArt.title}
                    className="h-36 sm:h-44 w-full"
                  />
                  <div className="mt-2 text-center">
                    <span className="text-[11px] text-slate-400">
                      Ngày nộp: {currentArt.dateSubmitted}
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-900 text-base">{currentArt.title}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>Tác giả: <strong className="text-slate-800">{currentArt.studentName}</strong></span>
                    <span aria-hidden="true">·</span>
                    <span>Lớp: <strong className="text-slate-800">{currentArt.classGroup}</strong></span>
                    <span aria-hidden="true">·</span>
                    <span>Chất liệu: <strong className="text-slate-800">{currentArt.medium}</strong></span>
                  </div>

                  {/* Rating & Computed score summary */}
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-center flex-1">
                      <span className="text-[10px] text-purple-700 font-semibold block uppercase">Điểm tổng hợp</span>
                      <span className="text-2xl font-bold font-mono text-purple-900 tabular-nums">
                        {computedAverage.toFixed(1)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center flex-1">
                      <span className="text-[10px] text-emerald-700 font-semibold block uppercase">Xếp loại Thông tư</span>
                      <span className="text-sm font-bold text-emerald-900 block mt-1">
                        {computedRating === 'excellent' ? 'Hoàn thành tốt (T)' : computedRating === 'proficient' ? 'Hoàn thành (H)' : 'Cần cố gắng (C)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rubric Criteria Sliders */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    5 Tiêu chí Rubric Đánh giá Mĩ thuật
                  </h3>
                </div>
                <span className="text-xs text-slate-400">Thang điểm 1 - 10</span>
              </div>

              {/* Slider 1: Đường nét & hình khối */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">1. Đường nét & Hình khối</span>
                  <span className="font-mono font-bold text-purple-700 tabular-nums">{lineScore.toFixed(1)} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={lineScore}
                  onChange={(e) => setLineScore(parseFloat(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500">Độ chắc khỏe, nhịp điệu nét và tỉ lệ hình thể nhân vật/vật thể.</p>
              </div>

              {/* Slider 2: Màu sắc & sắc độ */}
              <div className="space-y-1 text-xs pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">2. Màu sắc & Sắc độ (Hòa sắc)</span>
                  <span className="font-mono font-bold text-purple-700 tabular-nums">{colorScore.toFixed(1)} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={colorScore}
                  onChange={(e) => setColorScore(parseFloat(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500">Tương phản nóng - lạnh, độ đậm nhạt và cảm giác hòa hợp của gam màu.</p>
              </div>

              {/* Slider 3: Bố cục & không gian */}
              <div className="space-y-1 text-xs pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">3. Bố cục & Chiều sâu không gian</span>
                  <span className="font-mono font-bold text-purple-700 tabular-nums">{compScore.toFixed(1)} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={compScore}
                  onChange={(e) => setCompScore(parseFloat(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500">Mảng chính - mảng phụ, trọng tâm thị giác và luật xa gần thấu thị.</p>
              </div>

              {/* Slider 4: Tính sáng tạo */}
              <div className="space-y-1 text-xs pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">4. Tính sáng tạo & Độc đáo</span>
                  <span className="font-mono font-bold text-purple-700 tabular-nums">{creatScore.toFixed(1)} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={creatScore}
                  onChange={(e) => setCreatScore(parseFloat(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500">Ý tưởng bất ngờ, tìm tòi phong cách thể hiện và cá tính riêng.</p>
              </div>

              {/* Slider 5: Biểu đạt & cảm xúc */}
              <div className="space-y-1 text-xs pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">5. Tinh thần & Cảm xúc thẩm mĩ</span>
                  <span className="font-mono font-bold text-purple-700 tabular-nums">{exprScore.toFixed(1)} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={exprScore}
                  onChange={(e) => setExprScore(parseFloat(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500">Thông điệp muốn truyền tải, sự tâm huyết và tình yêu dành cho tác phẩm.</p>
              </div>
            </div>

            {/* Pedagogical Comments & Teacher Feedback Box */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Lời nhận xét Sư phạm khích lệ (Chuẩn Thông tư)
                  </h3>
                </div>
              </div>

              {/* Presets quick tags */}
              <div className="flex flex-wrap gap-1.5">
                {COMMENT_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="text-[11px] text-slate-600 hover:text-purple-700 bg-slate-50 hover:bg-purple-50 p-1.5 rounded-lg border border-slate-200 hover:border-purple-200 transition-colors text-left truncate max-w-xs"
                    title={preset}
                  >
                    + Mẫu {idx + 1}: {preset.slice(0, 32)}...
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nhận xét quá trình và sản phẩm:
                </label>
                <textarea
                  rows={3}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Viết nhận xét khích lệ học sinh..."
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gợi ý hướng phát triển tiếp theo cho học sinh:
                </label>
                <input
                  type="text"
                  value={suggestionText}
                  onChange={(e) => setSuggestionText(e.target.value)}
                  placeholder="VD: Em có thể thử nhấn thêm bóng phản chiếu trên mặt nước..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-900"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
        </div>
      )}

      {/* MODAL: Printable Assessment Slip */}
      {isExportSlipModal && currentArt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between no-print">
              <h3 className="text-sm font-bold text-slate-900">Phiếu Đánh giá Sản phẩm Mĩ thuật</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintSlip}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In phiếu ngay</span>
                </button>
                <button
                  onClick={() => setIsExportSlipModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Slip Content */}
            <div className="p-8 overflow-y-auto printable-area text-slate-900 space-y-6">
              <div className="text-center border-b pb-4 border-slate-300">
                <p className="text-xs uppercase font-medium text-slate-500">Bộ Giáo Dục và Đào Tạo · Môn Mĩ Thuật GDPT 2018</p>
                <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900 mt-1">
                  Phiếu Nhận Xét & Đánh Giá Sản Phẩm Mĩ Thuật
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Đánh giá thường xuyên theo Thông tư 27/2020/TT-BGDĐT & Thông tư 22/2021/TT-BGDĐT
                </p>
              </div>

              {/* Student info grid */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p>Học sinh: <strong className="text-slate-900">{currentArt.studentName}</strong></p>
                  <p className="mt-1">Lớp: <strong className="text-slate-900">{currentArt.classGroup}</strong></p>
                </div>
                <div>
                  <p>Tên tác phẩm: <strong className="text-slate-900">{currentArt.title}</strong></p>
                  <p className="mt-1">Chất liệu: <strong className="text-slate-900">{currentArt.medium}</strong></p>
                </div>
              </div>

              {/* Rubric scores table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Bảng Điểm Tiêu Chí Năng Lực (Rubric)
                </h4>
                <table className="w-full text-xs border border-slate-200 text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2 border-b border-r border-slate-200">Tiêu chí đánh giá</th>
                      <th className="p-2 border-b border-slate-200 text-center w-24">Điểm số</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2 border-r border-slate-200">1. Đường nét & Hình khối (Độ chắc chắn, tỉ lệ, nhịp điệu)</td>
                      <td className="p-2 text-center font-mono font-bold tabular-nums">{lineScore.toFixed(1)} / 10</td>
                    </tr>
                    <tr>
                      <td className="p-2 border-r border-slate-200">2. Màu sắc & Sắc độ (Hòa sắc, tương phản, độ chuyển màu)</td>
                      <td className="p-2 text-center font-mono font-bold tabular-nums">{colorScore.toFixed(1)} / 10</td>
                    </tr>
                    <tr>
                      <td className="p-2 border-r border-slate-200">3. Bố cục & Không gian (Mảng chính phụ, luật xa gần)</td>
                      <td className="p-2 text-center font-mono font-bold tabular-nums">{compScore.toFixed(1)} / 10</td>
                    </tr>
                    <tr>
                      <td className="p-2 border-r border-slate-200">4. Tính sáng tạo & Phong cách riêng</td>
                      <td className="p-2 text-center font-mono font-bold tabular-nums">{creatScore.toFixed(1)} / 10</td>
                    </tr>
                    <tr>
                      <td className="p-2 border-r border-slate-200">5. Biểu đạt cảm xúc & Tinh thần làm việc</td>
                      <td className="p-2 text-center font-mono font-bold tabular-nums">{exprScore.toFixed(1)} / 10</td>
                    </tr>
                    <tr className="bg-purple-50/50 font-bold text-purple-950">
                      <td className="p-2.5 border-r border-slate-200">ĐIỂM TRUNG BÌNH & XẾP LOẠI</td>
                      <td className="p-2.5 text-center font-mono text-sm tabular-nums">
                        {computedAverage.toFixed(1)} đ ({computedRating === 'excellent' ? 'HTT' : computedRating === 'proficient' ? 'HT' : 'CHT'})
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Teacher remarks */}
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <strong className="text-slate-900 block mb-1">Nhận xét của giáo viên:</strong>
                  <p className="text-slate-700 italic">"{feedbackText}"</p>
                </div>

                {suggestionText && (
                  <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200">
                    <strong className="text-blue-900 block mb-1">Gợi ý phát triển tiếp theo:</strong>
                    <p className="text-slate-700 italic">"{suggestionText}"</p>
                  </div>
                )}
              </div>

              {/* Signatures */}
              <div className="pt-6 flex items-center justify-between text-xs text-center text-slate-700">
                <div>
                  <p className="font-semibold">Học sinh xác nhận</p>
                  <p className="text-[11px] text-slate-400 mt-10">(Ký và ghi rõ họ tên)</p>
                </div>
                <div>
                  <p className="text-slate-500">Ngày 27 tháng 10 năm 2026</p>
                  <p className="font-semibold mt-1">Giáo viên Mĩ thuật</p>
                  <p className="text-purple-700 font-bold mt-8">Cô Mai Phương</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end no-print">
              <button
                onClick={() => setIsExportSlipModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

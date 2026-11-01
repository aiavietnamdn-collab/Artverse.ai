import React from 'react';
import { ScreenTab, SchoolLevel, StudentArtwork, LessonPlan } from '../../types/artverse';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import { EmptyState } from '../common/EmptyState';
import { 
  BookOpen, 
  Palette, 
  Users, 
  Sparkles, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  Star, 
  Layers,
  Clock,
  Compass
} from 'lucide-react';

interface DashboardViewProps {
  schoolLevel: SchoolLevel;
  onNavigateTab: (tab: ScreenTab) => void;
  artworks: StudentArtwork[];
  lessonPlans: LessonPlan[];
  isEmpty: boolean;
  onResetData: () => void;
  onSelectArtwork: (artwork: StudentArtwork) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  schoolLevel,
  onNavigateTab,
  artworks,
  lessonPlans,
  isEmpty,
  onResetData,
  onSelectArtwork
}) => {
  if (isEmpty) {
    return (
      <div className="py-8">
        <EmptyState
          title="Chưa có dữ liệu bài học hoặc bài vẽ"
          description="Hiện chưa có giáo án và bài vẽ nào trong hệ thống. Bạn có thể bật lại chế độ dữ liệu mẫu hoặc bắt đầu soạn bài mới ngay."
          actionText="Nạp lại dữ liệu mẫu minh họa"
          onAction={onResetData}
        />
      </div>
    );
  }

  // Filter artworks & lessons by level if selected
  const filteredLessons = schoolLevel === 'all' 
    ? lessonPlans 
    : lessonPlans.filter(lp => lp.level === schoolLevel);

  const filteredArtworks = schoolLevel === 'all'
    ? artworks
    : schoolLevel === 'primary'
      ? artworks.filter(a => a.classGroup.startsWith('4') || a.classGroup.startsWith('5'))
      : artworks.filter(a => a.classGroup.startsWith('6') || a.classGroup.startsWith('7') || a.classGroup.startsWith('8'));

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Editorial Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white p-6 md:p-8 shadow-sm">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-200 uppercase tracking-wider mb-2">
            <span>Hệ sinh thái dạy học Mĩ thuật thông minh</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-300">[Dữ liệu minh họa GDPT 2018]</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white text-balance leading-tight">
            Chào mừng Thầy Cô đến với ARTVERSE AI
          </h2>
          <p className="mt-2.5 text-sm md:text-base text-blue-100/90 leading-relaxed max-w-2xl">
            Công cụ đồng hành toàn diện giúp giáo viên Mĩ thuật thiết kế kế hoạch bài dạy 5 bước, đánh giá năng lực thẩm mĩ đa chiều và quản lý hồ sơ học tập học sinh chuyên nghiệp.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3 pt-2 border-t border-white/15 text-xs text-blue-200">
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-amber-300" />
              Năm học 2026 - 2027 (Học kỳ I)
            </span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span>Khối phụ trách: 4, 6, 7</span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span className="text-amber-200">Chuẩn hóa theo Thông tư 27 & 22 Bộ GD&ĐT</span>
          </div>
        </div>
      </div>

      {/* Metrics Row (4 Tabular KPI Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 md:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Giáo án GDPT 2018</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {lessonPlans.length}
            </span>
            <span className="text-xs text-emerald-600 font-medium">Đã số hóa</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Bám sát tiến trình 5 bước</p>
        </div>

        <div className="bg-white rounded-xl p-4 md:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Bài vẽ đã nhận xét</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Palette className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-slate-900 font-mono tabular-nums">
              142
            </span>
            <span className="text-xs text-purple-600 font-medium">Phiếu Rubric</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">5 tiêu chí thẩm mĩ</p>
        </div>

        <div className="bg-white rounded-xl p-4 md:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Học sinh theo dõi</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-slate-900 font-mono tabular-nums">
              218
            </span>
            <span className="text-xs text-emerald-600 font-medium">6 Lớp học</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Hồ sơ cá nhân hóa</p>
        </div>

        <div className="bg-white rounded-xl p-4 md:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Kho di sản học liệu</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-slate-900 font-mono tabular-nums">
              45
            </span>
            <span className="text-xs text-amber-600 font-medium">Tư liệu chuẩn</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Tranh dân gian & danh họa</p>
        </div>
      </div>

      {/* Main Grid: Teaching Schedule + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Teaching Calendar & Recent Artworks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section: Lịch giảng dạy tuần này */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Lịch giảng dạy Mĩ thuật tuần này
                </h3>
              </div>
              <span className="text-xs text-slate-400">Tuần 8 · Tháng 10</span>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              <div className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 text-center py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold leading-tight">
                    Thứ 2
                    <span className="block text-[10px] font-normal text-blue-600">Tiết 2</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900">Mĩ thuật 6A1 · THCS</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Bài: Sắc màu và không gian trong tranh phong cảnh (Tiết 1)</p>
                  </div>
                </div>
                <button 
                  onClick={() => onNavigateTab('lesson-plan')}
                  className="px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 bg-blue-50 rounded-md transition-colors shrink-0"
                >
                  Xem bài dạy
                </button>
              </div>

              <div className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 text-center py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold leading-tight">
                    Thứ 3
                    <span className="block text-[10px] font-normal text-purple-600">Tiết 3</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900">Mĩ thuật 7B2 · THCS</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Bài: Biểu cảm màu sắc sơn mài Việt Nam (Tiết 2 - Thực hành)</p>
                  </div>
                </div>
                <button 
                  onClick={() => onNavigateTab('assessment')}
                  className="px-2.5 py-1 text-[11px] font-medium text-purple-600 hover:text-purple-800 bg-purple-50 rounded-md transition-colors shrink-0"
                >
                  Chuẩn bị chấm
                </button>
              </div>

              <div className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 text-center py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold leading-tight">
                    Thứ 5
                    <span className="block text-[10px] font-normal text-amber-600">Tiết 1</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900">Mĩ thuật 4A3 · Tiểu học</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Bài: Tạo dáng con vật từ đất nặn dân gian</p>
                  </div>
                </div>
                <button 
                  onClick={() => onNavigateTab('library')}
                  className="px-2.5 py-1 text-[11px] font-medium text-amber-600 hover:text-amber-800 bg-amber-50 rounded-md transition-colors shrink-0"
                >
                  Mở tư liệu tò he
                </button>
              </div>
            </div>
          </div>

          {/* Section: Bài vẽ vừa đánh giá gần đây */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Tác phẩm học sinh vừa đánh giá
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('assessment')}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium inline-flex items-center gap-1"
              >
                <span>Xem tất cả ({filteredArtworks.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {filteredArtworks.slice(0, 4).map((artwork) => (
                <div
                  key={artwork.id}
                  onClick={() => {
                    onSelectArtwork(artwork);
                    onNavigateTab('assessment');
                  }}
                  className="group cursor-pointer rounded-xl border border-slate-200 hover:border-purple-300 bg-white p-3 transition-all hover:shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <ArtCanvasVisual
                      type={artwork.visualType}
                      title={artwork.title}
                      className="h-28 w-full"
                    />
                    <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-slate-800 truncate">{artwork.studentName}</span>
                      <span className="text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                        Lớp {artwork.classGroup}
                      </span>
                    </div>
                    <h4 className="text-xs font-medium text-slate-700 truncate mt-1">
                      {artwork.title}
                    </h4>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                      {artwork.ratingLevel === 'excellent' ? 'Hoàn thành tốt (T)' : artwork.ratingLevel === 'proficient' ? 'Hoàn thành (H)' : 'Cần cố gắng (C)'}
                    </span>
                    <span className="font-mono font-bold text-slate-800 tabular-nums">
                      {artwork.totalScore.toFixed(1)} đ
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Quick Workflows & Art Heritage Spotlight */}
        <div className="space-y-6">
          {/* Quick Action Hub */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-3">
              Thao tác nhanh cho Giáo viên
            </h3>
            
            <div className="space-y-2.5">
              <button
                onClick={() => onNavigateTab('lesson-plan')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-purple-200 bg-purple-50/40 hover:border-purple-400 hover:bg-purple-50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-purple-700 flex items-center gap-1.5">
                      <span>ArtPlan — Trợ lý thiết kế bài học</span>
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-semibold">AI Mới</span>
                    </div>
                    <div className="text-[11px] text-slate-500">Tạo giáo án 5 bước, câu hỏi & rubric theo căn cứ GV</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => onNavigateTab('assessment')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 group-hover:text-purple-700">
                      Chấm bài vẽ & Tạo Rubric
                    </div>
                    <div className="text-[11px] text-slate-500">Gợi ý nhận xét sư phạm chuẩn TT27/22</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => onNavigateTab('report')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700">
                      Báo cáo năng lực cuối kỳ
                    </div>
                    <div className="text-[11px] text-slate-500">Xuất biểu mẫu gửi Ban Giám Hiệu</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => onNavigateTab('library')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 group-hover:text-amber-700">
                      Kho tư liệu Mĩ thuật Việt Nam
                    </div>
                    <div className="text-[11px] text-slate-500">Tranh Đông Hồ, Hàng Trống, Sơn mài</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

          {/* Art Heritage Spotlight */}
          <div className="rounded-xl border border-amber-300 bg-gradient-to-br from-[#FDF8EE] to-[#FAF2DF] p-5 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">
              <Star className="w-3.5 h-3.5 fill-amber-600 text-amber-600" />
              <span>Góc Di sản Mĩ thuật Dân gian</span>
            </div>
            
            <ArtCanvasVisual
              type="dongho"
              title="Gà Đại Cát - Tranh Đông Hồ"
              badgeText="Di sản văn hóa"
              className="h-36 w-full my-3"
            />

            <h4 className="text-sm font-bold text-slate-900">
              Tranh khắc gỗ dân gian Đông Hồ
            </h4>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Kỹ thuật in trên giấy dó quét bột vỏ điệp óng ánh. Hình tượng con gà mang ý nghĩa chúc phúc, đại cát đại lợi, phù hợp giảng dạy chủ đề Mỹ thuật truyền thống lớp 5 và lớp 6.
            </p>

            <button
              onClick={() => onNavigateTab('library')}
              className="mt-3.5 w-full py-2 px-3 text-xs font-semibold text-amber-900 bg-amber-200/80 hover:bg-amber-300 rounded-lg transition-colors text-center"
            >
              Mở chuyên đề bài giảng Đông Hồ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

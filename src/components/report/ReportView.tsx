import React, { useState } from 'react';
import { SchoolLevel } from '../../types/artverse';
import { EmptyState } from '../common/EmptyState';
import { 
  BarChart3, 
  Download, 
  Printer, 
  Sparkles, 
  CheckCircle2, 
  Award, 
  AlertCircle, 
  FileText,
  X,
  Users,
  ChevronDown
} from 'lucide-react';

interface ReportViewProps {
  schoolLevel: SchoolLevel;
  isEmpty: boolean;
  onResetData: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
  schoolLevel,
  isEmpty,
  onResetData,
  onShowToast
}) => {
  const [selectedTerm, setSelectedTerm] = useState('Học kỳ I');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [isExportReportModal, setIsExportReportModal] = useState(false);

  const handleExportExcel = () => {
    onShowToast('success', 'Đã xuất dữ liệu Excel', 'Tập tin tổng hợp điểm đánh giá GDPT 2018 đã được tải xuống.');
  };

  const handlePrintReport = () => {
    window.print();
  };

  if (isEmpty) {
    return (
      <div className="py-8">
        <EmptyState
          title="Chưa có dữ liệu báo cáo"
          description="Chưa có đủ số liệu đánh giá để tổng hợp báo cáo tiến bộ. Bạn có thể bật lại dữ liệu mẫu minh họa để xem biểu đồ năng lực."
          actionText="Nạp lại dữ liệu báo cáo mẫu"
          onAction={onResetData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              Báo cáo Sư phạm
            </span>
            <span className="text-xs text-slate-500">Chuẩn hóa Thông tư 27 & 22</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-xs text-slate-400 font-mono tabular-nums">218 học sinh tổng kết</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            Báo cáo Tiến bộ & Năng lực Thẩm mĩ
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tổng hợp kết quả rèn luyện 3 năng lực đặc thù và phân phối xếp loại gửi Ban Giám Hiệu nhà trường.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Xuất file Excel</span>
          </button>
          
          <button
            onClick={() => setIsExportReportModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Xem & In báo cáo BGH</span>
          </button>
        </div>
      </div>

      {/* Filter and Period Selection Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">Kỳ đánh giá:</span>
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-blue-500 bg-slate-50"
          >
            <option value="Giữa Học kỳ I">Giữa Học kỳ I</option>
            <option value="Học kỳ I">Học kỳ I (Chính thức)</option>
            <option value="Giữa Học kỳ II">Giữa Học kỳ II</option>
            <option value="Tổng kết Năm học">Tổng kết Cả năm</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">Lọc theo khối lớp:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedClassFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                selectedClassFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Toàn trường
            </button>
            <button
              onClick={() => setSelectedClassFilter('primary')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                selectedClassFilter === 'primary' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Tiểu học (Lớp 4)
            </button>
            <button
              onClick={() => setSelectedClassFilter('secondary')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                selectedClassFilter === 'secondary' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              THCS (Lớp 6, 7)
            </button>
          </div>
        </div>
      </div>

      {/* 3 Core Art Competency Progress Gauges (Chương trình GDPT 2018 Mĩ thuật) */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Đánh giá 3 Năng lực Đặc thù môn Mĩ thuật (GDPT 2018)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Tỉ lệ học sinh đạt mức Hoàn thành tốt & Hoàn thành</p>
          </div>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
            Đạt chuẩn 96.8%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Competency 1 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">1. Quan sát & Nhận thức thẩm mĩ</span>
              <span className="font-mono font-bold text-blue-700 tabular-nums">88.5%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: '88.5%' }} />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Khả năng nhận diện màu sắc, hình khối, đường nét trong tự nhiên và trong tranh di sản dân tộc.
            </p>
          </div>

          {/* Competency 2 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">2. Sáng tạo & Ứng dụng thẩm mĩ</span>
              <span className="font-mono font-bold text-purple-700 tabular-nums">92.0%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div className="bg-purple-600 h-full rounded-full transition-all" style={{ width: '92.0%' }} />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Khéo léo trong thực hành tạo hình (vẽ, nặn, xé dán, in ấn) và biết ứng dụng làm đẹp cuộc sống.
            </p>
          </div>

          {/* Competency 3 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">3. Phân tích & Đánh giá thẩm mĩ</span>
              <span className="font-mono font-bold text-amber-700 tabular-nums">79.5%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div className="bg-amber-600 h-full rounded-full transition-all" style={{ width: '79.5%' }} />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Tự tin trình bày cảm xúc, chia sẻ ý tưởng tác phẩm và nhận xét đóng góp cho sản phẩm bạn bè.
            </p>
          </div>
        </div>
      </div>

      {/* Rating Breakdown Distribution & Class Summary Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Overall Rating Breakdown */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Phân bố Xếp loại Học tập (Thông tư 27/22)
          </h3>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-900 block">Hoàn thành tốt (T)</span>
                <span className="text-[11px] text-emerald-700">92 học sinh</span>
              </div>
              <span className="text-lg font-bold font-mono text-emerald-800 tabular-nums">42.2%</span>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-blue-900 block">Hoàn thành (H)</span>
                <span className="text-[11px] text-blue-700">112 học sinh</span>
              </div>
              <span className="text-lg font-bold font-mono text-blue-800 tabular-nums">51.4%</span>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-900 block">Chưa hoàn thành / Cố gắng (C)</span>
                <span className="text-[11px] text-amber-700">14 học sinh</span>
              </div>
              <span className="text-lg font-bold font-mono text-amber-800 tabular-nums">6.4%</span>
            </div>
          </div>

          <div className="pt-2 text-xs text-slate-500">
            <p className="leading-relaxed">
              * Tỉ lệ đạt yêu cầu chung đạt <strong>93.6%</strong>, vượt chỉ tiêu chuyên môn đề ra đầu năm học (90%).
            </p>
          </div>
        </div>

        {/* Right 2 cols: Class Performance Table */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Bảng Tổng hợp theo Lớp Phụ trách
            </h3>
            <span className="text-xs text-slate-400">Học kỳ I · [Dữ liệu minh họa]</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Lớp</th>
                  <th className="p-2.5">Sĩ số</th>
                  <th className="p-2.5 text-center">Hoàn thành tốt (T)</th>
                  <th className="p-2.5 text-center">Hoàn thành (H)</th>
                  <th className="p-2.5 text-center">Cần cố gắng (C)</th>
                  <th className="p-2.5 text-right">Đánh giá chung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr>
                  <td className="p-2.5 font-bold text-slate-900">Mĩ thuật 6A1</td>
                  <td className="p-2.5 font-mono tabular-nums">38 HS</td>
                  <td className="p-2.5 text-center font-mono text-emerald-700 font-bold tabular-nums">18 (47%)</td>
                  <td className="p-2.5 text-center font-mono text-blue-700 tabular-nums">19 (50%)</td>
                  <td className="p-2.5 text-center font-mono text-amber-700 tabular-nums">1 (3%)</td>
                  <td className="p-2.5 text-right text-emerald-700">Xuất sắc</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-900">Mĩ thuật 7B2</td>
                  <td className="p-2.5 font-mono tabular-nums">36 HS</td>
                  <td className="p-2.5 text-center font-mono text-emerald-700 font-bold tabular-nums">15 (42%)</td>
                  <td className="p-2.5 text-center font-mono text-blue-700 tabular-nums">18 (50%)</td>
                  <td className="p-2.5 text-center font-mono text-amber-700 tabular-nums">3 (8%)</td>
                  <td className="p-2.5 text-right text-blue-700">Tốt</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-900">Mĩ thuật 4A3</td>
                  <td className="p-2.5 font-mono tabular-nums">35 HS</td>
                  <td className="p-2.5 text-center font-mono text-emerald-700 font-bold tabular-nums">14 (40%)</td>
                  <td className="p-2.5 text-center font-mono text-blue-700 tabular-nums">19 (54%)</td>
                  <td className="p-2.5 text-center font-mono text-amber-700 tabular-nums">2 (6%)</td>
                  <td className="p-2.5 text-right text-blue-700">Tốt</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-900">Mĩ thuật 5A2</td>
                  <td className="p-2.5 font-mono tabular-nums">37 HS</td>
                  <td className="p-2.5 text-center font-mono text-emerald-700 font-bold tabular-nums">16 (43%)</td>
                  <td className="p-2.5 text-center font-mono text-blue-700 tabular-nums">18 (49%)</td>
                  <td className="p-2.5 text-center font-mono text-amber-700 tabular-nums">3 (8%)</td>
                  <td className="p-2.5 text-right text-blue-700">Tốt</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pedagogical Interventions: Gifted Students & Need-Support Students */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gifted students */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Học sinh năng khiếu nổi bật (Bồi dưỡng phong trào)</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900">Lê Hoàng Minh (6A1)</span>
                <p className="text-[11px] text-slate-500">Màu nước phong cảnh · Cảm thụ hòa sắc xuất sắc</p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Dự thi cấp Tỉnh
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900">Nguyễn Ngọc Anh Thư (6A1)</span>
                <p className="text-[11px] text-slate-500">Tranh khắc gỗ dân gian & Cách điệu hoa văn</p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                CLB Mĩ thuật
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900">Phạm Đức Khang (7B2)</span>
                <p className="text-[11px] text-slate-500">Chất liệu sơn mài ước lệ & Điêu khắc</p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Triển lãm trường
              </span>
            </div>
          </div>
        </div>

        {/* Support needed */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Kế hoạch hỗ trợ học sinh cần cố gắng thêm</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Bùi Hải Đăng (7B2)</span>
                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">Khâu đánh bóng</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Biện pháp: GV kèm riêng 5 phút đầu tiết thực hành về phương pháp xác định hướng chiếu sáng tĩnh vật.
              </p>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Trần Đình Tuấn (4A3)</span>
                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">Tô màu đều</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Biện pháp: Hướng dẫn cầm bút màu sáp theo góc nghiêng để tô mảng không bị hở trắng giấy.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Printable School Board Report */}
      {isExportReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between no-print">
              <h3 className="text-sm font-bold text-slate-900">Báo cáo Tổng kết Chuyên môn Mĩ thuật</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintReport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In báo cáo</span>
                </button>
                <button
                  onClick={() => setIsExportReportModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Report Content */}
            <div className="p-8 overflow-y-auto printable-area text-slate-900 space-y-6 text-xs">
              <div className="text-center border-b pb-4 border-slate-300">
                <p className="text-[11px] uppercase font-bold text-slate-500">PHÒNG GIÁO DỤC VÀ ĐÀO TẠO · TỔ CHUYÊN MÔN NGHỆ THUẬT</p>
                <h1 className="text-lg md:text-xl font-bold uppercase tracking-tight text-slate-900 mt-1">
                  Báo Cáo Tiến Bộ & Đánh Giá Năng Lực Mĩ Thuật
                </h1>
                <p className="text-slate-600 mt-1">
                  {selectedTerm} · Năm học 2026 - 2027 (Chương trình GDPT 2018)
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 uppercase mb-2">I. Tình hình chung</h4>
                <p className="text-slate-700 leading-relaxed">
                  Trong {selectedTerm}, công tác giảng dạy bộ môn Mĩ thuật được triển khai đồng bộ theo định hướng phát triển phẩm chất, năng lực của Chương trình GDPT 2018. Học sinh hào hứng tham gia các hoạt động thực hành sáng tạo, phát huy tốt trí tưởng tượng và tình yêu di sản văn hóa truyền thống.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 uppercase mb-2">II. Kết quả đạt được theo 3 Năng lực đặc thù</h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                  <li><strong>Năng lực Quan sát & Nhận thức:</strong> Đạt 88.5% học sinh xếp loại Hoàn thành tốt và Hoàn thành. Học sinh bước đầu làm quen tốt với các yếu tố tạo hình (đường nét, mảng khối, sắc độ).</li>
                  <li><strong>Năng lực Sáng tạo & Ứng dụng:</strong> Đạt 92.0%. 100% học sinh hoàn thành ít nhất 4 sản phẩm thực hành chất liệu đa dạng (màu nước, sáp dầu, đất nặn, xé dán).</li>
                  <li><strong>Năng lực Phân tích & Đánh giá:</strong> Đạt 79.5%. Kỹ năng chia sẻ cảm xúc thẩm mĩ và bình tranh đã có bước tiến bộ rõ nét.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 uppercase mb-2">III. Phương hướng trong học kỳ tiếp theo</h4>
                <p className="text-slate-700 leading-relaxed">
                  Tăng cường tổ chức không gian triển lãm nghệ thuật tại trường; đẩy mạnh tích hợp công nghệ AI và hình ảnh số vào khâu giới thiệu di sản mĩ thuật dân gian Việt Nam; tiếp tục bồi dưỡng nhóm học sinh có năng khiếu mỹ thuật hội họa.
                </p>
              </div>

              <div className="pt-8 flex items-center justify-between text-center">
                <div>
                  <p className="font-bold text-slate-800">HIỆU TRƯỞNG DUYỆT</p>
                  <p className="text-slate-400 mt-10">(Ký và đóng dấu)</p>
                </div>
                <div>
                  <p className="text-slate-500">Hà Nội, ngày 27 tháng 10 năm 2026</p>
                  <p className="font-bold text-slate-800 mt-1">GIÁO VIÊN BỘ MÔN</p>
                  <p className="text-purple-700 font-bold mt-8">Cô Mai Phương</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end no-print">
              <button
                onClick={() => setIsExportReportModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
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

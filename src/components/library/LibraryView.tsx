import React, { useState } from 'react';
import { ResourceItem, SchoolLevel } from '../../types/artverse';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import { EmptyState } from '../common/EmptyState';
import { 
  Library, 
  Search, 
  Download, 
  Plus, 
  Sparkles, 
  BookOpen, 
  X, 
  ExternalLink, 
  FileText,
  Share2,
  CheckCircle2
} from 'lucide-react';

interface LibraryViewProps {
  resources: ResourceItem[];
  schoolLevel: SchoolLevel;
  isEmpty: boolean;
  onResetData: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  resources,
  schoolLevel,
  isEmpty,
  onResetData,
  onShowToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewingResource, setViewingResource] = useState<ResourceItem | null>(null);

  const handleDownload = (res: ResourceItem) => {
    onShowToast('success', 'Bắt đầu tải học liệu', `Đang tải "${res.title}" định dạng ${res.downloadFormat} (${res.fileSize}).`);
  };

  const handleAddToLesson = (res: ResourceItem) => {
    onShowToast('success', 'Đã ghim vào bài dạy', `Đã thêm học liệu "${res.title}" vào danh mục tư liệu bài giảng của bạn.`);
  };

  if (isEmpty) {
    return (
      <div className="py-8">
        <EmptyState
          title="Thư viện học liệu đang trống"
          description="Hiện chưa có học liệu nào được lưu trong thư viện cá nhân. Bạn có thể bật lại kho tài liệu mẫu để khám phá di sản nghệ thuật."
          actionText="Nạp lại thư viện học liệu mẫu"
          onAction={onResetData}
        />
      </div>
    );
  }

  // Filter resources
  const filtered = resources.filter((res) => {
    const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          res.eraOrArtist.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          res.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || res.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: 'all', label: 'Tất cả học liệu' },
    { id: 'folk', label: 'Tranh dân gian' },
    { id: 'fineart', label: 'Mỹ thuật Việt Nam' },
    { id: 'technique', label: 'Kỹ thuật thực hành' },
    { id: 'award', label: 'Bài vẽ xuất sắc' },
    { id: 'slides', label: 'Bài giảng điện tử' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
              Kho Di sản & Tư liệu
            </span>
            <span className="text-xs text-slate-500">Chuẩn hóa cho Sư phạm Mĩ thuật</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-xs text-slate-400 font-mono tabular-nums">{filtered.length} tài liệu</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            Thư viện Học liệu & Di sản Nghệ thuật
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tranh dân gian Đông Hồ, Hàng Trống, kiệt tác danh họa Việt Nam, video kỹ thuật tạo hình và bài giảng điện tử.
          </p>
        </div>

        <button
          onClick={() => onShowToast('info', 'Đóng góp tư liệu', 'Tính năng tải lên bộ sưu tập riêng đang được chuẩn bị.')}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-xl shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Đóng góp tài liệu mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên tác phẩm, danh họa (Đông Hồ, Tô Ngọc Vân, Bùi Xuân Phái, màu nước, tò he...)"
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
          />
        </div>

        {/* Category Filter Pills / Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resources Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          title="Không tìm thấy tài liệu phù hợp"
          description={`Không có học liệu nào khớp với từ khóa tìm kiếm "${searchQuery}" trong danh mục này.`}
          actionText="Bỏ lọc tìm kiếm"
          onAction={() => {
            setSearchQuery('');
            setSelectedCategory('all');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 hover:border-amber-300 p-4 shadow-xs transition-all flex flex-col justify-between group"
            >
              <div>
                <ArtCanvasVisual
                  type={item.visualType}
                  title={item.title}
                  badgeText={item.categoryLabel}
                  className="h-44 w-full"
                />

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                      {item.categoryLabel}
                    </span>
                    <span className="text-slate-400 font-mono tabular-nums">
                      {item.downloadsCount} lượt tải
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mt-2 line-clamp-2 group-hover:text-amber-800 transition-colors leading-snug">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-500 mt-1">
                    Xuất xứ: <span className="font-medium text-slate-700">{item.eraOrArtist}</span>
                  </p>

                  <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Tags */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {item.tags.map((tag, idx) => (
                      <span key={idx} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => setViewingResource(item)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Xem hướng dẫn
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleAddToLesson(item)}
                    title="Thêm vào kế hoạch bài dạy"
                    className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-slate-200 transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDownload(item)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải về</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: Resource Pedagogical Guide & Details */}
      {viewingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded uppercase">
                  {viewingResource.categoryLabel}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{viewingResource.title}</h3>
              </div>
              <button
                onClick={() => setViewingResource(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <ArtCanvasVisual
                type={viewingResource.visualType}
                title={viewingResource.title}
                className="h-48 w-full"
              />

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Tác giả / Di sản</span>
                  <strong className="text-slate-900 text-xs mt-0.5 block">{viewingResource.eraOrArtist}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Cấp học khuyến nghị</span>
                  <strong className="text-slate-900 text-xs mt-0.5 block">{viewingResource.targetGrades}</strong>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Định dạng tệp</span>
                  <span className="text-slate-800 text-xs mt-0.5 block font-medium">{viewingResource.downloadFormat}</span>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Dung lượng</span>
                  <span className="text-slate-800 text-xs mt-0.5 block font-mono font-medium">{viewingResource.fileSize}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">
                  Mô tả nội dung học liệu:
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  {viewingResource.description}
                </p>
              </div>

              {/* Pedagogical integration guide */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 uppercase text-[11px]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Hướng dẫn Giáo viên Ứng dụng vào Giờ học:</span>
                </div>
                <p className="text-slate-700 leading-relaxed italic">
                  "{viewingResource.teachingGuide}"
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => handleAddToLesson(viewingResource)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Thêm vào bài giảng của tôi</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewingResource(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Đóng
                </button>
                <button
                  onClick={() => handleDownload(viewingResource)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải tệp ({viewingResource.fileSize})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

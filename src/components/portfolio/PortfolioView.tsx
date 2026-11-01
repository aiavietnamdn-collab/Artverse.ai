import React, { useState, useEffect } from 'react';
import { StudentProfile, SchoolLevel, ArtPortfolioRecord } from '../../types/artverse';
import { ArtCanvasVisual } from '../common/ArtCanvasVisual';
import { EmptyState } from '../common/EmptyState';
import { ArtPortfolioWorkspace } from './ArtPortfolioWorkspace';
import { INITIAL_PORTFOLIO_RECORDS } from '../../data/mockData';
import { 
  getTeacherPortfolios, 
  savePortfolioToFirestore, 
  deletePortfolioFromFirestore 
} from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';
import { 
  FolderHeart, 
  Search, 
  Plus, 
  Sparkles, 
  ChevronRight, 
  X, 
  TrendingUp, 
  Award,
  Eye,
  Cloud,
  Layers,
  RefreshCw
} from 'lucide-react';

interface PortfolioViewProps {
  students: StudentProfile[];
  schoolLevel: SchoolLevel;
  onAddStudent: (newStudent: StudentProfile) => void;
  isEmpty: boolean;
  onResetData: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  students,
  schoolLevel,
  onAddStudent,
  isEmpty,
  onResetData,
  onShowToast,
}) => {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<'artportfolio' | 'students'>('artportfolio');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [viewingStudent, setViewingStudent] = useState<StudentProfile | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Portfolio Records (Mock + Cloud Firestore)
  const [portfolioRecords, setPortfolioRecords] = useState<ArtPortfolioRecord[]>(INITIAL_PORTFOLIO_RECORDS);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState<boolean>(false);

  // Load teacher's portfolios from Firestore when logged in
  useEffect(() => {
    if (user) {
      loadCloudPortfolios();
    }
  }, [user]);

  const loadCloudPortfolios = async () => {
    if (!user) return;
    try {
      setIsLoadingFirestore(true);
      const cloudDocs = await getTeacherPortfolios();
      if (cloudDocs && cloudDocs.length > 0) {
        const cloudRecords: ArtPortfolioRecord[] = cloudDocs.map(d => ({
          ...d.rawPortfolioData,
          id: d.id,
          studentCode: d.studentCode,
          studentPseudonym: d.studentPseudonym,
          classGroup: d.classGroup,
          topic: d.topic,
          title: d.title,
          executionDate: d.executionDate,
          timePeriod: d.timePeriod,
          studentWrittenIdea: d.studentWrittenIdea,
          isSampleData: false,
          storageType: 'persistent_mock',
        }));

        // Merge: keep cloud records, and keep sample records that don't collide
        setPortfolioRecords(prev => {
          const sampleRemaining = prev.filter(r => r.isSampleData);
          return [...cloudRecords, ...sampleRemaining];
        });
        onShowToast('info', 'Đã đồng bộ Firestore', `Đã tải ${cloudDocs.length} hồ sơ mĩ thuật từ đám mây của bạn.`);
      }
    } catch (err: any) {
      console.error('Failed to load cloud portfolios:', err);
    } finally {
      setIsLoadingFirestore(false);
    }
  };

  // Add Record Handler
  const handleAddPortfolioRecord = async (record: ArtPortfolioRecord) => {
    setPortfolioRecords(prev => [record, ...prev]);
  };

  // Update Record Handler
  const handleUpdatePortfolioRecord = (updated: ArtPortfolioRecord) => {
    setPortfolioRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  // Delete Record Handler
  const handleDeletePortfolioRecord = async (id: string) => {
    setPortfolioRecords(prev => prev.filter(r => r.id !== id));
    if (user) {
      try {
        await deletePortfolioFromFirestore(id);
      } catch (err) {
        console.warn('Could not delete from firestore:', err);
      }
    }
  };

  // New Student Form State (Classic Tab)
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState('6A1');
  const [newAptitude, setNewAptitude] = useState('Hội họa màu nước & Màu sáp');
  const [newNotes, setNewNotes] = useState('');

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      onShowToast('error', 'Chưa nhập họ tên', 'Vui lòng nhập tên học sinh.');
      return;
    }

    const classNum = parseInt(newClass.charAt(0), 10);
    const lvl: 'primary' | 'secondary' = classNum <= 5 ? 'primary' : 'secondary';

    const created: StudentProfile = {
      id: `st-${Date.now()}`,
      name: newName.trim(),
      classGroup: newClass,
      level: lvl,
      artAptitude: newAptitude,
      overallRating: 'proficient',
      artworksCount: 1,
      recentNotes: newNotes || 'Học sinh mới tham gia lớp học mĩ thuật, bước đầu làm quen với dụng cụ tạo hình.',
      strengths: ['Yêu thích hoạt động sáng tạo', 'Chủ động chuẩn bị đồ dùng'],
      areasToGrow: ['Luyện tập thêm nét vẽ và phối màu'],
      sampleWorks: [
        {
          id: `w-${Date.now()}`,
          title: 'Bài vẽ khởi động đầu năm',
          date: 'Hôm nay',
          rating: 'Hoàn thành',
          visualType: 'watercolor'
        }
      ]
    };

    onAddStudent(created);
    setIsAddModalOpen(false);
    setNewName('');
    setNewNotes('');
    onShowToast('success', 'Đã thêm học sinh', `Đã tạo hồ sơ mĩ thuật cho học sinh ${created.name} (Lớp ${created.classGroup}).`);
  };

  if (isEmpty) {
    return (
      <div className="py-8">
        <EmptyState
          title="Chưa có hồ sơ học tập nào"
          description="Hiện chưa có hồ sơ học sinh mĩ thuật được lưu. Bạn có thể nạp lại dữ liệu mẫu hoặc thêm hồ sơ học sinh mới ngay."
          actionText="Nạp lại hồ sơ học sinh mẫu"
          onAction={onResetData}
        />
      </div>
    );
  }

  // Filter students
  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.artAptitude.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || s.classGroup === selectedClass;
    const matchesLevel = schoolLevel === 'all' || s.level === schoolLevel;

    return matchesSearch && matchesClass && matchesLevel;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top View Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-fit">
          <button
            onClick={() => setSubTab('artportfolio')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'artportfolio'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderHeart className="w-3.5 h-3.5 text-emerald-600" />
            <span>ArtPortfolio — Tiến trình & Đám mây ({portfolioRecords.length})</span>
          </button>

          <button
            onClick={() => setSubTab('students')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'students'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>Danh mục học sinh ({filteredStudents.length})</span>
          </button>
        </div>

        {subTab === 'artportfolio' && user && (
          <button
            onClick={loadCloudPortfolios}
            disabled={isLoadingFirestore}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isLoadingFirestore ? 'animate-spin' : ''}`} />
            <span>{isLoadingFirestore ? 'Đang đồng bộ...' : 'Đồng bộ Firestore'}</span>
          </button>
        )}
      </div>

      {/* SUBTAB 1: ArtPortfolio Workspace with Dual Visuals & Firestore */}
      {subTab === 'artportfolio' ? (
        <ArtPortfolioWorkspace
          portfolioRecords={portfolioRecords}
          onAddRecord={handleAddPortfolioRecord}
          onUpdateRecord={handleUpdatePortfolioRecord}
          onDeleteRecord={handleDeletePortfolioRecord}
          onShowToast={onShowToast}
        />
      ) : (
        /* SUBTAB 2: Student Profiles Directory */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Danh sách tổng hợp học sinh theo dõi mĩ thuật
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tổng hợp năng khiếu đặc thù, số lượng tác phẩm và định hướng thẩm mĩ từng học sinh.
              </p>
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm học sinh mới</span>
            </button>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên học sinh, thiên hướng năng khiếu..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 md:pb-0">
              <button
                onClick={() => setSelectedClass('all')}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  selectedClass === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả lớp
              </button>
              {['6A1', '7B2', '4A3'].map((cls) => (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(cls)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    selectedClass === cls
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Lớp {cls}
                </button>
              ))}
            </div>
          </div>

          {/* Student Profiles Cards Grid */}
          {filteredStudents.length === 0 ? (
            <EmptyState
              title="Không có học sinh phù hợp"
              description="Không tìm thấy học sinh nào thỏa mãn từ khóa tìm kiếm hoặc bộ lọc lớp hiện tại."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredStudents.map((st) => (
                <div
                  key={st.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{st.name}</span>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Lớp {st.classGroup}
                          </span>
                        </div>
                        <p className="text-xs text-blue-600 font-medium mt-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>{st.artAptitude}</span>
                        </p>
                      </div>

                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        st.overallRating === 'excellent'
                          ? 'bg-purple-50 text-purple-700'
                          : st.overallRating === 'proficient'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {st.overallRating === 'excellent' ? 'Hoàn thành tốt' : st.overallRating === 'proficient' ? 'Hoàn thành' : 'Cần cố gắng'}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 line-clamp-2 italic bg-slate-50 p-2 rounded-lg">
                      "{st.recentNotes}"
                    </div>

                    {/* Preview Work in Mini Frame */}
                    {st.sampleWorks[0] && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                          <span>Tác phẩm gần nhất:</span>
                          <span className="font-medium text-slate-700 truncate max-w-[150px]">{st.sampleWorks[0].title}</span>
                        </div>
                        <div className="h-28 w-full rounded-xl overflow-hidden border border-slate-200">
                          <ArtCanvasVisual visualType={st.sampleWorks[0].visualType} title={st.sampleWorks[0].title} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {st.artworksCount} tác phẩm lưu trữ
                    </span>
                    <button
                      onClick={() => setViewingStudent(st)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                    >
                      <span>Xem hồ sơ</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: View Full Student Profile */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  {viewingStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{viewingStudent.name}</h3>
                  <p className="text-xs text-slate-500">Lớp {viewingStudent.classGroup} · Mĩ thuật {viewingStudent.level === 'primary' ? 'Tiểu học' : 'THCS'}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingStudent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100">
                <span className="text-xs font-bold text-emerald-900">Thiên hướng & Năng khiếu:</span>
                <p className="text-xs text-emerald-800 font-medium mt-1">{viewingStudent.artAptitude}</p>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-800">Điểm mạnh thẩm mĩ:</span>
                <ul className="mt-1.5 space-y-1">
                  {viewingStudent.strengths.map((s, idx) => (
                    <li key={idx} className="text-xs text-slate-600 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-800">Gợi ý phát triển tiếp theo:</span>
                <ul className="mt-1.5 space-y-1">
                  {viewingStudent.areasToGrow.map((a, idx) => (
                    <li key={idx} className="text-xs text-slate-600 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2">
                <span className="text-xs font-bold text-slate-800">Nhận xét sư phạm của giáo viên:</span>
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-1.5 italic">
                  "{viewingStudent.recentNotes}"
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewingStudent(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Đóng hồ sơ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add New Student Profile */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Thêm hồ sơ học sinh mĩ thuật</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="py-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Họ và tên học sinh *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ví dụ: Lê Hoàng Minh"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Lớp
                  </label>
                  <select
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="1A1">1A1 (Tiểu học)</option>
                    <option value="4A3">4A3 (Tiểu học)</option>
                    <option value="6A1">6A1 (THCS)</option>
                    <option value="7B2">7B2 (THCS)</option>
                    <option value="8C3">8C3 (THCS)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Thiên hướng nghệ thuật
                  </label>
                  <input
                    type="text"
                    value={newAptitude}
                    onChange={(e) => setNewAptitude(e.target.value)}
                    placeholder="VD: Hội họa màu nước, Đất nặn..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ghi chú ban đầu của giáo viên
                </label>
                <textarea
                  rows={3}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Nhận xét sơ bộ về thái độ học tập và thói quen thao tác mĩ thuật..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                >
                  Tạo hồ sơ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

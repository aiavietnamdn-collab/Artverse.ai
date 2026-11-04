/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Bảng Quản lý Lớp học & Tài khoản Học sinh dành cho Giáo viên (Phương án A - Chuẩn hóa PHẦN A)
 * - Tạo lớp học & mã lớp duy nhất (Lớp 1 -> Lớp 9)
 * - Thêm học sinh theo biểu mẫu hoặc nhập hàng loạt từ Excel (.xlsx / .csv) theo cấu trúc 4 cột cố định:
 *   Cột A: Mã HS (Text - giữ nguyên số 0 ở đầu)
 *   Cột B: Bí danh (Công khai trong triển lãm; nếu trống sẽ yêu cầu HS tự đặt khi đăng nhập lần đầu)
 *   Cột C: Tên HS (Bảo mật - chỉ Giáo viên phụ trách và Admin xem, TUYỆT ĐỐI KHÔNG CÔNG KHAI)
 *   Cột D: Lớp (Chuẩn hóa Lớp 1 -> Lớp 9)
 * - Màn hình xem trước dữ liệu (Preview Table) kiểm tra trống, trùng mã, lớp không hợp lệ, đã tồn tại
 * - Cơ chế cập nhật hồ sơ học sinh hiện có mà không tạo tài khoản trùng lặp
 * - Sinh mã PIN ngẫu nhiên (chỉ hiển thị 1 lần ngay khi tạo hoặc cấp lại, lưu dạng băm Bcrypt)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TeacherManagedClass,
  StudentAccountSummary,
  StudentLoginCard,
  ExcelStudentPreviewRow,
} from '../../types/communityArt';
import { STANDARD_GRADES, normalizeGrade } from '../../utils/gradeUtils';
import {
  downloadStandardStudentExcelTemplate,
  parseExcelFileBufferToRows,
  parseTextToFourColumnRows,
  validateAndPreviewStudentExcelRows,
} from '../../utils/studentExcelUtils';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../lib/platform';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Printer,
  Download,
  Lock,
  Unlock,
  KeyRound,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  School,
  X,
  EyeOff,
  Sparkles,
  Trash2,
  Search,
} from 'lucide-react';
import { matchesSearchQuery } from '../../utils/searchEngine';

interface TeacherStudentManagerPanelProps {
  onShowToast?: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const TeacherStudentManagerPanel: React.FC<TeacherStudentManagerPanelProps> = ({
  onShowToast,
}) => {
  const { isTeacher, isAdmin, getValidBearerToken } = useAuth();

  const [managedClasses, setManagedClasses] = useState<TeacherManagedClass[]>([]);
  const [selectedClassCode, setSelectedClassCode] = useState<string>('LOP6');
  const [students, setStudents] = useState<StudentAccountSummary[]>([]);
  const [loadingClasses, setLoadingClasses] = useState<boolean>(false);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);

  // Create New Class Form
  const [showCreateClassForm, setShowCreateClassForm] = useState<boolean>(false);
  const [newClassCode, setNewClassCode] = useState<string>('');
  const [newClassName, setNewClassName] = useState<string>('');
  const [newClassGrade, setNewClassGrade] = useState<number>(6);
  const [newClassSchoolYear, setNewClassSchoolYear] = useState<string>('2025 - 2026');
  const [creatingClass, setCreatingClass] = useState<boolean>(false);

  // Single Student Form (4-column aligned: Mã HS, Bí danh công khai, Tên HS bảo mật, Lớp)
  const [studentCodeInput, setStudentCodeInput] = useState<string>('');
  const [studentAliasInput, setStudentAliasInput] = useState<string>('');
  const [studentFullNameInput, setStudentFullNameInput] = useState<string>('');
  const [submittingStudent, setSubmittingStudent] = useState<boolean>(false);

  // Standardized 4-Column Excel Import Modal + Preview Table
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkText, setBulkText] = useState<string>(
    '001\tCọ Nhỏ 01\tNguyễn Văn A\tLớp 6\n002\tMàu Xanh 02\tTrần Thị B\tLớp 6\n003\t\tLê Hoàng C\tLớp 7'
  );
  const [previewRows, setPreviewRows] = useState<ExcelStudentPreviewRow[]>([]);
  const [updateExistingMode, setUpdateExistingMode] = useState<boolean>(true);
  const [loadedFileName, setLoadedFileName] = useState<string>('');
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  // One-Time Printable Login Cards (Strictly shown ONCE after creation or PIN reset)
  const [oneTimeCards, setOneTimeCards] = useState<StudentLoginCard[]>([]);
  const [showPrintCardsModal, setShowPrintCardsModal] = useState<boolean>(false);

  // Student Search & Status Filter (III.5 QUẢN LÝ HỌC SINH)
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | 'active' | 'locked'>('all');

  const currentClassObj = managedClasses.find((c) => c.classCode === selectedClassCode);
  const currentDefaultGradeLabel = normalizeGrade(currentClassObj?.grade || selectedClassCode);

  const filteredStudents = React.useMemo(() => {
    return students.filter((stu) => {
      if (studentStatusFilter !== 'all' && stu.status !== studentStatusFilter) {
        return false;
      }
      if (studentSearchQuery.trim()) {
        const matched = matchesSearchQuery(studentSearchQuery, {
          primary: [stu.studentCode, stu.alias, stu.displayName, stu.fullName],
          secondary: [stu.classGroupId, stu.className, String(stu.grade || ''), stu.status],
        });
        if (!matched) return false;
      }
      return true;
    });
  }, [students, studentSearchQuery, studentStatusFilter]);

  const fetchManagedClasses = useCallback(async () => {
    if (!isTeacher && !isAdmin) return;
    setLoadingClasses(true);
    try {
      const token = await getValidBearerToken();
      if (!token) return;
      const res = await fetch(getApiUrl('/api/teacher/classes'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.classes)) {
          setManagedClasses(data.classes);
          if (
            data.classes.length > 0 &&
            !data.classes.some((c: TeacherManagedClass) => c.classCode === selectedClassCode)
          ) {
            setSelectedClassCode(data.classes[0].classCode);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingClasses(false);
    }
  }, [isTeacher, isAdmin, getValidBearerToken, selectedClassCode]);

  const fetchClassStudents = useCallback(
    async (classCode: string) => {
      if (!classCode || (!isTeacher && !isAdmin)) return;
      setLoadingStudents(true);
      try {
        const token = await getValidBearerToken();
        if (!token) return;
        const res = await fetch(
          getApiUrl(`/api/teacher/classes/${encodeURIComponent(classCode)}/students`),
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (res.ok && Array.isArray(data.students)) {
          setStudents(data.students);
        } else if (res.status === 403) {
          setStudents([]);
          onShowToast?.(
            'error',
            'Không có quyền truy cập',
            data.error || 'Lớp này thuộc giáo viên khác.'
          );
        }
      } catch {
        // ignore
      } finally {
        setLoadingStudents(false);
      }
    },
    [isTeacher, isAdmin, getValidBearerToken, onShowToast]
  );

  useEffect(() => {
    fetchManagedClasses();
  }, [fetchManagedClasses]);

  useEffect(() => {
    if (selectedClassCode) {
      fetchClassStudents(selectedClassCode);
    }
  }, [selectedClassCode, fetchClassStudents]);

  // Re-validate preview rows whenever bulkText or existing students list changes
  const rebuildPreviewFromText = useCallback(
    (text: string) => {
      const rawRows = parseTextToFourColumnRows(text);
      const existingCodes = students.map((s) => s.studentCode.toUpperCase());
      const validated = validateAndPreviewStudentExcelRows(rawRows, existingCodes);
      setPreviewRows(validated.rows);
    },
    [students]
  );

  useEffect(() => {
    if (showBulkModal && previewRows.length === 0 && bulkText.trim()) {
      rebuildPreviewFromText(bulkText);
    }
  }, [showBulkModal, previewRows.length, bulkText, rebuildPreviewFromText]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newClassCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanCode || cleanCode.length < 2) {
      onShowToast?.(
        'error',
        'Mã lớp chưa hợp lệ',
        'Vui lòng nhập Mã lớp từ 2 ký tự trở lên (VD: LOP6A).'
      );
      return;
    }

    setCreatingClass(true);
    try {
      const token = await getValidBearerToken();
      const res = await fetch(getApiUrl('/api/teacher/classes'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          classCode: cleanCode,
          name: newClassName.trim() || `Lớp ${newClassGrade} (${cleanCode})`,
          grade: newClassGrade,
          schoolYear: newClassSchoolYear.trim() || '2025 - 2026',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onShowToast?.('error', 'Không thể tạo lớp', data.error || 'Vui lòng kiểm tra lại.');
        return;
      }

      onShowToast?.(
        'success',
        'Đã tạo lớp học mới',
        `Đã khởi tạo lớp ${data.classRoom.name} với Mã lớp: ${data.classRoom.classCode}.`
      );
      setNewClassCode('');
      setNewClassName('');
      setShowCreateClassForm(false);
      await fetchManagedClasses();
      setSelectedClassCode(data.classRoom.classCode);
    } finally {
      setCreatingClass(false);
    }
  };

  const handleCreateSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanStuCode = studentCodeInput.trim().toUpperCase();
    const cleanFullName = studentFullNameInput.trim();
    const cleanAlias = studentAliasInput.trim();
    if (!cleanStuCode || !cleanFullName) {
      onShowToast?.(
        'error',
        'Thiếu thông tin học sinh',
        'Vui lòng nhập Mã HS (giữ nguyên số 0 ở đầu nếu có, VD: 001) và Tên HS.'
      );
      return;
    }

    setSubmittingStudent(true);
    try {
      const token = await getValidBearerToken();
      const res = await fetch(
        getApiUrl(`/api/teacher/classes/${encodeURIComponent(selectedClassCode)}/students`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            studentCode: cleanStuCode,
            alias: cleanAlias,
            fullName: cleanFullName,
            displayName: cleanAlias || cleanFullName,
            grade: currentDefaultGradeLabel,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        onShowToast?.('error', 'Không thể tạo tài khoản', data.error || 'Vui lòng thử lại.');
        return;
      }

      setStudentCodeInput('');
      setStudentAliasInput('');
      setStudentFullNameInput('');
      await fetchClassStudents(selectedClassCode);
      await fetchManagedClasses();

      if (Array.isArray(data.loginCardsOneTime) && data.loginCardsOneTime.length > 0) {
        setOneTimeCards(data.loginCardsOneTime);
        setShowPrintCardsModal(true);
      }

      onShowToast?.(
        'success',
        'Đã tạo tài khoản học sinh',
        `Đã cấp mã PIN ban đầu cho mã HS ${cleanStuCode}. Hãy in hoặc tải thẻ đăng nhập ngay!`
      );
    } finally {
      setSubmittingStudent(false);
    }
  };

  // Upload real .xlsx or .csv file and populate the 4-Column Preview Table
  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const rawRows = parseExcelFileBufferToRows(buffer);
      const existingCodes = students.map((s) => s.studentCode.toUpperCase());
      const validated = validateAndPreviewStudentExcelRows(rawRows, existingCodes);
      setPreviewRows(validated.rows);
      setLoadedFileName(file.name);

      // Sync text view for transparency
      const textRepresentation = validated.rows
        .map((r: ExcelStudentPreviewRow) => `${r.studentCode}\t${r.alias}\t${r.fullName}\t${r.normalizedGrade || r.rawGrade}`)
        .join('\n');
      setBulkText(textRepresentation);

      onShowToast?.(
        'info',
        `Đã đọc tệp "${file.name}"`,
        `Phát hiện ${validated.rows.length} dòng (${validated.validNewCount} mới hợp lệ, ${validated.validUpdateCount} đã tồn tại, ${validated.invalidCount + validated.duplicateInFileCount} lỗi/trùng).`
      );
    } catch (err: any) {
      onShowToast?.(
        'error',
        'Không thể đọc tệp Excel',
        err?.message || 'Vui lòng sử dụng tệp .xlsx hoặc .csv đúng cấu trúc 4 cột.'
      );
    } finally {
      e.target.value = '';
    }
  };

  // Inline edit a row directly inside the Preview Table and re-validate
  const handleEditPreviewRow = (
    rowNumber: number,
    field: 'studentCode' | 'alias' | 'fullName' | 'grade',
    value: string
  ) => {
    const updatedRaw: string[][] = previewRows.map((r) => {
      if (r.rowNumber === rowNumber) {
        return [
          field === 'studentCode' ? value : r.studentCode,
          field === 'alias' ? value : r.alias,
          field === 'fullName' ? value : r.fullName,
          field === 'grade' ? value : r.normalizedGrade || r.rawGrade,
        ];
      }
      return [
        r.studentCode,
        r.alias,
        r.fullName,
        r.normalizedGrade || r.rawGrade,
      ];
    });

    const existingCodes = students.map((s) => s.studentCode.toUpperCase());
    const validated = validateAndPreviewStudentExcelRows(updatedRaw, existingCodes);
    setPreviewRows(validated.rows);
  };

  const handleRemovePreviewRow = (rowNumber: number) => {
    const remainingRaw: string[][] = previewRows
      .filter((r) => r.rowNumber !== rowNumber)
      .map((r) => [
        r.studentCode,
        r.alias,
        r.fullName,
        r.normalizedGrade || r.rawGrade,
      ]);
    const existingCodes = students.map((s) => s.studentCode.toUpperCase());
    const validated = validateAndPreviewStudentExcelRows(remainingRaw, existingCodes);
    setPreviewRows(validated.rows);
  };

  const handleBulkCreateStudents = async () => {
    const actionableRows = previewRows.filter(
      (r) =>
        r.status === 'valid_new' || (updateExistingMode && r.status === 'valid_update')
    );

    if (actionableRows.length === 0) {
      onShowToast?.(
        'error',
        'Không có dòng hợp lệ để nhập',
        'Vui lòng sửa các dòng báo lỗi đỏ hoặc bật chế độ Cập nhật hồ sơ hiện có.'
      );
      return;
    }

    setSubmittingStudent(true);
    try {
      const token = await getValidBearerToken();
      const res = await fetch(
        getApiUrl(`/api/teacher/classes/${encodeURIComponent(selectedClassCode)}/students`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            updateExisting: updateExistingMode,
            students: actionableRows.map((r) => ({
              studentCode: r.studentCode,
              alias: r.alias,
              fullName: r.fullName,
              displayName: r.alias || r.fullName,
              grade: r.normalizedGrade || r.rawGrade || currentDefaultGradeLabel,
            })),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        onShowToast?.('error', 'Không thể nhập danh sách', data.error || 'Vui lòng kiểm tra lại.');
        return;
      }

      setShowBulkModal(false);
      await fetchClassStudents(selectedClassCode);
      await fetchManagedClasses();

      if (Array.isArray(data.loginCardsOneTime) && data.loginCardsOneTime.length > 0) {
        setOneTimeCards(data.loginCardsOneTime);
        setShowPrintCardsModal(true);
      }

      const createdMsg = data.createdCount ? `Tạo mới ${data.createdCount} HS` : '';
      const updatedMsg = data.updatedCount ? `Cập nhật ${data.updatedCount} HS` : '';
      const combinedMsg = [createdMsg, updatedMsg].filter(Boolean).join(' · ');

      onShowToast?.(
        'success',
        `Nhập Excel thành công (${combinedMsg || 'Hoàn tất'})`,
        data.loginCardsOneTime?.length > 0
          ? 'Vui lòng in hoặc tải danh sách thẻ đăng nhập (kèm PIN ban đầu) trước khi đóng cửa sổ.'
          : 'Đã cập nhật hồ sơ học sinh mà không làm thay đổi mã PIN hiện tại.'
      );
    } finally {
      setSubmittingStudent(false);
    }
  };

  const handleToggleStudentStatus = async (student: StudentAccountSummary) => {
    const targetStatus = student.status === 'active' ? 'locked' : 'active';
    try {
      const token = await getValidBearerToken();
      const res = await fetch(
        getApiUrl(`/api/teacher/students/${encodeURIComponent(student.id)}/status`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ status: targetStatus }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        onShowToast?.('error', 'Thao tác thất bại', data.error || 'Không thể đổi trạng thái.');
        return;
      }
      await fetchClassStudents(selectedClassCode);
      onShowToast?.(
        'info',
        targetStatus === 'locked' ? 'Đã khóa tài khoản học sinh' : 'Đã mở khóa tài khoản',
        `Mã HS ${student.studentCode} hiện ở trạng thái: ${
          targetStatus === 'locked' ? 'Đã khóa' : 'Đang hoạt động'
        }.`
      );
    } catch {
      onShowToast?.('error', 'Lỗi kết nối', 'Không thể kết nối máy chủ.');
    }
  };

  const handleResetStudentPin = async (student: StudentAccountSummary) => {
    try {
      const token = await getValidBearerToken();
      const res = await fetch(
        getApiUrl(`/api/teacher/students/${encodeURIComponent(student.id)}/reset-pin`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        onShowToast?.('error', 'Không thể cấp lại PIN', data.error || 'Vui lòng thử lại.');
        return;
      }
      await fetchClassStudents(selectedClassCode);
      if (data.loginCardOneTime) {
        setOneTimeCards([data.loginCardOneTime]);
        setShowPrintCardsModal(true);
      }
      onShowToast?.(
        'success',
        'Đã cấp mã PIN mới',
        `Mã PIN mới của học sinh (${student.studentCode}) đang hiển thị trên thẻ in.`
      );
    } catch {
      onShowToast?.('error', 'Lỗi kết nối', 'Không thể kết nối máy chủ.');
    }
  };

  const handleDownloadCardsCsv = () => {
    if (oneTimeCards.length === 0) return;
    const header =
      'Mã lớp,Lớp,Mã HS,Bí danh (Công khai),Tên HS (Chỉ GV lưu nội bộ),Mã PIN ban đầu,Thời điểm cấp\n';
    const rows = oneTimeCards
      .map(
        (c) =>
          `"${c.classCode}","${normalizeGrade(c.grade || c.className)}","${c.studentCode}","${(
            c.alias || c.displayName
          ).replace(/"/g, '""')}","${(c.fullName || c.displayName).replace(/"/g, '""')}","${
            c.initialPin
          }","${new Date(c.issuedAt).toLocaleString('vi-VN')}"`
      )
      .join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `The-Dang-Nhap-Artverse-${selectedClassCode}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isTeacher && !isAdmin) {
    return null;
  }

  const previewSummary = {
    total: previewRows.length,
    validNewCount: previewRows.filter((r) => r.status === 'valid_new').length,
    validUpdateCount: previewRows.filter((r) => r.status === 'valid_update').length,
    duplicateInFileCount: previewRows.filter((r) => r.status === 'duplicate_in_file').length,
    invalidCount: previewRows.filter((r) => r.status === 'invalid').length,
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200/90 p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-200/80">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#1D4ED8] text-[11px] font-bold border border-blue-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Phương án A · Chuẩn Excel 4 Cột &amp; Bảo mật Tên thật Học sinh</span>
          </div>
          <h2 className="font-editorial text-xl sm:text-2xl font-bold text-[#121316]">
            Quản lý Tài khoản Học sinh &amp; Nhập danh sách Excel chuẩn
          </h2>
          <p className="text-xs text-stone-600">
            Cấu trúc 4 cột cố định: <strong>Mã HS · Bí danh (Công khai) · Tên HS (Bảo mật) · Lớp</strong>.
            Tên thật của học sinh chỉ Giáo viên phụ trách &amp; Admin xem, tuyệt đối không xuất hiện công khai.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => downloadStandardStudentExcelTemplate()}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4 text-amber-700" />
            <span>Tải mẫu Excel chuẩn (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateClassForm((prev) => !prev)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <School className="w-4 h-4 text-[#1D4ED8]" />
            <span>+ Tạo Mã lớp mới</span>
          </button>

          <button
            type="button"
            onClick={() => {
              rebuildPreviewFromText(bulkText);
              setShowBulkModal(true);
            }}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Nhập danh sách từ Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Create New Class Collapse Form */}
      {showCreateClassForm && (
        <form
          onSubmit={handleCreateClass}
          className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              Mã lớp duy nhất *
            </label>
            <input
              type="text"
              value={newClassCode}
              onChange={(e) => setNewClassCode(e.target.value.toUpperCase())}
              placeholder="VD: LOP6A1, MT7B..."
              className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold uppercase text-stone-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              Cấp lớp chuẩn (Lớp 1 – Lớp 9) *
            </label>
            <select
              value={newClassGrade}
              onChange={(e) => setNewClassGrade(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-900"
            >
              {STANDARD_GRADES.map((g) => (
                <option key={g.gradeNumber} value={g.gradeNumber}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              Tên hiển thị phòng lớp
            </label>
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder={`VD: Lớp ${newClassGrade}A1`}
              className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={creatingClass}
              className="flex-1 py-2 px-3 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold cursor-pointer"
            >
              {creatingClass ? 'Đang tạo...' : 'Lưu Mã lớp'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateClassForm(false)}
              className="py-2 px-2.5 rounded-xl bg-white border border-stone-300 text-stone-600 text-xs font-bold cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </form>
      )}

      {/* Class Selector Pills */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-stone-700">
            Chọn lớp phụ trách để quản lý học sinh:
          </span>
          {loadingClasses && (
            <span className="text-[11px] text-stone-400">Đang tải danh sách lớp...</span>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {managedClasses.map((cls) => {
            const active = selectedClassCode === cls.classCode;
            return (
              <button
                key={cls.classCode}
                type="button"
                onClick={() => setSelectedClassCode(cls.classCode)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border ${
                  active
                    ? 'bg-[#121316] text-white border-[#121316] shadow-xs'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                }`}
              >
                <span>{normalizeGrade(cls.grade)}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    active ? 'bg-[#1D4ED8] text-white' : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  Mã: {cls.classCode}
                </span>
                <span className="text-[10px] opacity-80">({cls.studentCount || 0} HS)</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Add Single Student Form (Aligned with 4-Column Structure: Mã HS, Bí danh, Tên HS, Lớp) */}
      <form
        onSubmit={handleCreateSingleStudent}
        className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200/90 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
      >
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-stone-700 mb-1">
            Cột D: Lớp
          </label>
          <input
            type="text"
            disabled
            value={`${currentDefaultGradeLabel} (${selectedClassCode})`}
            className="w-full px-3 py-2.5 rounded-xl bg-stone-200/70 border border-stone-300 text-xs font-bold text-stone-700"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-stone-700 mb-1">
            Cột A: Mã HS *
          </label>
          <input
            type="text"
            value={studentCodeInput}
            onChange={(e) => setStudentCodeInput(e.target.value.toUpperCase())}
            placeholder="VD: 001, HS01..."
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-stone-300 text-xs font-mono font-bold uppercase text-stone-900 placeholder:normal-case placeholder:font-sans placeholder:font-normal"
          />
        </div>

        <div className="sm:col-span-3">
          <label className="block text-[11px] font-bold text-emerald-800 mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            <span>Cột B: Bí danh (Công khai)</span>
          </label>
          <input
            type="text"
            value={studentAliasInput}
            onChange={(e) => setStudentAliasInput(e.target.value)}
            placeholder="VD: Cọ Nhỏ 01 (Để trống HS tự đặt)"
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-stone-300 text-xs text-stone-900"
          />
        </div>

        <div className="sm:col-span-3">
          <label className="block text-[11px] font-bold text-amber-900 mb-1 flex items-center gap-1">
            <EyeOff className="w-3 h-3 text-amber-700" />
            <span>Cột C: Tên HS (Bảo mật) *</span>
          </label>
          <input
            type="text"
            value={studentFullNameInput}
            onChange={(e) => setStudentFullNameInput(e.target.value)}
            placeholder="VD: Nguyễn Văn A (Chỉ GV xem)"
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-stone-300 text-xs text-stone-900"
          />
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submittingStudent}
            className="w-full min-h-[40px] py-2.5 px-3 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#FBBF24]" />
            <span>Tạo &amp; Cấp PIN</span>
          </button>
        </div>
      </form>

      {/* Student List Table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#121316] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1D4ED8]" />
            <span>
              Danh sách Tài khoản Học sinh — Mã lớp{' '}
              <strong className="text-[#1D4ED8]">{selectedClassCode}</strong> (
              {filteredStudents.length}/{students.length} học sinh)
            </span>
          </h3>
          <span className="text-[11px] text-stone-500">
            Cột &ldquo;Tên HS&rdquo; được bảo mật nội bộ cho Giáo viên &amp; Admin · Triển lãm chỉ hiển thị &ldquo;Bí danh&rdquo;
          </span>
        </div>

        {/* Search & Filter Bar for QUẢN LÝ HỌC SINH (III.5) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-stone-50 p-3 rounded-xl border border-stone-200">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={studentSearchQuery}
              onChange={(e) => setStudentSearchQuery(e.target.value)}
              placeholder="Tìm học sinh theo Mã HS, Bí danh công khai, Họ tên nội bộ, Lớp..."
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-white border border-stone-300 text-xs text-stone-900 focus:outline-none focus:border-[#1D4ED8]"
            />
            {studentSearchQuery && (
              <button
                type="button"
                onClick={() => setStudentSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={studentStatusFilter}
            onChange={(e) => setStudentStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-lg bg-white border border-stone-300 text-xs font-bold text-stone-800"
          >
            <option value="all">Tất cả trạng thái ({students.length})</option>
            <option value="active">Đang hoạt động</option>
            <option value="locked">Đã khóa</option>
          </select>
        </div>

        {loadingStudents ? (
          <div className="py-8 text-center text-xs text-stone-500">
            Đang tải danh sách tài khoản học sinh...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 rounded-2xl bg-stone-50 border border-dashed border-stone-300 text-center space-y-2">
            <p className="text-xs font-bold text-stone-700">
              {students.length === 0
                ? `Lớp ${selectedClassCode} chưa có tài khoản học sinh nào.`
                : 'Không tìm thấy học sinh phù hợp với từ khóa hoặc bộ lọc.'}
            </p>
            <p className="text-[11px] text-stone-500">
              Hãy thêm học sinh bằng biểu mẫu bên trên hoặc bấm &ldquo;Nhập danh sách từ Excel (.xlsx)&rdquo; theo đúng 4 cột chuẩn.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-stone-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100/90 text-stone-600 border-b border-stone-200 text-[11px] uppercase">
                  <th className="py-3 px-3.5 font-bold">Cột A: Mã HS</th>
                  <th className="py-3 px-3.5 font-bold text-emerald-800">
                    Cột B: Bí danh (Công khai)
                  </th>
                  <th className="py-3 px-3.5 font-bold text-amber-900">
                    Cột C: Tên HS (Chỉ GV &amp; Admin)
                  </th>
                  <th className="py-3 px-3.5 font-bold">Cột D: Lớp</th>
                  <th className="py-3 px-3.5 font-bold">Trạng thái</th>
                  <th className="py-3 px-3.5 font-bold">Đăng nhập gần nhất</th>
                  <th className="py-3 px-3.5 font-bold text-right">Quản lý PIN &amp; Khóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/70 bg-white">
                {filteredStudents.map((stu) => {
                  const publicAlias = stu.alias || stu.displayName;
                  const privateFullName = stu.fullName || stu.displayName;
                  return (
                    <tr key={stu.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3 px-3.5 font-mono font-bold text-[#1D4ED8]">
                        {stu.studentCode}
                      </td>
                      <td className="py-3 px-3.5">
                        {stu.needsAliasSetup ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                            Chờ HS tự đặt lần đầu ({publicAlias})
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200/80">
                            {publicAlias}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 font-semibold text-stone-900">
                        <span className="inline-flex items-center gap-1.5">
                          <EyeOff className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>{privateFullName}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-stone-700 font-semibold">
                        {normalizeGrade(stu.grade || stu.className || stu.classGroupId)}
                      </td>
                      <td className="py-3 px-3.5">
                        {stu.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                            <Lock className="w-3 h-3" />
                            Đã khóa
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-[11px] text-stone-500">
                        {stu.lastLoginAt
                          ? new Date(stu.lastLoginAt).toLocaleString('vi-VN')
                          : 'Chưa đăng nhập'}
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleResetStudentPin(stu)}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            title="Cấp lại mã PIN ngẫu nhiên mới"
                          >
                            <KeyRound className="w-3 h-3 text-amber-700" />
                            <span>Cấp lại PIN</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStudentStatus(stu)}
                            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                              stu.status === 'active'
                                ? 'bg-stone-100 hover:bg-rose-50 text-stone-700 hover:text-rose-700 border-stone-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {stu.status === 'active' ? (
                              <>
                                <Lock className="w-3 h-3" />
                                <span>Khóa</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3" />
                                <span>Mở khóa</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Standardized 4-Column Excel Import + Interactive Preview Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-3xl border border-stone-200 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold">
                    Nhập Danh sách Học sinh từ Excel Chuẩn 4 Cột — Mã lớp: {selectedClassCode}
                  </h3>
                  <p className="text-[11px] text-stone-300">
                    Cột A: Mã HS (Text) · Cột B: Bí danh (Công khai) · Cột C: Tên HS (Bảo mật) · Cột D: Lớp (Lớp 1 – Lớp 9)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {/* Step 1: Download Standard Excel Template or Upload File */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-stone-900">
                    Bước 1: Tải file mẫu Excel chuẩn (.xlsx) hoặc chọn file Excel từ máy tính
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Cột <strong>Mã HS</strong> được định dạng kiểu <code>Text</code> để giữ nguyên số{' '}
                    <code>0</code> ở đầu (ví dụ: <code>001</code>, <code>002</code>).
                    {loadedFileName ? ` Đang nạp tệp: "${loadedFileName}"` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadStandardStudentExcelTemplate()}
                    className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-700" />
                    <span>Tải mẫu Excel chuẩn (.xlsx)</span>
                  </button>

                  <input
                    ref={excelFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.tsv,.txt"
                    onChange={handleExcelFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => excelFileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Chọn file Excel (.xlsx / .csv)</span>
                  </button>
                </div>
              </div>

              {/* Quick Paste Box (Optional alternative to file upload) */}
              <details className="rounded-2xl border border-stone-200 bg-white p-3.5 text-xs">
                <summary className="font-bold text-stone-700 cursor-pointer select-none">
                  Hoặc dán nhanh dữ liệu 4 cột từ bảng tính Excel (Mã HS | Bí danh | Tên HS | Lớp)
                </summary>
                <div className="mt-3 space-y-2">
                  <textarea
                    rows={4}
                    value={bulkText}
                    onChange={(e) => {
                      setBulkText(e.target.value);
                      rebuildPreviewFromText(e.target.value);
                    }}
                    className="w-full p-3 rounded-xl bg-stone-50 border border-stone-300 font-mono text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                    placeholder="001&#9;Cọ Nhỏ 01&#9;Nguyễn Văn A&#9;Lớp 6"
                  />
                </div>
              </details>

              {/* Step 2: Validation Summary Counters & Update Mode Toggle */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-700">
                    Bước 2: Bảng Xem Trước &amp; Kiểm Tra Dữ Liệu Trước Khi Nhập ({previewSummary.total}{' '}
                    dòng)
                  </h4>

                  <label className="inline-flex items-center gap-2 text-xs font-bold text-stone-800 bg-blue-50/80 border border-blue-200 px-3 py-1.5 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateExistingMode}
                      onChange={(e) => setUpdateExistingMode(e.target.checked)}
                      className="rounded text-[#1D4ED8]"
                    />
                    <span>
                      Cập nhật hồ sơ học sinh đã tồn tại (không tạo tài khoản trùng, giữ nguyên PIN)
                    </span>
                  </label>
                </div>

                {/* 4 Status Counters required by Audit Spec */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <span className="font-bold text-emerald-900">Hợp lệ (Tạo mới):</span>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-extrabold">
                      {previewSummary.validNewCount}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                    <span className="font-bold text-blue-900">Đã tồn tại (Cập nhật):</span>
                    <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white font-extrabold">
                      {previewSummary.validUpdateCount}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                    <span className="font-bold text-amber-900">Bị trùng trong file:</span>
                    <span className="px-2 py-0.5 rounded-lg bg-amber-600 text-white font-extrabold">
                      {previewSummary.duplicateInFileCount}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                    <span className="font-bold text-rose-900">Không hợp lệ / Lỗi:</span>
                    <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-extrabold">
                      {previewSummary.invalidCount}
                    </span>
                  </div>
                </div>

                {/* Interactive Preview Table allowing inline correction before import */}
                <div className="overflow-x-auto rounded-2xl border border-stone-200 max-h-72">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-stone-100 text-stone-700 border-b border-stone-200 text-[11px] uppercase z-10">
                      <tr>
                        <th className="py-2.5 px-3 font-bold">#</th>
                        <th className="py-2.5 px-3 font-bold">Cột A: Mã HS *</th>
                        <th className="py-2.5 px-3 font-bold text-emerald-800">
                          Cột B: Bí danh (Công khai)
                        </th>
                        <th className="py-2.5 px-3 font-bold text-amber-900">
                          Cột C: Tên HS (Bảo mật) *
                        </th>
                        <th className="py-2.5 px-3 font-bold">Cột D: Lớp (1–9) *</th>
                        <th className="py-2.5 px-3 font-bold">Trạng thái kiểm tra</th>
                        <th className="py-2.5 px-3 font-bold text-right">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 bg-white">
                      {previewRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-stone-400">
                            Chưa có dữ liệu xem trước. Hãy chọn file Excel (.xlsx) hoặc dán dữ liệu ở trên.
                          </td>
                        </tr>
                      ) : (
                        previewRows.map((row) => {
                          const isError =
                            row.status === 'invalid' || row.status === 'duplicate_in_file';
                          return (
                            <tr
                              key={row.rowNumber}
                              className={
                                isError
                                  ? 'bg-rose-50/70'
                                  : row.status === 'valid_update'
                                    ? 'bg-blue-50/40'
                                    : 'hover:bg-stone-50'
                              }
                            >
                              <td className="py-2 px-3 font-mono text-[11px] text-stone-500">
                                Dòng {row.rowNumber}
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={row.studentCode}
                                  onChange={(e) =>
                                    handleEditPreviewRow(
                                      row.rowNumber,
                                      'studentCode',
                                      e.target.value
                                    )
                                  }
                                  placeholder="001"
                                  className="w-24 px-2 py-1 rounded-lg border border-stone-300 font-mono font-bold text-stone-900 bg-white"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={row.alias}
                                  onChange={(e) =>
                                    handleEditPreviewRow(row.rowNumber, 'alias', e.target.value)
                                  }
                                  placeholder="(Trống = HS tự đặt)"
                                  className="w-36 px-2 py-1 rounded-lg border border-stone-300 text-emerald-900 font-semibold bg-white"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={row.fullName}
                                  onChange={(e) =>
                                    handleEditPreviewRow(row.rowNumber, 'fullName', e.target.value)
                                  }
                                  placeholder="Nguyễn Văn A"
                                  className="w-40 px-2 py-1 rounded-lg border border-stone-300 text-stone-900 bg-white"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={row.normalizedGrade || row.rawGrade}
                                  onChange={(e) =>
                                    handleEditPreviewRow(row.rowNumber, 'grade', e.target.value)
                                  }
                                  placeholder="Lớp 6"
                                  className="w-24 px-2 py-1 rounded-lg border border-stone-300 text-stone-900 font-semibold bg-white"
                                />
                              </td>
                              <td className="py-2 px-3">
                                {row.status === 'valid_new' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>
                                      Hợp lệ · Tạo mới
                                      {!row.alias.trim() ? ' (HS sẽ đặt Bí danh lần đầu)' : ''}
                                    </span>
                                  </span>
                                )}
                                {row.status === 'valid_update' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700">
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>
                                      {updateExistingMode
                                        ? 'Đã tồn tại · Sẽ cập nhật hồ sơ'
                                        : 'Đã tồn tại · Bỏ qua'}
                                    </span>
                                  </span>
                                )}
                                {(row.status === 'invalid' ||
                                  row.status === 'duplicate_in_file') && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{row.errors.join(' | ')}</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePreviewRow(row.rowNumber)}
                                  className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  title="Xóa dòng này khỏi danh sách nhập"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-[11px] text-stone-600">
                Chỉ các dòng <strong>Hợp lệ</strong> mới được lưu vào hệ thống. Bạn có thể sửa trực tiếp trên bảng xem trước hoặc hủy bỏ.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-200/80 hover:bg-stone-300 text-stone-700 text-xs font-bold cursor-pointer"
                >
                  Hủy nhập
                </button>
                <button
                  type="button"
                  onClick={handleBulkCreateStudents}
                  disabled={
                    submittingStudent ||
                    previewSummary.validNewCount +
                      (updateExistingMode ? previewSummary.validUpdateCount : 0) ===
                      0
                  }
                  className="px-5 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:bg-stone-300 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${submittingStudent ? 'animate-spin' : ''}`} />
                  <span>
                    Xác nhận Nhập (
                    {previewSummary.validNewCount +
                      (updateExistingMode ? previewSummary.validUpdateCount : 0)}{' '}
                    học sinh)
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* One-Time Printable Student Login Cards Modal */}
      {showPrintCardsModal && oneTimeCards.length > 0 && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-3xl border border-stone-200 shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 bg-gradient-to-r from-[#1D4ED8] to-indigo-800 text-white flex flex-wrap items-center justify-between gap-3 no-print">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-[#FBBF24]" />
                  <span>
                    Thẻ Đăng nhập Học sinh ({oneTimeCards.length} thẻ) — Chỉ hiển thị 1 lần duy nhất
                  </span>
                </h3>
                <p className="text-[11px] text-blue-100">
                  Vì lý do bảo mật, hệ thống chỉ lưu mã băm Bcrypt và không lưu mã PIN gốc. Hãy in hoặc tải danh sách thẻ này trước khi đóng cửa sổ!
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCardsCsv}
                  className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải file CSV/Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-[#FBBF24] hover:bg-amber-400 text-stone-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>In thẻ đăng nhập</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPrintCardsModal(false);
                    setOneTimeCards([]);
                  }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  title="Đóng (Mã PIN sẽ được ẩn vĩnh viễn)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 no-print">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Lưu ý bảo mật:</strong> Sau khi đóng bảng này, mã PIN gốc sẽ không bao giờ
                  hiển thị lại. Nếu học sinh làm mất thẻ, Giáo viên có thể bấm nút{' '}
                  <strong>&ldquo;Cấp lại PIN&rdquo;</strong> để sinh mã PIN mới.
                </span>
              </div>

              {/* Printable Grid of Student Login Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2">
                {oneTimeCards.map((card) => (
                  <div
                    key={card.id}
                    className="p-4 rounded-2xl border-2 border-dashed border-stone-400 bg-[#FAF8F5] space-y-2.5 break-inside-avoid"
                  >
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                      <span className="font-editorial font-bold text-sm text-[#121316]">
                        ARTVERSE AI
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-[#1D4ED8] text-[10px] font-bold">
                        {normalizeGrade(card.grade || card.className)}
                      </span>
                    </div>

                    <div className="text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">Bí danh nghệ thuật:</span>
                        <strong className="text-emerald-800">
                          {card.alias || card.displayName}
                        </strong>
                      </div>
                      {card.fullName && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-stone-400">Họ tên (Phát thẻ):</span>
                          <span className="font-semibold text-stone-700">{card.fullName}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">1. Mã lớp:</span>
                        <code className="px-2 py-0.5 rounded bg-white border border-stone-300 font-mono font-extrabold text-[#1D4ED8]">
                          {card.classCode}
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">2. Mã HS:</span>
                        <code className="px-2 py-0.5 rounded bg-white border border-stone-300 font-mono font-extrabold text-stone-900">
                          {card.studentCode}
                        </code>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-stone-500 font-bold">3. Mã PIN ban đầu:</span>
                        <code className="px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-300 font-mono text-sm font-extrabold tracking-widest text-amber-950">
                          {card.initialPin}
                        </code>
                      </div>
                    </div>

                    <p className="text-[10px] text-stone-500 pt-1 border-t border-stone-200/80 text-center">
                      Giữ kín mã PIN · Triển lãm chỉ hiển thị Bí danh nghệ thuật
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

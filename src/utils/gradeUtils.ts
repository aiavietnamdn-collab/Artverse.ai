/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Hàm chuẩn hóa cấp lớp tập trung (Lớp 1 -> Lớp 9)
 *
 * Quy ước hiển thị duy nhất trên toàn hệ thống:
 * Lớp 1, Lớp 2, Lớp 3, Lớp 4, Lớp 5, Lớp 6, Lớp 7, Lớp 8, Lớp 9
 * Nếu dữ liệu không xác định hoặc ngoài phạm vi 1..9: "Chưa xác định"
 */

export type StandardGradeLabel =
  | 'Lớp 1'
  | 'Lớp 2'
  | 'Lớp 3'
  | 'Lớp 4'
  | 'Lớp 5'
  | 'Lớp 6'
  | 'Lớp 7'
  | 'Lớp 8'
  | 'Lớp 9';

export const UNKNOWN_GRADE_LABEL = 'Chưa xác định' as const;

export interface StandardGradeOption {
  gradeNumber: number;
  label: StandardGradeLabel;
  classId: string;
}

export const STANDARD_GRADES: readonly StandardGradeOption[] = [
  { gradeNumber: 1, label: 'Lớp 1', classId: 'cls-1' },
  { gradeNumber: 2, label: 'Lớp 2', classId: 'cls-2' },
  { gradeNumber: 3, label: 'Lớp 3', classId: 'cls-3' },
  { gradeNumber: 4, label: 'Lớp 4', classId: 'cls-4' },
  { gradeNumber: 5, label: 'Lớp 5', classId: 'cls-5' },
  { gradeNumber: 6, label: 'Lớp 6', classId: 'cls-6' },
  { gradeNumber: 7, label: 'Lớp 7', classId: 'cls-7' },
  { gradeNumber: 8, label: 'Lớp 8', classId: 'cls-8' },
  { gradeNumber: 9, label: 'Lớp 9', classId: 'cls-9' },
] as const;

export const STANDARD_GRADE_LABELS: readonly StandardGradeLabel[] = STANDARD_GRADES.map(
  (g) => g.label
);

/**
 * Trích xuất số lớp hợp lệ trong khoảng 1..9 từ chuỗi hoặc số đầu vào.
 * Trả về null nếu không xác định được hoặc ngoài khoảng 1..9.
 */
export function extractGradeNumber(input?: string | number | null): number | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === 'number') {
    if (Number.isInteger(input) && input >= 1 && input <= 9) {
      return input;
    }
    return null;
  }

  if (typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();

  // 1. Trường hợp chỉ có chữ số thuần túy: "1" .. "9"
  if (/^[1-9]$/.test(lower)) {
    return Number(lower);
  }

  // Nếu là số nhiều chữ số (ví dụ "10", "11", "12", "0") -> ngoài phạm vi 1..9
  if (/^\d+$/.test(lower)) {
    return null;
  }

  // 2. Trường hợp chuẩn hóa các biến thể phổ biến:
  // "Lớp 1", "lớp 1", "lop 1", "Khối 1", "khối 1", "khoi 1",
  // "Grade 1", "grade-1", "cls-1", "class-grade-1", "Lớp 1 - Khối 1", "Lớp 6A1", "6A"
  const prefixPattern =
    /^(?:lớp|lop|khối|khoi|grade|cls|class|class-grade|lớp\s*\d+\s*-\s*khối)[\s\-_.:]*([1-9])(?:[a-z]\d*)?(?:\b|\s|$|-)/i;
  const prefixMatch = lower.match(prefixPattern);
  if (prefixMatch && prefixMatch[1]) {
    // Kiểm tra chắc chắn không phải số 10..19 (ví dụ "Lớp 10", "Khối 12")
    const afterPrefix = lower.match(
      /^(?:lớp|lop|khối|khoi|grade|cls|class|class-grade)[\s\-_.:]*(\d+)/i
    );
    if (afterPrefix && afterPrefix[1]) {
      const numericVal = Number(afterPrefix[1]);
      if (numericVal >= 1 && numericVal <= 9) {
        return numericVal;
      }
      return null;
    }
    return Number(prefixMatch[1]);
  }

  // 3. Trường hợp mã lớp kiểu "6A", "6A1", "7B", "9C2"
  const classCodeMatch = lower.match(/^([1-9])[a-z]\d*$/i);
  if (classCodeMatch && classCodeMatch[1]) {
    return Number(classCodeMatch[1]);
  }

  // 4. Trường hợp chuỗi có chứa "lớp X" hoặc "khối X" hoặc "grade X" ở bất kỳ vị trí nào (ví dụ "Mĩ thuật Lớp 6", "Tranh Khối 8")
  const embeddedMatch = lower.match(/(?:lớp|lop|khối|khoi|grade|cls)[\s\-_.:]*(\d+)/i);
  if (embeddedMatch && embeddedMatch[1]) {
    const num = Number(embeddedMatch[1]);
    if (num >= 1 && num <= 9) {
      return num;
    }
    return null;
  }

  return null;
}

/**
 * Hàm chuẩn hóa tên lớp duy nhất trên toàn hệ thống ARTVERSE AI.
 * - Đầu vào: "1", "Lớp 1", "lớp 1", "Khối 1", "khối 1", "Grade 1", "grade-1", "cls-1", v.v.
 * - Đầu ra: "Lớp 1" .. "Lớp 9", hoặc "Chưa xác định" nếu ngoài phạm vi 1..9 / không hợp lệ.
 */
export function normalizeGrade(
  input?: string | number | null
): StandardGradeLabel | typeof UNKNOWN_GRADE_LABEL {
  const num = extractGradeNumber(input);
  if (num !== null && num >= 1 && num <= 9) {
    return `Lớp ${num}` as StandardGradeLabel;
  }
  return UNKNOWN_GRADE_LABEL;
}

/**
 * Chuẩn hóa nhãn lớp cho một tác phẩm hoặc bài học dựa trên cả `className` và `classGroupId`
 * mà không cần sửa đổi dữ liệu gốc trong Firestore.
 */
export function getArtworkNormalizedGrade(item?: {
  className?: string | null;
  classGroupId?: string | null;
}): StandardGradeLabel | typeof UNKNOWN_GRADE_LABEL {
  if (!item) return UNKNOWN_GRADE_LABEL;

  const fromName = normalizeGrade(item.className);
  if (fromName !== UNKNOWN_GRADE_LABEL) {
    return fromName;
  }

  const fromGroupId = normalizeGrade(item.classGroupId);
  if (fromGroupId !== UNKNOWN_GRADE_LABEL) {
    return fromGroupId;
  }

  return UNKNOWN_GRADE_LABEL;
}

/**
 * Chuyển đổi từ nhãn lớp hoặc giá trị bất kỳ sang mã `classGroupId` chuẩn (`cls-1` .. `cls-9`).
 */
export function getStandardClassIdFromGrade(input?: string | number | null): string {
  const num = extractGradeNumber(input);
  if (num !== null && num >= 1 && num <= 9) {
    return `cls-${num}`;
  }
  return '';
}

/**
 * Kiểm tra một tác phẩm/bài học có khớp với bộ lọc lớp đang chọn hay không.
 * Hỗ trợ đầy đủ dữ liệu cũ ("Khối 6", "khối 6", "cls-6", "6", "Lớp 6", "class-grade-6").
 */
export function doesArtworkMatchGradeFilter(
  item: { className?: string | null; classGroupId?: string | null },
  selectedFilter: string
): boolean {
  if (!selectedFilter || selectedFilter === 'all') {
    return true;
  }

  const filterGrade = normalizeGrade(selectedFilter);
  const itemGrade = getArtworkNormalizedGrade(item);

  if (filterGrade !== UNKNOWN_GRADE_LABEL) {
    return itemGrade === filterGrade;
  }

  // Trường hợp lọc theo tác phẩm "Chưa xác định"
  if (selectedFilter === UNKNOWN_GRADE_LABEL) {
    return itemGrade === UNKNOWN_GRADE_LABEL;
  }

  return (
    item.classGroupId === selectedFilter ||
    (item.className || '').trim().toLowerCase() === selectedFilter.trim().toLowerCase()
  );
}

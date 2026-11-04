/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Tiện ích Chuẩn hóa File Excel Tài khoản Học sinh (PHẦN A)
 * Cấu trúc cố định 4 cột:
 * - Cột A: Mã HS (Text — giữ nguyên số 0 ở đầu, dùng để đăng nhập)
 * - Cột B: Bí danh (Text — hiển thị trong triển lãm & hoạt động cộng đồng)
 * - Cột C: Tên HS (Text — chỉ Giáo viên phụ trách & Quản trị viên được xem, KHÔNG công khai)
 * - Cột D: Lớp (Text — chuẩn hóa thành Lớp 1 đến Lớp 9)
 */

import * as XLSX from 'xlsx';
import { ExcelStudentPreviewRow } from '../types/communityArt';

export const EXCEL_EXPECTED_HEADERS = ['Mã HS', 'Bí danh', 'Tên HS', 'Lớp'] as const;

export const SAMPLE_EXCEL_ROWS: Array<[string, string, string, string]> = [
  ['HS001', 'Mây Màu', 'Nguyễn Minh Anh', 'Lớp 3'],
  ['HS002', 'Cọ Nhỏ', 'Trần Gia Bảo', 'Lớp 3'],
  ['HS003', 'Mặt Trời Xanh', 'Lê Hoàng Nam', 'Lớp 4'],
];

/**
 * Strictly validates and normalizes a raw grade string into "Lớp 1" .. "Lớp 9".
 * Returns null if the grade is empty or outside grades 1..9 (e.g., Grade 10, 11, 12, 0, or invalid text).
 */
export function parseAndValidateExcelGrade(rawGrade: string): string | null {
  if (!rawGrade || typeof rawGrade !== 'string') return null;
  const trimmed = rawGrade.trim();
  if (!trimmed) return null;

  // Extract digits from input like "Lớp 3", "Khối 3", "3", "Lớp 3A", "3B"
  const match = trimmed.match(/(?:lớp|lop|khối|khoi|grade|cls-)?\s*0*(\d{1,2})\b/i) || trimmed.match(/^0*(\d{1,2})[a-zA-Z0-9_-]*$/);
  if (!match || !match[1]) return null;

  const num = parseInt(match[1], 10);
  if (isNaN(num) || num < 1 || num > 9) {
    return null;
  }
  return `Lớp ${num}`;
}

/**
 * Generates an ArrayBuffer for the standardized 4-column .xlsx Excel template,
 * explicitly formatting all cells (especially Column A: Mã HS) as Text ('@') to preserve leading zeros.
 */
export function generateStandardStudentExcelBuffer(): ArrayBuffer {
  const aoa: string[][] = [
    [...EXCEL_EXPECTED_HEADERS],
    ...SAMPLE_EXCEL_ROWS.map((r) => [...r]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Force every cell in the template to Text type ('s') with format '@' so Excel never strips leading zeros
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:D4');
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellRef];
      if (cell) {
        cell.t = 's';
        cell.z = '@';
        cell.v = String(cell.v ?? '');
      }
    }
  }

  ws['!cols'] = [
    { wch: 16 }, // Cột A: Mã HS
    { wch: 24 }, // Cột B: Bí danh
    { wch: 28 }, // Cột C: Tên HS
    { wch: 14 }, // Cột D: Lớp
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachHocSinh');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

/**
 * Triggers browser download of the standardized 4-column .xlsx template file.
 */
export function downloadStandardStudentExcelTemplate(): void {
  const buffer = generateStandardStudentExcelBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Mau-Excel-Tai-Khoan-Hoc-Sinh-Artverse.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function isHeaderRow(colA: string, colB: string, colC: string, colD: string): boolean {
  const a = colA.toLowerCase();
  const b = colB.toLowerCase();
  const c = colC.toLowerCase();
  const d = colD.toLowerCase();
  return (
    (a.includes('mã hs') || a.includes('ma hs') || a === 'studentcode' || a === 'mã học sinh') &&
    (b.includes('bí danh') || b.includes('bi danh') || c.includes('tên') || d.includes('lớp'))
  );
}

/**
 * Parses raw 2D array rows (from .xlsx, .xls, .csv, or pasted TSV/CSV text) into validated ExcelStudentPreviewRow items.
 * Preserves leading zeros in Mã HS (Text).
 */
export function validateAndPreviewStudentExcelRows(
  rawRows: Array<Array<string | number | undefined | null>>,
  existingStudentCodesInClass: string[] = []
): {
  rows: ExcelStudentPreviewRow[];
  validNewCount: number;
  validUpdateCount: number;
  duplicateInFileCount: number;
  invalidCount: number;
} {
  const existingSet = new Set(
    existingStudentCodesInClass.map((code) => String(code ?? '').trim().toUpperCase())
  );
  const seenInFile = new Set<string>();
  const previewRows: ExcelStudentPreviewRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i] || [];
    const colA = String(rawRow[0] ?? '').trim();
    const colB = String(rawRow[1] ?? '').trim();
    const colC = String(rawRow[2] ?? '').trim();
    const colD = String(rawRow[3] ?? '').trim();

    // Skip completely empty rows
    if (!colA && !colB && !colC && !colD) {
      continue;
    }

    // Skip header row if present on first row
    if (i === 0 && isHeaderRow(colA, colB, colC, colD)) {
      continue;
    }

    const errors: string[] = [];

    // 1. Validate Column A: Mã HS (Text — keep leading zeros, uppercase)
    const studentCode = colA.toUpperCase().replace(/\s+/g, '');
    if (!studentCode) {
      errors.push('Thiếu Mã HS (Cột A)');
    } else if (!/^[A-Z0-9_-]{1,24}$/i.test(studentCode)) {
      errors.push('Mã HS chứa ký tự không hợp lệ (chỉ dùng chữ, số, gạch ngang/dưới)');
    }

    // 2. Column B: Bí danh (Text — public alias; if empty, student will be prompted on first login)
    const alias = colB;

    // 3. Validate Column C: Tên HS (Text — teacher/admin only)
    const fullName = colC;
    if (!fullName) {
      errors.push('Thiếu Tên HS (Cột C)');
    }

    // 4. Validate & normalize Column D: Lớp (Lớp 1 .. Lớp 9)
    const normalizedGrade = parseAndValidateExcelGrade(colD);
    if (!colD) {
      errors.push('Thiếu Lớp (Cột D)');
    } else if (!normalizedGrade) {
      errors.push(`Lớp "${colD}" không hợp lệ (chỉ chấp nhận Lớp 1 đến Lớp 9)`);
    }

    // 5. Check duplicate studentCode inside the same Excel file
    let isDuplicateInFile = false;
    if (studentCode) {
      if (seenInFile.has(studentCode)) {
        isDuplicateInFile = true;
        errors.push(`Trùng Mã HS "${studentCode}" ngay trong file Excel`);
      } else {
        seenInFile.add(studentCode);
      }
    }

    let status: ExcelStudentPreviewRow['status'] = 'valid_new';
    if (errors.length > 0) {
      status = isDuplicateInFile && errors.length === 1 ? 'duplicate_in_file' : 'invalid';
    } else if (existingSet.has(studentCode)) {
      status = 'valid_update';
    }

    previewRows.push({
      rowNumber: i + 1,
      studentCode,
      alias,
      fullName,
      rawGrade: colD,
      normalizedGrade: normalizedGrade || '',
      status,
      errors,
    });
  }

  return {
    rows: previewRows,
    validNewCount: previewRows.filter((r) => r.status === 'valid_new').length,
    validUpdateCount: previewRows.filter((r) => r.status === 'valid_update').length,
    duplicateInFileCount: previewRows.filter((r) => r.status === 'duplicate_in_file').length,
    invalidCount: previewRows.filter((r) => r.status === 'invalid').length,
  };
}

/**
 * Parses an ArrayBuffer from an uploaded .xlsx, .xls, or .csv file into a 2D string array
 * while preserving leading zeros in Column A (Mã HS).
 */
export function parseExcelFileBufferToRows(buffer: ArrayBuffer): string[][] {
  const wb = XLSX.read(buffer, { type: 'array', raw: false });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Array<string | number | undefined>>(ws, {
    header: 1,
    raw: false,
    defval: '',
  });
  return rows.map((r) => [
    String(r[0] ?? ''),
    String(r[1] ?? ''),
    String(r[2] ?? ''),
    String(r[3] ?? ''),
  ]);
}

/**
 * Parses pasted text (tab-separated, pipe-separated, semicolon-separated, or comma-separated) into 4-column rows.
 */
export function parseTextToFourColumnRows(rawText: string): string[][] {
  const lines = rawText.split(/\r?\n/);
  const result: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const delimiter = line.includes('\t')
      ? '\t'
      : line.includes('|')
      ? '|'
      : line.includes(';')
      ? ';'
      : ',';
    const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));
    result.push([parts[0] || '', parts[1] || '', parts[2] || '', parts[3] || '']);
  }
  return result;
}

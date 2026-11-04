/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Edit Artwork Modal
 * Cho phép chỉnh sửa Tên tác phẩm (bắt buộc), Lớp (bắt buộc) và Tác giả (không bắt buộc)
 */

import React, { useState, useMemo } from 'react';
import { CommunityArtwork, ClassGroup, ArtLesson } from '../../types/communityArt';
import { getArtworkNormalizedGrade, getStandardClassIdFromGrade, normalizeGrade } from '../../utils/gradeUtils';
import { X, Save, Edit3, User, GraduationCap } from 'lucide-react';

const STANDARD_CLASSES: Array<{ id: string; name: string }> = [
  { id: 'cls-1', name: 'Lớp 1' },
  { id: 'cls-2', name: 'Lớp 2' },
  { id: 'cls-3', name: 'Lớp 3' },
  { id: 'cls-4', name: 'Lớp 4' },
  { id: 'cls-5', name: 'Lớp 5' },
  { id: 'cls-6', name: 'Lớp 6' },
  { id: 'cls-7', name: 'Lớp 7' },
  { id: 'cls-8', name: 'Lớp 8' },
  { id: 'cls-9', name: 'Lớp 9' },
];

interface EditArtworkModalProps {
  artwork: CommunityArtwork;
  classes: ClassGroup[];
  lessons: ArtLesson[];
  onClose: () => void;
  onSave: (updated: CommunityArtwork) => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const EditArtworkModal: React.FC<EditArtworkModalProps> = ({
  artwork,
  classes,
  onClose,
  onSave,
  onShowToast
}) => {
  const availableClasses = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const std of STANDARD_CLASSES) {
      map.set(std.id, std);
    }
    for (const c of classes) {
      if (c.id && c.name && !c.isHidden && !map.has(c.id)) {
        map.set(c.id, { id: c.id, name: normalizeGrade(c.name) !== 'Chưa xác định' ? normalizeGrade(c.name) : c.name });
      }
    }
    return Array.from(map.values());
  }, [classes]);

  const initialStdClassId =
    getStandardClassIdFromGrade(artwork.className || artwork.classGroupId) ||
    artwork.classGroupId ||
    'cls-6';

  const [title, setTitle] = useState(artwork.title);
  const [classGroupId, setClassGroupId] = useState(initialStdClassId);
  const [author, setAuthor] = useState(
    artwork.creatorAnonymousPseudonym === 'Khuyết danh' ? '' : (artwork.creatorAnonymousPseudonym || '')
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      onShowToast('error', 'Thiếu tên tác phẩm', 'Vui lòng nhập Tên tác phẩm (bắt buộc).');
      return;
    }
    if (!classGroupId.trim()) {
      onShowToast('error', 'Thiếu thông tin Lớp', 'Vui lòng chọn Lớp (bắt buộc).');
      return;
    }

    const chosenClass = availableClasses.find(c => c.id === classGroupId) || {
      id: classGroupId,
      name: getArtworkNormalizedGrade(artwork) !== 'Chưa xác định' ? getArtworkNormalizedGrade(artwork) : 'Lớp 6'
    };
    const finalAuthor = author.trim() || 'Khuyết danh';

    const updated: CommunityArtwork = {
      ...artwork,
      title: title.trim(),
      classGroupId: chosenClass.id,
      className: chosenClass.name,
      creatorAnonymousPseudonym: finalAuthor,
      lessonId: '',
      lessonTitle: '',
      description: '',
      updatedAt: new Date().toLocaleDateString('vi-VN')
    };

    onSave(updated);
    onClose();
    onShowToast('success', 'Đã cập nhật tác phẩm', `Thông tin của "${updated.title}" (${chosenClass.name}) đã được lưu thành công.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Chỉnh sửa Thông tin Tác phẩm</h3>
              <p className="text-[11px] text-slate-500">Tên tác phẩm (bắt buộc) · Lớp (bắt buộc) · Tác giả (không bắt buộc)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs">
          {/* 1. Title (Required) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Tên tác phẩm <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Nhập tên tác phẩm..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* 2. Class (Required) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
              <span>Lớp <span className="text-rose-500">*</span></span>
            </label>
            <select
              required
              value={classGroupId}
              onChange={(e) => setClassGroupId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">-- Chọn lớp (Bắt buộc) --</option>
              {availableClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Author (Optional) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Tác giả <span className="text-slate-400 font-normal">(Không bắt buộc)</span></span>
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Nhập tên tác giả hoặc để trống..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

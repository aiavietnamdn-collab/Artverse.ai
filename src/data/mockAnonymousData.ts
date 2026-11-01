import { AnonymousSession, AnonymousPortfolioRecord } from '../types/anonymousPortfolio';

export const INITIAL_ANONYMOUS_SESSIONS: AnonymousSession[] = [
  {
    id: 'session-demo-01',
    teacherId: 'teacher-demo-uid',
    teacherName: 'Cô Mai Phương',
    lessonTitle: 'Tạo hình từ vật liệu tái chế bảo vệ môi trường',
    grade: 'Khối 6',
    topic: 'Mĩ thuật ứng dụng & Đời sống (GDPT 2018)',
    sessionToken: 'ARTV-TOKEN-7K9A-2M4P-9X1L-4W8E', // 32-char unguessable token
    rubricTitle: 'Rubric Sản phẩm Tái chế 3D (4 mức độ)',
    isRevoked: false,
    allowSubmissions: true,
    instructions: 'Học sinh tham gia ẩn danh: chụp ảnh bản phác thảo và ảnh sản phẩm hoàn thiện. Không chụp khuôn mặt, bảng tên hoặc đồng phục có thông tin cá nhân.',
    createdAt: '24/10/2026',
    updatedAt: '28/10/2026'
  },
  {
    id: 'session-demo-revoked',
    teacherId: 'teacher-demo-uid',
    teacherName: 'Cô Mai Phương',
    lessonTitle: 'Ký họa góc phố và di sản kiến trúc (Phiên thử nghiệm cũ)',
    grade: 'Khối 7',
    topic: 'Di sản văn hóa & Hội họa',
    sessionToken: 'REVOKED-TOKEN-OLD-X938-2048-EXPIRED',
    rubricTitle: 'Rubric Ký họa chì & màu nước',
    isRevoked: true, // Revoked session to demonstrate security enforcement
    allowSubmissions: false,
    instructions: 'Phiên này đã kết thúc và được giáo viên thu hồi quyền truy cập.',
    createdAt: '15/10/2026',
    updatedAt: '20/10/2026'
  }
];

export const INITIAL_ANONYMOUS_PORTFOLIOS: AnonymousPortfolioRecord[] = [
  {
    id: 'sample-anon-01',
    sessionId: 'session-demo-01',
    sessionToken: 'ARTV-TOKEN-7K9A-2M4P-9X1L-4W8E',
    teacherId: 'teacher-demo-uid',
    portfolioSecretKey: 'sec_key_alpha_9481729014',
    anonymousCode: 'ART-K92X-M4P1',
    lessonTitle: 'Tạo hình từ vật liệu tái chế bảo vệ môi trường',
    topic: 'Mĩ thuật ứng dụng & Đời sống (GDPT 2018)',
    grade: 'Khối 6',
    sketchImage: {
      id: 'img-sk-01',
      type: 'sketch',
      caption: 'Bản vẽ phác thảo cấu trúc chú rùa biển thu gom rác',
      notes: 'Xác định tỉ lệ mai rùa bằng đáy chai nhựa 1.5L và 4 chân bơi bằng bìa carton.',
      visualType: 'pastel',
      uploadedAt: '24/10/2026'
    },
    finalImage: {
      id: 'img-fn-01',
      type: 'final',
      caption: 'Mô hình 3D rùa biển hoàn thiện được sơn phủ màu xanh',
      notes: 'Mai rùa cố định bằng keo nến kết hợp dây dù, mắt rùa bằng hai nắp chai cam.',
      visualType: 'clay',
      uploadedAt: '25/10/2026'
    },
    revisions: [
      {
        id: 'img-rev-01',
        type: 'revision',
        revisionIndex: 1,
        caption: 'Phiên bản cải tiến: Gia cố thêm khớp chân và phủ lớp keo bóng',
        notes: 'Chân rùa được dán thêm thanh que kem trợ lực giúp mô hình đứng vững không bị xẹp.',
        visualType: 'clay',
        uploadedAt: '26/10/2026'
      }
    ],
    selfEvaluation: {
      idea: 'Ý tưởng của em là tạo một chú rùa biển thu gom rác đại dương từ chai nhựa và nắp chai đã qua sử dụng để gửi thông điệp bảo vệ động vật biển.',
      experiments: 'Em đã thử nghiệm 2 cách gắn mai rùa: lần 1 dùng băng dính hai mặt nhưng bị bong, lần 2 em chuyển sang dùng keo nến kết hợp buộc dây dù nhỏ.',
      mostSatisfied: 'Em hài lòng nhất là phần mắt rùa làm từ hai nắp chai màu cam tương phản nổi bật trên mai rùa xanh.',
      biggestChallenge: 'Khó khăn lớn nhất là cắt đáy chai nhựa tròn đều mà không làm méo mó hình khối.',
      whatToChange: 'Nếu làm lại, em sẽ dùng thêm vỏ sò nhỏ nhặt ở biển gắn quanh đế để mô hình thêm sinh động.',
      needSupport: 'Em muốn cô hướng dẫn cách pha màu phủ lên nhựa bóng sao cho màu bám chắc không bị tróc vảy.'
    },
    teacherEvaluation: {
      comment: 'Sản phẩm có ý thức bảo vệ môi trường rất đáng khen. Sự kiên trì khi đổi sang phương án cố định keo nến và dây dù thể hiện tư duy kỹ thuật tốt.',
      guidance: 'Em hãy chà nhẹ giấy nhám lên mặt nhựa trước khi quét sơn acrylic lót để màu bám chắc chắn hơn nhé.',
      rubricLevel: 'exceeded',
      evaluatedAt: '26/10/2026',
      teacherName: 'Cô Mai Phương'
    },
    status: 'evaluated',
    storageLocation: 'demo_sample',
    createdAt: '24/10/2026',
    updatedAt: '26/10/2026'
  },
  {
    id: 'sample-anon-02',
    sessionId: 'session-demo-01',
    sessionToken: 'ARTV-TOKEN-7K9A-2M4P-9X1L-4W8E',
    teacherId: 'teacher-demo-uid',
    portfolioSecretKey: 'sec_key_beta_8302194821',
    anonymousCode: 'ART-W8E3-X1L9',
    lessonTitle: 'Tạo hình từ vật liệu tái chế bảo vệ môi trường',
    topic: 'Mĩ thuật ứng dụng & Đời sống (GDPT 2018)',
    grade: 'Khối 6',
    sketchImage: {
      id: 'img-sk-02',
      type: 'sketch',
      caption: 'Bản vẽ phác thảo cối xay gió tạo năng lượng sạch',
      notes: 'Bố cục tháp cối xay gió hình trụ nón và vị trí trục quay cánh quạt.',
      visualType: 'pastel',
      uploadedAt: '25/10/2026'
    },
    finalImage: {
      id: 'img-fn-02',
      type: 'final',
      caption: 'Mô hình cối xay gió hoàn chỉnh từ lõi giấy và bìa carton',
      notes: 'Thân cối xay sơn màu nâu ngói, cánh quạt quay được nhẹ nhàng khi có gió thổi.',
      visualType: 'clay',
      uploadedAt: '26/10/2026'
    },
    revisions: [
      {
        id: 'img-rev-02',
        type: 'revision',
        revisionIndex: 1,
        caption: 'Phiên bản cải tiến: Thay đổi góc cánh quạt để quay đón gió tốt hơn',
        notes: 'Uốn cong nhẹ mép cánh bìa carton 15 độ theo lời khuyên của bạn cùng bàn.',
        visualType: 'clay',
        uploadedAt: '27/10/2026'
      }
    ],
    selfEvaluation: {
      idea: 'Em muốn làm cối xay gió tạo năng lượng sạch từ lõi giấy vệ sinh và bìa bánh quy để cổ vũ lối sống xanh.',
      experiments: 'Em thử làm 3 cánh quạt và 4 cánh quạt để xem loại nào đứng vững trước gió quạt máy.',
      mostSatisfied: 'Cánh quạt quay trơn tru nhờ trục tăm tre xuyên qua hạt cườm nhỏ.',
      biggestChallenge: 'Làm phần chân tháp cối xay gió đứng thẳng không bị nghiêng ngả.',
      whatToChange: 'Nếu làm lại, em sẽ khoét thêm cửa sổ nhỏ ở thân cối xay gió để có ánh sáng xuyên qua.',
      needSupport: 'Em nhờ cô góp ý xem nên trang trí hoa văn gì lên thân cối xay gió cho đẹp mắt.'
    },
    teacherEvaluation: {
      comment: 'Sáng kiến dùng hạt cườm làm ổ trục quay rất xuất sắc. Kết cấu tháp vững chãi.',
      guidance: 'Em có thể vẽ thêm hoa văn lá cây hoặc họa tiết gạch cổ theo phong cách Hà Lan.',
      rubricLevel: 'achieved',
      evaluatedAt: '27/10/2026',
      teacherName: 'Cô Mai Phương'
    },
    status: 'evaluated',
    storageLocation: 'demo_sample',
    createdAt: '25/10/2026',
    updatedAt: '27/10/2026'
  }
];

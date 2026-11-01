import { 
  ClassGroup, 
  ArtLesson, 
  CommunityArtwork, 
  ArtworkComment, 
  ContentReport,
  AuditLogEntry
} from '../types/communityArt';

export const INITIAL_CLASSES: ClassGroup[] = [
  {
    id: 'cls-6',
    name: 'Khối 6',
    code: 'khoi-6',
    description: 'Tham khảo bài học Mĩ thuật Khối 6 — Khám phá chất liệu tái chế, nghệ thuật cổ đại và di sản dân gian.',
    isHidden: false,
    createdAt: '01/09/2026',
    createdByTeacherId: 'teacher-demo',
    isPublicGalleryEnabled: true,
    assignedTeacherIds: ['teacher-demo', 'current-teacher']
  },
  {
    id: 'cls-7',
    name: 'Khối 7',
    code: 'khoi-7',
    description: 'Tham khảo bài học Mĩ thuật Khối 7 — Thể nghiệm hội họa sơn mài, ký họa dáng người và nhịp điệu kiến trúc.',
    isHidden: false,
    createdAt: '01/09/2026',
    createdByTeacherId: 'teacher-demo',
    isPublicGalleryEnabled: true,
    assignedTeacherIds: ['teacher-demo', 'current-teacher']
  },
  {
    id: 'cls-8',
    name: 'Khối 8',
    code: 'khoi-8',
    description: 'Tham khảo bài học Mĩ thuật Khối 8 — Nghệ thuật hiện đại, thiết kế đồ họa ứng dụng và tạo dáng công nghiệp.',
    isHidden: false,
    createdAt: '01/09/2026',
    createdByTeacherId: 'teacher-demo',
    isPublicGalleryEnabled: true,
    assignedTeacherIds: ['teacher-demo', 'current-teacher']
  },
  {
    id: 'cls-9',
    name: 'Khối 9',
    code: 'khoi-9',
    description: 'Tham khảo bài học Mĩ thuật Khối 9 — Mĩ thuật đương đại, thiết kế truyền thông thị giác và đồ án tổng hợp.',
    isHidden: false,
    createdAt: '01/09/2026',
    createdByTeacherId: 'teacher-demo',
    isPublicGalleryEnabled: true,
    assignedTeacherIds: ['teacher-demo', 'current-teacher']
  }
];

export const INITIAL_LESSONS: ArtLesson[] = [
  // Khối 6 Lessons
  {
    id: 'les-6-01',
    classGroupId: 'cls-6',
    className: 'Khối 6',
    grade: '6',
    title: 'Bài 1: Tạo hình từ vật liệu tái chế bảo vệ đại dương',
    topic: 'Mĩ thuật ứng dụng & Môi trường',
    description: 'Tận dụng chai nhựa, nắp chai, que kem và bìa carton để tạo các sinh vật biển 3D truyền tải thông điệp xanh.',
    isHidden: false,
    createdAt: '05/09/2026',
    createdByTeacherId: 'teacher-demo'
  },
  {
    id: 'les-6-02',
    classGroupId: 'cls-6',
    className: 'Khối 6',
    grade: '6',
    title: 'Bài 2: Nét vẽ và sắc màu tranh dân gian Đông Hồ',
    topic: 'Di sản mĩ thuật dân tộc',
    description: 'Thể nghiệm đường nét viền đen chắc khỏe và mảng màu bẹt tươi vui phỏng theo nghệ thuật khắc gỗ Đông Hồ.',
    isHidden: false,
    createdAt: '20/09/2026',
    createdByTeacherId: 'teacher-demo'
  },

  // Khối 7 Lessons
  {
    id: 'les-7-01',
    classGroupId: 'cls-7',
    className: 'Khối 7',
    grade: '7',
    title: 'Bài 1: Biểu cảm màu sắc nghệ thuật sơn mài quê hương',
    topic: 'Hội họa chất liệu truyền thống',
    description: 'Mô phỏng hiệu ứng sơn son thếp vàng, rắc nhũ và vỏ trứng diễn tả vẻ đẹp đầm sen ban mai.',
    isHidden: false,
    createdAt: '08/09/2026',
    createdByTeacherId: 'teacher-demo'
  },
  {
    id: 'les-7-02',
    classGroupId: 'cls-7',
    className: 'Khối 7',
    grade: '7',
    title: 'Bài 2: Ký họa góc phố và nhịp điệu kiến trúc cổ',
    topic: 'Ký họa & Luật xa gần',
    description: 'Quan sát mái ngói rêu phong, nhịp điệu hàng cây và không gian con hẻm cổ kính qua nét chì và màu nước.',
    isHidden: false,
    createdAt: '25/09/2026',
    createdByTeacherId: 'teacher-demo'
  },

  // Khối 8 Lessons
  {
    id: 'les-8-01',
    classGroupId: 'cls-8',
    className: 'Khối 8',
    grade: '8',
    title: 'Bài 1: Hòa sắc ấn tượng và chấm màu biểu cảm',
    topic: 'Mĩ thuật Tạo hình & Trường phái Ấn tượng',
    description: 'Khám phá hiệu ứng thị giác của các chấm màu nguyên sắc đặt cạnh nhau để diễn tả ánh nắng và thiên nhiên.',
    isHidden: false,
    createdAt: '10/09/2026',
    createdByTeacherId: 'teacher-demo'
  },
  {
    id: 'les-8-02',
    classGroupId: 'cls-8',
    className: 'Khối 8',
    grade: '8',
    title: 'Bài 2: Thiết kế bìa sách và nghệ thuật chữ (Typography)',
    topic: 'Thiết kế Đồ họa ứng dụng',
    description: 'Kết hợp bố cục hình minh họa và kiểu chữ sáng tạo để thiết kế bìa tác phẩm văn học thiếu nhi.',
    isHidden: false,
    createdAt: '28/09/2026',
    createdByTeacherId: 'teacher-demo'
  },

  // Khối 9 Lessons
  {
    id: 'les-9-01',
    classGroupId: 'cls-9',
    className: 'Khối 9',
    grade: '9',
    title: 'Bài 1: Thiết kế áp phích (Poster) truyền thông xã hội',
    topic: 'Thiết kế Truyền thông Thị giác',
    description: 'Sáng tác tranh cổ động tuyên truyền bảo vệ di sản văn hóa và môi trường sống xanh - sạch - bền vững.',
    isHidden: false,
    createdAt: '12/09/2026',
    createdByTeacherId: 'teacher-demo'
  },
  {
    id: 'les-9-02',
    classGroupId: 'cls-9',
    className: 'Khối 9',
    grade: '9',
    title: 'Bài 2: Nghệ thuật sắp đặt và điêu khắc không gian đương đại',
    topic: 'Mĩ thuật Đương đại Tổng hợp',
    description: 'Tổ hợp chất liệu đa phương tiện (kim loại, giấy, vải, ánh sáng) tạo mô hình nghệ thuật không gian 3 chiều.',
    isHidden: false,
    createdAt: '30/09/2026',
    createdByTeacherId: 'teacher-demo'
  }
];

export const INITIAL_ARTWORKS: CommunityArtwork[] = [
  // Artwork 1 - Approved & Shared
  {
    id: 'art-01',
    ownerKey: 'key-owner-alpha-1234',
    creatorAnonymousPseudonym: 'Cọ Non Biển Xanh',
    title: 'Chú rùa biển dọn rác đại dương',
    description: 'Mô hình chú rùa biển được lắp ghép từ đáy chai nhựa 1.5L, mai rùa sơn màu gouache xanh ngọc và hai mắt làm từ nắp chai cam tương phản.',
    materialsUsed: 'Chai nhựa tái chế, nắp chai, keo nến, màu gouache, que kem.',
    processNotes: 'Lúc đầu keo dán bị bong khi dán lên mặt nhựa trơn, sau đó em dùng giấy nhám chà nhẹ bề mặt giúp keo dính chắc chắn.',
    classGroupId: 'cls-6',
    className: 'Lớp 6',
    lessonId: 'les-6-01',
    lessonTitle: 'Bài 1: Tạo hình từ vật liệu tái chế bảo vệ đại dương',
    visualType: 'clay',
    sketchVisualType: 'pastel',
    sketchNotes: 'Bản vẽ phác thảo cấu trúc khung mai rùa và 4 chân bơi uốn cong.',
    revisions: [
      {
        id: 'rev-01-1',
        caption: 'Bản chỉnh sửa 1: Gia cố thêm thanh que kem trợ lực bên dưới chân rùa',
        notes: 'Chân rùa đứng vững trên bàn học mà không bị xẹp.',
        visualType: 'clay',
        createdAt: '26/10/2026'
      }
    ],
    status: 'approved',
    shareStatus: 'shared',
    shareToken: 'share-tok-r9k2-ocean-turtle',
    moderation: {
      moderatedBy: 'Cô Mai Phương (Giáo viên)',
      moderatedAt: '26/10/2026',
      moderatorNote: 'Ý tưởng môi trường rất nhân văn, chất liệu an toàn, bố cục vững chãi.'
    },
    reactions: {
      unique_idea: 18,
      striking_color: 14,
      interesting_composition: 9,
      commendable_effort: 22,
      inspiring: 16
    },
    commentsCount: 3,
    storageLocation: 'demo_sample',
    createdAt: '25/10/2026',
    updatedAt: '26/10/2026'
  },

  // Artwork 2 - Approved & Shared
  {
    id: 'art-02',
    ownerKey: 'key-owner-beta-5678',
    creatorAnonymousPseudonym: 'Nắng Mùa Gặt',
    title: 'Gà trống dũng cảm đón bình minh (Phỏng tranh Đông Hồ)',
    description: 'Bức tranh vẽ chú gà trống biểu trưng cho lòng dũng cảm và may mắn đầu năm. Em dùng nét viền đen dứt khoát bao quanh các mảng màu vàng nghệ và đỏ hoa hòe.',
    materialsUsed: 'Màu sáp dầu, giấy xơ dừa thô, bút dạ đen đi viền.',
    processNotes: 'Kỹ thuật cạo nét sáp dầu nhẹ nhàng để lộ vân xơ dừa tự nhiên giống mộc bản in khắc gỗ.',
    classGroupId: 'cls-6',
    className: 'Lớp 6',
    lessonId: 'les-6-02',
    lessonTitle: 'Bài 2: Nét vẽ và sắc màu tranh dân gian Đông Hồ',
    visualType: 'dongho',
    sketchVisualType: 'pastel',
    sketchNotes: 'Phác thảo các nét cong uốn lượn của đuôi gà và dáng đứng vươn cổ gáy.',
    revisions: [],
    status: 'approved',
    shareStatus: 'shared',
    shareToken: 'share-tok-dongho-rooster-8412',
    moderation: {
      moderatedBy: 'Thầy Quang (Kiểm duyệt viên)',
      moderatedAt: '27/10/2026',
      moderatorNote: 'Nét vẽ tự tin, cảm thụ sâu sắc tinh hoa mộc bản dân tộc.'
    },
    reactions: {
      unique_idea: 12,
      striking_color: 27,
      interesting_composition: 15,
      commendable_effort: 19,
      inspiring: 24
    },
    commentsCount: 2,
    storageLocation: 'demo_sample',
    createdAt: '26/10/2026',
    updatedAt: '27/10/2026'
  },

  // Artwork 3 - Approved & Shared
  {
    id: 'art-03',
    ownerKey: 'key-owner-gamma-9012',
    creatorAnonymousPseudonym: 'Hương Sen Sớm',
    title: 'Hồ sen sớm - Ánh son sơn mài',
    description: 'Bức tranh mô phỏng kỹ thuật sơn mài với nền đỏ son sẫm. Em đính các mẩu vỏ trứng vụn làm gân lá sen và rắc nhũ vàng óng ánh ở nhị hoa nở rộ.',
    materialsUsed: 'Màu acrylic nền son, vụn vỏ trứng vịt, bột nhũ vàng, keo bóng sữa.',
    processNotes: 'Phải đợi lớp keo vỏ trứng khô hẳn trong 2 tiếng mới quét lớp acrylic đen bóng lên trên để mài lộ vân.',
    classGroupId: 'cls-7',
    className: 'Lớp 7',
    lessonId: 'les-7-01',
    lessonTitle: 'Bài 1: Biểu cảm màu sắc nghệ thuật sơn mài quê hương',
    visualType: 'lacquer',
    sketchVisualType: 'pastel',
    sketchNotes: 'Bố cục mảng miếng đan xen giữa lá sen lớn và nụ sen e ấp.',
    revisions: [],
    status: 'approved',
    shareStatus: 'shared',
    shareToken: 'share-tok-lotus-lacquer-7319',
    moderation: {
      moderatedBy: 'Cô Mai Phương (Giáo viên)',
      moderatedAt: '26/10/2026',
      moderatorNote: 'Kỹ thuật vỏ trứng điêu luyện, chiều sâu không gian tĩnh lặng đầy rung cảm.'
    },
    reactions: {
      unique_idea: 16,
      striking_color: 21,
      interesting_composition: 19,
      commendable_effort: 30,
      inspiring: 28
    },
    commentsCount: 2,
    storageLocation: 'demo_sample',
    createdAt: '24/10/2026',
    updatedAt: '26/10/2026'
  },

  // Artwork 4 - Approved & Shared
  {
    id: 'art-04',
    ownerKey: 'key-owner-delta-3456',
    creatorAnonymousPseudonym: 'Phố Cổ Chiều Mưa',
    title: 'Mái ngói thâm nâu trong ngõ nhỏ',
    description: 'Ký họa góc phố với mái ngói cổ truyền và những vệt rêu phong thời gian. Em dùng màu nước ướt trên ướt để tạo cảm giác không khí ẩm mượt sau cơn mưa.',
    materialsUsed: 'Màu nước chuyên dụng, bút kim đen kháng nước, giấy 300gsm.',
    processNotes: 'Vẽ nét viền run rẩy tự nhiên thể hiện sự cổ kính của bức tường vôi lở.',
    classGroupId: 'cls-7',
    className: 'Lớp 7',
    lessonId: 'les-7-02',
    lessonTitle: 'Bài 2: Ký họa góc phố và nhịp điệu kiến trúc cổ',
    visualType: 'watercolor',
    sketchVisualType: 'pastel',
    sketchNotes: 'Ký họa nhanh đường chân trời và điểm tụ cuối ngõ.',
    revisions: [],
    status: 'approved',
    shareStatus: 'shared',
    shareToken: 'share-tok-hanoi-street-4910',
    moderation: {
      moderatedBy: 'Thầy Quang (Kiểm duyệt viên)',
      moderatedAt: '27/10/2026',
      moderatorNote: 'Gam màu trầm ấm, bắt được hồn cốt kiến trúc xưa.'
    },
    reactions: {
      unique_idea: 14,
      striking_color: 18,
      interesting_composition: 25,
      commendable_effort: 16,
      inspiring: 21
    },
    commentsCount: 1,
    storageLocation: 'demo_sample',
    createdAt: '26/10/2026',
    updatedAt: '27/10/2026'
  },

  // Artwork 5 - Approved & Shared
  {
    id: 'art-05',
    ownerKey: 'key-owner-epsilon-7890',
    creatorAnonymousPseudonym: 'Bé Hạt Kê',
    title: 'Gia đình gà ấm áp bên cây chuối',
    description: 'Bộ tượng đất nặn mô tả gà mẹ dẫn hai gà con đi kiếm mồi trong vườn chuối nhà bà ngoại. Con gà mẹ màu cam che chở cho hai chú gà con tròn xoe.',
    materialsUsed: 'Đất nặn tự khô không độc hại, tăm tre cố định khung cổ, đế bìa.',
    processNotes: 'Gia cố tăm tre vào cổ gà giúp đầu gà không bị rụng khi đất khô.',
    classGroupId: 'cls-4',
    className: 'Lớp 4',
    lessonId: 'les-4-01',
    lessonTitle: 'Bài 1: Gia đình con vật từ đất nặn dân gian',
    visualType: 'clay',
    sketchVisualType: 'pastel',
    sketchNotes: 'Phác thảo các khối tròn và hình bầu dục cơ bản.',
    revisions: [],
    status: 'approved',
    shareStatus: 'shared',
    shareToken: 'share-tok-clay-chicken-9381',
    moderation: {
      moderatedBy: 'Cô Mai Phương (Giáo viên)',
      moderatedAt: '28/10/2026',
      moderatorNote: 'Tạo hình trong sáng, giải pháp tăm tre thông minh.'
    },
    reactions: {
      unique_idea: 11,
      striking_color: 23,
      interesting_composition: 12,
      commendable_effort: 20,
      inspiring: 15
    },
    commentsCount: 1,
    storageLocation: 'demo_sample',
    createdAt: '27/10/2026',
    updatedAt: '28/10/2026'
  },

  // Artwork 6 - PENDING in Moderation Queue (Waiting for approval)
  {
    id: 'art-06-pending',
    ownerKey: 'key-owner-zeta-4321',
    creatorAnonymousPseudonym: 'Gió Mùa Thu',
    title: 'Rừng cây thay lá - Kỹ thuật xé dán Collage',
    description: 'Tác phẩm xé dán từ những mẩu báo cũ và giấy gói hoa quả tái chế tạo nên khu rừng mùa thu vàng rực rỡ.',
    materialsUsed: 'Báo cũ, giấy gói hoa quả, hồ dán, bìa carton.',
    processNotes: 'Xé giấy mép xơ tự nhiên để tạo hiệu ứng tán lá bồng bềnh trong gió.',
    classGroupId: 'cls-4',
    className: 'Lớp 4',
    lessonId: 'les-4-02',
    lessonTitle: 'Bài 2: Xé dán giấy màu thiên nhiên bốn mùa',
    visualType: 'collage',
    sketchVisualType: 'pastel',
    sketchNotes: 'Phác thảo thân cây bạch dương và tán lá hình vòm.',
    revisions: [],
    status: 'pending', // Pending moderation!
    shareStatus: 'shared',
    shareToken: 'share-tok-autumn-collage-pending',
    moderation: {},
    reactions: {
      unique_idea: 0,
      striking_color: 0,
      interesting_composition: 0,
      commendable_effort: 0,
      inspiring: 0
    },
    commentsCount: 0,
    storageLocation: 'demo_sample',
    createdAt: '28/10/2026',
    updatedAt: '28/10/2026'
  },

  // Artwork 7 - PRIVATE (Kept private by creator, not visible in public gallery)
  {
    id: 'art-07-private',
    ownerKey: 'key-owner-alpha-1234', // same owner as art-01
    creatorAnonymousPseudonym: 'Cọ Non Biển Xanh',
    title: 'Bản thể nghiệm màu nước thử nghiệm (Bản nháp riêng tư)',
    description: 'Thử nghiệm kỹ thuật loang màu nước trên giấy ẩm, hiện đang giữ chế độ riêng tư chưa sẵn sàng chia sẻ cộng đồng.',
    materialsUsed: 'Màu nước và giấy màu thử.',
    processNotes: 'Đang nghiên cứu thêm cách giữ ẩm bề mặt.',
    classGroupId: 'cls-6',
    className: 'Lớp 6',
    lessonId: 'les-6-01',
    lessonTitle: 'Bài 1: Tạo hình từ vật liệu tái chế bảo vệ đại dương',
    visualType: 'watercolor',
    revisions: [],
    status: 'draft',
    shareStatus: 'private', // PRIVATE!
    shareToken: 'share-tok-private-draft-key',
    moderation: {},
    reactions: {
      unique_idea: 0,
      striking_color: 0,
      interesting_composition: 0,
      commendable_effort: 0,
      inspiring: 0
    },
    commentsCount: 0,
    storageLocation: 'demo_sample',
    createdAt: '28/10/2026',
    updatedAt: '28/10/2026'
  }
];

export const INITIAL_COMMENTS: ArtworkComment[] = [
  {
    id: 'cmt-01',
    artworkId: 'art-01',
    anonymousNickname: 'Mây Xanh',
    content: 'Mai rùa làm từ chai nhựa mà bạn sơn màu lên nhìn bóng và đẹp như men gốm thật vậy!',
    status: 'approved',
    authorKey: 'auth-cmt-key-01',
    createdAt: '26/10/2026'
  },
  {
    id: 'cmt-02',
    artworkId: 'art-01',
    anonymousNickname: 'Cọ Nhỏ',
    content: 'Ý tưởng bảo vệ rùa biển rất ý nghĩa. Mình cũng muốn thử làm một chú cá heo tái chế.',
    status: 'approved',
    authorKey: 'auth-cmt-key-02',
    createdAt: '26/10/2026'
  },
  {
    id: 'cmt-03',
    artworkId: 'art-01',
    anonymousNickname: 'Hạt Nắng',
    content: 'Bạn dùng loại keo gì để dán que kem vào nhựa vậy? Mình dán hay bị lỏng.',
    status: 'approved',
    authorKey: 'auth-cmt-key-03',
    createdAt: '27/10/2026'
  },
  {
    id: 'cmt-04',
    artworkId: 'art-02',
    anonymousNickname: 'Sóng Biển',
    content: 'Đường viền đen dày dặn tạo cảm giác rất khỏe khoắn, đúng chất mộc bản Đông Hồ!',
    status: 'approved',
    authorKey: 'auth-cmt-key-04',
    createdAt: '27/10/2026'
  },
  {
    id: 'cmt-05-pending',
    artworkId: 'art-03',
    anonymousNickname: 'Khung Tranh',
    content: 'Kỹ thuật gắn vụn vỏ trứng làm gân lá sen thật tinh tế và công phu!',
    status: 'pending', // PENDING COMMENT
    authorKey: 'auth-cmt-key-05',
    createdAt: '28/10/2026'
  }
];

export const INITIAL_REPORTS: ContentReport[] = [
  {
    id: 'rep-01',
    targetType: 'comment',
    targetId: 'cmt-flagged-demo',
    targetTitle: 'Bình luận có từ ngữ không phù hợp',
    reason: 'inappropriate_language',
    reasonLabel: 'Từ ngữ chưa chuẩn mực / thiếu tôn trọng',
    reasonDetails: 'Bình luận chứa lời lẽ trêu chọc bạn học và không mang tính xây dựng thẩm mĩ.',
    status: 'reviewing',
    reporterAnonymousCode: 'Ẩn danh #8392',
    createdAt: '27/10/2026'
  },
  {
    id: 'rep-02',
    targetType: 'artwork',
    targetId: 'art-sample-resolved',
    targetTitle: 'Nghi vấn vô tình lộ số điện thoại trên tranh',
    reason: 'personal_info_leak',
    reasonLabel: 'Chứa thông tin nhận dạng cá nhân',
    reasonDetails: 'Góc giấy vẽ có ghi dòng số điện thoại nháp.',
    status: 'resolved',
    reporterAnonymousCode: 'Ẩn danh #1492',
    createdAt: '25/10/2026',
    resolvedAt: '26/10/2026',
    resolutionAction: 'Đã nhắc tác giả xóa bỏ thông tin và duyệt lại ảnh sạch',
    resolverRole: 'Kiểm duyệt viên'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-01',
    action: 'instant_publish',
    targetId: 'art-demo-01',
    targetTitle: 'Chú Rùa Đại Dương từ Chai Nhựa',
    performedBy: 'Cô Mai Phương (GV Mĩ thuật)',
    performedByRole: 'teacher',
    timestamp: '28/10/2026 09:15',
    details: 'Chụp xong, triển lãm ngay: Đã xóa EXIF GPS, quét khuôn mặt = 0, thông tin cá nhân = 0. Tác phẩm xuất bản công khai tức thì vào Lớp 6.',
    isSafeOperation: true
  },
  {
    id: 'log-02',
    action: 'security_block',
    targetId: 'art-draft-blocked',
    targetTitle: 'Bức vẽ có dòng chữ SĐT 0912xxx',
    performedBy: 'Hệ thống Kiểm tra An toàn Tự động',
    performedByRole: 'moderator',
    timestamp: '28/10/2026 08:30',
    details: 'Phát hiện số điện thoại cá nhân trong ảnh. Tác phẩm chuyển sang chế độ Riêng tư để giáo viên rà soát, không tự động công khai.',
    isSafeOperation: true
  },
  {
    id: 'log-03',
    action: 'permission_change',
    targetId: 'cls-6',
    targetTitle: 'Không gian Triển lãm Lớp 6',
    performedBy: 'Ban Giám Hiệu (Quản trị)',
    performedByRole: 'admin',
    timestamp: '27/10/2026 14:00',
    details: 'Cấp quyền Triển lãm công khai (isPublicGalleryEnabled: true) cho giáo viên môn Mĩ thuật khối 6.',
    isSafeOperation: true
  },
  {
    id: 'log-04',
    action: 'hide',
    targetId: 'art-temp-hidden',
    targetTitle: 'Ký họa Phố Cổ Cần Chỉnh Lại',
    performedBy: 'Thầy Hoàng Nam (GV Mĩ thuật)',
    performedByRole: 'teacher',
    timestamp: '27/10/2026 10:45',
    details: 'Giáo viên thực hiện ẩn tác phẩm khỏi triển lãm công khai theo yêu cầu bổ sung chất liệu của học sinh.',
    isSafeOperation: true
  }
];

import { LessonPlan, StudentArtwork, StudentProfile, ResourceItem } from '../types/artverse';

export const INITIAL_LESSON_PLANS: LessonPlan[] = [
  {
    id: 'lp-01',
    title: 'Nét vẽ và sắc màu của di sản tranh dân gian Đông Hồ',
    grade: 'Lớp 5',
    level: 'primary',
    topic: 'Di sản mĩ thuật dân tộc',
    durationWeeks: 2,
    textbook: 'Kết nối tri thức với cuộc sống',
    competencies: [
      'Quan sát và nhận thức thẩm mĩ về bản khắc gỗ và màu điệp truyền thống',
      'Sáng tạo mô phỏng một hình tượng dân gian (gà trống, lợn đàn) bằng màu sáp/màu dạ',
      'Biết trân trọng và giới thiệu nét đẹp tranh cổ truyền với người thân'
    ],
    qualities: ['Yêu nước (Tự hào văn hóa Việt Nam)', 'Chăm chỉ', 'Trách nhiệm'],
    preparationTeacher: 'Bản in tranh Đông Hồ mẫu (Đám cưới chuột, Gà đại cát), giấy dó mẫu, bảng màu tự nhiên (sò điệp, hoa hòe, than tre), máy chiếu.',
    preparationStudent: 'Giấy vẽ A4/A3, bút chì, màu sáp dầu, kéo thủ công, hồ dán.',
    steps: {
      step1Discovery: 'GV trình chiếu video nghệ nhân làng tranh Đông Hồ quét màu điệp óng ánh lên giấy dó. Đặt câu hỏi gợi mở: "Các em nhận thấy màu trắng điệp và màu đỏ hoa hòe có điểm gì khác với màu sáp trong hộp của mình?"',
      step2Knowledge: 'Hướng dẫn HS quan sát cách nghệ nhân dùng nét viền đen dứt khoát bao quanh mảng màu bẹt. Phân tích ý nghĩa hình tượng Gà trống biểu trưng cho 5 đức tính: Văn, Võ, Dũng, Nhân, Tín.',
      step3Practice: 'HS thực hành: Chọn một con vật quen thuộc trong đời sống hoặc tranh dân gian. Vẽ nét viền dày dặn, tô mảng màu tươi sáng, tạo hoa văn trang trí lên thân con vật theo phong cách dân gian.',
      step4Analysis: 'Tổ chức góc "Phiên chợ tranh xuân". HS treo bài vẽ, chia sẻ về thông điệp may mắn của bức tranh mình vẽ. Các bạn nhận xét về cách đi nét và phối màu.',
      step5Application: 'GV gợi ý HS gấp bài vẽ thành thiệp chúc tết mừng ông bà, cha mẹ hoặc đóng khung nhỏ trang trí góc học tập.'
    },
    status: 'published',
    lastEdited: '26/10/2026',
    author: 'Cô Nguyễn Thị Mai Phương'
  },
  {
    id: 'lp-02',
    title: 'Biểu cảm của màu sắc và không gian trong tranh phong cảnh quê hương',
    grade: 'Lớp 7',
    level: 'secondary',
    topic: 'Mĩ thuật tạo hình - Hội họa',
    durationWeeks: 2,
    textbook: 'Cánh diều',
    competencies: [
      'Nhận biết luật viễn cận (xa - gần), độ đậm nhạt và sắc ấm - lạnh trong tranh phong cảnh',
      'Ứng dụng kỹ thuật vẽ màu gouache/màu nước diễn tả không gian dòng sông, làng quê',
      'Phân tích được cảm xúc thẩm mĩ tác phẩm mang lại'
    ],
    qualities: ['Yêu thiên nhiên đất nước', 'Trung thực trong sáng tạo nghệ thuật'],
    preparationTeacher: 'Ảnh chụp tư liệu phong cảnh 3 miền (Bắc bộ, Tây Nguyên, Đồng bằng sông Cửu Long); tác phẩm của danh họa Tô Ngọc Vân, Bùi Xuân Phái.',
    preparationStudent: 'Màu nước/gouache, cọ vẽ số 2, 6, 10, bảng pha màu, khăn lau, giấy màu nước 300gsm.',
    steps: {
      step1Discovery: 'HS quan sát 2 bức tranh: một bức cận cảnh rực rỡ và một bức phong cảnh có chiều sâu xa xăm. Thảo luận nhóm: "Vì sao rặng núi ở xa lại có màu lam tím mờ nhạt hơn rặng cây ở gần?"',
      step2Knowledge: 'GV thị phạm kỹ thuật chuyển sắc độ từ đậm sang nhạt; quy luật thấu thị không khí (càng xa càng mờ, sắc màu ngả xanh lam). Phân định 3 lớp không gian: Tiền cảnh - Trung cảnh - Hậu cảnh.',
      step3Practice: 'HS phác thảo bố cục đường chân trời, xác định điểm nhấn trọng tâm (con đò, ngôi nhà ven đê). Vẽ lớp màu nền trước, tỉa chi tiết tiền cảnh sau.',
      step4Analysis: 'Trưng bày "Triển lãm Quê hương mến yêu". HS tự đánh giá độ chuyển màu và chiều sâu không gian theo phiếu tiêu chí Rubric.',
      step5Application: 'Viết lời bình ngắn (3-4 câu) diễn tả tình yêu dành cho nơi chốn được vẽ trong tranh, đính kèm vào triển lãm ảo của lớp.'
    },
    status: 'published',
    lastEdited: '24/10/2026',
    author: 'Thầy Trần Đình Quang'
  },
  {
    id: 'lp-03',
    title: 'Tạo dáng và trang trí con vật từ đất nặn dân gian',
    grade: 'Lớp 2',
    level: 'primary',
    topic: 'Thủ công và điêu khắc',
    durationWeeks: 1,
    textbook: 'Chân trời sáng tạo',
    competencies: [
      'Biết các thao tác cơ bản: vê tròn, lăn dài, ấn dẹt, vuốt nhọn đất nặn',
      'Tạo dáng được con vật quen thuộc (chú mèo, chú gà, chú rùa) có tỉ lệ hài hòa',
      'Phát triển xúc giác và khả năng phối hợp tay - mắt khéo léo'
    ],
    qualities: ['Nhân ái (Yêu thương động vật)', 'Chăm chỉ'],
    preparationTeacher: 'Mô hình tò he truyền thống Việt Nam, đất nặn màu sắc an toàn, que tăm tre tạo chi tiết.',
    preparationStudent: 'Hộp đất nặn nhiều màu, bảng nhựa kê bàn, khăn ướt lau tay.',
    steps: {
      step1Discovery: 'GV cho HS xem những chú tò he ngộ nghĩnh (chú trâu, chim bồ câu). HS đoán xem nghệ nhân đã dùng khối hình gì để ghép thành con vật.',
      step2Knowledge: 'GV hướng dẫn phân tích cấu tạo: Đầu hình tròn, mình hình bầu dục, 4 chân hình trụ lăn dài. Kỹ thuật đính ghép liền mạch.',
      step3Practice: 'HS tự chọn con vật yêu thích. Nặn các bộ phận chính trước, đính ráp lại, sau đó dùng các viên đất nhỏ khác màu trang trí mắt, hoa văn.',
      step4Analysis: 'Góc "Nông trại vui vẻ". Cả lớp cùng ngắm nhìn và đặt tên cho các con vật vừa hoàn thành. Nhận xét bạn nặn con vật nào sinh động nhất.',
      step5Application: 'Kể một câu chuyện ngắn 1 phút về con vật của mình và giữ gìn tác phẩm trong hộp trong suốt trưng bày ở nhà.'
    },
    status: 'draft',
    lastEdited: '22/10/2026',
    author: 'Cô Nguyễn Thị Mai Phương'
  },
  {
    id: 'lp-04',
    title: 'Thiết kế chữ nghệ thuật (Typography) truyền tải thông điệp bảo vệ môi trường',
    grade: 'Lớp 8',
    level: 'secondary',
    topic: 'Mĩ thuật ứng dụng - Đồ họa',
    durationWeeks: 2,
    textbook: 'Kết nối tri thức với cuộc sống',
    competencies: [
      'Hiểu cấu trúc con chữ, nguyên lý cách điệu chữ kết hợp với hình tượng biểu trưng',
      'Ứng dụng tương phản màu sắc và khoảng cách chữ (kerning) trong thiết kế poster',
      'Biết dùng ngôn ngữ đồ họa để nâng cao ý thức xã hội'
    ],
    qualities: ['Trách nhiệm công dân', 'Sáng tạo đổi mới'],
    preparationTeacher: 'Bộ sưu tập poster chữ nghệ thuật đương đại, thước kẻ, compa, bút kim kỹ thuật.',
    preparationStudent: 'Giấy A3, bút lông kim, màu dạ/màu poster, thước kẻ.',
    steps: {
      step1Discovery: 'Chiếu các từ khóa cách điệu: "XANH", "GIỌT NƯỚC", "MẦM SỐNG". Nhận diện cách các chữ cái biến thành lá cây hay dòng nước.',
      step2Knowledge: 'Nguyên tắc biến thể chữ: Giữ nét nhận diện cơ bản để người xem vẫn đọc được chữ, kết hợp hình tượng ẩn dụ phù hợp ngữ cảnh.',
      step3Practice: 'Chọn thông điệp ngắn 1-3 từ (ví dụ: SỐNG XANH, TÁI SINH, GIỮ RỪNG). Phác thảo lưới ô, tạo hình chữ và phối màu tương phản mạnh.',
      step4Analysis: 'Trưng bày poster theo hình thức phòng tranh poster truyền thông. Bỏ phiếu cho thiết kế có tính ứng dụng cao nhất.',
      step5Application: 'Số hóa bài vẽ bằng điện thoại để làm ảnh bìa tuyên truyền cho fanpage Đoàn Đội của trường.'
    },
    status: 'published',
    lastEdited: '20/10/2026',
    author: 'Thầy Trần Đình Quang'
  }
];

export const INITIAL_STUDENT_ARTWORKS: StudentArtwork[] = [
  {
    id: 'art-01',
    studentId: 'st-01',
    studentName: 'Lê Hoàng Minh',
    classGroup: '6A1',
    title: 'Chiều bình yên trên sông Hồng',
    medium: 'Màu nước trên giấy Canson',
    dateSubmitted: '25/10/2026',
    ratingLevel: 'excellent',
    rubricScores: {
      lineShape: 9,
      colorValue: 9.5,
      composition: 9,
      creativity: 8.5,
      expression: 9
    },
    totalScore: 9.0,
    teacherFeedback: 'Bài vẽ thể hiện khả năng làm chủ màu nước rất chững chạc. Độ chuyển sắc từ vàng hoàng hôn sang lam tím ở hậu cảnh mềm mại, tạo chiều sâu thị giác ấn tượng. Đường nét con đò chắc chắn.',
    pedagogicalSuggestion: 'Em có thể nhấn thêm một chút bóng phản chiếu lung linh trên mặt nước ở tiền cảnh để bức tranh càng thêm lung linh cảm xúc.',
    visualType: 'watercolor',
    accentColor: '#3B82F6'
  },
  {
    id: 'art-02',
    studentId: 'st-02',
    studentName: 'Nguyễn Ngọc Anh Thư',
    classGroup: '6A1',
    title: 'Chú gà trống rộn ràng sắc xuân (Mô phỏng Đông Hồ)',
    medium: 'Màu sáp dầu trên giấy xơ dừa',
    dateSubmitted: '24/10/2026',
    ratingLevel: 'excellent',
    rubricScores: {
      lineShape: 8.5,
      colorValue: 9,
      composition: 8.5,
      creativity: 9.5,
      expression: 9
    },
    totalScore: 8.9,
    teacherFeedback: 'Sự sáng tạo tuyệt vời khi biết dùng chất liệu sáp dầu cạo nét để gợi vân gỗ dân gian. Màu sắc rực rỡ, đường nét viền dứt khoát và biểu cảm của chú gà rất kiêu hãnh, tươi vui.',
    pedagogicalSuggestion: 'Hãy thử nghiệm kết hợp thêm một số hoa văn hoa sen hoặc mây cuộn cổ ở góc tranh để tăng tính truyền thống.',
    visualType: 'dongho',
    accentColor: '#8B5CF6'
  },
  {
    id: 'art-03',
    studentId: 'st-03',
    studentName: 'Phạm Đức Khang',
    classGroup: '7B2',
    title: 'Hồ sen sớm - Cảm hứng sơn mài truyền thống',
    medium: 'Màu acrylic kết hợp rắc nhũ vàng',
    dateSubmitted: '22/10/2026',
    ratingLevel: 'excellent',
    rubricScores: {
      lineShape: 9,
      colorValue: 9,
      composition: 8.5,
      creativity: 9,
      expression: 9
    },
    totalScore: 8.9,
    teacherFeedback: 'Bố cục mảng lớn tương phản giữa nền son sẫm và cánh sen sáng rất ấn tượng. Bạn thể hiện sự hiểu biết sâu sắc về tính chất trang trí ước lệ của sơn mài Việt Nam.',
    pedagogicalSuggestion: 'Lá sen ở góc phải có thể tạo thêm độ gân chìm để tăng độ tương phản bề mặt.',
    visualType: 'lacquer',
    accentColor: '#F59E0B'
  },
  {
    id: 'art-04',
    studentId: 'st-04',
    studentName: 'Đặng Bảo Nam',
    classGroup: '4A3',
    title: 'Gia đình gà sum vầy mùa quả ngọt',
    medium: 'Đất nặn tạo hình gắn trên bìa carton',
    dateSubmitted: '21/10/2026',
    ratingLevel: 'proficient',
    rubricScores: {
      lineShape: 8,
      colorValue: 7.5,
      composition: 7.5,
      creativity: 8,
      expression: 8
    },
    totalScore: 7.8,
    teacherFeedback: 'Các hình khối gà con và gà mẹ rất tròn trịa, đáng yêu. Kỹ thuật vê tròn, vuốt mỏ và gắn kết các bộ phận tốt, không bị rơi rụng khi trưng bày.',
    pedagogicalSuggestion: 'Lần sau em hãy thử phối thêm màu đất tương phản giữa thân gà và nền cỏ để con vật nổi bật hơn nữa nhé.',
    visualType: 'clay',
    accentColor: '#10B981'
  },
  {
    id: 'art-05',
    studentId: 'st-05',
    studentName: 'Vũ Thảo Nguyên',
    classGroup: '4A3',
    title: 'Khu rừng nhiệt đới của em',
    medium: 'Tranh xé dán giấy báo và giấy thủ công',
    dateSubmitted: '19/10/2026',
    ratingLevel: 'proficient',
    rubricScores: {
      lineShape: 7.5,
      colorValue: 8,
      composition: 7,
      creativity: 8,
      expression: 7.5
    },
    totalScore: 7.6,
    teacherFeedback: 'Kỹ thuật xé mép giấy tạo xơ trắng mô tả lông thú và tán lá rất thông minh. Bức tranh giàu cảm xúc tự nhiên.',
    pedagogicalSuggestion: 'Chú ý sắp xếp mảng chính lớn hơn mảng phụ để trọng tâm bức tranh rõ ràng hơn.',
    visualType: 'collage',
    accentColor: '#EC4899'
  },
  {
    id: 'art-06',
    studentId: 'st-06',
    studentName: 'Bùi Hải Đăng',
    classGroup: '7B2',
    title: 'Tĩnh vật lọ hoa và quả táo',
    medium: 'Chì màu và phấn tiên',
    dateSubmitted: '18/10/2026',
    ratingLevel: 'developing',
    rubricScores: {
      lineShape: 6.5,
      colorValue: 6,
      composition: 6.5,
      creativity: 6,
      expression: 6
    },
    totalScore: 6.2,
    teacherFeedback: 'Bạn đã dựng được dáng cơ bản của lọ hoa và quả. Tinh thần học tập chăm chỉ và nghiêm túc.',
    pedagogicalSuggestion: 'Cần quan sát kỹ nguồn sáng để đánh bóng phần tối rõ nét hơn, giúp vật thể có khối tròn nổi bật trên mặt bàn.',
    visualType: 'pastel',
    accentColor: '#64748B'
  }
];

export const INITIAL_STUDENT_PROFILES: StudentProfile[] = [
  {
    id: 'st-01',
    name: 'Lê Hoàng Minh',
    classGroup: '6A1',
    level: 'secondary',
    artAptitude: 'Hội họa màu nước & Diễn tả chiều sâu không gian',
    overallRating: 'excellent',
    artworksCount: 8,
    recentNotes: 'Học sinh có cảm thụ màu sắc đặc biệt tinh tế, nắm bắt luật viễn cận rất nhanh so với lứa tuổi.',
    strengths: ['Pha màu tinh tế', 'Quan sát tỉ mỉ', 'Độ chuyển sắc độ điêu luyện'],
    areasToGrow: ['Thử nghiệm thêm các chất liệu nổi như đất nặn và phù điêu'],
    sampleWorks: [
      { id: 'w-1', title: 'Chiều bình yên trên sông Hồng', date: '25/10/2026', rating: 'Hoàn thành tốt', visualType: 'watercolor' },
      { id: 'w-2', title: 'Phố mùa thu lá vàng', date: '10/10/2026', rating: 'Hoàn thành tốt', visualType: 'watercolor' },
      { id: 'w-3', title: 'Tĩnh vật ấm trà đất nung', date: '28/09/2026', rating: 'Hoàn thành tốt', visualType: 'pastel' }
    ]
  },
  {
    id: 'st-02',
    name: 'Nguyễn Ngọc Anh Thư',
    classGroup: '6A1',
    level: 'secondary',
    artAptitude: 'Trang trí mảng bẹt & Di sản nghệ thuật truyền thống',
    overallRating: 'excellent',
    artworksCount: 7,
    recentNotes: 'Rất yêu thích văn hóa dân tộc, có năng khiếu cách điệu hoa văn trống đồng và họa tiết Đông Hồ.',
    strengths: ['Nét vẽ dứt khoát', 'Tư duy mảng miếng đồ họa', 'Đam mê văn hóa cổ truyền'],
    areasToGrow: ['Rèn luyện thêm kỹ thuật vẽ chì tả khối thực tế'],
    sampleWorks: [
      { id: 'w-4', title: 'Chú gà trống rộn ràng sắc xuân', date: '24/10/2026', rating: 'Hoàn thành tốt', visualType: 'dongho' },
      { id: 'w-5', title: 'Họa tiết chim Lạc cách điệu', date: '12/10/2026', rating: 'Hoàn thành tốt', visualType: 'dongho' }
    ]
  },
  {
    id: 'st-03',
    name: 'Phạm Đức Khang',
    classGroup: '7B2',
    level: 'secondary',
    artAptitude: 'Thủ công mỹ nghệ & Sơn mài ước lệ',
    overallRating: 'excellent',
    artworksCount: 6,
    recentNotes: 'Khả năng phối hợp các chất liệu mới lạ (vỏ trứng, nhũ, cát) rất khéo léo và có cá tính.',
    strengths: ['Tỉ mỉ, kiên nhẫn cao', 'Thử nghiệm chất liệu mới', 'Bố cục khúc chiết'],
    areasToGrow: ['Tăng tốc độ hoàn thành bài trong khung giờ tiết học'],
    sampleWorks: [
      { id: 'w-6', title: 'Hồ sen sớm - Cảm hứng sơn mài', date: '22/10/2026', rating: 'Hoàn thành tốt', visualType: 'lacquer' },
      { id: 'w-7', title: 'Mặt nạ tuồng cách tân', date: '05/10/2026', rating: 'Hoàn thành tốt', visualType: 'clay' }
    ]
  },
  {
    id: 'st-04',
    name: 'Đặng Bảo Nam',
    classGroup: '4A3',
    level: 'primary',
    artAptitude: 'Tạo hình khối 3D & Đất nặn vui nhộn',
    overallRating: 'proficient',
    artworksCount: 9,
    recentNotes: 'Học sinh rất hào hứng với các giờ nặn và thủ công xé dán. Trí tưởng tượng phong phú về thế giới loài vật.',
    strengths: ['Khéo tay với khối tròn', 'Giàu năng lượng sáng tạo', 'Hòa đồng trong hoạt động nhóm'],
    areasToGrow: ['Cần tập trung hơn trong khâu tô màu nền bài vẽ tĩnh vật'],
    sampleWorks: [
      { id: 'w-8', title: 'Gia đình gà sum vầy', date: '21/10/2026', rating: 'Hoàn thành', visualType: 'clay' },
      { id: 'w-9', title: 'Chú voi Bản Đôn ngộ nghĩnh', date: '08/10/2026', rating: 'Hoàn thành tốt', visualType: 'clay' }
    ]
  },
  {
    id: 'st-05',
    name: 'Vũ Thảo Nguyên',
    classGroup: '4A3',
    level: 'primary',
    artAptitude: 'Tranh cắt dán Collage & Phối màu tươi sáng',
    overallRating: 'proficient',
    artworksCount: 8,
    recentNotes: 'Có gu thẩm mĩ hồn nhiên, trong trẻo. Các bài xé dán giấy có nhịp điệu sinh động.',
    strengths: ['Cảm xúc tươi vui', 'Ý tưởng ngây thơ đáng yêu', 'Phối màu rực rỡ'],
    areasToGrow: ['Rèn thêm tính cẩn thận khi sử dụng kéo và hồ dán'],
    sampleWorks: [
      { id: 'w-10', title: 'Khu rừng nhiệt đới của em', date: '19/10/2026', rating: 'Hoàn thành', visualType: 'collage' }
    ]
  },
  {
    id: 'st-06',
    name: 'Bùi Hải Đăng',
    classGroup: '7B2',
    level: 'secondary',
    artAptitude: 'Quan sát chi tiết thực tế',
    overallRating: 'developing',
    artworksCount: 5,
    recentNotes: 'Cần giáo viên động viên để tự tin hơn trong các bài vẽ sáng tạo theo cảm xúc.',
    strengths: ['Chăm chỉ, lắng nghe hướng dẫn', 'Nghiêm túc trong giờ học'],
    areasToGrow: ['Tự tin phóng khoáng nét vẽ', 'Mạnh dạn dùng màu đậm tương phản'],
    sampleWorks: [
      { id: 'w-11', title: 'Tĩnh vật lọ hoa và quả táo', date: '18/10/2026', rating: 'Cần cố gắng', visualType: 'pastel' }
    ]
  }
];

export const INITIAL_RESOURCE_ITEMS: ResourceItem[] = [
  {
    id: 'res-01',
    title: 'Bộ sưu tập Tranh dân gian Đông Hồ - Màu sắc và Ý nghĩa biểu trưng',
    category: 'folk',
    categoryLabel: 'Tranh dân gian',
    targetGrades: 'Tiểu học (Lớp 1-5) & THCS (Lớp 6)',
    eraOrArtist: 'Làng tranh Đông Hồ, Thuận Thành, Bắc Ninh',
    description: 'Tập hợp 16 bản in phục chế chất lượng cao của các kiệt tác tranh Đông Hồ: Gà đại cát, Lợn đàn âm dương, Vinh hoa phú quý, Đám cưới chuột, Thả diều. Kèm tư liệu thuyết minh về giấy điệp và màu tự nhiên.',
    teachingGuide: 'Dùng trong hoạt động Khám phá chủ đề Di sản mỹ thuật dân tộc. Cho học sinh phân biệt màu sắc tự nhiên (đen than lá tre, vàng hoa hòe, xanh gỉ đồng, trắng vỏ điệp).',
    visualType: 'dongho',
    downloadFormat: 'PDF + Bộ ảnh HD (Zip)',
    fileSize: '45.8 MB',
    downloadsCount: 1240,
    tags: ['Đông Hồ', 'Di sản', 'Bắc Ninh', 'Màu điệp']
  },
  {
    id: 'res-02',
    title: 'Nghệ thuật Tranh Sơn Mài Việt Nam - Từ Cổ điển đến Đương đại',
    category: 'fineart',
    categoryLabel: 'Mỹ thuật Việt Nam',
    targetGrades: 'THCS (Khối 7, 8, 9)',
    eraOrArtist: 'Nguyễn Gia Trí, Trần Văn Cẩn, Hoàng Tích Chù',
    description: 'Chuyên đề chuyên sâu về chất liệu sơn ta truyền thống, kỹ thuật gắn trứng, rắc vàng, mài bóng qua tác phẩm kinh điển "Vườn xuân Trung Nam Bắc" và "Nhớ một chiều Tây Bắc".',
    teachingGuide: 'Phân tích ngôn ngữ tạo hình lộng lẫy và tính ước lệ của sơn mài. Hướng dẫn học sinh ứng dụng hiệu ứng rắc nhũ và dán giấy xé vụn để mô phỏng chất liệu.',
    visualType: 'lacquer',
    downloadFormat: 'Slide PPTX + Giáo án đính kèm',
    fileSize: '62.4 MB',
    downloadsCount: 980,
    tags: ['Sơn mài', 'Nguyễn Gia Trí', 'Vàng quỳ', 'Sơn ta']
  },
  {
    id: 'res-03',
    title: 'Cẩm nang Kỹ thuật Vẽ Màu Nước - Diễn tả Thấu thị Phong cảnh Làng quê',
    category: 'technique',
    categoryLabel: 'Kỹ thuật thực hành',
    targetGrades: 'THCS (Lớp 6, 7, 8)',
    eraOrArtist: 'Ban Chuyên môn Sư phạm ARTVERSE AI',
    description: 'Video và infographic từng bước hướng dẫn: Kỹ thuật loang màu trên nền ướt (Wet-on-wet), gạt màu khô (Dry brush), pha sắc độ xa gần và quy luật đường chân trời trong tranh phong cảnh.',
    teachingGuide: 'Dành cho tiết Luyện tập - Sáng tạo. Giáo viên có thể chiếu từng bước 3 phút cho học sinh thực hành tương ứng.',
    visualType: 'watercolor',
    downloadFormat: 'Video MP4 (1080p) + Infographic A3',
    fileSize: '128 MB',
    downloadsCount: 1560,
    tags: ['Màu nước', 'Phong cảnh', 'Thấu thị', 'Kỹ thuật']
  },
  {
    id: 'res-04',
    title: 'Bộ Bài vẽ Học sinh Xuất sắc Đoạt giải Triển lãm Toàn quốc 2025-2026',
    category: 'award',
    categoryLabel: 'Bài vẽ xuất sắc',
    targetGrades: 'Toàn cấp Tiểu học & THCS',
    eraOrArtist: 'Học sinh các trường Tiểu học & THCS Việt Nam',
    description: 'Tuyển tập 25 tác phẩm đoạt giải cao với các chủ đề: Em yêu hòa bình, Bảo vệ hành tinh xanh, Nét đẹp ngày hội quê em. Minh họa sinh động góc nhìn trong trẻo của lứa tuổi học trò.',
    teachingGuide: 'Tư liệu quý để khích lệ cảm hứng, cho học sinh học hỏi cách phối màu dũng cảm và bố cục phá cách từ chính bạn bè cùng lứa tuổi.',
    visualType: 'collage',
    downloadFormat: 'Sách ảnh PDF (Print ready)',
    fileSize: '84.2 MB',
    downloadsCount: 890,
    tags: ['Giải thưởng', 'Tranh học sinh', 'Sáng tạo', 'Cảm hứng']
  },
  {
    id: 'res-05',
    title: 'Bài giảng Điện tử: Khám phá Thế giới Đất nặn Tò he Truyền thống',
    category: 'slides',
    categoryLabel: 'Bài giảng điện tử',
    targetGrades: 'Tiểu học (Lớp 1, 2, 3)',
    eraOrArtist: 'Làng nghề Tò he Xuân La, Phú Xuyên, Hà Nội',
    description: 'Bộ slide PowerPoint tương tác đầy đủ hiệu ứng âm thanh, câu đố hình khối, video nghệ nhân nặn tò he hình Tôn Ngộ Không, Chú gà trống, Bông hồng rực rỡ.',
    teachingGuide: 'Tối ưu cho màn hình cảm ứng hoặc máy chiếu lớp học. Có sẵn phần trò chơi Khởi động 5 phút và hướng dẫn an toàn khi dùng đất nặn.',
    visualType: 'clay',
    downloadFormat: 'PowerPoint (.pptx) tương tác',
    fileSize: '38.5 MB',
    downloadsCount: 2100,
    tags: ['Tò he', 'Xuân La', 'Bài giảng điện tử', 'Tiểu học']
  },
  {
    id: 'res-06',
    title: 'Hồ sơ Tác phẩm Mỹ thuật Việt Nam: Danh họa Bùi Xuân Phái và Phố Cổ Hà Nội',
    category: 'fineart',
    categoryLabel: 'Mỹ thuật Việt Nam',
    targetGrades: 'THCS (Lớp 7, 8, 9)',
    eraOrArtist: 'Danh họa Bùi Xuân Phái (1920 - 1988)',
    description: 'Bộ tranh ký họa chì, sơn dầu về mái ngói thâm nâu, những bức tường rêu phong và con người Hà Nội xưa. Phân tích giá trị đường viền run rẩy đầy rung cảm đặc trưng "Phố Phái".',
    teachingGuide: 'Thích hợp cho bài học Vẻ đẹp kiến trúc cổ truyền và ký họa đường phố.',
    visualType: 'pastel',
    downloadFormat: 'Tập tư liệu PDF + File Audio bình tranh',
    fileSize: '51.3 MB',
    downloadsCount: 1420,
    tags: ['Bùi Xuân Phái', 'Phố cổ', 'Hà Nội', 'Ký họa']
  }
];

export const INITIAL_PORTFOLIO_RECORDS: import('../types/artverse').ArtPortfolioRecord[] = [
  {
    id: 'port-01',
    studentCode: 'HS-6A1-08',
    studentPseudonym: 'Em L.H.M.',
    classGroup: '6A1',
    topic: 'Tạo hình từ vật liệu tái chế',
    title: 'Robot thám hiểm bảo vệ môi trường biển',
    executionDate: '24/10/2026',
    timePeriod: 'Tháng 10/2026',
    sketchImage: {
      caption: 'Bản vẽ phác thảo cấu trúc và ghi chú kích thước các khối hộp',
      visualType: 'pastel',
      notes: 'Phác thảo các khối hình hộp sữa làm thân, 4 nắp chai làm bánh xe di chuyển và cánh tay gắp rác bằng que kem.'
    },
    finalImage: {
      caption: 'Mô hình 3D hoàn chỉnh lắp ráp từ phế liệu sinh hoạt',
      visualType: 'clay',
      notes: 'Sản phẩm hoàn thiện có kết cấu vững chắc, được sơn phủ màu xanh lam bảo vệ đại dương và chi tiết mắt robot bằng đèn led hỏng.'
    },
    studentWrittenIdea: 'Ý tưởng của em: Em thấy bãi biển quê hương có nhiều rác thải nhựa trôi dạt. Em muốn thiết kế một chú robot thu gom rác từ các vật liệu bỏ đi như vỏ hộp sữa, nắp chai và que kem để gửi gắm thông điệp bảo vệ hành tinh xanh.',
    studentSelfAssessment: {
      level: 'achieved',
      levelLabel: 'Đạt yêu cầu (Mức 3)',
      reflection: 'Em đã hoàn thành mô hình robot đứng vững được trên bàn. Em thấy phần đầu robot bằng nắp chai rất sinh động, nhưng phần tay robot bằng que kem lúc đầu bị lỏng, em phải gia cố thêm keo nến mới chắc.',
      favoriteElement: 'Bộ phận bánh xe nắp chai có thể xoay nhẹ và màu xanh phủ trên thân robot.'
    },
    teacherFeedback: {
      comment: 'Em có ý thức bảo vệ môi trường rất đáng khen ngợi. Bản phác thảo ban đầu chi tiết giúp khâu lắp ráp thực tế diễn ra thuận lợi. Độ liên kết giữa các chất liệu nhựa và giấy carton chắc chắn.',
      guidance: 'Ở bài học sau, em có thể thử nghiệm tạo thêm bề mặt sần hoặc gắn thêm cờ hiệu nhỏ để mô hình thêm phần sinh động.',
      teacherName: 'Cô Mai Phương',
      verifiedDate: '25/10/2026'
    },
    rubricResult: {
      rubricTitle: 'Rubric Mô hình 3D từ Vật liệu Tái chế (Khối 6)',
      overallLevel: 'exceeded',
      overallLabel: 'Thể hiện tốt (Mức 4)',
      isTeacherVerified: true,
      criteriaScores: [
        { criterionName: 'Ý tưởng sáng tạo & Tính độc đáo', level: 'exceeded', note: 'Ý tưởng gắn liền thông điệp bảo vệ môi trường, biến đổi phế phẩm thông minh.' },
        { criterionName: 'Kỹ thuật xử lý vật liệu & Độ bền liên kết', level: 'achieved', note: 'Mối dán keo nến an toàn, kết cấu vững chắc.' },
        { criterionName: 'Hòa sắc & Hoàn thiện bề mặt', level: 'exceeded', note: 'Sơn phủ đồng đều, màu xanh đại dương tươi sáng.' },
        { criterionName: 'Ý thức môi trường & Vệ sinh lao động', level: 'exceeded', note: 'Thu dọn bàn học sạch sẽ, phân loại mẩu thừa gọn gàng.' }
      ]
    },
    isSampleData: true,
    storageType: 'persistent_mock'
  },
  {
    id: 'port-02',
    studentCode: 'HS-6A1-15',
    studentPseudonym: 'Em N.N.A.T.',
    classGroup: '6A1',
    topic: 'Di sản văn hóa tranh dân gian Đông Hồ',
    title: 'Chú gà trống rộn ràng sắc xuân (Mô phỏng Đông Hồ)',
    executionDate: '15/10/2026',
    timePeriod: 'Tháng 10/2026',
    sketchImage: {
      caption: 'Bản ký họa nét viền đen và phác mảng hoa văn thân gà',
      visualType: 'pastel',
      notes: 'Tập trung nghiên cứu nhịp điệu nét viền to dày dứt khoát đặc trưng của bản khắc gỗ Đông Hồ.'
    },
    finalImage: {
      caption: 'Bức tranh hoàn thiện bằng màu sáp cạo nét trên nền giấy xơ dừa',
      visualType: 'dongho',
      notes: 'Màu sắc tươi rói gồm đỏ hoa hòe, vàng nghệ và xanh gỉ đồng, đường nét viền bao quanh mảng màu bẹt.'
    },
    studentWrittenIdea: 'Ý tưởng của em: Em rất yêu thích tranh Đông Hồ của các nghệ nhân Bắc Ninh. Em chọn vẽ chú gà trống biểu trưng cho lòng dũng cảm và may mắn đầu năm mới, kết hợp hoa sen và hoa mẫu đơn.',
    studentSelfAssessment: {
      level: 'exceeded',
      levelLabel: 'Thể hiện tốt (Mức 4)',
      reflection: 'Em rất tự hào vì đã dùng kỹ thuật cạo màu sáp để tạo được đường vân gỗ tự nhiên trên giấy xơ dừa giống như tranh in mộc bản thật.',
      favoriteElement: 'Mào gà đỏ rực và đuôi gà uốn cong uyển chuyển.'
    },
    teacherFeedback: {
      comment: 'Cảm thụ di sản văn hóa dân gian đặc biệt sâu sắc. Kỹ thuật cạo nét sáp dầu sáng tạo và dũng cảm. Tinh thần học tập chủ động và say mê.',
      guidance: 'Em hãy tiếp tục giữ gìn phong cách đồ họa mảng bẹt này khi vẽ các đề tài lễ hội truyền thống sắp tới.',
      teacherName: 'Cô Mai Phương',
      verifiedDate: '16/10/2026'
    },
    rubricResult: {
      rubricTitle: 'Rubric Tranh Di sản Dân tộc (Khối 6)',
      overallLevel: 'exceeded',
      overallLabel: 'Thể hiện tốt (Mức 4)',
      isTeacherVerified: true,
      criteriaScores: [
        { criterionName: 'Đường nét & Hình thể dân gian', level: 'exceeded', note: 'Nét viền chắc khỏe, đúng tinh thần mộc bản.' },
        { criterionName: 'Hòa sắc màu tự nhiên', level: 'exceeded', note: 'Màu sắc ấm áp, rực rỡ mang không khí Tết.' },
        { criterionName: 'Bố cục trang trí ước lệ', level: 'exceeded', note: 'Bố cục đầy đặn, hài hòa.' },
        { criterionName: 'Thái độ trân trọng di sản', level: 'exceeded', note: 'Hiểu sâu sắc ý nghĩa nhân văn của tranh Đông Hồ.' }
      ]
    },
    isSampleData: true,
    storageType: 'persistent_mock'
  },
  {
    id: 'port-03',
    studentCode: 'HS-7B2-04',
    studentPseudonym: 'Em P.Đ.K.',
    classGroup: '7B2',
    topic: 'Biểu cảm màu sắc sơn mài Việt Nam',
    title: 'Hồ sen sớm - Cảm hứng sơn mài truyền thống',
    executionDate: '08/10/2026',
    timePeriod: 'Tháng 10/2026',
    sketchImage: {
      caption: 'Phác thảo bố cục mảng lá sen lớn nhỏ và vị trí bông sen nở',
      visualType: 'pastel',
      notes: 'Bố cục phân chia mảng tối sáng, xác định điểm nhấn nhũ vàng ở nhị hoa.'
    },
    finalImage: {
      caption: 'Tác phẩm hoàn thiện acrylic kết hợp rắc nhũ vàng và vỏ trứng',
      visualType: 'lacquer',
      notes: 'Mặt tranh óng ánh chiều sâu, nền son sẫm làm bật cánh sen vàng quỳ và gân lá khảm trứng.'
    },
    studentWrittenIdea: 'Ý tưởng của em: Em muốn tái hiện sự huyền bí lộng lẫy của nghệ thuật sơn mài danh họa Nguyễn Gia Trí bằng cách kết hợp màu acrylic nền son và gắn vụn vỏ trứng làm gân lá sen.',
    studentSelfAssessment: {
      level: 'achieved',
      levelLabel: 'Đạt yêu cầu (Mức 3)',
      reflection: 'Bức tranh có hiệu ứng bóng và tương phản tốt. Em gặp khó khăn ở khâu dán vỏ trứng nhỏ vì dễ vỡ vụn quá mức.',
      favoriteElement: 'Ánh nhũ vàng lấp lánh trên cánh hoa sen.'
    },
    teacherFeedback: {
      comment: 'Khả năng tìm tòi chất liệu mới rất đáng khen. Sự kiên nhẫn khi đính vỏ trứng tạo nên nhịp điệu thị giác độc đáo. Bố cục có chiều sâu tĩnh lặng.',
      guidance: 'Cần chú ý miết phẳng bề mặt vỏ trứng trước khi phủ lớp sơn bóng bảo vệ tranh.',
      teacherName: 'Cô Mai Phương',
      verifiedDate: '09/10/2026'
    },
    rubricResult: {
      rubricTitle: 'Rubric Sơn mài & Kỹ thuật chất liệu (Khối 7)',
      overallLevel: 'exceeded',
      overallLabel: 'Thể hiện tốt (Mức 4)',
      isTeacherVerified: true,
      criteriaScores: [
        { criterionName: 'Tính biểu cảm chất liệu', level: 'exceeded', note: 'Mô phỏng sơn mài điêu luyện, sáng tạo với vỏ trứng.' },
        { criterionName: 'Bố cục mảng miếng', level: 'achieved', note: 'Cân đối, tương phản rõ rệt.' },
        { criterionName: 'Kỹ thuật phủ bóng & hoàn thiện', level: 'achieved', note: 'Bề mặt sạch, keo dán khô đều.' },
        { criterionName: 'Tâm huyết & Kiên trì', level: 'exceeded', note: 'Tỉ mỉ trong từng thao tác nhỏ.' }
      ]
    },
    isSampleData: true,
    storageType: 'persistent_mock'
  },
  {
    id: 'port-04',
    studentCode: 'HS-4A3-11',
    studentPseudonym: 'Em Đ.B.N.',
    classGroup: '4A3',
    topic: 'Tạo dáng và trang trí con vật từ đất nặn dân gian',
    title: 'Gia đình gà sum vầy mùa quả ngọt',
    executionDate: '28/09/2026',
    timePeriod: 'Tháng 09/2026',
    sketchImage: {
      caption: 'Bản vẽ chì các khối tròn, khối trụ và hình dáng các con vật',
      visualType: 'pastel',
      notes: 'Phân tích các khối cơ bản: đầu tròn, thân bầu dục, mỏ nhọn.'
    },
    finalImage: {
      caption: 'Bộ mô hình đất nặn hoàn chỉnh gắn trên đế bìa carton',
      visualType: 'clay',
      notes: 'Gà mẹ lông vàng mỏ cam che chở 2 gà con, bên cạnh cây chuối có buồng quả nhỏ.'
    },
    studentWrittenIdea: 'Ý tưởng của em: Em nặn chú gà mẹ đang dẫn các con đi kiếm mồi trong vườn chuối nhà bà ngoại. Em muốn các con gà đều mập mạp và vui vẻ.',
    studentSelfAssessment: {
      level: 'achieved',
      levelLabel: 'Đạt yêu cầu (Mức 3)',
      reflection: 'Em nặn được gà con tròn xoe rất dễ thương. Lúc đầu đầu gà bị rơi, sau đó em cắm tăm tre vào cổ gà mới giữ được chắc chắn.',
      favoriteElement: 'Chú gà con lông vàng đang mổ hạt thóc.'
    },
    teacherFeedback: {
      comment: 'Em rất khéo tay và có trí tưởng tượng trong trẻo, hồn nhiên. Kỹ thuật cắm tăm tre gia cố cổ gà là sáng kiến kỹ thuật rất tốt.',
      guidance: 'Lần sau em hãy phối thêm nhiều màu đất nặn cho tán lá cây chuối nhé.',
      teacherName: 'Cô Mai Phương',
      verifiedDate: '29/09/2026'
    },
    rubricResult: {
      rubricTitle: 'Rubric Điêu khắc Đất nặn (Khối 4)',
      overallLevel: 'achieved',
      overallLabel: 'Đạt yêu cầu (Mức 3)',
      isTeacherVerified: true,
      criteriaScores: [
        { criterionName: 'Tạo hình khối 3D', level: 'achieved', note: 'Hình thể con vật ngộ nghĩnh, tỉ lệ cân đối.' },
        { criterionName: 'Độ bền gắn kết', level: 'achieved', note: 'Gia cố tăm tre thông minh, không bị rụng.' },
        { criterionName: 'Phối màu đất nặn', level: 'partially_achieved', note: 'Màu sắc tươi nhưng cây chuối còn đơn điệu.' },
        { criterionName: 'Thái độ học tập', level: 'exceeded', note: 'Rất hào hứng và giữ gìn sạch sẽ bàn nặn.' }
      ]
    },
    isSampleData: true,
    storageType: 'persistent_mock'
  }
];


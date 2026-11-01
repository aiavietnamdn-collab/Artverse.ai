import { 
  ArtRubricTemplate, 
  ArtRubricCriterion4Levels, 
  ArtProductFeedback, 
  RubricLevelKey,
  CriterionFeedbackItem 
} from '../types/artverse';

export const LEVEL_LABELS: Record<RubricLevelKey, string> = {
  needs_support: 'Mức 1: Cần hỗ trợ',
  partially_achieved: 'Mức 2: Đạt một phần',
  achieved: 'Mức 3: Đạt yêu cầu',
  exceeded: 'Mức 4: Thể hiện tốt'
};

export const LEVEL_COLORS: Record<RubricLevelKey, { bg: string; text: string; border: string }> = {
  needs_support: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  partially_achieved: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  achieved: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  exceeded: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' }
};

/**
 * Initial Default Rubric Templates
 */
export const DEFAULT_RUBRIC_TEMPLATES: ArtRubricTemplate[] = [
  {
    id: 'rubric-recycled-6',
    title: 'Rubric Đánh giá Mô hình 3D từ Vật liệu Tái chế',
    grade: 'Lớp 6',
    topic: 'Tạo hình sản phẩm mĩ thuật từ vật liệu tái chế',
    productType: 'Mô hình 3D / Tái chế',
    evaluationMode: 'weighted',
    criteria: [
      {
        id: 'c-1',
        name: 'Ý tưởng sáng tạo & Tính độc đáo',
        weight: 25,
        levels: {
          needs_support: 'Ý tưởng phụ thuộc hoàn toàn vào mẫu có sẵn hoặc còn sơ sài, chưa rõ hình tượng đồ vật/con vật muốn tạo hình.',
          partially_achieved: 'Ý tưởng bước đầu hình thành nhưng cấu trúc còn gượng ép, có chi tiết mô phỏng sáng tạo ở mức đơn giản.',
          achieved: 'Ý tưởng tạo hình rõ ràng, thể hiện góc nhìn cá nhân thú vị, biết biến đổi hình dạng phế liệu quen thuộc thành đồ vật hữu ích.',
          exceeded: 'Ý tưởng độc đáo, bất ngờ; kết hợp vật liệu tái chế phá cách, tạo được câu chuyện hoặc thông điệp môi trường sâu sắc.'
        }
      },
      {
        id: 'c-2',
        name: 'Kỹ thuật xử lý vật liệu & Độ bền liên kết',
        weight: 30,
        levels: {
          needs_support: 'Các mối dán/ghép còn lỏng lẻo, vết keo lem nhem, mô hình dễ bị nghiêng đổ hoặc bung rời khi chạm vào.',
          partially_achieved: 'Các bộ phận cơ bản liên kết được với nhau nhưng còn lộ nhiều vết cắt nham nhở, độ vững chãi ở mức vừa phải.',
          achieved: 'Thao tác cắt dán, cố định vật liệu (bìa carton, chai nhựa) chắc chắn; mô hình đứng vững trên mặt phẳng.',
          exceeded: 'Kỹ thuật ghép nối tinh xảo, xử lý mép cắt sạch sẽ; kết cấu chịu lực tốt, khéo léo che giấu các mối nối bằng màu sắc.'
        }
      },
      {
        id: 'c-3',
        name: 'Hòa sắc & Hoàn thiện bề mặt',
        weight: 25,
        levels: {
          needs_support: 'Màu sắc tô chưa đều, lem ra ngoài hình khối, bề mặt còn bám bụi bẩn hoặc để lộ nhiều nhãn mác cũ chưa xử lý.',
          partially_achieved: 'Có phối màu nhưng sắc độ còn đơn điệu, các mảng màu chính và phụ chưa tương phản rõ nét.',
          achieved: 'Phối màu hài hòa, có điểm nhấn chính phụ; bề mặt vật liệu tái chế được sơn phủ/trang trí tươm tất.',
          exceeded: 'Sử dụng màu sắc biểu cảm cao, tạo được chất cảm bề mặt hấp dẫn (nhũ bóng, loang màu, tạo vân texture) rất nghệ thuật.'
        }
      },
      {
        id: 'c-4',
        name: 'Ý thức môi trường & Vệ sinh lao động',
        weight: 20,
        levels: {
          needs_support: 'Chưa biết tận dụng triệt để vật liệu thừa, để rơi vãi rác bừa bãi xung quanh bàn học, cần GV nhắc nhở nhiều lần.',
          partially_achieved: 'Có ý thức thu gom rác sau giờ học nhưng thao tác còn lúng túng, còn lãng phí một số phụ liệu.',
          achieved: 'Tiết kiệm vật liệu, sử dụng hợp lý các mảnh bìa/nắp chai; dọn dẹp vệ sinh khu vực làm việc gọn gàng.',
          exceeded: 'Lan tỏa tinh thần sống xanh; biết tận dụng cả những mẩu phế phẩm nhỏ nhất để làm chi tiết trang trí; vệ sinh mẫu mực.'
        }
      }
    ],
    createdAt: '28/10/2026',
    author: 'Tổ Chuyên Môn Mĩ Thuật ARTVERSE'
  },
  {
    id: 'rubric-painting-7',
    title: 'Rubric Đánh giá Tranh Vẽ Phong Cảnh & Sắc Màu',
    grade: 'Lớp 7',
    topic: 'Biểu cảm của màu sắc trong tranh phong cảnh',
    productType: 'Hội họa 2D',
    evaluationMode: 'qualitative',
    criteria: [
      {
        id: 'cp-1',
        name: 'Đường nét & Hình thể phong cảnh',
        weight: 25,
        levels: {
          needs_support: 'Nét vẽ run rẩy, gò bó hoặc quá mờ nhạt; hình thể các sự vật (cây cối, ngôi nhà, dòng sông) bị méo mó thiếu chủ đích.',
          partially_achieved: 'Dựng được hình thể cơ bản nhưng đường nét còn đều đều, chưa tạo được nhịp điệu sinh động.',
          achieved: 'Nét vẽ tự tin, dứt khoát; hình thể phong cảnh có tỉ lệ hợp lý và nhịp điệu tự nhiên.',
          exceeded: 'Nét vẽ phóng khoáng, giàu cảm xúc; đường nét biến hóa linh hoạt gợi được chất sống động của thiên nhiên.'
        }
      },
      {
        id: 'cp-2',
        name: 'Bố cục & Chiều sâu không gian (Viễn cận)',
        weight: 30,
        levels: {
          needs_support: 'Các mảng hình xếp chồng lộn xộn hoặc dàn đều không có trọng tâm; không thể hiện được lớp không gian xa gần.',
          partially_achieved: 'Có phân biệt được gần - xa nhưng đường chân trời đặt chưa hợp lý, trọng tâm bức tranh chưa rõ.',
          achieved: 'Bố cục cân đối có mảng chính mảng phụ; thể hiện được 3 lớp không gian (tiền cảnh, trung cảnh, hậu cảnh).',
          exceeded: 'Bố cục sáng tạo, điểm nhấn thị giác cuốn hút; ứng dụng luật thấu thị không khí tinh tế tạo chiều sâu thăm thẳm.'
        }
      },
      {
        id: 'cp-3',
        name: 'Hòa sắc & Biểu cảm sắc độ',
        weight: 30,
        levels: {
          needs_support: 'Màu sắc tô bẹt một màu, chưa biết pha trộn hoặc màu bị đục, bẩn do cọ rửa chưa sạch.',
          partially_achieved: 'Biết dùng gam màu nóng hoặc lạnh nhưng độ chuyển sắc còn gắt, chưa tạo được sự liên kết giữa các mảng.',
          achieved: 'Hòa sắc êm dịu hoặc tương phản ấn tượng; độ đậm nhạt thể hiện được ánh sáng và thời gian trong tranh.',
          exceeded: 'Cảm thụ màu sắc tinh tế, phối hợp sắc độ điêu luyện; gợi được tâm trạng bình yên, rực rỡ hay hoài niệm của phong cảnh.'
        }
      },
      {
        id: 'cp-4',
        name: 'Thái độ thực hành & Chia sẻ cảm xúc',
        weight: 15,
        levels: {
          needs_support: 'Còn chán nản khi pha màu hỏng, chưa chủ động tìm cách khắc phục; ngại chia sẻ về tranh của mình.',
          partially_achieved: 'Hoàn thành bài đúng hạn nhưng thái độ làm bài còn thụ động, ít tương tác với bạn bè.',
          achieved: 'Chăm chỉ, kiên nhẫn trong khâu tỉa chi tiết; biết tự hào giới thiệu về bức tranh quê hương của mình.',
          exceeded: 'Tâm huyết và say mê với từng nét cọ; biết lắng nghe góp ý và tự tin trình bày câu chuyện thẩm mĩ truyền cảm hứng.'
        }
      }
    ],
    createdAt: '28/10/2026',
    author: 'Cô Mai Phương'
  }
];

/**
 * Generate AI Pedagogical Feedback adhering strictly to constraints:
 * - NO arbitrary rubric alteration
 * - NO guessing personality, IQ or lifelong overall capacity from 1 artwork
 * - NO equating creativity to copying sample models
 * - NO rigid automatic score finalization (Teacher has ultimate edit/accept/reject authority)
 * - Clear transparency on whether real image was uploaded
 * - Explicitly state what CANNOT be verified via a 2D flat photo
 */
export function generateAIPedagogicalFeedback(
  rubric: ArtRubricTemplate,
  studentName: string,
  classGroup: string,
  productTitle: string,
  teacherProcessNotes: string,
  hasImageFile: boolean,
  imageFileName?: string
): ArtProductFeedback {
  const notesLower = teacherProcessNotes.toLowerCase();

  // Observable visual features derived strictly from product title, materials and teacher's notes
  const visualFeatures: string[] = [
    `Hình khối tổng thể: Tác phẩm "${productTitle}" được tạo hình với cấu trúc đa chiều rõ nét, phân định được các bộ phận chính và chi tiết phụ.`,
    notesLower.includes('carton') || notesLower.includes('tái chế') || rubric.productType.includes('Tái chế')
      ? 'Chất liệu quan sát được: Bìa carton, nắp chai và các mẩu vật liệu tái sử dụng được ghép nối có chủ đích.'
      : 'Bề mặt tạo hình: Các mảng màu và đường viền được xử lý có nhịp điệu tương phản trên bề mặt sản phẩm.',
    'Màu sắc & sắc độ: Sử dụng gam màu phù hợp với chủ đề, có sự phân chia vùng sáng tối và điểm nhấn màu nổi bật.',
    notesLower.includes('nhóm') 
      ? 'Dấu ấn hợp tác: Tác phẩm có sự kết hợp ý tưởng của nhiều thành viên, thể hiện sự phong phú trong chi tiết.'
      : 'Dấu ấn tạo hình: Nét cắt và đường dán thể hiện nỗ lực điều khiển dụng cụ thủ công độc lập của học sinh.'
  ];

  // Specific limitations: What CANNOT be verified via a 2D camera photo
  const unverifiableAspects: string[] = [
    'Độ bền chịu lực và độ bám dính thực tế của các mối keo bên trong mô hình (ảnh chụp 2D không thể kiểm tra lực nén, độ rung lắc hay độ dẻo dai).',
    'Chất cảm xúc giác bề mặt (độ nhám, độ mịn màng hay độ dày mỏng thực tế của từng lớp vật liệu chỉ có thể đánh giá qua tương tác trực tiếp).',
    'Mức độ trung thực của màu sắc: Ống kính điện thoại và ánh sáng phòng học có thể làm lệch sắc độ (quá chói hoặc sẫm hơn so với mắt nhìn thực tế).',
    'Toàn bộ quá trình lao động, sự nỗ lực vượt khó hay thái độ an toàn của học sinh trong 90 phút học tập (ảnh tĩnh chỉ phản ánh kết quả ở thời điểm cuối cùng).'
  ];

  // Evaluate against TEACHER'S EXISTING RUBRIC (Without changing criteria!)
  const criteriaAlignment: CriterionFeedbackItem[] = rubric.criteria.map((criterion, index) => {
    let suggestedLevel: RubricLevelKey = 'achieved';
    let explanation = '';

    const nameLower = criterion.name.toLowerCase();

    if (nameLower.includes('ý tưởng') || nameLower.includes('sáng tạo')) {
      if (notesLower.includes('độc đáo') || notesLower.includes('sáng tạo') || notesLower.includes('bất ngờ')) {
        suggestedLevel = 'exceeded';
        explanation = `Ý tưởng tạo hình thể hiện tính tìm tòi riêng, không sao chép rập khuôn. Dựa trên quan sát và nhật ký giáo viên, học sinh đã biến đổi vật liệu thành công.`;
      } else if (notesLower.includes('lúng túng') || notesLower.includes('chậm') || notesLower.includes('khó khăn')) {
        suggestedLevel = 'partially_achieved';
        explanation = `Học sinh đã định hình được sản phẩm cơ bản, nhưng ý tưởng cần được khuyến khích mở rộng thêm để thoát khỏi sự gò bó ban đầu.`;
      } else {
        suggestedLevel = 'achieved';
        explanation = `Sản phẩm đáp ứng đúng mục tiêu chủ đề, thể hiện được ý tưởng tạo hình mạch lạc theo tiêu chí Mức 3 của Rubric.`;
      }
    } else if (nameLower.includes('kỹ thuật') || nameLower.includes('độ bền') || nameLower.includes('đường nét')) {
      if (notesLower.includes('khéo tay') || notesLower.includes('chắc chắn') || notesLower.includes('tỉ mỉ')) {
        suggestedLevel = 'exceeded';
        explanation = `Các mối nối/đường nét nhìn thấy được hoàn thiện chỉn chu, ít vết keo thừa, hình thể đứng vững chắc.`;
      } else if (notesLower.includes('bung') || notesLower.includes('lỏng') || notesLower.includes('chưa chắc')) {
        suggestedLevel = 'needs_support';
        explanation = `Cần hỗ trợ học sinh phương pháp dán giữ keo đủ thời gian nguội hoặc dùng thêm băng dính cố định tạm thời.`;
      } else {
        suggestedLevel = 'achieved';
        explanation = `Kỹ thuật lắp ráp đạt yêu cầu cơ bản của lứa tuổi học sinh lớp ${rubric.grade.replace('Lớp ', '')}, mô hình giữ được form dáng tốt.`;
      }
    } else if (nameLower.includes('màu') || nameLower.includes('hòa sắc') || nameLower.includes('bố cục')) {
      suggestedLevel = 'achieved';
      explanation = `Phối màu tươi sáng, có mảng nhấn chính phụ. Không đánh giá sáng tạo bằng việc giống tranh mẫu mà tôn trọng cách chọn màu tự nhiên của em.`;
    } else {
      // Attitude / Responsibility / Process
      if (notesLower.includes('tích cực') || notesLower.includes('gọn gàng') || notesLower.includes('an toàn')) {
        suggestedLevel = 'exceeded';
        explanation = `Nhật ký của giáo viên ghi nhận tinh thần làm việc nhóm gương mẫu, tuân thủ an toàn dụng cụ và dọn dẹp vệ sinh rất tốt.`;
      } else {
        suggestedLevel = 'achieved';
        explanation = `Học sinh tham gia hoàn thành bài cùng các bạn, thái độ học tập hợp tác và tích cực.`;
      }
    }

    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      suggestedLevel,
      suggestedLevelLabel: LEVEL_LABELS[suggestedLevel],
      explanation,
      isAccepted: null // Pending teacher decision!
    };
  });

  // Age-appropriate pedagogical suggestions
  const pedagogicalSuggestions: string[] = [
    `Khích lệ: "Thầy/Cô đánh giá cao nỗ lực kiên trì của ${studentName} khi hoàn thiện sản phẩm ${productTitle}. Tinh thần sáng tạo tự do của em rất đáng khen ngợi!"`,
    'Gợi mở kỹ thuật: "Trong bài học tiếp theo, em có thể thử nghiệm thêm việc dùng giấy nhám vuốt mịn các mép bìa hoặc dùng cọ nhỏ tỉa thêm các đường vân chi tiết."',
    'Ứng dụng: "Hãy chụp lại ảnh tác phẩm ở nhiều góc chụp khác nhau và viết 2 câu cảm nghĩ để đưa vào Hồ sơ học tập cá nhân nhé."'
  ];

  // Ethical & Pedagogical Guarantees
  const ethicalGuarantees: string[] = [
    '✓ Không suy đoán tính cách, chỉ số thông minh hay năng lực vĩnh viễn của học sinh từ một sản phẩm đơn lẻ.',
    '✓ Không đánh giá tính sáng tạo dựa trên việc bắt chước giống mẫu của giáo viên.',
    '✓ AI chỉ đóng vai trò trợ lý gợi ý đối chiếu; Giáo viên giữ toàn quyền sửa đổi, chấp nhận hoặc từ chối từng tiêu chí.'
  ];

  return {
    id: `feedback-${Date.now()}`,
    rubricId: rubric.id,
    studentName,
    classGroup,
    productTitle,
    imageFileName: imageFileName || (hasImageFile ? 'anh_san_pham_hoc_sinh.jpg' : undefined),
    imageAnalysisStatus: hasImageFile ? 'real_image_uploaded' : 'no_image_description_only',
    teacherProcessNotes,
    aiObservations: {
      visualFeatures,
      criteriaAlignment,
      unverifiableAspects,
      pedagogicalSuggestions,
      ethicalGuarantees
    },
    teacherFinalDecision: {
      status: 'pending',
      finalSummaryComment: `Bài thực hành "${productTitle}" của học sinh ${studentName} (${classGroup}) thể hiện sự cố gắng và tiếp thu tốt yêu cầu bài học. Cần phát huy tinh thần sáng tạo trong các chủ đề sau.`
    }
  };
}

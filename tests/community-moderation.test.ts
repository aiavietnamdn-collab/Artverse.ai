/**
 * ARTVERSE COMMUNITY — MANDATORY 10-CASE SECURITY, PRIVACY & MODERATION TEST SUITE
 * Verifies the Final Moderation Policy ("TỰ ĐỘNG KIỂM DUYỆT — AN TOÀN HIỂN THỊ NGAY — RỦI RO CHỜ DUYỆT")
 * against the real Express backend (createExpressApp) and 4-Layer Moderation Engine.
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { evaluateCommentModeration } from '../src/services/commentModerationEngine';

const firebaseConfigRaw = fs.readFileSync(
  path.resolve(process.cwd(), 'firebase-applet-config.json'),
  'utf-8'
);
const FIREBASE_PROJECT_ID: string = JSON.parse(firebaseConfigRaw).projectId;

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function createSignedFirebaseJwt(payload: {
  sub: string;
  email: string;
  name?: string;
}): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-kid-1' })
  ).toString('base64url');
  const fullPayload = {
    iss: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    aud: FIREBASE_PROJECT_ID,
    sub: payload.sub,
    email: payload.email,
    email_verified: true,
    name: payload.name || payload.email,
    iat: nowSeconds - 10,
    exp: nowSeconds + 3600,
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${body}`);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64url');
  return `${header}.${body}.${signature}`;
}

async function runTests() {
  process.env.ARTVERSE_SKIP_LISTEN = 'true';
  const { createExpressApp, setTestGooglePublicCerts } = await import('../server');
  setTestGooglePublicCerts({ 'test-kid-1': PUBLIC_KEY_PEM });

  const app = await createExpressApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test HTTP server');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  // Prepare real RS256-signed tokens for Admin, Teacher A (Class 7A1), Teacher B (Class 8B1)
  const adminToken = createSignedFirebaseJwt({
    sub: 'admin-uid-1',
    email: 'aiavietnam.dn@gmail.com',
    name: 'Admin Giám Tuyển',
  });

  const teacherAToken = createSignedFirebaseJwt({
    sub: 'teacher-7a-uid',
    email: 'teacher7a@artverse.edu.vn',
    name: 'Cô Giáo Mỹ Thuật 7A',
  });

  const teacherBToken = createSignedFirebaseJwt({
    sub: 'teacher-8b-uid',
    email: 'teacher8b@artverse.edu.vn',
    name: 'Thầy Giáo Mỹ Thuật 8B',
  });

  console.log('=== BẮT ĐẦU KIỂM THỬ BẢO MẬT & KIỂM DUYỆT ARTVERSE COMMUNITY (10 KỊCH BẢN) ===\n');

  try {
    // Bootstrap Teacher A & Teacher B via Admin + create Student 1 & Student 2 in Class 7A1
    await fetch(`${baseUrl}/api/admin/teachers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        email: 'teacher7a@artverse.edu.vn',
        displayName: 'Cô Giáo Mỹ Thuật 7A',
      }),
    });

    await fetch(`${baseUrl}/api/admin/teachers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        email: 'teacher8b@artverse.edu.vn',
        displayName: 'Thầy Giáo Mỹ Thuật 8B',
      }),
    });

    const testClassCode = `MT7A${Date.now().toString().slice(-4)}`;

    // Teacher A creates a new class
    const createClassRes = await fetch(`${baseUrl}/api/teacher/classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherAToken}`,
      },
      body: JSON.stringify({
        classCode: testClassCode,
        grade: 7,
        name: `Lớp 7A (${testClassCode})`,
      }),
    });
    assert.equal(createClassRes.status, 201, 'Teacher A should create class');

    // Teacher A creates Student 1 & Student 2 in testClassCode
    const createStudentsRes = await fetch(
      `${baseUrl}/api/teacher/classes/${encodeURIComponent(testClassCode)}/students`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherAToken}`,
        },
        body: JSON.stringify({
          students: [
            {
              studentCode: 'HS901',
              alias: 'Cọ Vàng Rực Rỡ',
              fullName: 'Nguyễn Văn A',
              grade: 'Lớp 7',
            },
            {
              studentCode: 'HS902',
              alias: 'Mây Xanh Sáng Tạo',
              fullName: 'Trần Thị B',
              grade: 'Lớp 7',
            },
          ],
        }),
      }
    );
    assert.equal(createStudentsRes.status, 201, 'Teacher A should create students in class');
    const createdStudentsData = await createStudentsRes.json();
    const card1 = createdStudentsData.loginCardsOneTime.find(
      (c: any) => c.studentCode === 'HS901'
    );
    const card2 = createdStudentsData.loginCardsOneTime.find(
      (c: any) => c.studentCode === 'HS902'
    );

    // Login Student 1 & Student 2 to obtain real student session tokens
    const loginS1Res = await fetch(`${baseUrl}/api/student-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classCode: testClassCode,
        studentCode: 'HS901',
        pin: card1.initialPin,
      }),
    });
    const loginS1Data = await loginS1Res.json();
    assert.equal(loginS1Res.status, 200, 'Student 1 login must succeed');
    const student1Token: string = loginS1Data.studentSessionToken;

    const loginS2Res = await fetch(`${baseUrl}/api/student-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classCode: testClassCode,
        studentCode: 'HS902',
        pin: card2.initialPin,
      }),
    });
    const loginS2Data = await loginS2Res.json();
    assert.equal(loginS2Res.status, 200, 'Student 2 login must succeed');
    const student2Token: string = loginS2Data.studentSessionToken;

    const uniqueArtworkId = `art-test-${Date.now()}`;

    // =========================================================================
    // TEST 1: Học sinh giả mạo vai trò giáo viên (Role Spoofing & Status Spoofing -> 403)
    // =========================================================================
    const spoofRoleRes = await fetch(`${baseUrl}/api/community/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({
        artworkId: uniqueArtworkId,
        artworkTitle: 'Bức tranh Mùa Thu',
        classCode: testClassCode,
        classGroupId: 'cls-7',
        content: 'Thử giả mạo vai trò giáo viên',
        authorRole: 'teacher',
      }),
    });
    assert.equal(
      spoofRoleRes.status,
      403,
      'Server must return 403 Forbidden when student attempts to spoof teacher/admin role'
    );

    const spoofStatusRes = await fetch(`${baseUrl}/api/community/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({
        artworkId: uniqueArtworkId,
        artworkTitle: 'Bức tranh Mùa Thu',
        classCode: testClassCode,
        classGroupId: 'cls-7',
        content: 'Thử tự gán trạng thái published từ client',
        status: 'published',
      }),
    });
    assert.equal(
      spoofStatusRes.status,
      403,
      'Server must return 403 Forbidden when client attempts to force status = published'
    );

    // Create a legitimate comment by Student 1
    const spoofRes = await fetch(`${baseUrl}/api/community/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({
        artworkId: uniqueArtworkId,
        artworkTitle: 'Bức tranh Mùa Thu',
        classCode: testClassCode,
        classGroupId: 'cls-7',
        content: 'Màu sắc bức tranh rất tươi sáng và ấm áp!',
      }),
    });
    const spoofData = await spoofRes.json();
    assert.equal(spoofRes.status, 201);
    assert.equal(spoofData.comment.authorRole, 'student');
    console.log(
      '✅ Kịch bản 1 PASS: Chặn học sinh giả mạo vai trò giáo viên (403) và chặn client tự gán published (403).'
    );

    // =========================================================================
    // TEST 2: Giáo viên truy cập / kiểm duyệt lớp không được phân công
    // =========================================================================
    const crossClassActionRes = await fetch(
      `${baseUrl}/api/community/moderation/comments/${encodeURIComponent(spoofData.comment.id)}/action`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherBToken}`, // Teacher B does NOT manage 7A1
        },
        body: JSON.stringify({
          action: 'hide',
          reason: 'Thử ẩn bình luận lớp khác',
        }),
      }
    );
    assert.equal(
      crossClassActionRes.status,
      403,
      'Teacher B must receive 403 Forbidden when moderating a comment in Teacher A class'
    );
    console.log('✅ Kịch bản 2 PASS: Chặn giáo viên kiểm duyệt bình luận thuộc lớp không phụ trách.');

    // =========================================================================
    // TEST 3: Học sinh cố đọc dữ liệu kiểm duyệt (Moderation Queue & Internal Metadata)
    // =========================================================================
    const studentModReadRes = await fetch(`${baseUrl}/api/community/moderation/overview`, {
      headers: {
        Authorization: `Bearer ${student1Token}`,
      },
    });
    assert.equal(
      studentModReadRes.status,
      403,
      'Student must receive 403 Forbidden when attempting to read moderation overview'
    );

    const publicListRes = await fetch(
      `${baseUrl}/api/community/comments?artworkId=${encodeURIComponent(uniqueArtworkId)}`
    );
    const publicListData = await publicListRes.json();
    const firstPublicComment = publicListData.items[0];
    assert.equal(
      'stateHistory' in firstPublicComment,
      false,
      'Public comment response must strip internal stateHistory'
    );
    assert.equal(
      'confidence' in firstPublicComment,
      false,
      'Public comment response must strip internal confidence score'
    );
    console.log('✅ Kịch bản 3 PASS: Chặn học sinh đọc dữ liệu kiểm duyệt và ẩn metadata nhạy cảm.');

    // =========================================================================
    // TEST 4: Người dùng sửa ID để xóa/sửa bình luận người khác (IDOR Protection)
    // =========================================================================
    const idorEditRes = await fetch(
      `${baseUrl}/api/community/comments/${encodeURIComponent(spoofData.comment.id)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student2Token}`, // Student 2 trying to edit Student 1's comment
        },
        body: JSON.stringify({ content: 'Sửa trái phép bình luận của bạn khác' }),
      }
    );
    assert.equal(idorEditRes.status, 403, 'Student 2 must be blocked from editing Student 1 comment');

    const idorDeleteRes = await fetch(
      `${baseUrl}/api/community/comments/${encodeURIComponent(spoofData.comment.id)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${student2Token}`, // Student 2 trying to delete Student 1's comment
        },
      }
    );
    assert.equal(
      idorDeleteRes.status,
      403,
      'Student 2 must be blocked from deleting Student 1 comment'
    );
    console.log('✅ Kịch bản 4 PASS: Chặn tấn công IDOR sửa/xóa bình luận của người dùng khác.');

    // =========================================================================
    // TEST 5: Người dùng spam báo cáo & spam bình luận trùng lặp
    // =========================================================================
    const duplicateCommentRes = await fetch(`${baseUrl}/api/community/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({
        artworkId: uniqueArtworkId,
        artworkTitle: 'Bức tranh Mùa Thu',
        classCode: testClassCode,
        content: 'Màu sắc bức tranh rất tươi sáng và ấm áp!', // Exact duplicate
      }),
    });
    assert.equal(
      duplicateCommentRes.status,
      422,
      'Duplicate consecutive comment must be blocked by Layer 3 Anti-Spam'
    );

    // First report succeeds
    const report1Res = await fetch(
      `${baseUrl}/api/community/comments/${encodeURIComponent(spoofData.comment.id)}/report`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student2Token}`,
        },
        body: JSON.stringify({
          reasonLabel: 'Spam hoặc quảng cáo',
          details: 'Kiểm thử báo cáo lần 1',
        }),
      }
    );
    assert.equal(report1Res.status, 201, 'First report should succeed');

    // Duplicate report on same comment by same student is rejected (429)
    const reportDupRes = await fetch(
      `${baseUrl}/api/community/comments/${encodeURIComponent(spoofData.comment.id)}/report`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student2Token}`,
        },
        body: JSON.stringify({
          reasonLabel: 'Spam hoặc quảng cáo',
          details: 'Báo cáo trùng lặp liên tục',
        }),
      }
    );
    assert.equal(reportDupRes.status, 429, 'Duplicate report on same comment must be blocked');
    console.log('✅ Kịch bản 5 PASS: Chặn spam bình luận trùng lặp và chặn spam báo cáo vi phạm.');

    // =========================================================================
    // TEST 6: AI Moderation mất kết nối (Safe Fallback — Không tự động cho đăng nội dung nghi ngờ)
    // =========================================================================
    const aiOfflineDecision = evaluateCommentModeration({
      content: 'Nhìn bức tranh này hơi kỳ cục và rối mắt sao ấy',
      authorUid: 'student-1',
      authorRole: 'student',
      artworkId: uniqueArtworkId,
      aiModerationSimulatedOffline: true, // Simulate AI moderation service offline
    });
    assert.equal(
      aiOfflineDecision.severity,
      'REVIEW',
      'When AI is offline, uncertain/nuanced comments must route to REVIEW'
    );
    assert.equal(
      aiOfflineDecision.decidedStatus,
      'pending',
      'When AI is offline, uncertain comments must be held as pending (never auto-published)'
    );
    console.log('✅ Kịch bản 6 PASS: Khi AI mất kết nối, nội dung nghi ngờ tự động chuyển sang pending (REVIEW).');

    // =========================================================================
    // TEST 7: Bình luận có thông tin cá nhân (SĐT, địa chỉ, gạ gẫm liên hệ riêng)
    // =========================================================================
    const piiPhoneRes = await fetch(`${baseUrl}/api/community/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student2Token}`,
      },
      body: JSON.stringify({
        artworkId: uniqueArtworkId,
        classCode: testClassCode,
        content: 'Cho mình số điện thoại để nói chuyện riêng nhé, số mình là 0912345678',
      }),
    });
    const piiPhoneData = await piiPhoneRes.json();
    assert.equal(
      piiPhoneRes.status,
      422,
      'Comment with private contact solicitation / phone number must be rejected (422)'
    );
    const piiSeverity = piiPhoneData.moderation?.severity || piiPhoneData.moderationSeverity;
    assert.ok(
      piiSeverity === 'CRITICAL' || piiSeverity === 'BLOCKED',
      'Must be classified as CRITICAL or BLOCKED'
    );
    console.log('✅ Kịch bản 7 PASS: Chặn triệt để bình luận chứa SĐT, địa chỉ cá nhân hoặc gạ gẫm liên hệ riêng.');

    // =========================================================================
    // TEST 8: Bình luận nhận xét nghệ thuật tích cực có từ dễ hiểu nhầm
    // =========================================================================
    const constructiveCritiqueRes = await fetch(`${baseUrl}/api/community/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student2Token}`,
      },
      body: JSON.stringify({
        artworkId: uniqueArtworkId,
        classCode: testClassCode,
        content: 'Bạn vẽ chưa đúng phối cảnh, mảng màu tối ở góc trái hơi đậm, thử lại nhé',
      }),
    });
    const constructiveData = await constructiveCritiqueRes.json();
    assert.equal(constructiveCritiqueRes.status, 201);
    assert.equal(
      constructiveData.moderation.severity,
      'SAFE',
      'Constructive art critique must be recognized as SAFE'
    );
    assert.equal(
      constructiveData.comment.status,
      'published',
      'Constructive art critique must be published immediately'
    );
    console.log(
      '✅ Kịch bản 8 PASS: Bình luận góp ý mỹ thuật xây dựng ("phối cảnh, mảng màu tối hơi đậm") được nhận diện SAFE và hiển thị ngay.'
    );

    // =========================================================================
    // TEST 9: Khôi phục bình luận đã ẩn (hidden -> published) bởi Giáo viên phụ trách
    // =========================================================================
    const commentIdToRestore = constructiveData.comment.id;
    const hideRes = await fetch(
      `${baseUrl}/api/community/moderation/comments/${encodeURIComponent(commentIdToRestore)}/action`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherAToken}`,
        },
        body: JSON.stringify({
          action: 'hide',
          reason: 'Tạm ẩn để kiểm tra',
        }),
      }
    );
    const hideData = await hideRes.json();
    assert.equal(hideRes.status, 200);
    assert.equal(hideData.comment.status, 'hidden');

    const restoreRes = await fetch(
      `${baseUrl}/api/community/moderation/comments/${encodeURIComponent(commentIdToRestore)}/action`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherAToken}`,
        },
        body: JSON.stringify({
          action: 'restore',
          reason: 'Khôi phục hiển thị sau khi xác minh nội dung tích cực',
        }),
      }
    );
    const restoreData = await restoreRes.json();
    assert.equal(restoreRes.status, 200);
    assert.equal(
      restoreData.comment.status,
      'published',
      'Restored comment must return to published state'
    );
    console.log('✅ Kịch bản 9 PASS: Giáo viên phụ trách tạm ẩn và khôi phục bình luận thành công.');

    // =========================================================================
    // TEST 10: Khiếu nại quyết định kiểm duyệt (Student Appeal -> Teacher Approves Appeal)
    // =========================================================================
    const reviewCommentRes = await fetch(`${baseUrl}/api/community/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${student1Token}`,
      },
      body: JSON.stringify({
        artworkId: uniqueArtworkId,
        classCode: testClassCode,
        content: 'Nhìn bức tranh này hơi kỳ cục và lộn xộn một chút',
      }),
    });
    const reviewCommentData = await reviewCommentRes.json();
    assert.equal(reviewCommentRes.status, 202);
    assert.equal(
      reviewCommentData.comment.status,
      'pending',
      'Borderline comment must enter pending state (REVIEW)'
    );

    // Student 1 submits an appeal
    const appealRes = await fetch(
      `${baseUrl}/api/community/comments/${encodeURIComponent(reviewCommentData.comment.id)}/appeal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student1Token}`,
        },
        body: JSON.stringify({
          appealReason: 'Em chỉ muốn góp ý chi tiết góc tranh để bạn vẽ gọn hơn ạ.',
        }),
      }
    );
    assert.equal(appealRes.status, 200, 'Student appeal submission must succeed');

    // Teacher A approves the appeal -> comment becomes published
    const approveAppealRes = await fetch(
      `${baseUrl}/api/community/moderation/comments/${encodeURIComponent(reviewCommentData.comment.id)}/action`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherAToken}`,
        },
        body: JSON.stringify({
          action: 'approve_appeal',
          reason: 'Chấp nhận giải trình của học sinh, mở hiển thị.',
        }),
      }
    );
    const approveAppealData = await approveAppealRes.json();
    assert.equal(approveAppealRes.status, 200);
    assert.equal(
      approveAppealData.comment.status,
      'published',
      'Comment must transition to published after teacher approves appeal'
    );
    assert.equal(approveAppealData.comment.appeal.status, 'approved');
    console.log(
      '✅ Kịch bản 10 PASS: Học sinh gửi yêu cầu xem xét lại và giáo viên phê duyệt khiếu nại thành công.'
    );

    // =========================================================================
    // TEST 11: HỆ THỐNG 5 CẢM XÚC (❤️ Yêu thích, 👍 Thích, 😂 Vui, 😢 Buồn, 😡 Giận)
    // - Chọn cảm xúc, Đổi sang cảm xúc khác, Bỏ chọn cảm xúc
    // - Chặn client tự truyền counts ảo (403) & chặn chưa đăng nhập (401)
    // - Đồng bộ chính xác khi nhiều người dùng cùng tương tác đồng thời (Promise.all)
    // - Giữ nguyên trạng thái sau khi tải lại trang
    // =========================================================================
    const unauthReactRes = await fetch(
      `${baseUrl}/api/community/artworks/${encodeURIComponent(uniqueArtworkId)}/reactions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emotion: 'love' }),
      }
    );
    assert.equal(unauthReactRes.status, 401, 'Unauthenticated user cannot react');

    const spoofCountRes = await fetch(
      `${baseUrl}/api/community/artworks/${encodeURIComponent(uniqueArtworkId)}/reactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student1Token}`,
        },
        body: JSON.stringify({ emotion: 'love', counts: { love: 999 } }),
      }
    );
    assert.equal(spoofCountRes.status, 403, 'Client cannot manipulate reaction counts directly');

    // 11a. Student 1 selects 'love' (❤️ Yêu thích)
    const selectLoveRes = await fetch(
      `${baseUrl}/api/community/artworks/${encodeURIComponent(uniqueArtworkId)}/reactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student1Token}`,
        },
        body: JSON.stringify({ emotion: 'love' }),
      }
    );
    const selectLoveData = await selectLoveRes.json();
    assert.equal(selectLoveRes.status, 200);
    assert.equal(selectLoveData.action, 'selected');
    assert.equal(selectLoveData.userEmotion, 'love');
    assert.equal(selectLoveData.counts.love, 1);
    assert.equal(selectLoveData.totalCount, 1);

    // 11b. Student 1 switches from 'love' to 'haha' (😂 Vui) -> 'love' becomes 0, 'haha' becomes 1
    const switchHahaRes = await fetch(
      `${baseUrl}/api/community/artworks/${encodeURIComponent(uniqueArtworkId)}/reactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student1Token}`,
        },
        body: JSON.stringify({ emotion: 'haha' }),
      }
    );
    const switchHahaData = await switchHahaRes.json();
    assert.equal(switchHahaRes.status, 200);
    assert.equal(switchHahaData.action, 'switched');
    assert.equal(switchHahaData.userEmotion, 'haha');
    assert.equal(switchHahaData.counts.love, 0);
    assert.equal(switchHahaData.counts.haha, 1);
    assert.equal(switchHahaData.totalCount, 1);

    // 11c. Student 1 clicks 'haha' again to unselect (toggle off) -> 'haha' becomes 0, total = 0
    const unselectRes = await fetch(
      `${baseUrl}/api/community/artworks/${encodeURIComponent(uniqueArtworkId)}/reactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student1Token}`,
        },
        body: JSON.stringify({ emotion: 'haha' }),
      }
    );
    const unselectData = await unselectRes.json();
    assert.equal(unselectRes.status, 200);
    assert.equal(unselectData.action, 'unselected');
    assert.equal(unselectData.userEmotion, null);
    assert.equal(unselectData.counts.haha, 0);
    assert.equal(unselectData.totalCount, 0);

    // 11d. Concurrent reactions from Student 1 ('love'), Student 2 ('like'), and Teacher A ('love')
    await Promise.all([
      fetch(`${baseUrl}/api/community/artworks/${encodeURIComponent(uniqueArtworkId)}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student1Token}`,
        },
        body: JSON.stringify({ emotion: 'love' }),
      }),
      fetch(`${baseUrl}/api/community/artworks/${encodeURIComponent(uniqueArtworkId)}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${student2Token}`,
        },
        body: JSON.stringify({ emotion: 'like' }),
      }),
      fetch(`${baseUrl}/api/community/artworks/${encodeURIComponent(uniqueArtworkId)}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherAToken}`,
        },
        body: JSON.stringify({ emotion: 'love' }),
      }),
    ]);

    // 11e. Reload state as Student 1 and verify persistence & exact counts (love=2, like=1, total=3)
    const reloadReactionRes = await fetch(
      `${baseUrl}/api/community/artworks/${encodeURIComponent(uniqueArtworkId)}/reactions`,
      {
        headers: {
          Authorization: `Bearer ${student1Token}`,
        },
      }
    );
    const reloadReactionData = await reloadReactionRes.json();
    assert.equal(reloadReactionRes.status, 200);
    assert.equal(reloadReactionData.userEmotion, 'love');
    assert.equal(reloadReactionData.counts.love, 2);
    assert.equal(reloadReactionData.counts.like, 1);
    assert.equal(reloadReactionData.counts.haha, 0);
    assert.equal(reloadReactionData.counts.sad, 0);
    assert.equal(reloadReactionData.counts.angry, 0);
    assert.equal(reloadReactionData.totalCount, 3);
    console.log(
      '✅ Kịch bản 11 PASS: Hệ thống 5 cảm xúc (Chọn, Đổi cảm xúc, Bỏ chọn, Chống tăng số ảo, Nhiều người dùng tương tác đồng thời & Lưu bền vững) hoạt động chính xác 100%.'
    );

    console.log('\n🎉 TẤT CẢ 11/11 KỊCH BẢN KIỂM THỬ BẢO MẬT, BÌNH LUẬN & 5 CẢM XÚC ĐỀU ĐẠT (100% PASS)!');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ KIỂM THỬ THẤT BẠI:', err);
  process.exit(1);
});

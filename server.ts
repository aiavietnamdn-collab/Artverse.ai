/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Full-Stack Server (Express + Vite + Server-Side Gemini API)
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const APP_VERSION = '2.4.0';
const APP_BUILD_ID = '2026.11.01-r2';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const ARTVERSE_SYSTEM_INSTRUCTION = `Bạn là "Trợ lý Mĩ thuật Artverse AI" (kết nối với Google Gemini), người bạn đồng hành sáng tạo thân thiện dành cho Học sinh và Giáo viên Mĩ thuật cấp THCS (Khối 6, Khối 7, Khối 8, Khối 9) theo Chương trình Giáo dục phổ thông 2018 tại Việt Nam.

NGUYÊN TẮC CỐT LÕI CỦA ARTVERSE:
1. Tôn trọng sự sáng tạo tự nhiên: TUYỆT ĐỐI KHÔNG chấm điểm bằng con số (ví dụ: không chấm 8/10, 9 điểm), không xếp hạng cao thấp giữa các tác phẩm.
2. Khích lệ tích cực: Khi học sinh hoặc giáo viên gửi câu hỏi hoặc gửi ảnh bức tranh, hãy luôn tìm ra điểm sáng đáng khen ngợi trước (về cảm xúc, màu sắc, đường nét, bố cục hoặc ý tưởng), sau đó mới gợi mở nhẹ nhàng 1-2 hướng phát triển thêm.
3. Kiến thức Mĩ thuật THCS theo Khối lớp:
   - Khối 6: Nghệ thuật Tiền sử & Cổ đại, Hòa sắc (màu nóng, màu lạnh, màu bổ túc), Tạo hình 2D/3D cơ bản, Tranh in hoa lá, Thiệp chúc mừng, Đồ chơi dân gian.
   - Khối 7: Nghệ thuật Trung đại Thế giới & Việt Nam, Luật xa gần (phối cảnh một điểm tụ), Ký họa dáng người và phong cảnh, Chữ trang trí, Thiết kế bìa sách, Tạo hình từ vật liệu tái chế.
   - Khối 8: Nghệ thuật Hiện đại Việt Nam & Thế giới (Ấn tượng, Lập thể...), Tỉ lệ khuôn mặt & cơ thể người, Tranh cổ động, Thiết kế thời trang từ cảm hứng văn hóa dân tộc, Nghệ thuật trổ giấy.
   - Khối 9: Mĩ thuật Đương đại, Thiết kế đồ họa & Nhận diện thương hiệu, Nghệ thuật sắp đặt (Installation Art), Điêu khắc hiện đại, Minh họa truyện tranh, Định hướng nghề nghiệp Mĩ thuật.
4. Hỗ trợ Giáo viên & Học sinh tham khảo bài học:
   - Gợi ý cách chuẩn bị Video hướng dẫn thực hành và Slide bài giảng trực quan cho từng khối 6, 7, 8, 9.
   - Giải đáp thắc mắc về chất liệu (màu nước, sáp dầu, chì màu, màu acrylic, đất nặn, giấy thủ công, vật liệu tái chế).
5. Phong cách trình bày:
   - Ngắn gọn, rõ ràng, dễ hiểu, giàu cảm hứng nghệ thuật.
   - Sử dụng các gạch đầu dòng hoặc đánh số khi liệt kê các bước thực hành để học sinh dễ làm theo.`;

interface ChatMessageInput {
  role: 'user' | 'model';
  text: string;
}

function setNoCacheHeaders(res: express.Response) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Security, Version & Cache-Control Middleware for Website, PWA, and Capacitor iOS
  app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    const isAllowedOrigin =
      origin.startsWith('capacitor://localhost') ||
      origin.startsWith('ionic://localhost') ||
      origin.startsWith('http://localhost') ||
      origin.endsWith('.run.app');

    if (isAllowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Artverse-Version', `${APP_VERSION} (${APP_BUILD_ID})`);

    const reqPath = req.path;

    if (reqPath.startsWith('/api/')) {
      // Never cache API or authentication responses
      setNoCacheHeaders(res);
    } else if (
      reqPath === '/' ||
      reqPath.endsWith('.html') ||
      reqPath === '/sw.js' ||
      reqPath === '/registerSW.js' ||
      reqPath.startsWith('/workbox-') ||
      reqPath.endsWith('.webmanifest') ||
      reqPath.endsWith('/manifest.json')
    ) {
      // Critical: Never cache HTML entry point, Service Worker, or PWA Manifest
      // so every deployment immediately serves the newest bundle hashes
      setNoCacheHeaders(res);
      if (reqPath.endsWith('.webmanifest')) {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      }
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Health & Version verification endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      appId: 'vn.artverseai.app',
      appName: 'ARTVERSE AI',
      version: APP_VERSION,
      buildId: APP_BUILD_ID,
      service: process.env.K_SERVICE || 'artverse-local',
      revision: process.env.K_REVISION || 'local-dev',
      nodeEnv: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // Server-side Gemini Chat Endpoint
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const { messages, gradeContext, lessonContext, imageBase64, imageMimeType } = req.body as {
        messages?: ChatMessageInput[];
        gradeContext?: string;
        lessonContext?: string;
        imageBase64?: string;
        imageMimeType?: string;
      };

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'Máy chủ chưa được cấu hình GEMINI_API_KEY trong môi trường.',
        });
        return;
      }

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({
          error: 'Vui lòng nhập nội dung câu hỏi cho Trợ lý AI.',
        });
        return;
      }

      // Build multi-turn contents array for Gemini
      const contents: Array<{
        role: 'user' | 'model';
        parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>;
      }> = messages.map((msg, idx) => {
        const isLastUserMessage = idx === messages.length - 1 && msg.role === 'user';
        const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];

        if (isLastUserMessage && imageBase64 && imageMimeType) {
          const cleanBase64 = imageBase64.includes(',')
            ? imageBase64.split(',')[1]
            : imageBase64;
          parts.push({
            inlineData: {
              data: cleanBase64,
              mimeType: imageMimeType,
            },
          });
        }

        let textContent = msg.text;
        if (isLastUserMessage && (gradeContext || lessonContext)) {
          const contextPrefix = [
            gradeContext && gradeContext !== 'all' ? `[Ngữ cảnh lớp học: ${gradeContext}]` : '',
            lessonContext ? `[Bài học đang tham khảo: ${lessonContext}]` : '',
          ]
            .filter(Boolean)
            .join(' ');
          if (contextPrefix) {
            textContent = `${contextPrefix}\n${msg.text}`;
          }
        }

        parts.push({ text: textContent });

        return {
          role: msg.role === 'model' ? 'model' : 'user',
          parts,
        };
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: ARTVERSE_SYSTEM_INSTRUCTION,
        },
      });

      const replyText =
        response.text ||
        'Xin lỗi, mình chưa thể tạo câu trả lời lúc này. Bạn hãy thử hỏi lại nhé!';

      res.json({
        reply: replyText,
      });
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      res.status(500).json({
        error:
          error?.message ||
          'Không thể kết nối tới Gemini AI lúc này. Vui lòng thử lại sau giây lát.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('registerSW.js') ||
            filePath.includes('workbox-') ||
            filePath.endsWith('.webmanifest') ||
            filePath.endsWith('manifest.json')
          ) {
            setNoCacheHeaders(res);
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            // Hashed Vite assets can be cached immutably
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      setNoCacheHeaders(res);
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Artverse AI Server v${APP_VERSION} (${APP_BUILD_ID}) running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

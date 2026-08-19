// Vercel Serverless Function
// Receives the 공사 의뢰 접수 form as JSON and sends it via Brevo's transactional email API.
// Required environment variables (set in Vercel project settings):
//   BREVO_API_KEY      - your Brevo API key (Settings > SMTP & API > API Keys)
//   BREVO_SENDER_EMAIL  - a sender email verified in Brevo (Settings > Senders & IP)
//   BREVO_TO_EMAIL      - (optional) recipient email, defaults to majam@naver.com

const TO_EMAIL = process.env.BREVO_TO_EMAIL || 'majam@naver.com';

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    console.error('Missing BREVO_API_KEY or BREVO_SENDER_EMAIL env vars');
    res.status(500).json({ error: '서버 설정 오류입니다. 관리자에게 문의해주세요.' });
    return;
  }

  try {
    const { site, name, addr, addr2, phone, type, detail, files } = req.body || {};

    if (!site || !name || !addr || !phone || !type) {
      res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
      return;
    }

    // files: [{ name: string, content: string (base64, no data: prefix) }]
    const attachment = Array.isArray(files)
      ? files.slice(0, 10).map(function (f) {
          return { name: f.name, content: f.content };
        })
      : [];

    const htmlContent =
      '<h2>공사 의뢰 접수</h2>' +
      '<table cellpadding="6" style="border-collapse:collapse">' +
      '<tr><td><b>단지명/건물명</b></td><td>' + escapeHtml(site) + '</td></tr>' +
      '<tr><td><b>담당자</b></td><td>' + escapeHtml(name) + '</td></tr>' +
      '<tr><td><b>주소</b></td><td>' + escapeHtml(addr) + ' ' + escapeHtml(addr2) + '</td></tr>' +
      '<tr><td><b>연락처</b></td><td>' + escapeHtml(phone) + '</td></tr>' +
      '<tr><td><b>공사종류</b></td><td>' + escapeHtml(type) + '</td></tr>' +
      '<tr><td valign="top"><b>공사내용</b></td><td>' + escapeHtml(detail).replace(/\n/g, '<br>') + '</td></tr>' +
      '</table>';

    const payload = {
      sender: { name: '페인트7 홈페이지', email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: TO_EMAIL }],
      replyTo: { email: process.env.BREVO_SENDER_EMAIL },
      subject: '[공사 의뢰] ' + site + ' - ' + type,
      htmlContent: htmlContent
    };
    if (attachment.length) payload.attachment = attachment;

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!brevoRes.ok) {
      const errText = await brevoRes.text();
      console.error('Brevo error:', brevoRes.status, errText);
      res.status(502).json({ error: '메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

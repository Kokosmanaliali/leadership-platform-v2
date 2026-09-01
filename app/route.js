import { fetchPlatformData } from '../lib/fetchData';
import { headBodyHtml } from '../lib/templates/headBody';
import { logicScriptJs } from '../lib/templates/logicScript';
import { tailHtml } from '../lib/templates/tail';

export const dynamic = 'force-dynamic'; // اقرأ من القاعدة في كل طلب، بلا تخزين مؤقت وقت البناء

export async function GET() {
  let html;
  try {
    const data = await fetchPlatformData();

    // JSON.stringify قد ينتج التتابع "</script>" حرفياً إذا وُجد داخل أي نص عربي (نادر لكن ممكن)،
    // وهذا يكسر الصفحة بإغلاق وسم <script> قبل أوانه. الحماية القياسية: تهريب الشرطة المائلة.
    const safeJson = JSON.stringify(data).replace(/<\/script/gi, '<\\/script');

    const dataDeclarations =
      `window.__DATA__ = ${safeJson};\n` +
      `const {MONTHS,WEEKS,TOPICS,DATES,KPI,RATE_DENOMINATORS,EXEC_SUMMARY,HIGHLIGHTS_DETAILED,` +
      `CHALLENGES,PRACTICES,IDEAS,QUOTES,MEMBERS,ENTITIES,PLATFORM_ENTITIES_EXTRA,PLATFORM_ENTITIES,` +
      `HARVEST_FILES,REF_FILES,OUTPUTS} = window.__DATA__;\n`;

    html = headBodyHtml + '<script>\n' + dataDeclarations + '\n' + logicScriptJs + tailHtml;
  } catch (err) {
    // لا نُظهر أي بيانات جزئية أو مضلِّلة إن فشل الاتصال بالقاعدة — رسالة واضحة فقط
    html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
      <title>خطأ في الاتصال بقاعدة البيانات</title></head>
      <body style="font-family:sans-serif; padding:40px; direction:rtl;">
        <h2>تعذّر تحميل بيانات المنصة</h2>
        <p>${(err && err.message) || 'خطأ غير معروف'}</p>
      </body></html>`;
  }

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

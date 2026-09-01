import { createClient } from '@supabase/supabase-js';

// هذا الملف يعمل فقط على الخادم (Server Components / API Routes) — لا يصل أبداً لمتصفح المستخدم.
// SUPABASE_SERVICE_ROLE_KEY يجب أن يكون Environment Variable على Vercel، بدون بادئة NEXT_PUBLIC_،
// حتى لا يُضمَّن إطلاقاً في أي كود JavaScript يُرسَل للمتصفح.
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'متغيرات البيئة SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY غير مضبوطة. أضيفيهما من إعدادات مشروع Vercel (Settings → Environment Variables) قبل النشر.'
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
    // مهم: مكتبة Supabase تستخدم fetch الخاص بها داخلياً لإرسال طلباتها الفعلية، وهذا لا يتأثر
    // تلقائياً بإعداد dynamic='force-dynamic' في route.js (ذاك يحمي فقط استجابة الصفحة النهائية،
    // لا الطلب الداخلي لجلب البيانات من Supabase). هذا يفرض عدم التخزين المؤقت صراحة على كل طلب
    // فعلي ترسله المكتبة، مهما كانت طبقة الشبكة الوسيطة.
    global: {
      fetch: (input, init = {}) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}

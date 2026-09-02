export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { chatText } = await request.json();

    if (!chatText || typeof chatText !== "string") {
      return Response.json(
        { error: "لم يتم إرسال محتوى ملف الواتساب." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY غير موجود في Vercel." },
        { status: 500 }
      );
    }

    const instructions = `
أنت محلل محتوى لمنصة تواصل قيادي حكومية في دولة قطر.

حلل محادثة واتساب أسبوعية باللغة العربية، ولا تخترع أي معلومة غير موجودة في النص.

التعريفات المعتمدة:
- المشاركة: أول طرح للعضو في محور الأسبوع، وتحسب مرة واحدة فقط لكل عضو خلال الأسبوع.
- المداخلة: أي رد أو تعقيب أو إضافة لاحقة من العضو.
- إجمالي التفاعل = المشاركات + المداخلات.
- المقترح أو الفكرة: فكرة أو حل جديد مقترح للتطبيق، وليس مجرد رأي أو تحليل.
- الممارسة أو التجربة: شيء مطبق فعلياً في جهة العضو.
- التحدي: مشكلة أو عائق مرتبط بمحور النقاش.
- لا تعتبر المبادرة ممارسة إلا إذا كان النص يوضح أنها مطبقة فعلياً.
- إذا لم تكن متأكداً من التصنيف، ضعه ضمن "يحتاج مراجعة".
- حافظ على الاقتباسات المنسوبة لأصحابها كما وردت قدر الإمكان.
- لا تعتبر مخرجات النقاش قرارات معتمدة.

أعد النتيجة JSON فقط بالشكل التالي:
{
  "topic": "",
  "participants": [],
  "participations": [],
  "interventions": [],
  "practices": [],
  "ideas": [],
  "challenges": [],
  "highlights": [],
  "quotes": [],
  "needsReview": [],
  "summary": ""
}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        instructions,
        input: chatText,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);
      return Response.json(
        {
          error:
            data?.error?.message ||
            "حدث خطأ أثناء الاتصال بخدمة التحليل.",
        },
        { status: response.status }
      );
    }

    const outputText =
      data.output_text ||
      data.output
        ?.flatMap((item) => item.content || [])
        ?.map((item) => item.text || "")
        ?.join("") ||
      "";

    let analysis;

    try {
      const cleaned = outputText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      analysis = JSON.parse(cleaned);
    } catch {
      return Response.json(
        {
          error: "تم التحليل ولكن تعذر قراءة النتيجة المنظمة.",
          raw: outputText,
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "حدث خطأ غير متوقع أثناء تحليل الأسبوع." },
      { status: 500 }
    );
  }
}

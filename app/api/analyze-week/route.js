export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toIsoDate(day, month, year) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function parseWhatsapp(chatText) {
  const lines = chatText.replace(/\r\n/g, "\n").split("\n");
  const messages = [];

  const messageRegex =
    /^[\u200e\u200f]?\[(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*([^\]]+)\]\s*([^:]+):\s?(.*)$/;

  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[\u200e\u200f]/, "");
    const match = line.match(messageRegex);

    if (match) {
      if (current) messages.push(current);

      const [, day, month, year, time, sender, text] = match;

      current = {
        date: toIsoDate(day, month, year),
        time: time.trim(),
        sender: sender.trim(),
        text: text.trim(),
      };
    } else if (current) {
      const extra = rawLine.trim();

      if (extra) {
        current.text += `\n${extra}`;
      }
    }
  }

  if (current) messages.push(current);

  return messages;
}

function isSystemMessage(message) {
  const text = message.text || "";

  return (
    /Messages and calls are end-to-end encrypted/i.test(text) ||
    /created group/i.test(text) ||
    /added you/i.test(text) ||
    /pinned a message/i.test(text) ||
    /This message was deleted/i.test(text) ||
    /You deleted this message/i.test(text)
  );
}

export async function POST(request) {
  try {
    const { chatText, startDate, endDate } = await request.json();

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

    if (startDate && endDate && startDate > endDate) {
      return Response.json(
        { error: "تاريخ البداية يجب أن يكون قبل تاريخ النهاية." },
        { status: 400 }
      );
    }

    const allMessages = parseWhatsapp(chatText);

    const selectedMessages = allMessages.filter((message) => {
      if (isSystemMessage(message)) return false;
      if (startDate && message.date < startDate) return false;
      if (endDate && message.date > endDate) return false;

      return true;
    });

    if (selectedMessages.length === 0) {
      return Response.json(
        { error: "لا توجد رسائل ضمن الفترة المحددة." },
        { status: 400 }
      );
    }

    /*
      حساب التفاعل من رسائل الواتساب نفسها
      وليس من تقدير الذكاء الاصطناعي.
    */

    const memberStats = new Map();

    for (const message of selectedMessages) {
      if (!memberStats.has(message.sender)) {
        memberStats.set(message.sender, {
          participation: message,
          interventions: [],
        });
      } else {
        memberStats.get(message.sender).interventions.push(message);
      }
    }

    const participants = Array.from(memberStats.keys());

    const participations = Array.from(memberStats.entries()).map(
      ([name, stats]) => ({
        member_name: name,
        text: stats.participation.text,
        date: stats.participation.date,
        time: stats.participation.time,
      })
    );

    const interventions = Array.from(memberStats.entries()).flatMap(
      ([name, stats]) =>
        stats.interventions.map((message) => ({
          member_name: name,
          text: message.text,
          date: message.date,
          time: message.time,
        }))
    );

    /*
      فقط النص المختار حسب التاريخ يذهب إلى AI.
    */

    const filteredChat = selectedMessages
      .map(
        (message) =>
          `[${message.date} ${message.time}] ${message.sender}: ${message.text}`
      )
      .join("\n");

    const instructions = `
أنت محلل محتوى لمنصة تواصل قيادي حكومية في دولة قطر.

حلل فقط النص المرسل لك، ولا تخترع أي معلومة غير موجودة فيه.

مهم جداً:
- لا تحسب عدد المشاركين.
- لا تحسب المشاركات.
- لا تحسب المداخلات.
- هذه المؤشرات يتم احتسابها برمجياً من رسائل واتساب.
- مهمتك هي تحليل وتصنيف المحتوى فقط.

التعريفات المعتمدة:

- المقترح أو الفكرة:
فكرة أو حل جديد مقترح للتطبيق، وليس مجرد رأي أو تحليل.

- الممارسة أو التجربة:
شيء مطبق فعلياً في جهة العضو.

- التحدي:
مشكلة أو عائق مرتبط بمحور النقاش.

- لا تعتبر المبادرة ممارسة إلا إذا كان النص يوضح أنها مطبقة فعلياً.

- إذا لم تكن متأكداً من التصنيف، ضعه ضمن "يحتاج مراجعة".

- حافظ على الاقتباسات المنسوبة لأصحابها كما وردت قدر الإمكان.

- لا تعتبر مخرجات النقاش قرارات معتمدة.

أعد النتيجة JSON فقط بالشكل التالي:

{
  "topic": "",
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
        input: filteredChat,
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

    let contentAnalysis;

    try {
      const cleaned = outputText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      contentAnalysis = JSON.parse(cleaned);
    } catch {
      return Response.json(
        {
          error: "تم التحليل ولكن تعذر قراءة النتيجة المنظمة.",
          raw: outputText,
        },
        { status: 500 }
      );
    }

    const analysis = {
      ...contentAnalysis,

      participants,
      participations,
      interventions,

      interactionStats: participants
        .map((name) => {
          const stats = memberStats.get(name);

          return {
            member_name: name,
            participations: 1,
            interventions: stats.interventions.length,
            total: 1 + stats.interventions.length,
          };
        })
        .sort((a, b) => b.total - a.total),
    };

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

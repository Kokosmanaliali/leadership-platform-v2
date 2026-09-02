import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();

    const { startDate, endDate, analysis } = body;

    if (!startDate || !endDate || !analysis) {
      return Response.json(
        { error: "بيانات الأسبوع غير مكتملة." },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    // حالياً نحفظ نسخة الاعتماد أولاً بدون لمس بيانات الداشبورد الأساسية.
    const { error } = await supabase
      .from("weekly_approvals")
      .insert({
        start_date: startDate,
        end_date: endDate,
        analysis_json: analysis,
        approved_at: new Date().toISOString(),
      });

    if (error) throw error;

    return Response.json({
      success: true,
      message: "تم اعتماد الأسبوع وحفظه بنجاح.",
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: error.message || "تعذر حفظ الأسبوع." },
      { status: 500 }
    );
  }
}

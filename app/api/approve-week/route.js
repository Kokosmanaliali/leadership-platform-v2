import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AR_MONTHS = [
  "",
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function normalizeArabic(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

function getMonthInfo(startDate) {
  const [year, month] = startDate.split("-").map(Number);

  return {
    year,
    month,
    monthId: `${year}-${String(month).padStart(2, "0")}`,
    monthLabel: `${AR_MONTHS[month]} ${year}`,
  };
}

function itemText(item) {
  if (typeof item === "string") return item;

  return (
    item?.text ||
    item?.title ||
    item?.description ||
    item?.content ||
    item?.quote ||
    ""
  );
}

export async function POST(request) {
  try {
    const { startDate, endDate, analysis } = await request.json();

    if (!startDate || !endDate || !analysis) {
      return Response.json(
        { error: "بيانات الأسبوع غير مكتملة." },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return Response.json(
        { error: "تاريخ البداية يجب أن يكون قبل تاريخ النهاية." },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
        global: {
          fetch: (input, init = {}) =>
            fetch(input, { ...init, cache: "no-store" }),
        },
      }
    );

    /*
      1. حفظ نسخة الاعتماد
    */

    const { error: approvalError } = await supabase
      .from("weekly_approvals")
      .insert({
        start_date: startDate,
        end_date: endDate,
        analysis_json: analysis,
        approved_at: new Date().toISOString(),
      });

    if (approvalError) throw approvalError;

    /*
      2. تحديد الشهر من تاريخ البداية
      مثال:
      2026-09-01 => 2026-09 => سبتمبر 2026
    */

    const { year, month, monthId, monthLabel } =
      getMonthInfo(startDate);

    const { data: existingMonth, error: monthReadError } =
      await supabase
        .from("months")
        .select("id")
        .eq("id", monthId)
        .maybeSingle();

    if (monthReadError) throw monthReadError;

    if (!existingMonth) {
      const { error: monthInsertError } = await supabase
        .from("months")
        .insert({
          id: monthId,
          year,
          month_number: month,
          label: monthLabel,
        });

      if (monthInsertError) throw monthInsertError;
    }

    /*
      3. هل يوجد أسبوع بنفس الفترة مسبقاً؟
    */

    const { data: existingWeek, error: weekLookupError } =
      await supabase
        .from("weeks")
        .select("*")
        .eq("date_start", startDate)
        .eq("date_end", endDate)
        .maybeSingle();

    if (weekLookupError) throw weekLookupError;

    let week;

    if (existingWeek) {
      week = existingWeek;
    } else {
      /*
        نحسب رقم الأسبوع داخل الشهر نفسه فقط.
        سبتمبر الجديد يبدأ W1.
      */

      const { data: monthWeeks, error: monthWeeksError } =
        await supabase
          .from("weeks")
          .select("week_number")
          .eq("month_id", monthId)
          .order("week_number", { ascending: false });

      if (monthWeeksError) throw monthWeeksError;

      const weekNumber =
        monthWeeks && monthWeeks.length
          ? Number(monthWeeks[0].week_number) + 1
          : 1;

      const weekId = `${monthId}-W${weekNumber}`;

      const newWeek = {
        id: weekId,
        month_id: monthId,
        week_number: weekNumber,
        label: `الأسبوع ${weekNumber}`,
        topic: analysis.topic || "",
        date_start: startDate,
        date_end: endDate,
        date_label: `${startDate} إلى ${endDate}`,
      };

      const { data: insertedWeek, error: weekInsertError } =
        await supabase
          .from("weeks")
          .insert(newWeek)
          .select()
          .single();

      if (weekInsertError) throw weekInsertError;

      week = insertedWeek;

      /*
        نسخ آخر snapshot متوفر مؤقتاً
        حتى يظل الداشبورد قادر على الحساب.
      */

      const { data: latestSnapshot } = await supabase
        .from("membership_snapshots")
        .select("*")
        .order("week_id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSnapshot) {
        await supabase.from("membership_snapshots").insert({
          week_id: week.id,
          members_count: latestSnapshot.members_count,
          denominator: latestSnapshot.denominator,
          represented_entities:
            latestSnapshot.represented_entities,
          locked: false,
          note: "نسخة أولية من آخر أسبوع وتحتاج مراجعة.",
        });
      }
    }

    /*
      4. حماية من التكرار
      إذا الأسبوع يحتوي بيانات Dashboard لا نكررها.
    */

    const tablesToCheck = [
      "member_week_stats",
      "practices",
      "ideas",
      "challenges",
      "highlights",
      "quotes",
      "outputs",
    ];

    for (const table of tablesToCheck) {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("week_id", week.id);

      if (error) throw error;

      if ((count || 0) > 0) {
        return Response.json({
          success: true,
          published: false,
          weekId: week.id,
          monthId,
          message:
            "تم حفظ الاعتماد، لكن بيانات هذا الأسبوع موجودة مسبقاً ولم يتم تكرارها.",
        });
      }
    }

    /*
      5. جلب الأعضاء والجهات للمطابقة
    */

    const { data: members, error: membersError } =
      await supabase
        .from("members")
        .select("id, full_name, current_entity_id");

    if (membersError) throw membersError;

    const { data: entities, error: entitiesError } =
      await supabase
        .from("entities")
        .select("id, name");

    if (entitiesError) throw entitiesError;

    const memberMap = new Map(
      (members || []).map((member) => [
        normalizeArabic(member.full_name),
        member,
      ])
    );

    const entityMap = new Map(
      (entities || []).map((entity) => [
        normalizeArabic(entity.name),
        entity,
      ])
    );

    const unknownMembers = [];

    /*
      6. التفاعل
    */

    const stats = Array.isArray(analysis.interactionStats)
      ? analysis.interactionStats
      : [];

    const statRows = [];

    for (const stat of stats) {
      const name =
        stat.member_name ||
        stat.name ||
        stat.person_name ||
        "";

      const member = memberMap.get(normalizeArabic(name));

      if (!member) {
        if (name && !unknownMembers.includes(name)) {
          unknownMembers.push(name);
        }
        continue;
      }

      statRows.push({
        member_id: member.id,
        week_id: week.id,
        entity_id: member.current_entity_id,
        participations: Number(stat.participations || 0),
        interventions: Number(stat.interventions || 0),
      });
    }

    if (statRows.length) {
      const { error } = await supabase
        .from("member_week_stats")
        .insert(statRows);

      if (error) throw error;
    }

    /*
      7. الممارسات
    */

    const practices = Array.isArray(analysis.practices)
      ? analysis.practices
      : [];

    if (practices.length) {
      const rows = practices.map((item, index) => {
        const entityName =
          item?.entity ||
          item?.entity_name ||
          item?.organization ||
          item?.org_display ||
          "";

        const entity = entityMap.get(
          normalizeArabic(entityName)
        );

        return {
          week_id: week.id,
          entity_id: entity?.id || null,
          org_display: entityName || null,
          title:
            item?.title ||
            itemText(item).slice(0, 200) ||
            "ممارسة",
          description:
            item?.description ||
            item?.text ||
            itemText(item),
          sort_order: index + 1,
        };
      });

      const { error } = await supabase
        .from("practices")
        .insert(rows);

      if (error) throw error;
    }

    /*
      8. الأفكار والمقترحات
    */

    const ideas = Array.isArray(analysis.ideas)
      ? analysis.ideas
      : [];

    if (ideas.length) {
      const rows = ideas.map((item, index) => ({
        week_id: week.id,
        title:
          item?.title ||
          itemText(item).slice(0, 200) ||
          "فكرة أو مقترح",
        description:
          item?.description ||
          item?.text ||
          itemText(item),
        member_id: null,
        entity_id: null,
        sort_order: index + 1,
      }));

      const { error } = await supabase
        .from("ideas")
        .insert(rows);

      if (error) throw error;
    }

    /*
      9. التحديات
    */

    const challenges = Array.isArray(analysis.challenges)
      ? analysis.challenges
      : [];

    if (challenges.length) {
      const rows = challenges.map((item, index) => ({
        week_id: week.id,
        title:
          item?.title ||
          itemText(item).slice(0, 200) ||
          "تحدٍ",
        note:
          item?.note ||
          item?.description ||
          item?.text ||
          itemText(item),
        member_id: null,
        entity_id: null,
        sort_order: index + 1,
      }));

      const { error } = await supabase
        .from("challenges")
        .insert(rows);

      if (error) throw error;
    }

    /*
      10. أبرز ما خرج به النقاش
    */

    const highlights = Array.isArray(analysis.highlights)
      ? analysis.highlights
      : [];

    if (highlights.length) {
      const rows = highlights.map((item, index) => ({
        week_id: week.id,
        title:
          item?.title ||
          itemText(item).slice(0, 200) ||
          "أبرز ما خرج به النقاش",
        description:
          item?.description ||
          item?.text ||
          itemText(item),
        sort_order: index + 1,
      }));

      const { error } = await supabase
        .from("highlights")
        .insert(rows);

      if (error) throw error;
    }

    /*
      11. الاقتباسات
    */

    const quotes = Array.isArray(analysis.quotes)
      ? analysis.quotes
      : [];

    if (quotes.length) {
      const rows = quotes.map((item, index) => ({
        week_id: week.id,
        quote_text:
          item?.quote_text ||
          item?.quote ||
          item?.text ||
          itemText(item),
        person_name:
          item?.person_name ||
          item?.name ||
          item?.speaker ||
          null,
        person_role:
          item?.person_role ||
          item?.role ||
          null,
        sort_order: index + 1,
      }));

      const { error } = await supabase
        .from("quotes")
        .insert(rows);

      if (error) throw error;
    }

    /*
      12. تحديث محور الأسبوع
    */

    if (analysis.topic) {
      const { error } = await supabase
        .from("weeks")
        .update({ topic: analysis.topic })
        .eq("id", week.id);

      if (error) throw error;
    }

    return Response.json({
      success: true,
      published: true,
      monthId,
      weekId: week.id,
      unknownMembers,
      message: "تم اعتماد الأسبوع ونشره في الداشبورد.",
    });
  } catch (error) {
    console.error("approve-week error:", error);

    return Response.json(
      {
        error:
          error?.message ||
          "تعذر اعتماد الأسبوع ونشره في الداشبورد.",
      },
      { status: 500 }
    );
  }
}

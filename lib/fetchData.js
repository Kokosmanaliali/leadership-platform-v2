import { getSupabaseServerClient } from './supabase';

// يملأ نصاً يحوي رموز {placeholder} بالقيم الفعلية من نفس السياق المحسوب — بلا أي رقم مكتوب حرفياً مسبقاً.
function fillTemplate(tmpl, ctx) {
  return tmpl.replace(/\{(\w+)\}/g, (_, key) => (ctx[key] !== undefined ? ctx[key] : ''));
}

function fmtPctForTemplate(x) {
  const v = Math.round(x * 1000) / 10;
  return (Number.isInteger(v) ? v : v.toFixed(1));
}

// يبني نصوص التصويت الجاهزة للعرض (votingLabel / votingSub) من صفوف voting_options الخام،
// بنفس الصياغة المعتمدة أصلاً في المنصة الحالية — بلا أي نص مكتوب يدوياً هنا.
function buildVotingText(options) {
  const totalRow = options.find((o) => o.sort_order === 99);
  const topRow = options.find((o) => o.sort_order === 1);
  const votingLabel = totalRow && totalRow.votes != null ? `${totalRow.votes} صوتاً` : '';
  let votingSub = '';
  if (topRow) {
    votingSub = topRow.votes != null
      ? `أعلى الخيارات: ${topRow.option_text} (${topRow.votes} صوتاً)`
      : `أعلى الخيارات: ${topRow.option_text}`;
  }
  return { votingLabel, votingSub };
}

export async function fetchPlatformData() {
  const supabase = getSupabaseServerClient();

  const [
    { data: months, error: e1 },
    { data: weeks, error: e2 },
    { data: snapshots, error: e3 },
    { data: entities, error: e4 },
    { data: members, error: e5 },
    { data: mws, error: e6 },
    { data: votingRounds, error: e7 },
    { data: votingOptions, error: e8 },
    { data: execBullets, error: e9 },
    { data: highlights, error: e10 },
    { data: practices, error: e11 },
    { data: ideas, error: e12 },
    { data: challenges, error: e13 },
    { data: quotes, error: e14 },
    { data: outputs, error: e15 },
    { data: outputEntities, error: e16 },
    { data: harvestFiles, error: e17 },
    { data: referenceFiles, error: e18 },
  ] = await Promise.all([
    supabase.from('months').select('*'),
    supabase.from('weeks').select('*').order('week_number'),
    supabase.from('membership_snapshots').select('*'),
    supabase.from('entities').select('*'),
    supabase.from('members').select('*'),
    supabase.from('member_week_stats').select('*'),
    supabase.from('voting_rounds').select('*'),
    supabase.from('voting_options').select('*'),
    supabase.from('exec_summary_bullets').select('*').order('sort_order'),
    supabase.from('highlights').select('*').order('sort_order'),
    supabase.from('practices').select('*').order('sort_order'),
    supabase.from('ideas').select('*').order('sort_order'),
    supabase.from('challenges').select('*').order('sort_order'),
    supabase.from('quotes').select('*').order('sort_order'),
    supabase.from('outputs').select('*').order('sort_order'),
    supabase.from('output_entities').select('*'),
    supabase.from('harvest_files').select('*'),
    supabase.from('reference_files').select('*').order('sort_order'),
  ]);

  const firstError = [e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12,e13,e14,e15,e16,e17,e18].find(Boolean);
  if (firstError) throw new Error('فشل الاتصال بقاعدة البيانات: ' + firstError.message);

  // فحص دفاعي: إن رجعت الجداول الأساسية فارغة بلا أي خطأ صريح من Supabase (وهو بالضبط ما
  // يحدث إذا كان RLS يمنع القراءة فعلياً بسبب مفتاح غير صحيح)، أوقف التنفيذ برسالة واضحة
  // بدل السماح لصفحة فارغة بالظهور بصمت لاحقاً في المتصفح.
  if (!months || months.length === 0) {
    throw new Error(
      'جدول months رجع فارغاً بلا أي خطأ صريح من Supabase. هذا يحدث عادة عندما لا يكون ' +
      'SUPABASE_SERVICE_ROLE_KEY هو مفتاح service_role الصحيح فعلياً (مثلاً استُخدم مفتاح anon ' +
      'بالخطأ)، فيمنع RLS القراءة دون أن يُرجع خطأ صريحاً. تأكدي من قيمة هذا المتغير في ' +
      'Vercel Settings → Environment Variables مقابل Supabase Project Settings → API → service_role.'
    );
  }
  if (!weeks || weeks.length === 0) {
    throw new Error('جدول weeks رجع فارغاً — نفس سبب جدول months على الأرجح (راجع مفتاح service_role).');
  }

  const entityById = Object.fromEntries(entities.map((e) => [e.id, e.name]));
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const weekById = Object.fromEntries(weeks.map((w) => [w.id, w]));
  const snapshotByWeek = Object.fromEntries(snapshots.map((s) => [s.week_id, s]));

  // ---------- MONTHS / WEEKS / TOPICS / DATES ----------
  const MONTHS = months.map((m) => ({
    id: m.id,
    year: m.year,
    month: m.month_number,
    label: m.label,
    weekIds: weeks.filter((w) => w.month_id === m.id).sort((a,b)=>a.week_number-b.week_number).map((w) => w.id),
  }));
  const WEEKS = weeks.map((w) => ({ id: w.id, monthId: w.month_id, weekNum: w.week_number, label: w.label }));
  const TOPICS = Object.fromEntries(weeks.map((w) => [w.id, w.topic]));
  const DATES = Object.fromEntries(weeks.map((w) => [w.id, w.date_label]));

  // ---------- RATE_DENOMINATORS (بالأسبوع + الشهر = آخر أسبوع فيه) ----------
  const RATE_DENOMINATORS = {};
  snapshots.forEach((s) => { RATE_DENOMINATORS[s.week_id] = s.rate_denominator; });
  MONTHS.forEach((m) => {
    const lastWeekId = m.weekIds[m.weekIds.length - 1];
    if (lastWeekId && snapshotByWeek[lastWeekId]) RATE_DENOMINATORS[m.id] = snapshotByWeek[lastWeekId].rate_denominator;
  });

  // ---------- تجميعات خام من member_week_stats (لا تُخزَّن، تُحسب هنا فقط) ----------
  function weekAgg(weekId) {
    const rows = mws.filter((r) => r.week_id === weekId);
    const participations = rows.reduce((s, r) => s + r.participations, 0);
    const interventions = rows.reduce((s, r) => s + r.interventions, 0);
    const active = new Set(rows.filter(r=>r.participations+r.interventions>0).map((r) => r.member_id)).size;
    const interactingEntities = new Set(rows.filter(r=>r.participations+r.interventions>0).map((r) => r.entity_id)).size;
    return { participations, interventions, qualitative: participations + interventions, active, entities: interactingEntities };
  }

  const KPI = {};
  WEEKS.forEach((w) => {
    const agg = weekAgg(w.id);
    const snap = snapshotByWeek[w.id] || {};
    const outputsCount = outputs.filter((o) => o.week_id === w.id).length;
    const ideasCount = ideas.filter((i) => i.week_id === w.id).length;
    const practicesCount = practices.filter((p) => p.week_id === w.id).length;
    const challengesCount = challenges.filter((c) => c.week_id === w.id).length;
    const roundsForWeek = votingRounds.filter((v) => v.week_id === w.id);
    const optionsForWeek = votingOptions.filter((o) => roundsForWeek.some((r) => r.id === o.voting_round_id));
    const { votingLabel, votingSub } = buildVotingText(optionsForWeek);
    KPI[w.id] = {
      qualitative: agg.qualitative,
      rate: agg.active / RATE_DENOMINATORS[w.id],
      active: agg.active,
      entities: agg.entities,
      entitiesOnPlatform: snap.entities_on_platform,
      participations: agg.participations,
      interventions: agg.interventions,
      outputs: outputsCount,
      ideas: ideasCount,
      practices: practicesCount,
      challenges: challengesCount,
      votingLabel,
      votingSub,
    };
  });
  MONTHS.forEach((m) => {
    const weekIds = m.weekIds;
    const rows = mws.filter((r) => weekIds.includes(r.week_id));
    const qualitative = rows.reduce((s, r) => s + r.participations + r.interventions, 0);
    const activeMembers = new Set(rows.filter(r=>r.participations+r.interventions>0).map((r) => r.member_id)).size;
    const interactingEntities = new Set(rows.filter(r=>r.participations+r.interventions>0).map((r) => r.entity_id)).size;
    const lastWeekId = weekIds[weekIds.length - 1];
    const snap = snapshotByWeek[lastWeekId] || {};
    const outputsCount = outputs.filter((o) => weekIds.includes(o.week_id)).length;
    const ideasCount = ideas.filter((i) => weekIds.includes(i.week_id)).length;
    const practicesCount = practices.filter((p) => weekIds.includes(p.week_id)).length;
    const roundsForMonth = votingRounds.filter((v) => weekIds.includes(v.week_id));
    const votesSum = votingOptions
      .filter((o) => roundsForMonth.some((r) => r.id === o.voting_round_id) && o.sort_order === 99)
      .reduce((s, o) => s + (o.votes || 0), 0);
    KPI[m.id] = {
      qualitative,
      rate: activeMembers / RATE_DENOMINATORS[m.id],
      active: activeMembers,
      entities: interactingEntities,
      entitiesOnPlatform: snap.entities_on_platform,
      totalMembers: snap.total_members,
      outputs: outputsCount,
      ideas: ideasCount,
      practices: practicesCount,
      votingLabel: `${roundsForMonth.length} جولات`,
      votingSub: `إجمالي الأصوات: ${votesSum}`,
      topics: weekIds.length,
    };
  });

  // ---------- EXEC_SUMMARY: تعبئة القوالب بالأرقام المحسوبة أعلاه (لا رقم مكتوب حرفياً) ----------
  const EXEC_SUMMARY = {};
  execBullets.forEach((b) => {
    const scopeId = b.scope_type === 'month' ? b.month_id : b.week_id;
    const k = KPI[scopeId] || {};
    const ctx = {
      total_members: k.totalMembers,
      active_members: k.active,
      rate_pct: k.rate != null ? fmtPctForTemplate(k.rate) : '',
      qualitative: k.qualitative,
      entities_count: k.entities,
      topics_count: k.topics,
      voting_rounds_count: b.scope_type === 'month' ? (k.votingLabel || '').replace(' جولات','') : undefined,
      voting_total_votes: b.scope_type === 'month' ? (k.votingSub || '').replace('إجمالي الأصوات: ','') : undefined,
      practices_count: k.practices,
      ideas_count: k.ideas,
      outputs_count: k.outputs,
    };
    const text = fillTemplate(b.bullet_template, ctx);
    if (!EXEC_SUMMARY[scopeId]) EXEC_SUMMARY[scopeId] = [];
    EXEC_SUMMARY[scopeId].push(text);
  });

  // ---------- المحتوى النوعي ----------
  const HIGHLIGHTS_DETAILED = {};
  highlights.forEach((h) => {
    if (!HIGHLIGHTS_DETAILED[h.week_id]) HIGHLIGHTS_DETAILED[h.week_id] = [];
    HIGHLIGHTS_DETAILED[h.week_id].push({ title: h.title, desc: h.description });
  });

  const PRACTICES = {};
  practices.forEach((p) => {
    if (!PRACTICES[p.week_id]) PRACTICES[p.week_id] = [];
    PRACTICES[p.week_id].push({
      name: p.title, org: entityById[p.entity_id], orgDisplay: p.org_display || undefined, desc: p.description,
    });
  });

  const IDEAS = {};
  ideas.forEach((i) => {
    if (!IDEAS[i.week_id]) IDEAS[i.week_id] = [];
    IDEAS[i.week_id].push({
      title: i.title, desc: i.description,
      by: i.member_id ? memberById[i.member_id].full_name : undefined,
      org: i.entity_id ? entityById[i.entity_id] : undefined,
    });
  });

  const CHALLENGES = {};
  challenges.forEach((c) => {
    if (!CHALLENGES[c.week_id]) CHALLENGES[c.week_id] = [];
    CHALLENGES[c.week_id].push({
      t: c.title, note: c.note || undefined,
      by: c.member_id ? memberById[c.member_id].full_name : undefined,
      org: c.entity_id ? entityById[c.entity_id] : undefined,
    });
  });

  const QUOTES = {};
  quotes.forEach((q) => {
    if (!QUOTES[q.week_id]) QUOTES[q.week_id] = [];
    QUOTES[q.week_id].push({ q: q.quote_text, who: q.person_name, role: q.person_role });
  });

  const OUTPUTS = outputs.map((o) => ({
    n: o.sort_order,
    weekId: o.week_id,
    orgs: outputEntities.filter((oe) => oe.output_id === o.id).map((oe) => entityById[oe.entity_id]),
    text: o.text,
    basis: o.basis || undefined,
  }));

  // ---------- الأعضاء (org = جهته الحالية؛ لا فرق عملياً لأن أغسطس بلا أي انتقال جهة مسجَّل) ----------
  const MEMBERS = members.map((m) => {
    const rows = mws.filter((r) => r.member_id === m.id);
    const weeksObj = {};
    let part = 0, inter = 0;
    rows.forEach((r) => {
      weeksObj[r.week_id] = r.participations + r.interventions;
      part += r.participations; inter += r.interventions;
    });
    return { name: m.full_name, org: entityById[m.current_entity_id], weeks: weeksObj, part, inter, total: part + inter };
  });

  // ---------- الجهات: قائمة الفلتر الكاملة (19) مباشرة من جدول entities ----------
  const interactingEntityIds = new Set(mws.filter(r=>r.participations+r.interventions>0).map((r) => r.entity_id));
  const ENTITIES = entities.filter((e) => interactingEntityIds.has(e.id)).map((e) => ({ name: e.name }));
  const PLATFORM_ENTITIES_EXTRA = entities.filter((e) => !interactingEntityIds.has(e.id)).map((e) => e.name);
  const PLATFORM_ENTITIES = entities.map((e) => e.name);

  // ---------- الملفات ----------
  const HARVEST_FILES = harvestFiles.map((h) => ({ weekId: h.week_id, title: h.title, href: h.storage_url }));
  const REF_FILES = {};
  referenceFiles.forEach((r) => {
    if (!REF_FILES[r.week_id]) REF_FILES[r.week_id] = [];
    const ext = (r.storage_url || '').split('.').pop();
    REF_FILES[r.week_id].push({
      title: r.title, by: r.submitted_by || undefined,
      org: r.entity_id ? entityById[r.entity_id] : undefined,
      href: r.storage_url || undefined, ext, available: r.is_available,
    });
  });

  return {
    MONTHS, WEEKS, TOPICS, DATES, KPI, RATE_DENOMINATORS, EXEC_SUMMARY, HIGHLIGHTS_DETAILED,
    CHALLENGES, PRACTICES, IDEAS, QUOTES, MEMBERS, ENTITIES, PLATFORM_ENTITIES_EXTRA,
    PLATFORM_ENTITIES, HARVEST_FILES, REF_FILES, OUTPUTS,
  };
}

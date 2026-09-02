"use client";

import { useState } from "react";

export default function AdminPage() {
  const [fileName, setFileName] = useState("");
  const [chatText, setChatText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [excluded, setExcluded] = useState({});
  const [saved, setSaved] = useState(false);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setChatText(await file.text());
    setResult(null);
    setError("");
    setExcluded({});
    setSaved(false);
  }

  async function handleAnalyze() {
    if (!chatText) {
      setError("اختاري ملف الواتساب أولاً.");
      return;
    }

    if (!startDate || !endDate) {
      setError("حددي تاريخ بداية ونهاية الأسبوع.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setExcluded({});
    setSaved(false);

    try {
      const response = await fetch("/api/analyze-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatText,
          startDate,
          endDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر تحليل الأسبوع.");
      }

      setResult(data.analysis);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function getText(item) {
    if (typeof item === "string") return item;

    return (
      item?.content ||
      item?.practice ||
      item?.idea ||
      item?.challenge ||
      item?.highlight ||
      item?.quote ||
      item?.text ||
      ""
    );
  }

  function getMember(item) {
    if (typeof item !== "object" || !item) return "";
    return item.member || item.name || item.author || "";
  }

  function editItem(section, index) {
    const item = result[section][index];
    const oldText = getText(item);

    const newText = window.prompt("عدلي النص:", oldText);

    if (newText === null) return;

    const updated = { ...result };
    const items = [...updated[section]];

    if (typeof item === "string") {
      items[index] = newText;
    } else {
      const copy = { ...item };

      if ("content" in copy) copy.content = newText;
      else if ("practice" in copy) copy.practice = newText;
      else if ("idea" in copy) copy.idea = newText;
      else if ("challenge" in copy) copy.challenge = newText;
      else if ("highlight" in copy) copy.highlight = newText;
      else if ("quote" in copy) copy.quote = newText;
      else if ("text" in copy) copy.text = newText;
      else copy.content = newText;

      items[index] = copy;
    }

    updated[section] = items;
    setResult(updated);
  }

  function toggleExclude(section, index) {
    const key = `${section}-${index}`;

    setExcluded((old) => ({
      ...old,
      [key]: !old[key],
    }));
  }

  function renderList(section, items) {
    if (!items?.length) {
      return <div className="empty">لا يوجد</div>;
    }

    return (
      <div className="items">
        {items.map((item, index) => {
          const key = `${section}-${index}`;
          const isExcluded = excluded[key];

          return (
            <div
              className={`item ${isExcluded ? "excluded" : ""}`}
              key={key}
            >
              {getMember(item) && (
                <strong className="member">{getMember(item)}</strong>
              )}

              <div className="itemText">{getText(item)}</div>

              <div className="actions">
                <button
                  className="edit"
                  onClick={() => editItem(section, index)}
                >
                  تعديل
                </button>

                <button
                  className="exclude"
                  onClick={() => toggleExclude(section, index)}
                >
                  {isExcluded ? "إرجاع" : "استبعاد"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function countIncluded(section) {
    const items = result?.[section] || [];

    return items.filter(
      (_, index) => !excluded[`${section}-${index}`]
    ).length;
  }

 async function handleApprove() {
  const ok = window.confirm(
    "هل أنتِ متأكدة من اعتماد نتيجة الأسبوع بعد المراجعة؟"
  );

  if (!ok) return;

  try {
    setError("");

    const cleanedAnalysis = { ...result };

    [
      "participations",
      "interventions",
      "practices",
      "ideas",
      "challenges",
      "highlights",
      "quotes",
      "needsReview",
    ].forEach((section) => {
      if (Array.isArray(cleanedAnalysis[section])) {
        cleanedAnalysis[section] = cleanedAnalysis[section].filter(
          (_, index) => !excluded[`${section}-${index}`]
        );
      }
    });

    const response = await fetch("/api/approve-week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate,
        endDate,
        analysis: cleanedAnalysis,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "تعذر اعتماد الأسبوع.");
    }

    setSaved(true);
  } catch (e) {
    setError(e.message);
  }
}

  return (
    <main dir="rtl">
      <div className="wrap">
        <header>
          <div>
            <div className="tag">منصة التواصل القيادي</div>
            <h1>مراجعة الأسبوع قبل الاعتماد</h1>
            <p>
              ارفعي محادثة الأسبوع، راجعي التصنيف، وعدلي أو استبعدي
              أي بند قبل الاعتماد.
            </p>
          </div>

          <span className="test">تجريبي</span>
        </header>

        <section className="panel">
          <label className="upload">
            <b>رفع محادثة واتساب</b>
            <span>{fileName || "اختاري ملف TXT"}</span>
            <input
              type="file"
              accept=".txt,text/plain"
              onChange={handleFile}
            />
          </label>

          <div className="dates">
            <label>
              من تاريخ
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            <label>
              إلى تاريخ
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>

          <button
            className="analyze"
            onClick={handleAnalyze}
            disabled={loading}
          >
            {loading ? "جاري التحليل..." : "تحليل الأسبوع"}
          </button>

          {error && <div className="error">{error}</div>}
        </section>

        {result && (
          <>
            <section className="topic">
              <span>محور الأسبوع</span>
              <h2>{result.topic || "غير محدد"}</h2>
            </section>

            <section className="kpis">
              <Kpi
                number={result.participants?.length || 0}
                label="المشاركون"
              />
              <Kpi
                number={countIncluded("participations")}
                label="المشاركات"
              />
              <Kpi
                number={countIncluded("interventions")}
                label="المداخلات"
              />
              <Kpi
                number={
                  countIncluded("participations") +
                  countIncluded("interventions")
                }
                label="إجمالي التفاعل"
              />
            </section>
                                      <section className="grid">
<Card title="أكثر الأعضاء تفاعلًا">
  {renderList(
    "topMembers",
    [...(result.participations || []), ...(result.interventions || [])]
      .reduce((members, item) => {
        const name = item.member_name || item.name || item.person_name;
        if (!name) return members;

        const existing = members.find((m) => m.name === name);

        if (existing) {
          existing.total += 1;
        } else {
          members.push({ name, total: 1 });
        }

        return members;
      }, [])
      .sort((a, b) => b.total - a.total)
      .map((m) => `${m.name} — ${m.total} تفاعل`)
  )}
</Card>
</section>
            <section className="grid">
              <Card title="الممارسات والتجارب">
                {renderList("practices", result.practices)}
              </Card>

              <Card title="الأفكار والمقترحات">
                {renderList("ideas", result.ideas)}
              </Card>

              <Card title="أبرز التحديات">
                {renderList("challenges", result.challenges)}
              </Card>

              <Card title="أبرز ما خرج به النقاش">
                {renderList("highlights", result.highlights)}
              </Card>

              <Card title="اقتباسات بارزة">
                {renderList("quotes", result.quotes)}
              </Card>

              <Card title="يحتاج مراجعة">
                {renderList("needsReview", result.needsReview)}
              </Card>
            </section>

            <section className="summary">
              <h3>ملخص الأسبوع</h3>
              <p>{result.summary || "لا يوجد ملخص."}</p>
            </section>

            <section className="approveBox">
              {!saved ? (
                <>
                  <b>راجعي النتائج قبل الاعتماد</b>
                  <p>
                    الاستبعاد والتعديل هنا لا يؤثران على الداشبورد
                    حتى يتم اعتماد الأسبوع.
                  </p>

                  <button
                    className="approve"
                    onClick={handleApprove}
                  >
                    اعتماد الأسبوع
                  </button>
                </>
              ) : (
                <div className="success">
                  ✓ تمت مراجعة الأسبوع في النسخة التجريبية.
                  <br />
                  لم يتم الإرسال إلى قاعدة البيانات بعد.
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        main {
          min-height: 100vh;
          background: #f4f6f8;
          color: #18232d;
          font-family: Arial, sans-serif;
          padding: 35px 18px 70px;
        }

        .wrap {
          max-width: 1100px;
          margin: auto;
        }

        header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 25px;
        }

        .tag {
          color: #69747c;
          font-size: 14px;
          margin-bottom: 8px;
        }

        h1 {
          margin: 0;
          font-size: 30px;
        }

        header p {
          color: #65717a;
        }

        .test {
          background: #fff1bf;
          padding: 8px 15px;
          border-radius: 20px;
          font-size: 13px;
        }

        .panel,
        .topic,
        .card,
        .summary,
        .approveBox {
          background: #fff;
          border: 1px solid #e0e5e8;
          border-radius: 15px;
        }

        .panel {
          padding: 22px;
          margin-bottom: 20px;
        }

        .upload {
          display: flex;
          flex-direction: column;
          gap: 8px;
          border: 2px dashed #ccd3d8;
          border-radius: 12px;
          padding: 18px;
        }

        .upload input {
          margin-top: 8px;
        }

        .dates {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin: 18px 0;
        }

        .dates label {
          display: flex;
          flex-direction: column;
          gap: 7px;
          font-weight: bold;
        }

        .dates input {
          padding: 11px;
          border: 1px solid #ccd3d8;
          border-radius: 8px;
        }

        button {
          cursor: pointer;
          font-family: inherit;
        }

        .analyze {
          width: 100%;
          padding: 14px;
          border: 0;
          border-radius: 9px;
          background: #17232d;
          color: white;
          font-size: 16px;
        }

        .analyze:disabled {
          opacity: 0.6;
        }

        .error {
          margin-top: 14px;
          background: #fff0f0;
          padding: 12px;
          border-radius: 8px;
        }

        .topic {
          padding: 20px;
          margin-bottom: 18px;
        }

        .topic span {
          color: #707b83;
          font-size: 13px;
        }

        .topic h2 {
          margin: 8px 0 0;
          font-size: 21px;
        }

        .kpis {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .kpis :global(.kpi) {
          background: #fff;
          border: 1px solid #e0e5e8;
          border-radius: 14px;
          padding: 18px;
          text-align: center;
        }

        .kpis :global(.kpiNumber) {
          display: block;
          font-size: 28px;
          font-weight: bold;
        }

        .kpis :global(.kpiLabel) {
          display: block;
          color: #6c7780;
          margin-top: 5px;
          font-size: 13px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .card {
          padding: 20px;
        }

        .card :global(h3) {
          margin: 0 0 15px;
        }

        .items {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .item {
          background: #f7f8f9;
          border-radius: 10px;
          padding: 13px;
        }

        .item.excluded {
          opacity: 0.45;
          text-decoration: line-through;
        }

        .member {
          display: block;
          margin-bottom: 6px;
        }

        .itemText {
          line-height: 1.7;
        }

        .actions {
          display: flex;
          gap: 7px;
          margin-top: 10px;
        }

        .actions button {
          padding: 6px 13px;
          border-radius: 7px;
          background: white;
          border: 1px solid #cfd5d9;
        }

        .exclude {
          color: #9c3434;
        }

        .empty {
          color: #8a949b;
        }

        .summary {
          padding: 20px;
          margin-top: 18px;
        }

        .summary h3 {
          margin-top: 0;
        }

        .summary p {
          line-height: 1.8;
        }

        .approveBox {
          margin-top: 18px;
          padding: 22px;
          text-align: center;
        }

        .approveBox p {
          color: #6d7880;
        }

        .approve {
          width: 100%;
          max-width: 420px;
          padding: 14px;
          border: 0;
          border-radius: 9px;
          background: #17232d;
          color: white;
          font-size: 16px;
          font-weight: bold;
        }

        .success {
          padding: 16px;
          line-height: 1.8;
          font-weight: bold;
        }

        @media (max-width: 700px) {
          .grid,
          .dates,
          .kpis {
            grid-template-columns: 1fr;
          }

          header {
            flex-direction: column;
          }

          h1 {
            font-size: 24px;
          }
        }
      `}</style>
    </main>
  );
}

function Card({ title, children }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Kpi({ number, label }) {
  return (
    <div className="kpi">
      <span className="kpiNumber">{number}</span>
      <span className="kpiLabel">{label}</span>
    </div>
  );
}

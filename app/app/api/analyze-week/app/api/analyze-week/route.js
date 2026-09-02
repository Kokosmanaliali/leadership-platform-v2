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

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setChatText(await file.text());
    setResult(null);
    setError("");
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

  const list = (items) => {
    if (!items?.length) return <div className="empty">لا يوجد</div>;

    return (
      <div className="items">
        {items.map((item, i) => {
          let text = "";

          if (typeof item === "string") {
            text = item;
          } else {
            text =
              item.content ||
              item.practice ||
              item.idea ||
              item.challenge ||
              item.highlight ||
              item.quote ||
              item.text ||
              JSON.stringify(item);
          }

          const member =
            typeof item === "object"
              ? item.member || item.name || item.author || ""
              : "";

          return (
            <div className="item" key={i}>
              {member && <strong>{member}</strong>}
              <span>{text}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const count = (x) => (Array.isArray(x) ? x.length : 0);

  return (
    <main dir="rtl">
      <div className="wrap">
        <div className="header">
          <div>
            <div className="tag">منصة التواصل القيادي</div>
            <h1>مراجعة الأسبوع قبل الاعتماد</h1>
            <p>ارفعي محادثة الأسبوع وحددي الفترة، ثم راجعي نتيجة التحليل.</p>
          </div>
          <div className="status">تجريبي</div>
        </div>

        <section className="box">
          <label className="upload">
            <b>رفع محادثة واتساب</b>
            <span>{fileName || "اختاري ملف TXT"}</span>
            <input type="file" accept=".txt,text/plain" onChange={handleFile} />
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

          <button onClick={handleAnalyze} disabled={loading}>
            {loading ? "جاري التحليل..." : "تحليل الأسبوع"}
          </button>

          {error && <div className="error">{error}</div>}
        </section>

        {result && (
          <>
            <section className="topic">
              <small>محور الأسبوع</small>
              <h2>{result.topic || "غير محدد"}</h2>
            </section>

            <div className="kpis">
              <div>
                <b>{count(result.participants)}</b>
                <span>المشاركون</span>
              </div>
              <div>
                <b>{count(result.participations)}</b>
                <span>المشاركات</span>
              </div>
              <div>
                <b>{count(result.interventions)}</b>
                <span>المداخلات</span>
              </div>
              <div>
                <b>
                  {count(result.participations) +
                    count(result.interventions)}
                </b>
                <span>إجمالي التفاعل</span>
              </div>
            </div>

            <section className="grid">
              <Card title="الممارسات والتجارب">
                {list(result.practices)}
              </Card>

              <Card title="الأفكار والمقترحات">
                {list(result.ideas)}
              </Card>

              <Card title="أبرز التحديات">
                {list(result.challenges)}
              </Card>

              <Card title="أبرز ما خرج به النقاش">
                {list(result.highlights)}
              </Card>

              <Card title="اقتباسات بارزة">
                {list(result.quotes)}
              </Card>

              <Card title="يحتاج مراجعة">
                {list(result.needsReview)}
              </Card>
            </section>

            <section className="summary">
              <h3>ملخص الأسبوع</h3>
              <p>{result.summary || "لا يوجد ملخص."}</p>
            </section>

            <div className="reviewNote">
              هذه النتيجة للمراجعة فقط ولم يتم حفظها في قاعدة البيانات.
            </div>
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
          font-family: Arial, sans-serif;
          color: #18232d;
          padding: 35px 18px;
        }

        .wrap {
          max-width: 1100px;
          margin: auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 25px;
        }

        .tag {
          font-size: 14px;
          margin-bottom: 8px;
          color: #66727d;
        }

        h1 {
          margin: 0 0 8px;
          font-size: 30px;
        }

        p {
          line-height: 1.8;
        }

        .status {
          background: #fff2cc;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
        }

        .box,
        .topic,
        .summary,
        .card {
          background: white;
          border: 1px solid #e2e6e9;
          border-radius: 16px;
        }

        .box {
          padding: 22px;
          margin-bottom: 20px;
        }

        .upload {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 18px;
          border: 2px dashed #ccd3d8;
          border-radius: 12px;
          cursor: pointer;
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
          padding: 12px;
          border: 1px solid #ccd3d8;
          border-radius: 9px;
        }

        button {
          width: 100%;
          padding: 14px;
          border: 0;
          border-radius: 10px;
          background: #18232d;
          color: white;
          font-size: 16px;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.6;
        }

        .error {
          margin-top: 15px;
          padding: 12px;
          background: #fff0f0;
          border-radius: 8px;
        }

        .topic {
          padding: 20px;
          margin-bottom: 18px;
        }

        .topic small {
          color: #6d7880;
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

        .kpis div {
          background: white;
          border: 1px solid #e2e6e9;
          border-radius: 14px;
          padding: 18px;
          text-align: center;
        }

        .kpis b {
          display: block;
          font-size: 27px;
          margin-bottom: 5px;
        }

        .kpis span {
          font-size: 13px;
          color: #68747d;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .card {
          padding: 20px;
        }

        .card h3 {
          margin: 0 0 15px;
          font-size: 18px;
        }

        .items {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .item {
          background: #f7f8f9;
          border-radius: 9px;
          padding: 12px;
          line-height: 1.7;
        }

        .item strong {
          display: block;
          margin-bottom: 3px;
        }

        .item span {
          display: block;
        }

        .empty {
          color: #89939a;
        }

        .summary {
          margin-top: 18px;
          padding: 20px;
        }

        .summary h3 {
          margin-top: 0;
        }

        .reviewNote {
          margin-top: 18px;
          text-align: center;
          color: #6c767e;
          font-size: 13px;
        }

        @media (max-width: 700px) {
          .dates,
          .grid,
          .kpis {
            grid-template-columns: 1fr;
          }

          .header {
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

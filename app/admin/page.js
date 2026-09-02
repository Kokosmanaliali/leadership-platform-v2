"use client";

import { useState } from "react";

export default function AdminPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleAnalyze() {
    if (!file) {
      setError("اختاري ملف الواتساب أولاً.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const chatText = await file.text();

      const response = await fetch("/api/analyze-week", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chatText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر تحليل الأسبوع.");
      }

      setResult(data.analysis);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء التحليل.");
    } finally {
      setLoading(false);
    }
  }

  const Section = ({ title, items }) => {
    if (!items || items.length === 0) return null;

    return (
      <div
        style={{
          marginTop: "20px",
          padding: "20px",
          background: "#f7f7f7",
          borderRadius: "12px",
        }}
      >
        <h3>{title}</h3>

        <ul>
          {items.map((item, index) => (
            <li key={index} style={{ marginBottom: "10px" }}>
              {typeof item === "string"
                ? item
                : JSON.stringify(item, null, 2)}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <main
      dir="rtl"
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "1000px",
        margin: "50px auto",
        padding: "30px",
      }}
    >
      <h1>إدارة الأسبوع</h1>

      <p>
        رفع وتحليل محتوى منصة التواصل القيادي قبل اعتماده ونشره في لوحة المتابعة.
      </p>

      <div
        style={{
          marginTop: "30px",
          padding: "30px",
          border: "2px dashed #aaa",
          borderRadius: "12px",
        }}
      >
        <h2>رفع ملف الواتساب</h2>

        <p>ارفعي ملف المحادثة بصيغة TXT لبدء تحليل الأسبوع.</p>

        <input
          type="file"
          accept=".txt,text/plain"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setResult(null);
            setError("");
          }}
        />

        <div style={{ marginTop: "25px" }}>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading}
            style={{
              padding: "13px 28px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "16px",
            }}
          >
            {loading ? "جاري التحليل..." : "تحليل الأسبوع"}
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: "20px",
              padding: "15px",
              background: "#fff0f0",
              borderRadius: "8px",
            }}
          >
            {error}
          </div>
        )}
      </div>

      {result && (
        <div style={{ marginTop: "35px" }}>
          <h2>مراجعة الأسبوع قبل الاعتماد</h2>

          {result.topic && (
            <div
              style={{
                padding: "20px",
                border: "1px solid #ddd",
                borderRadius: "12px",
              }}
            >
              <strong>محور الأسبوع:</strong>
              <div style={{ marginTop: "8px" }}>{result.topic}</div>
            </div>
          )}

          <Section
            title="الأعضاء المرصودون"
            items={result.participants}
          />

          <Section
            title="المشاركات"
            items={result.participations}
          />

          <Section
            title="المداخلات"
            items={result.interventions}
          />

          <Section
            title="الممارسات والتجارب"
            items={result.practices}
          />

          <Section
            title="الأفكار والمقترحات"
            items={result.ideas}
          />

          <Section
            title="التحديات"
            items={result.challenges}
          />

          <Section
            title="أبرز ما خرج به النقاش"
            items={result.highlights}
          />

          <Section
            title="الاقتباسات"
            items={result.quotes}
          />

          <Section
            title="يحتاج مراجعة"
            items={result.needsReview}
          />

          {result.summary && (
            <div
              style={{
                marginTop: "20px",
                padding: "20px",
                border: "1px solid #ddd",
                borderRadius: "12px",
              }}
            >
              <h3>ملخص الأسبوع</h3>
              <p>{result.summary}</p>
            </div>
          )}

          <div
            style={{
              marginTop: "25px",
              padding: "15px",
              background: "#f5f5f5",
              borderRadius: "10px",
            }}
          >
            هذه مرحلة المراجعة فقط. لم يتم حفظ أي بيانات في قاعدة البيانات.
          </div>
        </div>
      )}
    </main>
  );
}

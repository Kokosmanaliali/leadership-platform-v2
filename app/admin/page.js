"use client";

import { useState } from "react";

export default function AdminPage() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");

  async function handleAnalyze() {
    if (!file) {
      setStatus("اختاري ملف الواتساب أولاً.");
      return;
    }

    setStatus("جاري قراءة ملف الواتساب...");

    try {
      const text = await file.text();

      sessionStorage.setItem("whatsapp_chat", text);
      sessionStorage.setItem("whatsapp_filename", file.name);

      setStatus(
        `تمت قراءة الملف بنجاح: ${file.name} — جاهز للمرحلة التالية من التحليل.`
      );
    } catch (error) {
      setStatus("تعذر قراءة الملف. حاولي مرة أخرى.");
    }
  }

  return (
    <main
      dir="rtl"
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "900px",
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
            setStatus("");
          }}
        />

        <div style={{ marginTop: "25px" }}>
          <button
            type="button"
            onClick={handleAnalyze}
            style={{
              padding: "12px 24px",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            تحليل الأسبوع
          </button>
        </div>

        {status && (
          <div
            style={{
              marginTop: "20px",
              padding: "15px",
              background: "#f5f5f5",
              borderRadius: "8px",
            }}
          >
            {status}
          </div>
        )}
      </div>
    </main>
  );
}

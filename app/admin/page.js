export default function AdminPage() {
  return (
    <main dir="rtl" style={{
      fontFamily: "Arial, sans-serif",
      maxWidth: "900px",
      margin: "50px auto",
      padding: "30px"
    }}>
      <h1>إدارة الأسبوع</h1>
      <p>رفع وتحليل محتوى منصة التواصل القيادي قبل اعتماده.</p>

      <div style={{
        marginTop: "30px",
        padding: "30px",
        border: "2px dashed #aaa",
        borderRadius: "12px"
      }}>
        <h2>رفع ملف الواتساب</h2>
        <p>ارفع ملف المحادثة بصيغة TXT لبدء تحليل الأسبوع.</p>

        <input type="file" accept=".txt" />
      </div>
    </main>
  );
}

const base = process.env.NEXT_PUBLIC_BASE_PATH || '';


export default function Home() {
  return <>
    <header><strong className="brand">◈ ردِ سفر</strong><a href={base + "/album/"}>آلبوم من</a></header>
    <main>
      <section className="hero landing">
        <p className="eyebrow">آلبوم سفر روی نقشهٔ ایران</p>
        <h1>هر شهر، چند تا خاطره</h1>
        <p>عکس‌های سفرت رو به شهرها وصل کن، روی نقشه ببین و ازشون استوری بساز.</p>
        <a className="btn" href={base + "/album/"}>باز کردن آلبوم</a>
      </section>
      <section className="layout" aria-label="چطور کار می‌کند">
        <div className="card"><h2>شهر هر عکس رو انتخاب کن</h2><p>چند عکس رو یک‌جا به یک شهر وصل کن. برای JPEGهای دارای GPS، اگر نزدیک یکی از شهرهای موجود باشن، اپ شهر رو پیشنهاد می‌ده.</p></div>
        <div className="card"><h2>آلبوم روی دستگاهت می‌مونه</h2><p>عکس‌ها در مرورگر ذخیره می‌شن. هر وقت خواستی، از نقشه و عکس‌ها یک استوری PNG بگیر.</p></div>
      </section>
    </main>
  </>;
}

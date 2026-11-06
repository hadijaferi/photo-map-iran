'use client';

import {useEffect, useRef, useState} from 'react';
import {openAlbum, saveAlbum} from '../../lib/album';
import {cities, loadImage, mapSvg, samplePhotos, suggestCity} from '../../lib/photos';
import {createStory} from '../../lib/story';

const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const number = value => value.toLocaleString('fa-IR');

export default function Album() {
  const [photos, setPhotos] = useState([]);
  const [title, setTitle] = useState('سفر شمال');
  const [city, setCity] = useState('rasht');
  const [focused, setFocused] = useState('');
  const [ready, setReady] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState('');
  const [storage, setStorage] = useState('');
  const [story, setStory] = useState('');
  const db = useRef(null);
  const version = useRef(0);
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);
  const inputLock = useRef(false);
  const urls = useRef(new Set());

  useEffect(() => {
    let active = true;
    openAlbum().then(({db: connection, saved}) => {
      if (!active) { connection.close(); return; }
      db.current = connection;
      if (saved) {
        version.current = saved.version;
        setTitle(saved.title);
        setPhotos(saved.records.map(record => {
          const url = record.sample ? record.url : URL.createObjectURL(record.blob);
          if (!record.sample) urls.current.add(url);
          return {...record, url, selected:false};
        }));
        setStorage('آلبوم ذخیره‌شده باز شد.');
      }
    }).catch(() => {
      if (active) setStorage('ذخیرهٔ محلی در دسترس نیست. تغییرات تا وقتی صفحه بازه می‌مونن.');
    }).finally(() => { if (active) setReady(true); });

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register(base + '/sw.js').catch(() => {});
    }

    const photoUrls = urls.current;
    return () => {
      active = false;
      revision.current++;
      queue.current.finally(() => db.current?.close());
      photoUrls.forEach(url => URL.revokeObjectURL(url));
      photoUrls.clear();
    };
  }, []);
  useEffect(() => () => { if (story) URL.revokeObjectURL(story); }, [story]);

  const selected = photos.filter(photo => photo.selected);
  const occupied = [...new Set(photos.map(photo => photo.city).filter(Boolean))];
  const activeCity = occupied.includes(focused) ? focused : occupied[0];

  function persist(nextTitle, nextPhotos) {
    if (!db.current) return;
    setStorage('در حال ذخیرهٔ آلبوم…');
    queue.current = queue.current.then(async () => {
      try {
        if (await saveAlbum(db.current, nextTitle, nextPhotos, version.current)) {
          version.current++;
          setStorage('آلبوم روی این دستگاه ذخیره شد.');
        } else {
          setStorage('آلبوم در تب دیگری تغییر کرده. برای دیدن نسخهٔ ذخیره‌شده صفحه رو دوباره باز کن.');
        }
      } catch {
        setStorage('ذخیره انجام نشد. فضای مرورگر رو بررسی کن.');
      }
    });
  }

  function invalidateStory() {
    revision.current++;
    setStory('');
  }

  function replacePhotos(next) {
    setPhotos(next);
    invalidateStory();
    persist(title, next);
  }

  function selectPhotos(next) {
    const group = next.filter(photo => photo.selected);
    const suggestion = group[0]?.suggestion;
    if (suggestion && group.every(photo => !photo.city && photo.suggestion === suggestion)) setCity(suggestion);
    setPhotos(next);
  }

  async function importFiles(event) {
    const files = Array.from(event.target.files);
    event.target.value = '';
    if (!files.length || inputLock.current) return;
    inputLock.current = true;
    setImporting(true);
    setStatus('در حال باز کردن عکس‌ها…');
    try {
      const results = await Promise.all(files.map(async blob => {
        const url = URL.createObjectURL(blob);
        try {
          await loadImage(url);
          urls.current.add(url);
          return {blob, url, suggestion:await suggestCity(blob), city:'', selected:false};
        } catch {
          URL.revokeObjectURL(url);
          return null;
        }
      }));
      const usable = results.filter(Boolean);
      if (usable.length) replacePhotos([...photos, ...usable]);
      setStatus(number(usable.length) + ' عکس اضافه شد.' + (usable.length < files.length ? ' بعضی فایل‌ها در این مرورگر باز نشدند.' : ''));
    } finally {
      inputLock.current = false;
      setImporting(false);
    }
  }

  function assignCity() {
    replacePhotos(photos.map(photo => photo.selected ? {...photo, city, selected:false} : photo));
    setFocused(city);
    setStatus('شهر ' + cities[city][0] + ' برای ' + number(selected.length) + ' عکس ثبت شد.');
  }

  function removePhotos() {
    if (!window.confirm('عکس‌های انتخاب‌شده از این آلبوم حذف بشن؟')) return;
    for (const photo of selected) {
      if (urls.current.delete(photo.url)) URL.revokeObjectURL(photo.url);
    }
    replacePhotos(photos.filter(photo => !photo.selected));
    setStatus('عکس‌های انتخاب‌شده از آلبوم حذف شدند.');
  }

  async function preview() {
    invalidateStory();
    const started = revision.current;
    setStatus('در حال ساخت استوری…');
    try {
      const blob = await createStory(title.trim() || 'نقشه سفر من', photos.filter(photo => photo.city));
      if (started !== revision.current) return;
      setStory(URL.createObjectURL(blob));
      setStatus('استوری آماده دانلود شد.');
    } catch {
      if (started === revision.current) setStatus('ساخت تصویر ممکن نشد. دوباره امتحان کن.');
    }
  }

  return <>
    <header><strong className="brand">◈ ردِ سفر</strong><a href={base + "/"}>معرفی برنامه</a></header>
    <main>
      <section className="hero"><p className="eyebrow">آلبوم شخصی</p><h1>عکس‌هات رو به شهرها وصل کن.</h1><p>چند عکس انتخاب کن، شهر هر گروه رو مشخص کن و یک استوری از سفرت بساز.</p></section>
      <div className="layout">
        <section className="card">
          <h2>۱. عکس‌ها و شهرها</h2>
          <label className="field">نام سفر<input type="text" maxLength={45} value={title} disabled={!ready || importing} onChange={event => {
            setTitle(event.target.value);
            invalidateStory();
            persist(event.target.value, photos);
          }}/></label>
          <label className="picker">انتخاب عکس از دستگاه<br/><input type="file" accept="image/*" multiple disabled={!ready || importing} onChange={importFiles}/></label>
          <button className="btn alt" disabled={!ready || importing || photos.some(photo => photo.sample)} onClick={() => {
            replacePhotos([...photos, ...samplePhotos()]);
            setStatus('۱۰ تصویر نمونه اضافه شد.');
          }}>امتحان با ۱۰ عکس نمونه</button>
          <div className="photos">
            {photos.map((photo, index) => {
              const label = cities[photo.city]?.[0] ?? (photo.suggestion ? 'پیشنهاد: ' + cities[photo.suggestion][0] : 'بدون شهر');
              return <button className="photo" key={photo.url} aria-pressed={photo.selected} aria-label={`عکس ${index+1}، ${label}`} disabled={importing} onClick={() => selectPhotos(photos.map(item => item === photo ? {...item, selected:!item.selected} : item))}><img src={photo.url} alt=""/><span>{label}</span></button>;
            })}
          </div>
          <div className="actions">
            <button className="btn alt" disabled={!photos.length || importing} onClick={() => selectPhotos(photos.map(photo => ({...photo, selected:true})))}>انتخاب همه</button>
            <button className="btn alt" disabled={!selected.length || importing} onClick={() => selectPhotos(photos.map(photo => ({...photo, selected:false})))}>لغو انتخاب</button>
            <button className="btn alt" disabled={!selected.length || importing} onClick={removePhotos}>حذف انتخاب‌شده‌ها</button>
            <small>{number(selected.length)} انتخاب‌شده</small>
          </div>
          <div className="assignment"><label className="field">شهر عکس‌های انتخاب‌شده<select value={city} onChange={event => setCity(event.target.value)}>{Object.entries(cities).map(([id,[name]]) => <option key={id} value={id}>{name}</option>)}</select></label><button className="btn" disabled={!selected.length || importing} onClick={assignCity}>ثبت شهر</button></div>
          {storage && <p className="status" role="status">{storage}</p>}
          <p className="status" role="status">{!ready ? 'در حال باز کردن آلبوم…' : status}</p>
        </section>
        <section className="card">
          <h2>۲. نقشه و خروجی</h2>
          <div className="map">
            <div className="map-background" dangerouslySetInnerHTML={{__html:mapSvg}}/>
            {occupied.map(id => {
              const [name,x,y] = cities[id];
              return <button className="pin" key={id} style={{right:(100-x/4)+'%',top:(y/3)+'%'}} aria-pressed={id === activeCity} onClick={() => setFocused(id)}>{name}</button>;
            })}
          </div>
          <small>نقشه شماتیک · برای دیدن عکس‌ها روی نام شهر بزن.</small>
          <div className="strip" aria-label="عکس‌های شهر انتخاب‌شده">{activeCity && photos.filter(photo => photo.city === activeCity).map(photo => <img key={photo.url} src={photo.url} alt={'عکس سفر در '+cities[activeCity][0]}/>)}</div>
          <div className="actions"><button className="btn" disabled={!occupied.length} onClick={preview}>ساخت پیش‌نمایش استوری</button>{story && <a className="btn alt" download="travel-story.png" href={story}>دانلود PNG</a>}</div>
          {story && <img className="story" src={story} alt="پیش‌نمایش استوری سفر"/>}
        </section>
      </div>
      <p className="footer">عکس‌ها در همین مرورگر ذخیره می‌شن. برای نصب در آیفون، در Safari از منوی اشتراک‌گذاری «افزودن به صفحهٔ اصلی» رو بزن.</p>
    </main>
  </>;
}

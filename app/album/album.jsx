'use client';

import {useEffect, useRef, useState} from 'react';
import {openAlbum, saveAlbum} from '../../lib/album';
import {cities, loadImage, samplePhotos, suggestCity} from '../../lib/photos';
import {cityProvince, mapHeight, mapWidth, photoProvince, provinceCovers, provinces} from '../../lib/provinces';
import ProvinceMap from './province-map';
import {createStory} from '../../lib/story';

const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const number = value => value.toLocaleString('fa-IR');

export default function Album() {
  const [photos, setPhotos] = useState([]);
  const [title, setTitle] = useState('سفر شمال');
  const [city, setCity] = useState('rasht');
  const [step, setStep] = useState(0);
  const [focused, setFocused] = useState('');
  const [uploadCity, setUploadCity] = useState('');
  const stepHeading = useRef(null);
  const statsDialog = useRef(null);
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
        if (provinceCovers(saved.records).size) setStep(current => current === 0 ? 2 : current);
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
  const covers = provinceCovers(photos);
  const activeProvince = focused;
  const region = provinces.find(province => province.id === activeProvince);

  useEffect(() => { if (step > 0) stepHeading.current?.focus(); }, [step, activeProvince]);

  function openProvince(id) {
    if (!id || importing) return;
    setFocused(id);
    setUploadCity('');
    setStatus('');
    setStep(3);
  }

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

  async function importFiles(event, province, chosenCity) {
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
          return {blob, url, suggestion:await suggestCity(blob), city:chosenCity || '', province, selected:false};
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
    replacePhotos(photos.map(photo => photo.selected ? {...photo, city, province:cityProvince[city], selected:false, cover:photo.cover && photoProvince(photo) === cityProvince[city]} : photo));
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
      const blob = await createStory(title.trim() || 'نقشه سفر من', photos.filter(photo => photoProvince(photo)));
      if (started !== revision.current) return;
      setStory(URL.createObjectURL(blob));
      setStatus('استوری آماده دانلود شد.');
    } catch {
      if (started === revision.current) setStatus('ساخت تصویر ممکن نشد. دوباره امتحان کن.');
    }
  }

  return <>
    {step < 2 && <header><strong className="brand">◈ ردِ سفر</strong><a href={base + "/"}>معرفی برنامه</a></header>}
    <main>
      <div className={step < 2 ? "wizard album-shell" : "atlas-app"}>
        {step < 2 && <section className="album-intro">
          <svg className="intro-map" viewBox={`0 0 ${mapWidth} ${mapHeight}`} aria-hidden="true">
            {provinces.map(({id,path}) => <path key={id} d={path} fill={id === 'fars' || id === 'gilan' ? '#eab883' : '#254e46'} fillRule="evenodd" stroke="#8cab9d" strokeWidth="0.65"/>)}
          </svg>
          <div className="album-heading-copy">
            <p className="eyebrow">آلبوم سفر روی نقشه</p>
            <h1>ایران، به روایت عکس‌های تو</h1>
            <p>از هر سفر، یک عکس روی نقشه بگذار. کم‌کم ایران با خاطره‌های تو پر می‌شه.</p>
            <button className="btn" disabled={!ready} onClick={() => setStep(2)}>باز کردن نقشه <span aria-hidden="true">←</span></button>
          </div>
        </section>}
        {step >= 2 && <div className="atlas-top">
          {step === 3 && <button className="atlas-back" type="button" aria-label="بازگشت به نقشهٔ ایران" disabled={importing} onClick={() => {
            setStatus('');
            setFocused('');
            setStep(2);
          }}>→</button>}
          <h1 ref={stepHeading} tabIndex={-1}>{region?.name ?? 'نقشهٔ سفرهای من'}</h1>
          {step === 2 && <button type="button" className="atlas-back atlas-stats-toggle" onClick={() => statsDialog.current?.showModal()}>آمار سفر</button>}
        </div>}
        {step >= 2 && <section className="album-map-panel">
          <ProvinceMap photos={photos} covers={covers} active={activeProvince} zoom={step === 3} importing={importing} onSelect={openProvince} feedback={status || storage} onCover={chosen => {
            replacePhotos(photos.map(photo => photoProvince(photo) === activeProvince ? {...photo, cover:photo === chosen} : photo));
            setStatus('کاور استان تغییر کرد.');
          }}>
          {step === 3 && region && <div className="wizard-upload">
            {Object.values(cityProvince).includes(activeProvince) && <label className="field">شهر (اختیاری)<select value={uploadCity} disabled={importing} onChange={event => setUploadCity(event.target.value)}>
              <option value="">فعلاً فقط استان</option>
              {Object.entries(cities).filter(([id]) => cityProvince[id] === activeProvince).map(([id,[name]]) => <option key={id} value={id}>{name}</option>)}
            </select></label>}
            <label className="btn upload-action">
              {importing ? 'در حال آماده‌کردن عکس‌ها…' : covers.has(activeProvince) ? 'افزودن عکس بیشتر' : 'افزودن اولین خاطرهٔ ' + region.name}
              <input type="file" accept="image/*" multiple disabled={!ready || importing} onChange={event => importFiles(event, activeProvince, uploadCity)}/>
            </label>
          </div>}
          </ProvinceMap>
        </section>}
        {step === 2 && <dialog ref={statsDialog} className="atlas-stats" aria-labelledby="atlas-stats-title">
          <form method="dialog"><button className="btn alt" aria-label="بستن آمار">×</button></form>
          <h2 id="atlas-stats-title">آمار سفر</h2>
          <dl><div><dt>استان‌های دارای عکس</dt><dd>{number(covers.size)} از {number(provinces.length)}</dd></div>
          <div><dt>عکس‌های روی نقشه</dt><dd>{number(photos.filter(photo => photoProvince(photo)).length)}</dd></div></dl>
        </dialog>}
        {step === 2 && <aside className="atlas-dock" aria-label="کارهای آلبوم">
          <div className="atlas-dock-title"><strong>خاطره‌های ایران</strong><small>{number(covers.size)} استان از ۳۱ استان</small></div>
          <div className="atlas-stop-list">
            {covers.size ? [...covers].map(([id, photo]) => {
              const province = provinces.find(item => item.id === id);
              return <button key={id} className="atlas-stop" onClick={() => openProvince(id)}>
                <img src={photo.url} alt=""/><span>{province.name}</span>
              </button>;
            }) : <p>روی استان بزن و اولین خاطره‌ات رو اضافه کن.</p>}
          </div>
          {status && <p role="status">{status}</p>}
          <div className="actions atlas-share"><button className="btn" disabled={!covers.size || importing} onClick={preview}>ساخت استوری</button>{story && <a className="btn alt" download="travel-story.png" href={story}>دانلود PNG</a>}</div>
          {story && <img className="story" src={story} alt="پیش‌نمایش استوری سفر"/>}
          <details className="atlas-management">
          <summary>مدیریت عکس‌ها و شهرها</summary>
          <label className="field">نام سفر<input type="text" maxLength={45} value={title} disabled={!ready || importing} onChange={event => {
            setTitle(event.target.value);
            invalidateStory();
            persist(event.target.value, photos);
          }}/></label>
          <label className="picker">انتخاب عکس از دستگاه<br/><input type="file" accept="image/*" multiple disabled={!ready || importing} onChange={event => importFiles(event)}/></label>
          <button className="btn alt" disabled={!ready || importing || photos.some(photo => photo.sample)} onClick={() => {
            replacePhotos([...photos, ...samplePhotos()]);
            setStatus('۱۰ تصویر نمونه اضافه شد.');
          }}>امتحان با ۱۰ عکس نمونه</button>
          <div className="photos">
            {photos.map((photo, index) => {
              const label = cities[photo.city]?.[0] ?? (photo.suggestion ? 'پیشنهاد: ' + cities[photo.suggestion][0] : provinces.find(province => province.id === photo.province)?.name ?? 'بدون شهر');
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
          </details>
        </aside>}
      </div>
      {step < 2 && <p className="footer">عکس‌ها در همین مرورگر ذخیره می‌شن.</p>}
    </main>
  </>;
}

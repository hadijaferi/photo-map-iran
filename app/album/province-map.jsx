import {useRef, useState} from 'react';
import {changeView, mapView} from './map-viewport';
import {cities} from '../../lib/photos';
import {photoProvince, mapHeight, mapWidth, provinces} from '../../lib/provinces';

export default function ProvinceMap({photos, covers, active, onSelect, onCover, importing, zoom = false, children}) {
  const region = provinces.find(province => province.id === active);
  const gallery = photos.filter(photo => photoProvince(photo) === active);
  const viewKey = zoom ? active : '';
  const initial = mapView(mapWidth, mapHeight, zoom ? region?.box : undefined);
  const [view, setView] = useState(null);
  const viewport = view?.key === viewKey ? view.box : initial;
  const pointers = useRef(new Map());
  const moved = useRef(false);
  const startPoint = useRef(null);

  function updateView(...change) {
    setView(previous => ({
      key:viewKey,
      box:changeView(previous?.key === viewKey ? previous.box : initial, mapWidth, mapHeight, ...change),
    }));
  }

  function pointerDown(event) {
    if (event.button !== 0 || pointers.current.size >= 2) return;
    const point = [event.clientX, event.clientY];
    if (!pointers.current.size) {
      moved.current = false;
      startPoint.current = point;
    } else {
      moved.current = true;
    }
    pointers.current.set(event.pointerId, point);
    event.target.setPointerCapture(event.pointerId);
  }

  function pointerMove(event) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const point = [event.clientX, event.clientY];
    const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
    if (!moved.current && distance(point, startPoint.current) < 6) return;
    const other = [...pointers.current].find(([id]) => id !== event.pointerId)?.[1];
    moved.current = true;
    pointers.current.set(event.pointerId, point);
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const midpoint = other ? previous.map((value,i) => (value+other[i])/2) : previous;
    const factor = other ? Math.max(1,distance(point,other)) / Math.max(1,distance(previous,other)) : 1;
    const divisor = other ? 2 : 1;
    updateView(factor, (midpoint[0]-rect.left)/rect.width, (midpoint[1]-rect.top)/rect.height,
      (point[0]-previous[0])/rect.width/divisor, (point[1]-previous[1])/rect.height/divisor);
  }

  function pointerEnd(event) {
    pointers.current.delete(event.pointerId);
  }

  return <>
    <div className="atlas-stage">
    {!zoom && <div className="atlas-progress">
      <strong>{covers.size.toLocaleString('fa-IR')} <span>از {provinces.length.toLocaleString('fa-IR')} استان</span></strong>
      <progress aria-label="استان‌هایی که عکس دارند" value={covers.size} max={provinces.length}/>
    </div>}
    <div className="map-controls" role="group" aria-label="بزرگ‌نمایی نقشه">
      <button type="button" className="btn alt" aria-label="بزرگ‌نمایی" disabled={viewport[2] <= mapWidth/8} onClick={() => updateView(1.5)}>+</button>
      <button type="button" className="btn alt" aria-label="کوچک‌نمایی" disabled={viewport[2] >= mapWidth} onClick={() => updateView(1/1.5)}>−</button>
      <button type="button" className="btn alt" onClick={() => setView({key:viewKey, box:[0,0,mapWidth,mapHeight]})}>نمای کامل ایران</button>
    </div>
    <svg className="province-map" viewBox={viewport.join(" ")} aria-label="نقشهٔ استان‌های ایران"
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd}
      onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd}>
      <defs>{provinces.map(({id,path}) => <clipPath key={id} id={'province-'+id}><path d={path} clipRule="evenodd"/></clipPath>)}</defs>
      {provinces.map(({id,name,path,box:[x,y,width,height]}) => {
        const cover = covers.get(id);
        return <g key={id} opacity={zoom && id !== active ? 0.38 : 1}>
          {cover && <image href={cover.url} x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid slice" clipPath={`url(#province-${id})`} pointerEvents="none"/>}
          <path d={path} fill={cover ? 'transparent' : '#b7c9ad'} fillRule="evenodd" stroke={active === id ? '#ffce90' : '#315e53'} strokeWidth={active === id ? 2.4 : 1} role="button" tabIndex={0} aria-label={name} aria-pressed={active === id} onClick={event => { if (!event.detail || !moved.current) onSelect(id); }} onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(id); }
          }}/>
        </g>;
      })}
    </svg>
    </div>
    {!zoom && <details className="atlas-search"><summary>انتخاب استان از فهرست</summary><label className="field">نام استان<select value={active} onChange={event => onSelect(event.target.value)}>
      <option value="">یک استان انتخاب کن</option>
      {provinces.map(({id,name}) => <option key={id} value={id}>{name}</option>)}
    </select></label></details>}
    {zoom && region && <section className="province-gallery" aria-label={'عکس‌های '+region.name}>
      <div className="gallery-heading"><h2>خاطره‌های {region.name}</h2><span>{gallery.length.toLocaleString('fa-IR')} عکس</span></div>
      {children}
      {gallery.length ? <><p>برای تغییر کاور نقشه، روی یکی از عکس‌ها بزن.</p><div className="photos">{gallery.map(photo => {
        const isCover = covers.get(active) === photo;
        return <button className="photo" key={photo.url} aria-pressed={isCover} disabled={importing} onClick={() => onCover(photo)}>
          <img src={photo.url} alt=""/><span>{cities[photo.city]?.[0] ?? region.name} · {isCover ? 'کاور فعلی' : 'انتخاب کاور'}</span>
        </button>;
      })}</div></> : <p>اولین عکسی که اضافه کنی، روی نقشه کاور این استان می‌شه.</p>}
    </section>}
    <small className="atlas-attribution">دادهٔ مرزها از <a href="https://www.geoboundaries.org/">geoBoundaries</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> و Wambacher · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL 1.0</a></small>
  </>;
}

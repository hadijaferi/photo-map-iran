import {cities} from '../../lib/photos';
import {photoProvince, mapHeight, mapWidth, provinces} from '../../lib/provinces';

export default function ProvinceMap({photos, covers, active, onSelect, onCover, importing, zoom = false}) {
  const region = provinces.find(province => province.id === active);
  const gallery = photos.filter(photo => photoProvince(photo) === active);
  const [x,y,width,height] = region?.box ?? [0,0,mapWidth,mapHeight];
  const viewport = zoom && region ? [x-18,y-18,width+36,height+36] : [0,0,mapWidth,mapHeight];
  return <>
    <p>{covers.size.toLocaleString('fa-IR')} استان از {provinces.length.toLocaleString('fa-IR')} استان عکس داره</p>
    <svg className="province-map" viewBox={viewport.join(" ")} aria-label="نقشهٔ استان‌های ایران">
      <defs>{provinces.map(({id,path}) => <clipPath key={id} id={'province-'+id}><path d={path} clipRule="evenodd"/></clipPath>)}</defs>
      {provinces.map(({id,name,path,box:[x,y,width,height]}) => {
        const cover = covers.get(id);
        return <g key={id} opacity={zoom && id !== active ? 0.38 : 1}>
          {cover && <image href={cover.url} x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid slice" clipPath={`url(#province-${id})`} pointerEvents="none"/>}
          <path d={path} fill={cover ? 'transparent' : '#fff8e6'} fillRule="evenodd" stroke={active === id ? '#a65325' : '#557e69'} strokeWidth={active === id ? 2.4 : 1} role="button" tabIndex={0} aria-label={name} aria-pressed={active === id} onClick={() => onSelect(id)} onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(id); }
          }}/>
        </g>;
      })}
    </svg>
    {!zoom && <label className="field">انتخاب استان<select value={active} onChange={event => onSelect(event.target.value)}>
      <option value="">یک استان انتخاب کن</option>
      {provinces.map(({id,name}) => <option key={id} value={id}>{name}</option>)}
    </select></label>}
    {zoom && region && <section className="province-gallery" aria-label={'عکس‌های '+region.name}>
      <h3>{region.name}</h3>
      {gallery.length ? <div className="photos">{gallery.map(photo => {
        const isCover = covers.get(active) === photo;
        return <button className="photo" key={photo.url} aria-pressed={isCover} disabled={importing} onClick={() => onCover(photo)}>
          <img src={photo.url} alt=""/><span>{cities[photo.city]?.[0] ?? region.name} · {isCover ? 'کاور فعلی' : 'انتخاب کاور'}</span>
        </button>;
      })}</div> : <p>هنوز عکسی برای این استان ثبت نشده.</p>}
    </section>}
    <small>دادهٔ مرزها از <a href="https://www.geoboundaries.org/">geoBoundaries</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> و Wambacher · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL 1.0</a></small>
  </>;
}

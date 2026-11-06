import {useEffect, useRef, useState} from 'react';

const iran = [53.7, 32.2];
const sourceId = 'album-provinces';
const layerId = 'album-province-hit-area';
const toLngLat = ([x,y]) => [43.5+x/21, 40-y/25];

const styleUrl = 'https://tiles.openfreemap.org/styles/liberty';
const satellite = 'sentinel-satellite';
const iranZoom = 5;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

async function satelliteStyle(signal) {
  const response = await fetch(styleUrl, {signal});
  if (!response.ok) throw new Error('Map style unavailable');
  const style = await response.json();
  const base = [];
  const detail = [];
  for (const layer of style.layers) {
    const source = layer['source-layer'];
    const road = source === 'transportation' && layer.type === 'line';
    const label = layer.type === 'symbol';
    if (road || label) {
      if (label && !['place','transportation_name'].includes(source)) continue;
      detail.push({
        ...layer,
        minzoom: Math.max(layer.minzoom ?? 0, source === 'place' ? 3.5 : 9),
        paint: {...layer.paint, ...(label ? {
          'text-color':'#fcf7e9', 'text-halo-color':'#0b1c22', 'text-halo-width':1.2,
        } : {'line-opacity':0.55})},
      });
    } else {
      base.push(layer);
    }
  }
  style.sources[satellite] = {
    type:'raster',
    tiles:['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg'],
    tileSize:256,
    maxzoom:14,
    attribution:'<a href="https://cloudless.eox.at/">Sentinel-2 cloudless by EOX</a> (modified Copernicus Sentinel data 2016), <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
  };
  style.sources['satellite-overview'] = {
    type:'raster',
    tiles:[location.origin + basePath + '/world-overview.jpg'],
    tileSize:256,
    maxzoom:0,
    attribution:style.sources[satellite].attribution,
  };
  style.layers = [
    ...base,
    {id:'satellite-overview',type:'raster',source:'satellite-overview',paint:{'raster-fade-duration':0}},
    {id:satellite,type:'raster',source:satellite,paint:{
      'raster-saturation':0.17,'raster-contrast':0.02,'raster-brightness-min':0.045,'raster-fade-duration':120,
    }},
    ...detail,
  ];
  return style;
}

function boundaryData(provinces) {
  return {
    type:'FeatureCollection',
    features:provinces.map(({id,path}) => ({
      type:'Feature',
      properties:{id},
      geometry:{type:'MultiPolygon', coordinates:path.slice(1,-1).split('ZM').map(part => {
        const ring = part.split(' ').map(pair => toLngLat(pair.split(',').map(Number)));
        return [[...ring,ring[0]]];
      })},
    })),
  };
}

export default function GlobeMap({provinces, active, covers, onSelect, onUnavailable}) {
  const element = useRef(null);
  const globe = useRef(null);
  const library = useRef(null);
  const selection = useRef(onSelect);
  const fallback = useRef(onUnavailable);
  const markers = useRef([]);
  const [ready, setReady] = useState(false);
  selection.current = onSelect;
  fallback.current = onUnavailable;

  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    let map;
    const controller = new AbortController();
    const timer = setTimeout(() => { if (!loaded && !cancelled) fallback.current(); }, 14000);
    Promise.all([import('maplibre-gl'), satelliteStyle(controller.signal)]).then(([{default:maplibre}, style]) => {
      if (cancelled) return;
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      library.current = maplibre;
      map = new maplibre.Map({
        container:element.current,
        style,
        center:reducedMotion ? iran : [20,23],
        zoom:reducedMotion ? iranZoom : 1.5,
        minZoom:0,
        maxZoom:17,
        cancelPendingTileRequestsWhileZooming:false,
        maxTileCacheSize:160,
        attributionControl:{compact:true},
      });
      globe.current = map;
      map.addControl(new maplibre.NavigationControl({showCompass:true}), 'top-left');
      map.on('error', event => {
        if (!loaded && !event.sourceId && !cancelled) fallback.current();
      });
      map.on('style.load', () => {
        if (cancelled) return;
        loaded = true;
        clearTimeout(timer);
        map.setProjection({type:'globe'});
        map.setSky({'sky-color':'rgba(0,0,0,0)','horizon-color':'rgba(0,0,0,0)','fog-color':'rgba(0,0,0,0)','atmosphere-blend':0.76});
        map.addSource(sourceId,{type:'geojson', data:boundaryData(provinces), attribution:'<a href="https://www.geoboundaries.org/">geoBoundaries</a> · Wambacher · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'});
        map.addLayer({id:layerId,type:'fill',source:sourceId,maxzoom:9,paint:{'fill-color':'#254e46','fill-opacity':0.06}});
        map.addLayer({id:'album-province-boundaries',type:'line',source:sourceId,maxzoom:10,paint:{'line-color':'#366456','line-opacity':0.72,'line-width':1.25}});
        map.on('click',layerId,event => {
          const id = event.features?.[0]?.properties.id;
          if (id) selection.current(id);
        });
        map.on('mouseenter',layerId,() => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave',layerId,() => { map.getCanvas().style.cursor = ''; });
        setReady(true);
        if (!reducedMotion) map.flyTo({center:iran,zoom:iranZoom,duration:1700});
      });
    }).catch(() => { if (!cancelled) fallback.current(); });
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
      globe.current = null;
      map?.remove();
    };
  }, [provinces]);

  useEffect(() => {
    if (!ready || !active) return;
    const map = globe.current;
    const province = provinces.find(item => item.id === active);
    if (!province || !map) return;
    const [x,y,w,h] = province.box;
    map.flyTo({center:toLngLat([x+w/2,y+h/2]), zoom:Math.max(map.getZoom(),6),duration:850});
  }, [active, provinces, ready]);

  useEffect(() => {
    if (!ready || !globe.current) return;
    markers.current = [...covers].flatMap(([id, photo]) => {
      const province = provinces.find(item => item.id === id);
      if (!province) return [];
      const [x,y,w,h] = province.box;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'globe-photo-marker';
      button.setAttribute('aria-label', 'خاطره‌های ' + province.name);
      const image = document.createElement('img');
      image.addEventListener('error', () => { image.remove(); button.textContent = '•'; });
      image.src = photo.url;
      image.alt = '';
      button.append(image);
      button.onclick = event => { event.stopPropagation(); selection.current(id); };
      return [new library.current.Marker({element:button}).setLngLat(toLngLat([x+w/2,y+h/2])).addTo(globe.current)];
    });
    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
    };
  }, [covers, provinces, ready]);

  return <>
    <div ref={element} className="globe-map" style={{backgroundImage:`url(${basePath}/globe-stars.svg)`}} role="region" aria-label="کرهٔ زمین"/>
    {ready && <button type="button" className="btn globe-home" onClick={() => globe.current?.flyTo({center:iran,zoom:iranZoom,duration:950})}>بازگشت به ایران</button>}
  </>;
}

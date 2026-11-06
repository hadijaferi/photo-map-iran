export const cities = {
  rasht: ['رشت', 125, 83], anzali: ['انزلی', 96, 55], sari: ['ساری', 216, 63],
  tehran: ['تهران', 190, 112], mashhad: ['مشهد', 312, 85], isfahan: ['اصفهان', 190, 174],
  shiraz: ['شیراز', 219, 227], tabriz: ['تبریز', 60, 49], yazd: ['یزد', 244, 177]
};
const coordinates = {
  rasht:[37.28,49.58], anzali:[37.47,49.46], sari:[36.57,53.06],
  tehran:[35.69,51.39], mashhad:[36.30,59.60], isfahan:[32.65,51.67],
  shiraz:[29.59,52.58], tabriz:[38.08,46.29], yazd:[31.90,54.37]
};

function nearestCity(lat, lon) {
  let nearest = '';
  let limit = 35;
  for (const [id, [cityLat, cityLon]] of Object.entries(coordinates)) {
    const distance = 111 * Math.hypot(cityLat-lat, (cityLon-lon)*Math.cos(lat*Math.PI/180));
    if (distance < limit) { nearest = id; limit = distance; }
  }
  return nearest;
}

function readGps(buffer) {
  const jpeg = new DataView(buffer);
  if (jpeg.byteLength < 4 || jpeg.getUint16(0) !== 0xffd8) return '';
  for (let start = 2; start + 4 <= jpeg.byteLength;) {
    const marker = jpeg.getUint16(start);
    if (marker === 0xffda || marker === 0xffd9 || (marker & 0xff00) !== 0xff00) return '';
    if (marker === 0xffff) { start++; continue; }
    const length = jpeg.getUint16(start + 2);
    const end = start + 2 + length;
    if (length < 2 || end > jpeg.byteLength) return '';
    if (marker === 0xffe1 && length >= 16 && jpeg.getUint32(start+4) === 0x45786966 && jpeg.getUint16(start+8) === 0) {
      const tiff = new DataView(buffer, start+10, end-start-10);
      const order = tiff.getUint16(0);
      if (order !== 0x4949 && order !== 0x4d4d) return '';
      const little = order === 0x4949;
      const u16 = offset => tiff.getUint16(offset, little);
      const u32 = offset => tiff.getUint32(offset, little);
      if (u16(2) !== 42) return '';
      const entries = offset => {
        const tags = new Map();
        const count = u16(offset);
        if (offset + 2 + count*12 > tiff.byteLength) return tags;
        for (let i=0; i<count; i++) {
          const entry = offset+2+i*12;
          tags.set(u16(entry), entry);
        }
        return tags;
      };
      const pointer = entries(u32(4)).get(0x8825);
      if (pointer === undefined || u16(pointer+2) !== 4 || u32(pointer+4) !== 1) return '';
      const gps = entries(u32(pointer+8));
      const coordinate = (refTag, valueTag, positive, negative, max) => {
        const ref = gps.get(refTag), value = gps.get(valueTag);
        if (ref === undefined || value === undefined || u16(ref+2) !== 2 || u32(ref+4) !== 2 ||
            u16(value+2) !== 5 || u32(value+4) !== 3) return NaN;
        const sign = String.fromCharCode(tiff.getUint8(ref+8));
        if (sign !== positive && sign !== negative) return NaN;
        const offset = u32(value+8);
        const rational = i => u32(offset+i*8) / u32(offset+i*8+4);
        const degrees = rational(0) + rational(1)/60 + rational(2)/3600;
        return degrees <= max ? degrees * (sign === negative ? -1 : 1) : NaN;
      };
      return nearestCity(coordinate(1,2,'N','S',90), coordinate(3,4,'E','W',180));
    }
    start = end;
  }
  return '';
}
export async function suggestCity(file) {
  try { return readGps(await file.slice(0,256*1024).arrayBuffer()); }
  catch { return ''; }
}
let focused = '';
let exportUrl = '';
let revision = 0;

export function samplePhotos() {
  const colors = ['#649a84','#c58f5f','#638ba5','#9da765','#9c796d'];
  return Array.from({length:10},(_,i) => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="225"><rect width="300" height="225" fill="'+colors[i%colors.length]+'"/><circle cx="'+(48+i*20)+'" cy="52" r="21" fill="#ffe8a9"/><path d="M0 179 73 82 132 152 194 97 300 178V225H0Z" fill="#244d45" opacity=".75"/><text x="145" y="197" font-size="24" text-anchor="middle" fill="white">'+(i+1)+'</text></svg>';
    return {url:'data:image/svg+xml,'+encodeURIComponent(svg),city:'',selected:false,sample:true};
  });
}
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

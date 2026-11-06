import {cities, mapSvg, loadImage} from './photos';

export async function createStory(title, assigned) {
  const locations = [...new Set(assigned.map(photo => photo.city))];
  if (document.fonts) {
    await Promise.all([document.fonts.load('700 64px Vazirmatn'), document.fonts.load('400 36px Vazirmatn')]);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f4eb';
  ctx.fillRect(0,0,1080,1920);
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#18362f';
  ctx.font = 'bold 64px Vazirmatn,Tahoma, sans-serif';
  ctx.fillText(title,1000,154,920);
  ctx.font = '36px Vazirmatn,Tahoma, sans-serif';
  ctx.fillText(locations.map(id => cities[id][0]).join(' · '),1000,221,920);
  const map = await loadImage('data:image/svg+xml,'+encodeURIComponent(mapSvg));
  ctx.drawImage(map,80,300,920,690);
  for (const id of locations) {
    const [,x,y] = cities[id];
    ctx.beginPath();
    ctx.arc(80+x*2.3,300+y*2.3,13,0,Math.PI*2);
    ctx.fillStyle = '#81431b';
    ctx.fill();
  }
  const picks = await Promise.all(assigned.slice(0,4).map(photo => loadImage(photo.url)));
  picks.forEach((pic,i) => {
    const x = 80+(i%2)*468, y = 1040+Math.floor(i/2)*315;
    const scale = Math.max(452/pic.width, 298/pic.height);
    const w = 452/scale, h = 298/scale;
    ctx.drawImage(pic,(pic.width-w)/2,(pic.height-h)/2,w,h,x,y,452,298);
  });
  ctx.fillStyle = '#18362f';
  ctx.font = '36px Vazirmatn,Tahoma, sans-serif';
  ctx.fillText('ردِ سفر',1000,1810);
  const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
  if (!blob) throw new Error('PNG export failed');
  return blob;
}

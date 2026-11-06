import {cities, loadImage} from './photos';
import {mapHeight, mapWidth, provinceCovers, provinces} from './provinces';

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
  const covers = provinceCovers(assigned);
  const images = new Map(await Promise.all([...covers].map(async ([id, photo]) => [id, await loadImage(photo.url)])));
  const scale = Math.min(920/mapWidth, 690/mapHeight);
  ctx.save();
  ctx.fillStyle = '#e5efe8';
  ctx.fillRect(80,300,920,690);
  ctx.translate((1080-mapWidth*scale)/2,300);
  ctx.scale(scale,scale);
  for (const {id,path,box:[x,y,width,height]} of provinces) {
    const shape = new Path2D(path);
    ctx.fillStyle = '#fff8e6';
    ctx.fill(shape, 'evenodd');
    const photo = images.get(id);
    if (photo) {
      const fit = Math.max(width/photo.width,height/photo.height);
      ctx.save();
      ctx.clip(shape,'evenodd');
      ctx.drawImage(photo,x+(width-photo.width*fit)/2,y+(height-photo.height*fit)/2,photo.width*fit,photo.height*fit);
      ctx.restore();
    }
    ctx.strokeStyle = '#557e69';
    ctx.lineWidth = 0.8;
    ctx.stroke(shape);
  }
  ctx.restore();
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
  ctx.font = '19px sans-serif';
  ctx.fillText('geoBoundaries · © OpenStreetMap contributors · Wambacher · ODbL 1.0',1000,1860,920);
  const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
  if (!blob) throw new Error('PNG export failed');
  return blob;
}

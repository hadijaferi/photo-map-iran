import {coordinates, loadImage} from './photos';
import {mapWidth, mapHeight, provinces} from './provinces';

const ease = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

function cover(ctx, image, x, y, width, height, zoom = 1) {
  const scale = Math.max(width / image.width, height / image.height) * zoom;
  const w = width / scale;
  const h = height / scale;
  ctx.drawImage(image, (image.width-w)/2, (image.height-h)/2, w, h, x, y, width, height);
}

export async function createStoryVideo({title, name, city, province, photos, terrainUrl, signal}) {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1280;
  if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
    throw new Error('Video export unsupported');
  }
  const [terrain, images] = await Promise.all([
    loadImage(terrainUrl),
    Promise.all(photos.slice(0, 6).map(photo => loadImage(photo.url))),
    document.fonts?.load('700 54px Vazirmatn'),
  ]);
  signal.throwIfAborted();
  const ctx = canvas.getContext('2d');
  const [x,y,w,h] = province.box;
  const coordinate = coordinates[city];
  const target = coordinate ? [(coordinate[1]-43.5)*21, (40-coordinate[0])*25] : [x+w/2,y+h/2];
  const boundaries = provinces.map(region => new Path2D(region.path));
  const dark = ctx.createLinearGradient(0, 720, 0, 1280);
  dark.addColorStop(0, 'transparent');
  dark.addColorStop(1, '#091716');
  const duration = 2500 + images.length * 2300;
  function draw(time) {
    const flight = ease(time / 2600);
    const scale = 1.65 + flight * 6;
    const centerX = mapWidth/2 + (target[0]-mapWidth/2)*flight;
    const centerY = mapHeight/2 + (target[1]-mapHeight/2)*flight;
    ctx.fillStyle = '#102722';
    ctx.fillRect(0,0,720,1280);
    ctx.save();
    ctx.translate(360,535);
    ctx.scale(scale,scale);
    ctx.translate(-centerX,-centerY);
    ctx.drawImage(terrain,0,0,mapWidth,mapHeight);
    ctx.strokeStyle = '#f7f1d499';
    ctx.lineWidth = 1 / scale;
    for (const path of boundaries) ctx.stroke(path);
    ctx.beginPath();
    ctx.arc(...target, 8/scale, 0, Math.PI*2);
    ctx.fillStyle = '#f8c692';
    ctx.fill();
    ctx.restore();
    const sequence = Math.max(0, time-2100) / 2300;
    const index = Math.min(images.length-1, Math.floor(sequence));
    if (time > 2100) {
      ctx.save();
      ctx.globalAlpha = ease((time-2100)/600);
      cover(ctx, images[index],0,0,720,1280,1+Math.min(1,sequence-index)*0.07);
      if (index+1 < images.length) {
        ctx.globalAlpha *= ease((sequence-index-0.76)/0.24);
        cover(ctx, images[index+1],0,0,720,1280);
      }
      ctx.restore();
    }
    ctx.fillStyle = dark;
    ctx.fillRect(0,720,720,560);
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f8c692';
    ctx.font = '700 24px Vazirmatn, sans-serif';
    ctx.fillText('ردِ سفر  /  ' + title, 660, 1045, 600);
    ctx.fillStyle = '#fffaf1';
    ctx.font = '700 54px Vazirmatn, sans-serif';
    ctx.fillText(name,660,1120,600);
    ctx.font = '16px sans-serif';
    ctx.fillText('NASA Blue Marble · geoBoundaries · © OpenStreetMap contributors',660,1200,600);
  }

  draw(0);
  const stream = canvas.captureStream(30);
  try {
    const mimeType = ['video/mp4', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported?.(type));
    const recorder = new MediaRecorder(stream, { ...(mimeType && {mimeType}), videoBitsPerSecond: 3500000 });
    return await new Promise((resolve, reject) => {
      const parts = [];
      let frame;
      let watchdog;
      let start;
      function cleanup() {
        cancelAnimationFrame(frame);
        clearTimeout(watchdog);
        signal.removeEventListener('abort', cancel);
      }
      function cancel() {
        cleanup();
        if (recorder.state !== 'inactive') recorder.stop();
        reject(signal.aborted ? signal.reason : new Error('Video export timed out'));
      }
      recorder.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
      recorder.onerror = () => { cleanup(); reject(new Error('Recording failed')); };
      recorder.onstop = () => {
        cleanup();
        const blob = new Blob(parts, {type:recorder.mimeType || parts[0]?.type || mimeType});
        if (blob.size) resolve(blob);
        else reject(new Error('Empty video'));
      };
      function render(now) {
        start ??= now;
        try {
          draw(Math.min(duration, now-start));
          if (now-start < duration) frame = requestAnimationFrame(render);
          else recorder.stop();
        } catch (error) {
          cleanup();
          reject(error);
        }
      }
      recorder.start();
      signal.addEventListener('abort', cancel, {once:true});
      watchdog = setTimeout(cancel, duration + 10000);
      frame = requestAnimationFrame(render);
    });
  } finally {
    stream.getTracks().forEach(track => track.stop());
  }
}

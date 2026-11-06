export function mapView(width, height, box) {
  if (!box) return [0, 0, width, height];
  const [x, y, w, h] = box;
  const scale = Math.min(1, Math.max(0.125, (w + 36) / width, (h + 36) / height));
  return changeView([0, 0, width, height], width, height, 1 / scale,
    0.5, 0.5, (width / 2 - x - w / 2) / (width * scale), (height / 2 - y - h / 2) / (height * scale));
}

export function changeView(view, width, height, factor, anchorX = 0.5, anchorY = 0.5, dx = 0, dy = 0) {
  const [x, y, w, h] = view;
  const nextW = Math.min(width, Math.max(width / 8, w / factor));
  const nextH = height * nextW / width;
  const clamp = (value, limit) => Math.min(limit, Math.max(0, value));
  return [
    clamp(x + (w - nextW) * anchorX - dx * nextW, width - nextW),
    clamp(y + (h - nextH) * anchorY - dy * nextH, height - nextH),
    nextW,
    nextH,
  ];
}

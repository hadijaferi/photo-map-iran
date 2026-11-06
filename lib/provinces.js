import boundaries from './iran-provinces.json';

export const provinces = boundaries;
export const mapWidth = 440;
export const mapHeight = 410;
export const cityProvince = {
  rasht:'gilan', anzali:'gilan', sari:'mazandaran', tehran:'tehran',
  mashhad:'razavi-khorasan', isfahan:'isfahan', shiraz:'fars', tabriz:'east-azerbaijan', yazd:'yazd',
};

export function provinceCovers(photos) {
  const covers = new Map();
  for (const photo of photos) {
    const province = cityProvince[photo.city];
    if (province && (!covers.has(province) || photo.cover)) covers.set(province, photo);
  }
  return covers;
}

type NormalizedAnchor = readonly [x: number, y: number];


const DOMAIN_ANCHORS: Readonly<Record<string, NormalizedAnchor>> = {
  ai: [0.05, -1],
  data: [-0.38, -0.82],
  mlops: [0.44, -0.72],
  computer_vision: [-0.32, -0.3],
  frontend: [-1, -0.38],
  web: [-0.9, 0.08],
  design: [-1, 0.52],
  product: [-0.5, 0.52],
  backend: [0.72, -0.42],
  cloud: [1, 0.02],
  devops: [0.9, 0.5],
  security: [0.46, 0.82],
  qa: [0.05, 0.42],
  embedded: [-0.45, 0.9],
  robotics: [0.02, 1],
  autonomy: [0.34, 0.94],
  high_performance: [0.74, 0.92],
  game: [-0.92, 0.88],
  graphics: [-0.72, 1],
};


function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}


export function skillGraphDomainAnchor(domain: string, spread: number) {
  const safeSpread = Number.isFinite(spread) ? Math.max(0, spread) : 0;
  const known = DOMAIN_ANCHORS[domain];
  if (known) {
    return {
      x: known[0] * safeSpread,
      y: known[1] * safeSpread,
    };
  }

  const hash = stableHash(domain);
  const angle = ((hash % 360) * Math.PI) / 180;
  const radius = safeSpread * (0.42 + ((hash >>> 9) % 44) / 100);
  return {
    x: Number((Math.cos(angle) * radius).toFixed(4)),
    y: Number((Math.sin(angle) * radius).toFixed(4)),
  };
}

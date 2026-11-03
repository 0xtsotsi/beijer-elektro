// WCAG 2.2 contrast van het palet van de doorstuurpagina's.
// Gebruik: node tools/forwarding/check-contrast.mjs

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function oklchToSrgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => clamp01(v));
}

const luminance = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

const ratio = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

const T = {
  paper: [0.975, 0.006, 235],
  surface: [1, 0, 0],
  ink: [0.27, 0.03, 245],
  ink2: [0.45, 0.025, 245],
  line: [0.63, 0.022, 235],
  petrol: [0.42, 0.075, 240],
  petrolDeep: [0.3, 0.055, 245],
  brassInk: [0.5, 0.1, 70],
};

const px = (t) => oklchToSrgb(...t);

const pairs = [
  ["ink op paper (kop)", "ink", "paper", 4.5],
  ["ink2 op paper (lead, label)", "ink2", "paper", 4.5],
  ["ink2 op surface (lead, label)", "ink2", "surface", 4.5],
  ["wit op petrol (knop)", "surface", "petrol", 4.5],
  ["wit op petrolDeep (knop hover)", "surface", "petrolDeep", 4.5],
  ["line op paper (scheiding)", "line", "paper", 3],
  ["petrol op paper (rand knop)", "petrol", "paper", 3],
  ["brassInk focus op paper", "brassInk", "paper", 3],
  ["brassInk focus op surface", "brassInk", "surface", 3],
];

let fails = 0;
for (const [label, a, b, min] of pairs) {
  const r = ratio(px(T[a]), px(T[b]));
  const pass = r >= min;
  if (!pass) fails++;
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(6)} (min ${min})  ${label}`
  );
}
console.log(fails ? `\n${fails} failing pair(s)` : "\nAlle paren voldoen");
process.exit(fails ? 1 : 0);

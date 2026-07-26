// Script to generate placeholder SVG images for menu items that don't have AI-generated photos
const fs = require('fs');
const path = require('path');

const items = [
  { file: 'caramel-macchiato.png', emoji: '☕', bg: '#D4A574', label: 'Caramel Macchiato' },
  { file: 'masala-chai.png', emoji: '🍵', bg: '#C68B59', label: 'Masala Chai' },
  { file: 'matcha-latte.png', emoji: '🍵', bg: '#7BA05B', label: 'Matcha Latte' },
  { file: 'iced-peach-tea.png', emoji: '🍑', bg: '#E8A87C', label: 'Iced Peach Tea' },
  { file: 'green-tea.png', emoji: '🍃', bg: '#8FBC8F', label: 'Green Tea' },
  { file: 'croissant.png', emoji: '🥐', bg: '#DEB887', label: 'Croissant' },
  { file: 'panini.png', emoji: '🥪', bg: '#C4A882', label: 'Panini' },
  { file: 'samosa.png', emoji: '🔺', bg: '#DAA06D', label: 'Samosa' },
  { file: 'garlic-bread.png', emoji: '🍞', bg: '#D2B48C', label: 'Garlic Bread' },
  { file: 'bruschetta.png', emoji: '🍅', bg: '#CD853F', label: 'Bruschetta' },
  { file: 'brownie.png', emoji: '🍫', bg: '#654321', label: 'Brownie' },
  { file: 'cheesecake.png', emoji: '🍰', bg: '#F5DEB3', label: 'Cheesecake' },
  { file: 'tiramisu.png', emoji: '🍮', bg: '#8B7355', label: 'Tiramisu' },
  { file: 'muffin.png', emoji: '🧁', bg: '#BC8F8F', label: 'Muffin' },
  { file: 'cookie-skillet.png', emoji: '🍪', bg: '#A0522D', label: 'Cookie Skillet' },
];

const menuDir = path.join(__dirname, '..', 'public', 'menu');

for (const item of items) {
  // Skip if file already exists (AI-generated)
  const filePath = path.join(menuDir, item.file.replace('.png', '.svg'));
  const pngPath = path.join(menuDir, item.file);

  if (fs.existsSync(pngPath)) continue;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${item.bg};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${adjustColor(item.bg, -30)};stop-opacity:1" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.15"/>
    </filter>
  </defs>
  <rect width="400" height="400" rx="24" fill="url(#bg)"/>
  <circle cx="200" cy="170" r="80" fill="rgba(255,255,255,0.15)" filter="url(#shadow)"/>
  <text x="200" y="195" font-size="80" text-anchor="middle" dominant-baseline="middle">${item.emoji}</text>
  <text x="200" y="320" font-family="system-ui, sans-serif" font-size="22" font-weight="600" fill="rgba(255,255,255,0.9)" text-anchor="middle">${item.label}</text>
</svg>`;

  // Save as SVG (next/image handles SVGs fine)
  fs.writeFileSync(filePath, svg);
  console.log(`Created: ${filePath}`);
}

function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

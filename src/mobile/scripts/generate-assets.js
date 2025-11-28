#!/usr/bin/env node
/**
 * Generate placeholder asset files for Expo
 * Run: node scripts/generate-assets.js
 */

const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

// Create assets directory if it doesn't exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Minimal 1x1 transparent PNG (base64)
const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Simple colored PNG generator (1024x1024 solid color)
function createColoredPng(color = { r: 76, g: 175, b: 80 }) {
  // This creates a minimal valid PNG - for production, use proper image generation
  // For now, we use the transparent PNG as a placeholder
  return transparentPng;
}

// Asset configurations
const assets = [
  { name: 'icon.png', description: 'App icon (1024x1024)' },
  { name: 'splash.png', description: 'Splash screen (1284x2778)' },
  { name: 'adaptive-icon.png', description: 'Android adaptive icon (1024x1024)' },
  { name: 'favicon.png', description: 'Web favicon (48x48)' },
];

console.log('Generating placeholder assets...\n');

assets.forEach(({ name, description }) => {
  const filePath = path.join(assetsDir, name);

  if (fs.existsSync(filePath)) {
    console.log(`  [SKIP] ${name} already exists`);
  } else {
    fs.writeFileSync(filePath, createColoredPng());
    console.log(`  [CREATE] ${name} - ${description}`);
  }
});

console.log('\n--- Asset Generation Complete ---');
console.log('\nNote: These are minimal placeholder assets.');
console.log('Replace them with proper branded assets for production:');
console.log('  - icon.png: 1024x1024px app icon');
console.log('  - splash.png: 1284x2778px splash screen');
console.log('  - adaptive-icon.png: 1024x1024px Android icon');
console.log('  - favicon.png: 48x48px web favicon');

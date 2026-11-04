#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const appDir = process.env.CAFE_APP_DIR || '/var/www/engineer-cafe';
const { PrismaClient } = require(path.join(appDir, 'node_modules/@prisma/client'));
const prisma = new PrismaClient();
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const categoryPhotos = {
  chai: 'sada-chai',
  parathas: 'aloo-paratha',
  anday: 'omelette',
  'sides-extras': 'shakeel-lahori-chanay-full',
};
const expected = manifest.products;
function assert(condition, message) { if (!condition) throw new Error(message); }
function checkFiles() {
  assert(expected.length === 35, 'Expected exactly 35 menu items.');
  assert(new Set(expected.map(p => p.slug)).size === 35, 'Duplicate product slug.');
  assert(new Set(expected.map(p => p.image)).size === 35, 'Duplicate image path.');
  for (const p of expected) {
    assert(/^[a-z0-9-]+$/.test(p.slug), 'Invalid product slug.');
    assert(p.image === `/uploads/menu-photos-v1/${p.slug}.png`, 'Unexpected image destination.');
    const bytes = fs.readFileSync(path.join(__dirname, p.file));
    assert(bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), `Invalid PNG: ${p.slug}`);
    assert(crypto.createHash('sha256').update(bytes).digest('hex') === p.sha256, `Checksum mismatch: ${p.slug}`);
    assert(bytes.readUInt32BE(16) >= 800 && bytes.readUInt32BE(20) >= 800, `Image too small: ${p.slug}`);
  }
}
async function snapshot() {
  const products = await prisma.product.findMany({
    where: { slug: { in: expected.map(p => p.slug) } },
    select: { id: true, slug: true, name: true, image: true },
  });
  assert(products.length === 35, `Found ${products.length}/35 expected products; no changes made.`);
  const categories = await prisma.category.findMany({
    where: { slug: { in: Object.keys(categoryPhotos) } },
    select: { id: true, slug: true, image: true },
  });
  assert(categories.length === 4, 'Expected all 4 menu categories; no changes made.');
  return {
    createdAt: new Date().toISOString(), appDir,
    products: products.map(p => ({ ...p, newImage: expected.find(e => e.slug === p.slug).image })),
    categories: categories.map(c => ({ ...c, newImage: `/uploads/menu-photos-v1/${categoryPhotos[c.slug]}.png` })),
  };
}
async function mutate(data, restore) {
  await prisma.$transaction(async tx => {
    for (const [table, rows] of [['product', data.products], ['category', data.categories]]) {
      for (const row of rows) {
        const from = restore ? row.newImage : row.image;
        const to = restore ? row.image : row.newImage;
        const result = await tx[table].updateMany({ where: { id: row.id, image: from }, data: { image: to } });
        assert(result.count === 1, `Image changed concurrently for ${row.slug}; transaction cancelled.`);
      }
    }
  });
}
async function main() {
  const mode = process.argv[2];
  const backupFile = process.argv[3];
  if (mode === 'rollback') {
    assert(backupFile, 'Backup path required.');
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    assert(backup.appDir === appDir, 'Backup belongs to another application path.');
    assert(backup.products.length === 35 && backup.categories.length === 4, 'Incomplete backup.');
    await mutate(backup, true);
    console.log('Restored previous product and category image paths.');
    return;
  }
  checkFiles();
  const data = await snapshot();
  if (mode === 'check') {
    console.log('PASS: 35 PNG files, SHA-256 checksums, 35 database products and 4 categories.');
  } else if (mode === 'apply') {
    assert(backupFile, 'Backup path required.');
    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await mutate(data, false);
    console.log('Updated 35 product images and 4 category images. Previous paths backed up.');
  } else if (mode === 'verify') {
    for (const row of [...data.products, ...data.categories]) {
      assert(row.image === row.newImage, `Image does not match manifest: ${row.slug}`);
    }
    console.log('PASS: all 35 product and 4 category image paths match.');
  } else {
    throw new Error('Usage: update-images.cjs check|apply|verify|rollback [backup-file]');
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());

import * as THREE from 'three';

export function createFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#151b26';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle concrete speckle noise
  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 20 + Math.floor(Math.random() * 18);
    ctx.fillStyle = `rgb(${v}, ${v + 5}, ${v + 12})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Tile seams
  ctx.strokeStyle = 'rgba(10, 14, 22, 0.85)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Subtle blueprint accent hairline
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  for (let i = 64; i < 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 7);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createESDMatTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f293a';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1;
  for (let x = 16; x < 512; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x, 244);
    ctx.stroke();
  }
  for (let y = 16; y < 256; y += 24) {
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(500, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 492, 236);

  ctx.fillStyle = 'rgba(186, 230, 253, 0.7)';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('ESD SAFE WORKZONE · ANTI-STATIC MAT', 24, 234);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createMotherboardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, 512, 512);

  // PCB copper traces
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const x = 30 + ((i * 37) % 440);
    const y = 30 + ((i * 53) % 440);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 40, y);
    ctx.lineTo(x + 60, y + 20);
    ctx.stroke();
  }

  // Silkscreen markings
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, 488, 488);
  ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('PRO-WORKSTATION PCB', 26, 480);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSignTexture(workshopName: string, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090e1a';
  ctx.fillRect(0, 0, 1024, 256);

  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 996, 228);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(workshopName.toUpperCase().slice(0, 26), 512, 128);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 24px monospace';
  ctx.fillText('CUSTOM PC ASSEMBLY · DIAGNOSTICS · HARDWARE LAB', 512, 185);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createMonitorScreenTexture(
  mode: 'analytics' | 'diagnostics' | 'bios',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = mode === 'bios' ? '#0b192c' : '#09111f';
  ctx.fillRect(0, 0, 512, 320);

  ctx.fillStyle = mode === 'diagnostics' ? '#10b981' : '#0ea5e9';
  ctx.fillRect(0, 0, 512, 36);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(
    mode === 'analytics'
      ? 'WORKSHOP ERP · STORE & LEADERBOARD'
      : mode === 'diagnostics'
      ? 'HARDWARE BENCHMARK & THERMAL SUITE'
      : 'UEFI BIOS UTILITY v2.4',
    16,
    24
  );

  // Graph bars
  const colors = ['#38bdf8', '#22d3ee', '#34d399', '#818cf8', '#f59e0b'];
  for (let i = 0; i < 6; i++) {
    const h = 50 + ((i * 37) % 130);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(36 + i * 74, 240 - h, 44, h);
  }

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.strokeRect(20, 54, 472, 210);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

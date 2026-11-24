import * as THREE from 'three';
import { PCBuildState, StationId } from '../types/game';
import { getHardwareItem } from '../engine/hardwareDatabase';

export interface InteractivePCRefs {
  root: THREE.Group;
  sidePanel: THREE.Mesh;
  motherboard: THREE.Group;
  cpu: THREE.Mesh;
  thermalPaste: THREE.Mesh;
  airCooler: THREE.Group;
  aioCooler: THREE.Group;
  ramSticks: THREE.Mesh[];
  nvmeDrive: THREE.Mesh;
  sataDrive: THREE.Mesh;
  gpuGroup: THREE.Group;
  gpuFans: THREE.Mesh[];
  psuGroup: THREE.Group;
  caseFans: THREE.Group[];
  fanBlades: THREE.Mesh[];
  cables: {
    atx24: THREE.Mesh;
    cpu8: THREE.Mesh;
    gpuPcie: THREE.Mesh;
    sata: THREE.Mesh;
  };
  ghostHighlight: THREE.Mesh;
}

export function tagStationInteractive(obj: THREE.Object3D, stationId: StationId, label: string): void {
  obj.userData.stationId = stationId;
  obj.userData.stationLabel = label;
  obj.traverse((child) => {
    child.userData.stationId = stationId;
    child.userData.stationLabel = label;
    if ((child as THREE.Mesh).isMesh) {
      child.layers.enable(1);
    }
  });
}

export function createCompositeDesk(
  width: number,
  depth: number,
  height: number,
  topMat: THREE.Material,
  frameMat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();

  // Tabletop
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, depth), topMat);
  top.position.y = height - 0.03;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  // Underframe apron
  const apron = new THREE.Mesh(new THREE.BoxGeometry(width - 0.14, 0.05, depth - 0.14), frameMat);
  apron.position.y = height - 0.08;
  group.add(apron);

  // 4 steel legs + leveling feet
  const legGeo = new THREE.BoxGeometry(0.06, height - 0.08, 0.06);
  const footGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.02, 12);
  const lx = width / 2 - 0.08;
  const lz = depth / 2 - 0.08;
  const offsets = [
    [-lx, -lz],
    [lx, -lz],
    [-lx, lz],
    [lx, lz],
  ];
  for (const [ox, oz] of offsets) {
    const leg = new THREE.Mesh(legGeo, frameMat);
    leg.position.set(ox, (height - 0.08) / 2 + 0.02, oz);
    leg.castShadow = true;
    group.add(leg);

    const foot = new THREE.Mesh(footGeo, frameMat);
    foot.position.set(ox, 0.01, oz);
    group.add(foot);
  }

  return group;
}

export function createMonitorRig(
  screenTex: THREE.Texture,
  frameMat: THREE.Material,
  accentMat: THREE.Material,
  wide = false
): THREE.Group {
  const group = new THREE.Group();
  const w = wide ? 0.92 : 0.58;
  const h = wide ? 0.38 : 0.34;

  // Base plate
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.18), frameMat);
  base.position.y = 0.0075;
  group.add(base);

  // Neck
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.04), frameMat);
  neck.position.set(0, 0.13, -0.04);
  group.add(neck);

  // Display bezel
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), frameMat);
  bezel.position.set(0, 0.27, 0);
  bezel.castShadow = true;
  group.add(bezel);

  // Screen panel
  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTex,
    emissive: 0xffffff,
    emissiveMap: screenTex,
    emissiveIntensity: 0.72,
    roughness: 0.2,
    metalness: 0.1,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.035, h - 0.035), screenMat);
  screen.position.set(0, 0.27, 0.016);
  group.add(screen);

  // Status LED strip under bezel
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.01), accentMat);
  led.position.set(0, 0.095, 0.016);
  group.add(led);

  return group;
}

export function createChair(seatMat: THREE.Material, metalMat: THREE.Material): THREE.Group {
  const group = new THREE.Group();

  // 5-star caster base
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.26, 12), metalMat);
  hub.position.y = 0.16;
  group.add(hub);

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.035), metalMat);
    arm.position.set(Math.cos(angle) * 0.12, 0.04, Math.sin(angle) * 0.12);
    arm.rotation.y = -angle;
    group.add(arm);
  }

  // Seat cushion
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.44), seatMat);
  seat.position.y = 0.44;
  seat.castShadow = true;
  group.add(seat);

  // Backrest spine + cushion
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.45, 0.04), metalMat);
  spine.position.set(0, 0.66, -0.21);
  group.add(spine);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.07), seatMat);
  back.position.set(0, 0.74, -0.19);
  back.rotation.x = -0.1;
  back.castShadow = true;
  group.add(back);

  return group;
}

export function createTutorialBeacon(): THREE.Group {
  const group = new THREE.Group();
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.4,
    roughness: 0.25,
    metalness: 0.4,
  });

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.032, 10, 28), ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), ringMat);
  arrow.rotation.x = Math.PI;
  arrow.position.y = 0.42;
  group.add(arrow);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.08, 0.75, 12),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
  );
  beam.position.y = -0.35;
  group.add(beam);

  return group;
}

export function createInteractivePCModel(
  pcbTexture: THREE.Texture,
  isSoftwareGl: boolean
): InteractivePCRefs {
  const root = new THREE.Group();

  const caseSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1a2232,
    metalness: 0.72,
    roughness: 0.34,
  });
  const innerTrayMat = new THREE.MeshStandardMaterial({
    color: 0x111722,
    metalness: 0.55,
    roughness: 0.5,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9bd5f5,
    transparent: true,
    opacity: isSoftwareGl ? 0.32 : 0.28,
    roughness: 0.08,
    metalness: 0.1,
    depthWrite: false,
  });

  // Case dimensions (scaled visibly on workbench: ~0.26W x 0.48H x 0.48D)
  const W = 0.26;
  const H = 0.48;
  const D = 0.48;

  // Bottom + PSU Shroud
  const basePlate = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, D), caseSteelMat);
  basePlate.position.y = 0.01;
  basePlate.castShadow = true;
  root.add(basePlate);

  const psuShroud = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 0.1, D - 0.02), innerTrayMat);
  psuShroud.position.set(0, 0.07, 0);
  root.add(psuShroud);

  // Top + Front + Back panels
  const topPanel = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, D), caseSteelMat);
  topPanel.position.y = H - 0.01;
  topPanel.castShadow = true;
  root.add(topPanel);

  const frontPanel = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.025), caseSteelMat);
  frontPanel.position.set(0, H / 2, D / 2 - 0.012);
  frontPanel.castShadow = true;
  root.add(frontPanel);

  const rearPanel = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.02), caseSteelMat);
  rearPanel.position.set(0, H / 2, -D / 2 + 0.01);
  rearPanel.castShadow = true;
  root.add(rearPanel);

  // Right solid wall + Motherboard tray (case opens on +X side toward camera!)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.018, H, D), caseSteelMat);
  backWall.position.set(-W / 2 + 0.009, H / 2, 0);
  root.add(backWall);

  const mbTray = new THREE.Mesh(new THREE.BoxGeometry(0.012, H - 0.13, D - 0.06), innerTrayMat);
  mbTray.position.set(-W / 2 + 0.03, 0.29, 0);
  root.add(mbTray);

  // Tempered glass side panel (+X)
  const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(0.012, H - 0.04, D - 0.04), glassMat);
  sidePanel.position.set(W / 2 - 0.006, H / 2, 0);
  sidePanel.renderOrder = 5;
  root.add(sidePanel);

  // Motherboard group
  const motherboard = new THREE.Group();
  motherboard.position.set(-W / 2 + 0.045, 0.3, -0.02);
  const pcbMat = new THREE.MeshStandardMaterial({
    map: pcbTexture,
    roughness: 0.45,
    metalness: 0.2,
  });
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.28, 0.24), pcbMat);
  motherboard.add(pcb);

  const vrmMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
  const vrmTop = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.09), vrmMat);
  vrmTop.position.set(0.012, 0.11, -0.02);
  motherboard.add(vrmTop);
  const vrmSide = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.09, 0.03), vrmMat);
  vrmSide.position.set(0.012, 0.05, -0.09);
  motherboard.add(vrmSide);

  // CPU Socket frame
  const socketBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.052, 0.052),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 })
  );
  socketBase.position.set(0.008, 0.05, -0.02);
  motherboard.add(socketBase);

  // 4 DIMM slots
  const dimmMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.11, 0.007), dimmMat);
    slot.position.set(0.009, 0.05, 0.045 + i * 0.014);
    motherboard.add(slot);
  }

  // PCIe x16 slot
  const pcieSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.012, 0.11),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8, roughness: 0.25 })
  );
  pcieSlot.position.set(0.01, -0.045, -0.03);
  motherboard.add(pcieSlot);
  root.add(motherboard);

  // CPU IHS
  const cpu = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.042, 0.042),
    new THREE.MeshStandardMaterial({ color: 0xdbeafe, metalness: 0.9, roughness: 0.18 })
  );
  cpu.position.set(-W / 2 + 0.058, 0.35, -0.04);
  root.add(cpu);

  // Thermal Paste X-blob
  const thermalPaste = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.014, 0.004, 12),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.2 })
  );
  thermalPaste.rotation.z = Math.PI / 2;
  thermalPaste.position.set(-W / 2 + 0.064, 0.35, -0.04);
  root.add(thermalPaste);

  // Air Tower Cooler
  const airCooler = new THREE.Group();
  airCooler.position.set(-W / 2 + 0.095, 0.35, -0.04);
  const finStack = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.088, 0.082),
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.28 })
  );
  airCooler.add(finStack);
  const coolerFan = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.082, 0.082),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
  );
  coolerFan.position.set(0, 0, 0.045);
  airCooler.add(coolerFan);
  root.add(airCooler);

  // AIO Liquid Cooler
  const aioCooler = new THREE.Group();
  const pumpBlock = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.028, 16),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.5, roughness: 0.3 })
  );
  pumpBlock.rotation.z = Math.PI / 2;
  pumpBlock.position.set(-W / 2 + 0.075, 0.35, -0.04);
  aioCooler.add(pumpBlock);
  const pumpLed = new THREE.Mesh(
    new THREE.TorusGeometry(0.02, 0.003, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 1.4 })
  );
  pumpLed.rotation.y = Math.PI / 2;
  pumpLed.position.set(-W / 2 + 0.09, 0.35, -0.04);
  aioCooler.add(pumpLed);
  const topRad = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.032, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.4 })
  );
  topRad.position.set(0, H - 0.04, 0);
  aioCooler.add(topRad);
  const tubeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-W / 2 + 0.085, 0.36, -0.02),
    new THREE.Vector3(-0.01, 0.4, 0.08),
    new THREE.Vector3(0, H - 0.05, 0.11),
  ]);
  const tubes = new THREE.Mesh(
    new THREE.TubeGeometry(tubeCurve, 16, 0.007, 8, false),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 })
  );
  aioCooler.add(tubes);
  root.add(aioCooler);

  // RAM Sticks (up to 4)
  const ramSticks: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const stick = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.108, 0.008),
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        metalness: 0.65,
        roughness: 0.3,
      })
    );
    stick.position.set(-W / 2 + 0.068, 0.35, 0.025 + i * 0.014);
    root.add(stick);
    ramSticks.push(stick);
  }

  // M.2 NVMe Drive
  const nvmeDrive = new THREE.Mesh(
    new THREE.BoxGeometry(0.008, 0.022, 0.078),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.5, roughness: 0.35 })
  );
  nvmeDrive.position.set(-W / 2 + 0.056, 0.28, -0.03);
  root.add(nvmeDrive);

  // SATA Drive
  const sataDrive = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.068, 0.098),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 })
  );
  sataDrive.position.set(-W / 2 + 0.04, 0.17, 0.15);
  root.add(sataDrive);

  // GPU Group
  const gpuGroup = new THREE.Group();
  gpuGroup.position.set(-W / 2 + 0.11, 0.255, -0.055);
  const gpuBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.044, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.28 })
  );
  gpuGroup.add(gpuBody);
  const gpuAccent = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.012, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 1.0 })
  );
  gpuAccent.position.set(0.055, 0.01, 0);
  gpuGroup.add(gpuAccent);
  const gpuFans: THREE.Mesh[] = [];
  for (let i = -1; i <= 1; i += 2) {
    const gfan = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.006, 10),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
    );
    gfan.position.set(0.01, -0.024, i * 0.055);
    gpuGroup.add(gfan);
    gpuFans.push(gfan);
  }
  root.add(gpuGroup);

  // PSU Group
  const psuGroup = new THREE.Group();
  psuGroup.position.set(-0.02, 0.065, -0.14);
  const psuBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.082, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.45 })
  );
  psuGroup.add(psuBox);
  root.add(psuGroup);

  // Case Fans (2 front + 1 rear)
  const caseFans: THREE.Group[] = [];
  const fanBlades: THREE.Mesh[] = [];
  const fanPositions: [number, number, number, boolean][] = [
    [0, 0.36, D / 2 - 0.035, false],
    [0, 0.22, D / 2 - 0.035, false],
    [0, 0.36, -D / 2 + 0.035, false],
  ];
  for (const [fx, fy, fz] of fanPositions) {
    const fg = new THREE.Group();
    fg.position.set(fx, fy, fz);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.11, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    );
    fg.add(frame);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.046, 0.004, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.9 })
    );
    fg.add(ring);
    const blade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.012, 6),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4 })
    );
    blade.rotation.x = Math.PI / 2;
    fg.add(blade);
    fanBlades.push(blade);
    caseFans.push(fg);
    root.add(fg);
  }

  // Power & Data Cables (TubeGeometry)
  const makeCable = (pts: THREE.Vector3[], color: number): THREE.Mesh => {
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.Mesh(
      new THREE.TubeGeometry(curve, 14, 0.006, 6, false),
      new THREE.MeshStandardMaterial({ color, roughness: 0.65 })
    );
  };

  const atx24 = makeCable(
    [
      new THREE.Vector3(-0.04, 0.12, 0.08),
      new THREE.Vector3(-0.02, 0.24, 0.12),
      new THREE.Vector3(-W / 2 + 0.055, 0.3, 0.08),
    ],
    0x0284c7
  );
  const cpu8 = makeCable(
    [
      new THREE.Vector3(-0.06, 0.12, -0.14),
      new THREE.Vector3(-W / 2 + 0.04, 0.43, -0.13),
      new THREE.Vector3(-W / 2 + 0.055, 0.41, -0.07),
    ],
    0xf59e0b
  );
  const gpuPcie = makeCable(
    [
      new THREE.Vector3(0.0, 0.12, -0.04),
      new THREE.Vector3(0.04, 0.18, 0.02),
      new THREE.Vector3(0.02, 0.245, 0.01),
    ],
    0x38bdf8
  );
  const sata = makeCable(
    [
      new THREE.Vector3(-W / 2 + 0.055, 0.2, 0.07),
      new THREE.Vector3(-0.03, 0.16, 0.12),
      new THREE.Vector3(-W / 2 + 0.045, 0.17, 0.15),
    ],
    0xef4444
  );
  root.add(atx24, cpu8, gpuPcie, sata);

  // Ghost Highlight Box for assembly feedback
  const ghostHighlight = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.12),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    })
  );
  ghostHighlight.visible = false;
  root.add(ghostHighlight);

  return {
    root,
    sidePanel,
    motherboard,
    cpu,
    thermalPaste,
    airCooler,
    aioCooler,
    ramSticks,
    nvmeDrive,
    sataDrive,
    gpuGroup,
    gpuFans,
    psuGroup,
    caseFans,
    fanBlades,
    cables: { atx24, cpu8, gpuPcie, sata },
    ghostHighlight,
  };
}

export function syncInteractivePCVisuals(
  refs: InteractivePCRefs,
  build: PCBuildState,
  activeStageHint?: string
): void {
  refs.root.visible = Boolean(build.caseId);
  if (!build.caseId) return;

  refs.motherboard.visible = Boolean(build.motherboardId);
  refs.cpu.visible = Boolean(build.cpuId);
  refs.thermalPaste.visible = build.thermalPasteApplied && !build.coolerId;

  const cooler = getHardwareItem(build.coolerId);
  refs.airCooler.visible = Boolean(cooler && !cooler.isLiquidCooler);
  refs.aioCooler.visible = Boolean(cooler && cooler.isLiquidCooler);

  refs.ramSticks.forEach((stick, idx) => {
    stick.visible = idx < build.ramIds.length;
    const mat = stick.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = build.poweredOn ? 0.9 : 0.15;
  });

  const storages = build.storageIds.map((id) => getHardwareItem(id)).filter(Boolean);
  refs.nvmeDrive.visible = storages.some((s) => s?.storageInterface === 'NVMe');
  refs.sataDrive.visible = storages.some((s) => s?.storageInterface === 'SATA');

  const gpu = getHardwareItem(build.gpuId);
  refs.gpuGroup.visible = Boolean(gpu);
  if (gpu) {
    const scaleLen = Math.min(1.25, Math.max(0.75, (gpu.lengthMm ?? 240) / 250));
    refs.gpuGroup.scale.set(1, 1, scaleLen);
  }

  refs.psuGroup.visible = Boolean(build.psuId);

  refs.caseFans.forEach((fan, idx) => {
    fan.visible = idx < build.fanCount;
  });

  refs.cables.atx24.visible = build.atx24PinConnected;
  refs.cables.cpu8.visible = build.cpu8PinConnected;
  refs.cables.gpuPcie.visible = Boolean(build.gpuId && build.gpuPowerConnected);
  refs.cables.sata.visible = build.storageCablesConnected || build.sataPowerConnected;

  // Ghost placement preview
  const ghost = refs.ghostHighlight;
  ghost.visible = false;
  if (activeStageHint === 'motherboard' && !build.motherboardId) {
    ghost.visible = true;
    ghost.position.set(-0.08, 0.3, -0.02);
    ghost.scale.set(0.3, 2.2, 1.9);
  } else if (activeStageHint === 'cpu' && !build.cpuId) {
    ghost.visible = true;
    ghost.position.set(-0.07, 0.35, -0.04);
    ghost.scale.set(0.25, 0.5, 0.5);
  } else if (activeStageHint === 'cooling' && !build.coolerId) {
    ghost.visible = true;
    ghost.position.set(-0.04, 0.35, -0.04);
    ghost.scale.set(0.65, 0.85, 0.8);
  } else if (activeStageHint === 'ram' && build.ramIds.length < 2) {
    ghost.visible = true;
    ghost.position.set(-0.06, 0.35, 0.045);
    ghost.scale.set(0.35, 0.95, 0.5);
  } else if (activeStageHint === 'storage' && build.storageIds.length === 0) {
    ghost.visible = true;
    ghost.position.set(-0.06, 0.22, 0.08);
    ghost.scale.set(0.35, 0.55, 0.9);
  } else if (activeStageHint === 'gpu' && !build.gpuId) {
    ghost.visible = true;
    ghost.position.set(-0.02, 0.255, -0.055);
    ghost.scale.set(1.0, 0.45, 2.0);
  } else if (activeStageHint === 'psu' && !build.psuId) {
    ghost.visible = true;
    ghost.position.set(-0.02, 0.065, -0.14);
    ghost.scale.set(1.2, 0.75, 1.25);
  } else if (activeStageHint === 'cables' && !build.frontPanelConnected) {
    ghost.visible = true;
    ghost.position.set(-0.06, 0.21, 0.09);
    ghost.scale.set(0.3, 0.35, 0.35);
  }
}

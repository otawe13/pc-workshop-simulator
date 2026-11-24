import * as THREE from 'three';
import { CustomerArchetype, CustomerProfile } from '../types/game';

export type CharacterAnimMode =
  | 'idle'
  | 'walk'
  | 'work_bench'
  | 'inspect'
  | 'impatient'
  | 'celebrate';

export type HairStyleType =
  | 'short_fade'
  | 'side_part'
  | 'bob_cut'
  | 'ponytail'
  | 'curly_crop'
  | 'senior_swept';

export interface CharacterBuildConfig {
  gender: 'male' | 'female';
  scale: number;
  skinTone: number;
  hairColor: number;
  hairStyle: HairStyleType;
  topColor: number;
  secondaryTopColor: number;
  pantsColor: number;
  shoeColor: number;
  eyeColor: number;
  hasGlasses?: boolean;
  hasHeadphones?: boolean;
  hasBackpack?: boolean;
  hasBriefcase?: boolean;
  hasLaptop?: boolean;
  hasPhone?: boolean;
  hasWatch?: boolean;
  isOwner?: boolean;
}

export interface StylizedHumanRig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftEye: THREE.Group;
  rightEye: THREE.Group;
  leftArm: THREE.Group;
  leftForearm: THREE.Group;
  rightArm: THREE.Group;
  rightForearm: THREE.Group;
  leftLeg: THREE.Group;
  leftShin: THREE.Group;
  rightLeg: THREE.Group;
  rightShin: THREE.Group;
  screwdriverProp?: THREE.Group;
  phoneProp?: THREE.Group;
  laptopProp?: THREE.Group;
  baseY: number;
  blinkTimer: number;
}

const SKIN_TONES = [0xe8bea2, 0xd9a787, 0xc68e6b, 0xf0cbb1];
const HAIR_COLORS = [0x1c1917, 0x3b2314, 0x27272a, 0x573b26, 0x9ca3af];

function makeMat(color: number, roughness = 0.65, metalness = 0.05): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function buildEye(irisColor: number, eyeWhiteMat: THREE.Material, darkMat: THREE.Material): THREE.Group {
  const eyeGroup = new THREE.Group();

  // Sclera slightly flattened sphere
  const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), eyeWhiteMat);
  sclera.scale.set(1.05, 0.92, 0.65);
  eyeGroup.add(sclera);

  // Colored Iris
  const iris = new THREE.Mesh(
    new THREE.SphereGeometry(0.0115, 10, 10),
    new THREE.MeshStandardMaterial({ color: irisColor, roughness: 0.25 })
  );
  iris.scale.set(1, 1, 0.5);
  iris.position.set(0, 0, 0.009);
  eyeGroup.add(iris);

  // Dark Pupil
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0062, 8, 8), darkMat);
  pupil.scale.set(1, 1, 0.5);
  pupil.position.set(0, 0, 0.0128);
  eyeGroup.add(pupil);

  // Specular catchlight dot
  const glint = new THREE.Mesh(
    new THREE.SphereGeometry(0.0024, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  glint.position.set(0.004, 0.004, 0.0155);
  eyeGroup.add(glint);

  return eyeGroup;
}

function buildHairMesh(style: HairStyleType, hairMat: THREE.Material, isFemale: boolean): THREE.Group {
  const hair = new THREE.Group();

  // Base scalp dome
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.123, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat
  );
  crown.scale.set(1.0, 1.04, 1.05);
  crown.position.set(0, 0.016, -0.008);
  crown.castShadow = true;
  hair.add(crown);

  if (style === 'short_fade') {
    const quiff = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.055, 0.13), hairMat);
    quiff.position.set(0, 0.105, 0.032);
    quiff.rotation.x = -0.18;
    const backTrim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.085, 0.06), hairMat);
    backTrim.position.set(0, 0.015, -0.098);
    hair.add(quiff, backTrim);
  } else if (style === 'side_part') {
    const sweep = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 10), hairMat);
    sweep.scale.set(1.25, 0.45, 1.1);
    sweep.position.set(0.018, 0.108, 0.025);
    sweep.rotation.z = -0.15;
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.09), hairMat);
    sideL.position.set(-0.108, 0.02, -0.01);
    const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.09), hairMat);
    sideR.position.set(0.108, 0.02, -0.01);
    hair.add(sweep, sideL, sideR);
  } else if (style === 'bob_cut') {
    const leftCurtain = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.13, 6, 10), hairMat);
    leftCurtain.position.set(-0.106, -0.02, -0.008);
    leftCurtain.rotation.z = 0.08;
    const rightCurtain = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.13, 6, 10), hairMat);
    rightCurtain.position.set(0.106, -0.02, -0.008);
    rightCurtain.rotation.z = -0.08;
    const backBob = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.132, 0.16, 14, 1, false, Math.PI * 0.55, Math.PI * 0.9), hairMat);
    backBob.position.set(0, -0.015, -0.015);
    const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.042, 0.06), hairMat);
    bangs.position.set(0, 0.082, 0.086);
    bangs.rotation.x = 0.25;
    hair.add(leftCurtain, rightCurtain, backBob, bangs);
  } else if (style === 'ponytail') {
    const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.038, 0.055), hairMat);
    bangs.position.set(0, 0.088, 0.082);
    bangs.rotation.x = 0.22;
    const tie = new THREE.Mesh(
      new THREE.TorusGeometry(0.028, 0.008, 8, 12),
      makeMat(0x0ea5e9, 0.4)
    );
    tie.position.set(0, 0.04, -0.125);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.22, 12), hairMat);
    tail.position.set(0, -0.05, -0.155);
    tail.rotation.x = 0.24;
    hair.add(bangs, tie, tail);
  } else if (style === 'curly_crop') {
    for (let i = 0; i < 9; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), hairMat);
      const ang = (i / 9) * Math.PI * 2;
      puff.position.set(Math.sin(ang) * 0.078, 0.092 + (i % 2) * 0.018, Math.cos(ang) * 0.072 - 0.01);
      hair.add(puff);
    }
  } else {
    // senior_swept
    const topSwept = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), hairMat);
    topSwept.scale.set(1.06, 0.5, 1.15);
    topSwept.position.set(0, 0.095, -0.005);
    const templeL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.07, 0.08), hairMat);
    templeL.position.set(-0.112, 0.015, -0.015);
    const templeR = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.07, 0.08), hairMat);
    templeR.position.set(0.112, 0.015, -0.015);
    hair.add(topSwept, templeL, templeR);
  }

  if (isFemale && style !== 'bob_cut' && style !== 'ponytail') {
    const strandL = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.09, 0.04), hairMat);
    strandL.position.set(-0.105, -0.01, 0.04);
    const strandR = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.09, 0.04), hairMat);
    strandR.position.set(0.105, -0.01, 0.04);
    hair.add(strandL, strandR);
  }

  return hair;
}

export function createStylizedHumanCharacter(cfg: CharacterBuildConfig): StylizedHumanRig {
  const root = new THREE.Group();
  root.scale.setScalar(cfg.scale);

  const skinMat = makeMat(cfg.skinTone, 0.62, 0.02);
  const topMat = makeMat(cfg.topColor, 0.68, 0.06);
  const secMat = makeMat(cfg.secondaryTopColor, 0.52, 0.14);
  const pantsMat = makeMat(cfg.pantsColor, 0.78, 0.04);
  const shoeMat = makeMat(cfg.shoeColor, 0.45, 0.15);
  const hairMat = makeMat(cfg.hairColor, 0.76, 0.05);
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
  const soleMat = makeMat(0xe2e8f0, 0.6);

  // HIPS / PELVIS (center pivot at ~0.88m)
  const hips = new THREE.Group();
  hips.position.set(0, 0.88, 0);
  root.add(hips);

  const pelvisMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(cfg.gender === 'female' ? 0.142 : 0.138, 0.148, 0.14, 14),
    pantsMat
  );
  pelvisMesh.scale.set(1.12, 1, 0.74);
  pelvisMesh.position.y = -0.02;
  pelvisMesh.castShadow = true;
  hips.add(pelvisMesh);

  // Belt + buckle
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.146, 0.146, 0.036, 14), darkMat);
  belt.scale.set(1.13, 1, 0.75);
  belt.position.y = 0.045;
  hips.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.032, 0.02), makeMat(0x94a3b8, 0.25, 0.85));
  buckle.position.set(0, 0.045, 0.11);
  hips.add(buckle);

  // LEGS (left & right articulated hip -> thigh -> knee -> shin -> shoe)
  const makeLeg = (xSign: -1 | 1): { leg: THREE.Group; shin: THREE.Group } => {
    const leg = new THREE.Group();
    leg.position.set(xSign * 0.088, -0.05, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.31, 6, 12), pantsMat);
    thigh.position.y = -0.18;
    thigh.castShadow = true;
    leg.add(thigh);

    const shin = new THREE.Group();
    shin.position.set(0, -0.37, 0);
    leg.add(shin);

    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.30, 6, 12), pantsMat);
    calf.position.y = -0.18;
    calf.castShadow = true;
    shin.add(calf);

    // Sculpted sneaker / boot
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(0, -0.38, 0.035);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.068, 0.185), shoeMat);
    upper.position.y = 0.015;
    upper.castShadow = true;
    const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), shoeMat);
    toeCap.scale.set(1, 0.65, 1.15);
    toeCap.position.set(0, 0.005, 0.082);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.022, 0.20), soleMat);
    sole.position.set(0, -0.02, 0.01);
    shoeGroup.add(upper, toeCap, sole);
    shin.add(shoeGroup);

    hips.add(leg);
    return { leg, shin };
  };

  const { leg: leftLeg, shin: leftShin } = makeLeg(-1);
  const { leg: rightLeg, shin: rightShin } = makeLeg(1);

  // TORSO GROUP
  const torso = new THREE.Group();
  torso.position.set(0, 0.06, 0);
  hips.add(torso);

  const shoulderWidth = cfg.gender === 'female' ? 0.155 : 0.182;
  const waistWidth = cfg.gender === 'female' ? 0.122 : 0.14;
  const chest = new THREE.Mesh(
    new THREE.CylinderGeometry(shoulderWidth, waistWidth, 0.43, 16),
    topMat
  );
  chest.scale.set(1.18, 1, 0.72);
  chest.position.y = 0.22;
  chest.castShadow = true;
  torso.add(chest);

  // Rounded shoulders cap
  const shoulderCap = new THREE.Mesh(
    new THREE.SphereGeometry(shoulderWidth, 14, 10),
    topMat
  );
  shoulderCap.scale.set(1.18, 0.35, 0.72);
  shoulderCap.position.y = 0.42;
  torso.add(shoulderCap);

  // Layered Jacket Collar / Trim / Lanyard
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.078, 0.02, 8, 16),
    secMat
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.435, 0.005);
  torso.add(collar);

  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.36, 0.016), secMat);
  placket.position.set(0, 0.22, 0.118);
  torso.add(placket);

  if (cfg.isOwner) {
    // Owner cyan accent stripes + workshop badge + tool pouch
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.04, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.7 })
    );
    badge.position.set(0.09, 0.32, 0.118);
    torso.add(badge);

    const toolPouch = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.05), darkMat);
    toolPouch.position.set(-0.175, 0.02, 0.02);
    hips.add(toolPouch);
  }

  if (cfg.hasBackpack) {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.12), secMat);
    pack.position.set(0, 0.24, -0.155);
    pack.castShadow = true;
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.14, 0.03), darkMat);
    pocket.position.set(0, 0.17, -0.22);
    torso.add(pack, pocket);
  }

  // NECK + HEAD
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.056, 0.095, 12), skinMat);
  neck.position.set(0, 0.47, 0);
  torso.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 0.585, 0.008);
  torso.add(head);

  // Cranium + tapered jawline
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.116, 20, 16), skinMat);
  cranium.scale.set(0.95, 1.06, 1.02);
  cranium.position.y = 0.015;
  cranium.castShadow = true;
  head.add(cranium);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.092, 16, 12), skinMat);
  jaw.scale.set(0.86, 0.76, 0.92);
  jaw.position.set(0, -0.052, 0.02);
  head.add(jaw);

  // Ears
  const earGeo = new THREE.SphereGeometry(0.023, 8, 8);
  const earL = new THREE.Mesh(earGeo, skinMat);
  earL.scale.set(0.45, 1.15, 0.75);
  earL.position.set(-0.112, 0.002, -0.005);
  const earR = new THREE.Mesh(earGeo, skinMat);
  earR.scale.set(0.45, 1.15, 0.75);
  earR.position.set(0.112, 0.002, -0.005);
  head.add(earL, earR);

  // Nose bridge
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.038, 8), skinMat);
  nose.rotation.x = Math.PI * 0.42;
  nose.position.set(0, -0.012, 0.12);
  head.add(nose);

  // Natural Eyes + Eyebrows
  const leftEye = buildEye(cfg.eyeColor, eyeWhiteMat, darkMat);
  leftEye.position.set(-0.042, 0.018, 0.102);
  const rightEye = buildEye(cfg.eyeColor, eyeWhiteMat, darkMat);
  rightEye.position.set(0.042, 0.018, 0.102);
  head.add(leftEye, rightEye);

  const browGeo = new THREE.BoxGeometry(0.036, 0.007, 0.01);
  const browL = new THREE.Mesh(browGeo, hairMat);
  browL.position.set(-0.042, 0.044, 0.108);
  browL.rotation.z = 0.08;
  const browR = new THREE.Mesh(browGeo, hairMat);
  browR.position.set(0.042, 0.044, 0.108);
  browR.rotation.z = -0.08;
  head.add(browL, browR);

  // Expressive gentle smile mouth
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.0045, 6, 12, Math.PI * 0.75),
    makeMat(0xb96b5c, 0.5)
  );
  mouth.rotation.z = Math.PI * 1.125;
  mouth.position.set(0, -0.046, 0.106);
  head.add(mouth);

  // Hair Mesh
  const hairMesh = buildHairMesh(cfg.hairStyle, hairMat, cfg.gender === 'female');
  head.add(hairMesh);

  // Optional Glasses
  if (cfg.hasGlasses) {
    const frameMat = makeMat(0x1e293b, 0.3, 0.75);
    const lensL = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0035, 6, 14), frameMat);
    lensL.position.set(-0.042, 0.018, 0.118);
    const lensR = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0035, 6, 14), frameMat);
    lensR.position.set(0.042, 0.018, 0.118);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.005, 0.005), frameMat);
    bridge.position.set(0, 0.022, 0.118);
    head.add(lensL, lensR, bridge);
  }

  // Optional Over-Ear Gaming Headphones
  if (cfg.hasHeadphones) {
    const hpMat = makeMat(0x0f172a, 0.35, 0.6);
    const hpAccent = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.9 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.012, 8, 20, Math.PI), hpMat);
    band.position.set(0, 0.025, 0);
    const cupL = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.024, 14), hpMat);
    cupL.rotation.z = Math.PI / 2;
    cupL.position.set(-0.125, 0.005, 0);
    const cupR = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.024, 14), hpMat);
    cupR.rotation.z = Math.PI / 2;
    cupR.position.set(0.125, 0.005, 0);
    const ringL = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.003, 6, 14), hpAccent);
    ringL.rotation.y = Math.PI / 2;
    ringL.position.set(-0.138, 0.005, 0);
    const ringR = ringL.clone();
    ringR.position.set(0.138, 0.005, 0);
    head.add(band, cupL, cupR, ringL, ringR);
  }

  // ARMS (Shoulder -> Upper Arm -> Forearm -> Sculpted Hand)
  const makeArm = (xSign: -1 | 1): { arm: THREE.Group; forearm: THREE.Group; hand: THREE.Group } => {
    const arm = new THREE.Group();
    const xOff = xSign * (shoulderWidth + 0.038);
    arm.position.set(xOff, 0.40, 0);
    torso.add(arm);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.21, 6, 10), topMat);
    upper.position.y = -0.115;
    upper.castShadow = true;
    arm.add(upper);

    const forearm = new THREE.Group();
    forearm.position.set(0, -0.24, 0);
    arm.add(forearm);

    const sleeveMat = cfg.isOwner || cfg.hasBriefcase ? topMat : skinMat;
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.19, 6, 10), sleeveMat);
    lower.position.y = -0.105;
    lower.castShadow = true;
    forearm.add(lower);

    const hand = new THREE.Group();
    hand.position.set(0, -0.225, 0);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.062, 0.056), skinMat);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.022, 4, 6), skinMat);
    thumb.position.set(-xSign * 0.02, 0, 0.022);
    thumb.rotation.x = 0.5;
    hand.add(palm, thumb);
    forearm.add(hand);

    return { arm, forearm, hand };
  };

  const { arm: leftArm, forearm: leftForearm, hand: leftHand } = makeArm(-1);
  const { arm: rightArm, forearm: rightForearm, hand: rightHand } = makeArm(1);

  if (cfg.hasWatch) {
    const watch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.039, 0.039, 0.022, 12),
      makeMat(0x0ea5e9, 0.3, 0.8)
    );
    watch.position.set(0, -0.19, 0);
    leftForearm.add(watch);
  }

  let screwdriverProp: THREE.Group | undefined;
  if (cfg.isOwner) {
    screwdriverProp = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.09, 10), makeMat(0x0ea5e9, 0.35));
    handle.rotation.x = Math.PI / 2;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.11, 8), makeMat(0xcbd5e1, 0.2, 0.9));
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.095;
    screwdriverProp.add(handle, shaft);
    screwdriverProp.position.set(0, -0.02, 0.04);
    screwdriverProp.visible = false;
    rightHand.add(screwdriverProp);
  }

  let phoneProp: THREE.Group | undefined;
  if (cfg.hasPhone) {
    phoneProp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.008, 0.115), darkMat);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.054, 0.102),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    screen.rotation.x = -Math.PI / 2;
    screen.position.y = 0.005;
    phoneProp.add(body, screen);
    phoneProp.position.set(0, -0.015, 0.045);
    rightHand.add(phoneProp);
  }

  let laptopProp: THREE.Group | undefined;
  if (cfg.hasLaptop) {
    laptopProp = new THREE.Group();
    const laptop = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.022, 0.19), makeMat(0x94a3b8, 0.3, 0.8));
    laptopProp.add(laptop);
    laptopProp.position.set(-0.04, -0.02, 0.08);
    laptopProp.rotation.z = Math.PI / 2;
    leftHand.add(laptopProp);
  }

  if (cfg.hasBriefcase) {
    const brief = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.34), makeMat(0x3f2e21, 0.55));
    box.position.y = -0.15;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.1), darkMat);
    handle.position.y = -0.01;
    brief.add(box, handle);
    brief.position.set(0.03, -0.02, 0);
    rightHand.add(brief);
  }

  return {
    root,
    hips,
    torso,
    head,
    leftEye,
    rightEye,
    leftArm,
    leftForearm,
    rightArm,
    rightForearm,
    leftLeg,
    leftShin,
    rightLeg,
    rightShin,
    screwdriverProp,
    phoneProp,
    laptopProp,
    baseY: 0,
    blinkTimer: Math.random() * 4,
  };
}

export function createOwnerCharacter(): StylizedHumanRig {
  return createStylizedHumanCharacter({
    gender: 'male',
    scale: 1.0,
    skinTone: 0xd9a787,
    hairColor: 0x1c1917,
    hairStyle: 'short_fade',
    topColor: 0x1e293b,
    secondaryTopColor: 0x0ea5e9,
    pantsColor: 0x0f172a,
    shoeColor: 0x1e293b,
    eyeColor: 0x292524,
    hasWatch: true,
    isOwner: true,
  });
}

export function createCustomerCharacter(customer: CustomerProfile, seedIndex: number): StylizedHumanRig {
  const archetype: CustomerArchetype = customer.archetype;
  const variant = customer.appearanceVariant ?? seedIndex % 4;
  const isFemale =
    customer.gender === 'female' || archetype === 'Female Customer';

  const base: CharacterBuildConfig = {
    gender: isFemale ? 'female' : 'male',
    scale: isFemale ? 0.94 : 0.98 + (variant % 2) * 0.03,
    skinTone: SKIN_TONES[(seedIndex + variant) % SKIN_TONES.length],
    hairColor: HAIR_COLORS[(seedIndex + variant) % HAIR_COLORS.length],
    hairStyle: isFemale ? (variant % 2 === 0 ? 'bob_cut' : 'ponytail') : variant % 2 === 0 ? 'side_part' : 'short_fade',
    topColor: 0x2563eb,
    secondaryTopColor: 0x0ea5e9,
    pantsColor: 0x1e293b,
    shoeColor: 0x18181b,
    eyeColor: 0x292524,
  };

  switch (archetype) {
    case 'Office Worker':
      base.topColor = 0xe2e8f0;
      base.secondaryTopColor = 0x1d4ed8;
      base.pantsColor = 0x1e293b;
      base.hasGlasses = true;
      base.hasBriefcase = true;
      break;
    case 'Student':
      base.topColor = [0x0ea5e9, 0x10b981, 0xf59e0b][variant % 3];
      base.secondaryTopColor = 0x0f172a;
      base.pantsColor = 0x334155;
      base.hasBackpack = true;
      base.hasPhone = true;
      break;
    case 'Casual Gamer':
      base.topColor = 0x4f46e5;
      base.secondaryTopColor = 0x38bdf8;
      base.hairStyle = isFemale ? 'ponytail' : 'curly_crop';
      base.hasPhone = true;
      break;
    case 'Professional Gamer':
      base.topColor = 0x0f172a;
      base.secondaryTopColor = 0xec4899;
      base.hasHeadphones = true;
      base.hasWatch = true;
      break;
    case 'Content Creator':
      base.topColor = 0x0d9488;
      base.secondaryTopColor = 0xfbbf24;
      base.hasHeadphones = true;
      base.hasLaptop = true;
      break;
    case 'Business Owner':
      base.topColor = 0x1e293b;
      base.secondaryTopColor = 0x94a3b8;
      base.pantsColor = 0x0f172a;
      base.hasBriefcase = true;
      base.hasWatch = true;
      break;
    case 'PC Enthusiast':
      base.topColor = 0x0369a1;
      base.secondaryTopColor = 0x38bdf8;
      base.hasGlasses = true;
      base.hasLaptop = true;
      break;
    case 'Budget Customer':
      base.topColor = 0x475569;
      base.secondaryTopColor = 0x94a3b8;
      base.hasPhone = true;
      break;
    case 'Older Customer':
      base.gender = 'male';
      base.hairColor = 0xcbd5e1;
      base.hairStyle = 'senior_swept';
      base.topColor = 0x78350f;
      base.secondaryTopColor = 0xd97706;
      base.pantsColor = 0x292524;
      base.hasGlasses = true;
      break;
    case 'Female Customer':
      base.gender = 'female';
      base.scale = 0.94;
      base.topColor = [0xdb2777, 0x0ea5e9, 0x14b8a6][variant % 3];
      base.secondaryTopColor = 0xf8fafc;
      base.hairStyle = variant % 2 === 0 ? 'bob_cut' : 'ponytail';
      base.hasLaptop = variant % 2 === 1;
      base.hasPhone = variant % 2 === 0;
      break;
  }

  return createStylizedHumanCharacter(base);
}

export function animateHumanCharacter(
  rig: StylizedHumanRig,
  mode: CharacterAnimMode,
  dt: number,
  elapsed: number,
  phase = 0
): void {
  const t = elapsed + phase;

  // Natural blinking
  rig.blinkTimer -= dt;
  let eyeScaleY = 1;
  if (rig.blinkTimer <= 0) {
    if (rig.blinkTimer > -0.14) {
      eyeScaleY = 0.15;
    } else {
      rig.blinkTimer = 2.6 + Math.random() * 3.0;
    }
  }
  rig.leftEye.scale.y = eyeScaleY;
  rig.rightEye.scale.y = eyeScaleY;

  if (rig.screwdriverProp) {
    rig.screwdriverProp.visible = mode === 'work_bench';
  }

  if (mode === 'walk') {
    const stride = Math.sin(t * 7.5);
    const kneeBendL = Math.max(0, -stride) * 0.55;
    const kneeBendR = Math.max(0, stride) * 0.55;

    rig.leftLeg.rotation.x = stride * 0.45;
    rig.rightLeg.rotation.x = -stride * 0.45;
    rig.leftShin.rotation.x = kneeBendL;
    rig.rightShin.rotation.x = kneeBendR;

    rig.leftArm.rotation.x = -stride * 0.36;
    rig.rightArm.rotation.x = stride * 0.36;
    rig.leftArm.rotation.z = 0.08;
    rig.rightArm.rotation.z = -0.08;
    rig.leftForearm.rotation.x = -0.22;
    rig.rightForearm.rotation.x = -0.22;

    rig.torso.rotation.x = 0.05;
    rig.torso.rotation.y = stride * 0.06;
    rig.head.rotation.x = 0;
    rig.head.rotation.y = Math.sin(t * 1.4) * 0.08;
    rig.hips.position.y = 0.88 + Math.abs(Math.sin(t * 7.5)) * 0.032;
  } else if (mode === 'work_bench') {
    rig.leftLeg.rotation.x = 0;
    rig.rightLeg.rotation.x = 0;
    rig.leftShin.rotation.x = 0;
    rig.rightShin.rotation.x = 0;

    rig.torso.rotation.x = 0.18;
    rig.torso.rotation.y = Math.sin(t * 1.8) * 0.05;
    rig.head.rotation.x = 0.22;
    rig.head.rotation.y = Math.sin(t * 2.1) * 0.12;

    rig.leftArm.rotation.x = -0.65;
    rig.leftArm.rotation.z = 0.14;
    rig.leftForearm.rotation.x = -0.55;

    rig.rightArm.rotation.x = -0.78 + Math.sin(t * 5.2) * 0.08;
    rig.rightArm.rotation.z = -0.14;
    rig.rightForearm.rotation.x = -0.62 + Math.cos(t * 5.2) * 0.12;
    rig.hips.position.y = 0.88;
  } else if (mode === 'inspect') {
    rig.leftLeg.rotation.x = 0;
    rig.rightLeg.rotation.x = 0;
    rig.leftShin.rotation.x = 0;
    rig.rightShin.rotation.x = 0;

    rig.torso.rotation.x = 0.12;
    rig.torso.rotation.y = Math.sin(t * 1.3) * 0.14;
    rig.head.rotation.x = 0.14;
    rig.head.rotation.y = Math.sin(t * 1.5) * 0.22;

    rig.leftArm.rotation.x = -0.3;
    rig.leftForearm.rotation.x = -0.45;
    rig.rightArm.rotation.x = -0.85;
    rig.rightForearm.rotation.x = -1.1;
    rig.hips.position.y = 0.88;
  } else if (mode === 'impatient') {
    rig.leftLeg.rotation.x = 0;
    rig.rightLeg.rotation.x = 0;
    rig.leftShin.rotation.x = 0;
    rig.rightShin.rotation.x = 0;

    rig.torso.rotation.x = 0.02;
    rig.torso.rotation.y = Math.sin(t * 2.4) * 0.08;
    rig.head.rotation.y = Math.sin(t * 2.8) * 0.24;
    rig.head.rotation.x = 0.12;

    // Checking phone / wristwatch gesture
    rig.leftArm.rotation.x = -0.65;
    rig.leftArm.rotation.z = 0.2;
    rig.leftForearm.rotation.x = -0.75;
    rig.rightArm.rotation.x = -0.15;
    rig.rightArm.rotation.z = -0.12;
    rig.rightForearm.rotation.x = -0.25;
    rig.hips.position.y = 0.88 + Math.abs(Math.sin(t * 4.5)) * 0.008;
  } else if (mode === 'celebrate') {
    rig.leftLeg.rotation.x = 0;
    rig.rightLeg.rotation.x = 0;
    rig.leftShin.rotation.x = 0;
    rig.rightShin.rotation.x = 0;

    const bounce = Math.abs(Math.sin(t * 6.0));
    rig.hips.position.y = 0.88 + bounce * 0.06;
    rig.torso.rotation.x = -0.05;
    rig.head.rotation.x = -0.1;
    rig.head.rotation.y = Math.sin(t * 3.0) * 0.15;

    rig.leftArm.rotation.x = -2.4 + Math.sin(t * 8) * 0.25;
    rig.leftArm.rotation.z = 0.35;
    rig.rightArm.rotation.x = -2.4 - Math.sin(t * 8) * 0.25;
    rig.rightArm.rotation.z = -0.35;
    rig.leftForearm.rotation.x = -0.25;
    rig.rightForearm.rotation.x = -0.25;
  } else {
    // idle
    const breathe = Math.sin(t * 2.2);
    rig.leftLeg.rotation.x = 0;
    rig.rightLeg.rotation.x = 0;
    rig.leftShin.rotation.x = 0;
    rig.rightShin.rotation.x = 0;

    rig.torso.rotation.x = breathe * 0.02;
    rig.torso.rotation.y = Math.sin(t * 0.8) * 0.05;
    rig.head.rotation.x = Math.sin(t * 1.1) * 0.04;
    rig.head.rotation.y = Math.sin(t * 0.9) * 0.15;

    rig.leftArm.rotation.x = -0.06 + breathe * 0.03;
    rig.leftArm.rotation.z = 0.08;
    rig.rightArm.rotation.x = rig.phoneProp ? -0.58 : -0.06 - breathe * 0.03;
    rig.rightArm.rotation.z = -0.08;
    rig.leftForearm.rotation.x = rig.laptopProp ? -0.85 : -0.18;
    rig.rightForearm.rotation.x = rig.phoneProp ? -0.75 : -0.18;

    rig.hips.position.y = 0.88 + breathe * 0.008;
  }
}

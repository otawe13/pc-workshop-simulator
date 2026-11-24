import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraMode,
  GraphicsQuality,
  Language,
  PCBuildState,
  StationId,
  WorkshopOrder,
  WorkshopUpgrade,
} from '../types/game';
import { t, TranslationKey } from '../i18n/translations';
import {
  createContactShadowTexture,
  createESDMatTexture,
  createFloorTexture,
  createMonitorScreenTexture,
  createMotherboardTexture,
  createSignTexture,
} from './proceduralTextures';
import {
  createChair,
  createCompositeDesk,
  createInteractivePCModel,
  createMonitorRig,
  createTutorialBeacon,
  InteractivePCRefs,
  syncInteractivePCVisuals,
  tagStationInteractive,
} from './workshopModels';
import {
  animateHumanCharacter,
  CharacterAnimMode,
  createCustomerCharacter,
  createOwnerCharacter,
  StylizedHumanRig,
} from './characterSystem';

interface CameraPreset {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

const CAMERA_PRESETS: Record<CameraMode, CameraPreset> = {
  overview: { pos: new THREE.Vector3(9.4, 8.0, 10.2), target: new THREE.Vector3(0, 0.9, 0) },
  reception: { pos: new THREE.Vector3(-2.4, 2.5, 5.0), target: new THREE.Vector3(-3.6, 1.0, 2.2) },
  workbench: { pos: new THREE.Vector3(1.56, 1.38, 0.22), target: new THREE.Vector3(0.53, 1.12, -0.54) },
  pc_closeup: { pos: new THREE.Vector3(1.26, 1.24, -0.02), target: new THREE.Vector3(0.51, 1.13, -0.49) },
  pc_socket: { pos: new THREE.Vector3(1.04, 1.28, -0.18), target: new THREE.Vector3(0.48, 1.22, -0.49) },
  pc_ram: { pos: new THREE.Vector3(1.02, 1.26, -0.04), target: new THREE.Vector3(0.48, 1.22, -0.34) },
  pc_storage: { pos: new THREE.Vector3(1.06, 1.16, 0.12), target: new THREE.Vector3(0.48, 1.08, -0.24) },
  pc_gpu: { pos: new THREE.Vector3(1.14, 1.14, 0.08), target: new THREE.Vector3(0.49, 1.06, -0.49) },
  pc_psu: { pos: new THREE.Vector3(1.12, 1.02, -0.14), target: new THREE.Vector3(0.45, 0.95, -0.51) },
  pc_cables: { pos: new THREE.Vector3(1.15, 1.15, 0.08), target: new THREE.Vector3(0.47, 1.11, -0.28) },
  business_pc: { pos: new THREE.Vector3(-1.4, 2.3, -0.8), target: new THREE.Vector3(-3.4, 1.05, -2.8) },
  testing_station: { pos: new THREE.Vector3(2.4, 2.4, -0.6), target: new THREE.Vector3(3.8, 1.1, -2.8) },
  repair_table: { pos: new THREE.Vector3(2.3, 2.5, 4.3), target: new THREE.Vector3(3.8, 1.0, 1.8) },
  repair_closeup: { pos: new THREE.Vector3(3.05, 1.56, 2.35), target: new THREE.Vector3(3.82, 1.05, 1.75) },
  shelves: { pos: new THREE.Vector3(-0.2, 2.6, 0.2), target: new THREE.Vector3(-0.4, 1.3, -4.4) },
};

const _scratchVec = new THREE.Vector3();
const _panForward = new THREE.Vector3();
const _panRight = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export interface WorkshopSceneCallbacks {
  onSelectStation: (station: StationId) => void;
  onHoverStation: (label: string | null) => void;
  onFpsUpdate: (fps: number) => void;
  onCameraMoved?: () => void;
}

export class WorkshopSceneController {
  private container: HTMLElement;
  private callbacks: WorkshopSceneCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private keyLight!: THREE.DirectionalLight;
  private accentLights: THREE.PointLight[] = [];

  private pcRefs!: InteractivePCRefs;
  private signMesh!: THREE.Mesh;
  private signTexture!: THREE.CanvasTexture;
  private contactShadowMat!: THREE.MeshBasicMaterial;
  private entranceDoorLeft!: THREE.Mesh;
  private entranceDoorRight!: THREE.Mesh;
  private workbenchGantry!: THREE.Group;
  private proTestingRig!: THREE.Group;
  private extraShelfGroup!: THREE.Group;
  private tutorialBeacon!: THREE.Group;
  private beaconBasePos = new THREE.Vector3(-3.6, 2.0, 2.2);

  private ownerRig!: StylizedHumanRig;
  private ownerShadow!: THREE.Mesh;
  private ownerTargetPos = new THREE.Vector3(0.45, 0, 0.55);
  private ownerLookTarget = new THREE.Vector3(0.45, 0, -0.35);
  private ownerTargetAnim: CharacterAnimMode = 'idle';
  private ownerCelebrateTimer = 0;

  private customerActors = new Map<
    string,
    {
      orderId: string;
      rig: StylizedHumanRig;
      shadow: THREE.Mesh;
      targetX: number;
      targetZ: number;
      phase: number;
      impatient: boolean;
    }
  >();
  private customerCelebrateTimer = 0;

  private stationTags: { obj: THREE.Object3D; stationId: StationId; labelKey: TranslationKey }[] = [];
  private activeLanguage: Language = 'id';
  private lastWorkshopName = 'PC WORKSHOP SIMULATOR';

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private interactables: THREE.Object3D[] = [];
  private keysPressed = new Set<string>();
  private cameraSpeed = 1.0;
  private resizeObserver: ResizeObserver;

  private activeCameraMode: CameraMode = 'overview';
  private isTransitioning = false;
  private targetCamPos = CAMERA_PRESETS.overview.pos.clone();
  private targetCamLook = CAMERA_PRESETS.overview.target.clone();
  private isTitleShowcase = true;
  private titleAngle = 0.55;
  private currentPCBuild: PCBuildState | null = null;
  private doorOpenTimer = 0;

  private lastFrameTime = performance.now();
  private elapsedTime = 0;
  private frameId = 0;
  private disposed = false;
  private lastHoverCheck = 0;
  private fpsFrames = 0;
  private fpsAccum = 0;

  private disposables: { dispose: () => void }[] = [];

  constructor(container: HTMLElement, callbacks: WorkshopSceneCallbacks, quality: GraphicsQuality) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b101b);
    this.scene.fog = new THREE.FogExp2(0x0b101b, 0.022);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = envRT.texture;
    this.disposables.push(envRT);
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 100);
    this.camera.position.copy(CAMERA_PRESETS.overview.pos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.minPolarAngle = 0.2;
    this.controls.minDistance = 0.38;
    this.controls.maxDistance = 18;
    this.controls.target.copy(CAMERA_PRESETS.overview.target);

    this.controls.addEventListener('start', () => {
      // Cancel scripted transition if player takes manual camera control
      this.isTransitioning = false;
      this.callbacks.onCameraMoved?.();
    });

    this.raycaster.layers.set(1);

    this.setupLighting();
    this.buildWorkshopArchitecture();
    this.buildAllWorkstations();
    this.applyGraphicsQuality(quality);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.lastFrameTime = performance.now();
    this.tick();
  }

  private setupLighting(): void {
    // Crisp cool sky/ground hemisphere fill paired with warm directional key + rear fill light
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x334155, 1.45);
    this.scene.add(hemi);

    this.keyLight = new THREE.DirectionalLight(0xfff5e6, 2.35);
    this.keyLight.position.set(6, 9, 6);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 26;
    const d = 8.5;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.85);
    fillLight.position.set(-6, 6, -5);
    this.scene.add(fillLight);

    // Focused overhead work lights for workbench, reception, showcase & repair bay
    const workbenchSpot = new THREE.PointLight(0x7dd3fc, 3.2, 8, 1.4);
    workbenchSpot.position.set(0.6, 2.25, -0.2);
    this.scene.add(workbenchSpot);

    const receptionSpot = new THREE.PointLight(0xfde68a, 2.2, 8, 1.4);
    receptionSpot.position.set(-3.5, 2.5, 2.2);
    this.scene.add(receptionSpot);

    const displaySpot = new THREE.PointLight(0x38bdf8, 2.4, 7, 1.4);
    displaySpot.position.set(-4.1, 2.3, -0.3);
    this.scene.add(displaySpot);

    const repairSpot = new THREE.PointLight(0xa7f3d0, 2.0, 8, 1.4);
    repairSpot.position.set(3.6, 2.5, 1.2);
    this.scene.add(repairSpot);

    this.accentLights.push(workbenchSpot, receptionSpot, displaySpot, repairSpot);
  }

  private buildWorkshopArchitecture(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const floorTex = createFloorTexture(maxAniso);
    const signTex = createSignTexture('PC WORKSHOP SIMULATOR', maxAniso);
    this.signTexture = signTex;
    this.disposables.push(floorTex, signTex);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 12),
      new THREE.MeshStandardMaterial({
        map: floorTex,
        color: 0xe2e8f0,
        roughness: 0.68,
        metalness: 0.12,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Back & Side Walls (architectural slate paneling)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x222e42, roughness: 0.76, metalness: 0.1 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x162032, roughness: 0.48, metalness: 0.58 });
    const ledStripMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.4,
    });

    // North back wall
    const northWall = new THREE.Mesh(new THREE.BoxGeometry(14, 3.6, 0.2), wallMat);
    northWall.position.set(0, 1.8, -5.8);
    northWall.receiveShadow = true;
    this.scene.add(northWall);

    // West wall
    const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 12), wallMat);
    westWall.position.set(-6.8, 1.8, 0.2);
    westWall.receiveShadow = true;
    this.scene.add(westWall);

    // Blue architectural LED cove strip along walls
    const backLed = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.05, 0.05), ledStripMat);
    backLed.position.set(0, 3.35, -5.66);
    this.scene.add(backLed);

    const westLed = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 11.4), ledStripMat);
    westLed.position.set(-6.66, 3.35, 0.2);
    this.scene.add(westLed);

    // 14. Workshop Signage on back wall
    const signFrame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 0.12), trimMat);
    signFrame.position.set(-0.2, 2.75, -5.64);
    this.scene.add(signFrame);

    this.signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 0.98),
      new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: 0xffffff,
        emissiveMap: signTex,
        emissiveIntensity: 0.6,
        roughness: 0.3,
      })
    );
    this.signMesh.position.set(-0.2, 2.75, -5.57);
    this.scene.add(this.signMesh);

    // 1. Main Entrance (South-West glazed double doors with jambs & welcome mat)
    const doorFrameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.22), trimMat);
    doorFrameLeft.position.set(-5.6, 1.3, 5.8);
    const doorFrameRight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.22), trimMat);
    doorFrameRight.position.set(-3.4, 1.3, 5.8);
    const doorHeader = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.24), trimMat);
    doorHeader.position.set(-4.5, 2.6, 5.8);
    this.scene.add(doorFrameLeft, doorFrameRight, doorHeader);

    const glassDoorMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: this.isSoftwareGl ? 0.35 : 0.3,
      roughness: 0.1,
    });
    this.entranceDoorLeft = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.45, 0.05), glassDoorMat);
    this.entranceDoorLeft.position.set(-5.0, 1.24, 5.8);
    this.entranceDoorRight = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.45, 0.05), glassDoorMat);
    this.entranceDoorRight.position.set(-4.0, 1.24, 5.8);
    this.scene.add(this.entranceDoorLeft, this.entranceDoorRight);

    const welcomeMat = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.02, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 })
    );
    welcomeMat.position.set(-4.5, 0.015, 5.1);
    this.scene.add(welcomeMat);

    // 13. Overhead Industrial Lighting Fixtures (3 suspended light bars)
    for (let i = -1; i <= 1; i++) {
      const fixture = new THREE.Group();
      fixture.position.set(i * 3.6, 3.55, -0.8);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.26), trimMat);
      const diffuser = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.03, 0.2),
        new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          emissive: 0xe0f2fe,
          emissiveIntensity: 1.5,
        })
      );
      diffuser.position.y = -0.04;
      fixture.add(housing, diffuser);
      this.scene.add(fixture);
    }
  }

  private buildAllWorkstations(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const esdTex = createESDMatTexture(maxAniso);
    const pcbTex = createMotherboardTexture(maxAniso);
    const analyticsTex = createMonitorScreenTexture('analytics', maxAniso);
    const diagTex = createMonitorScreenTexture('diagnostics', maxAniso);
    const biosTex = createMonitorScreenTexture('bios', maxAniso);
    const contactTex = createContactShadowTexture();
    this.disposables.push(esdTex, pcbTex, analyticsTex, diagTex, biosTex, contactTex);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4638, roughness: 0.62, metalness: 0.05 });
    const slateTopMat = new THREE.MeshStandardMaterial({ color: 0x2b394f, roughness: 0.44, metalness: 0.22 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.75 });
    const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1a2436, roughness: 0.42, metalness: 0.65 });
    const blueAccentMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.1,
    });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x1e2532, roughness: 0.72, metalness: 0.08 });
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.contactShadowMat = shadowMat;

    const addContactShadow = (x: number, z: number, sx: number, sz: number) => {
      const disc = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), shadowMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x, 0.012, z);
      this.scene.add(disc);
    };

    const registerStation = (obj: THREE.Object3D, stationId: StationId, labelKey: TranslationKey) => {
      this.stationTags.push({ obj, stationId, labelKey });
      tagStationInteractive(obj, stationId, t(this.activeLanguage, labelKey));
      this.interactables.push(obj);
    };

    // 2. RECEPTION DESK (-3.6, 2.2)
    const reception = new THREE.Group();
    reception.position.set(-3.6, 0, 2.2);
    const recCounter = createCompositeDesk(2.2, 0.9, 0.98, woodMat, darkMetalMat);
    const recFrontPanel = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.85, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 })
    );
    recFrontPanel.position.set(0, 0.46, 0.4);
    const recLedBar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, 0.02), blueAccentMat);
    recLedBar.position.set(0, 0.86, 0.44);
    const recMonitor = createMonitorRig(analyticsTex, darkMetalMat, blueAccentMat);
    recMonitor.position.set(-0.3, 0.98, -0.05);
    const recChair = createChair(leatherMat, steelMat);
    recChair.position.set(-0.2, 0, -0.75);
    reception.add(recCounter, recFrontPanel, recLedBar, recMonitor, recChair);
    this.scene.add(reception);
    addContactShadow(-3.6, 2.2, 2.7, 1.6);
    registerStation(reception, 'reception', 'hoverReception');

    // 3. CUSTOMER WAITING AREA (-5.4, 1.4)
    const waiting = new THREE.Group();
    waiting.position.set(-5.5, 0, 1.2);
    const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 1.8), leatherMat);
    sofaBase.position.set(0, 0.22, 0);
    sofaBase.castShadow = true;
    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 1.8), leatherMat);
    sofaBack.position.set(-0.36, 0.52, 0);
    const coffeeTable = createCompositeDesk(0.6, 1.1, 0.44, slateTopMat, steelMat);
    coffeeTable.position.set(1.0, 0, 0);
    waiting.add(sofaBase, sofaBack, coffeeTable);
    this.scene.add(waiting);

    // 4. MAIN PC ASSEMBLY WORKBENCH (0.45, -0.35)
    const workbench = new THREE.Group();
    workbench.position.set(0.45, 0, -0.35);
    const benchDesk = createCompositeDesk(2.6, 1.2, 0.88, slateTopMat, steelMat);
    workbench.add(benchDesk);

    // Anti-static ESD mat
    const esdMat = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.8),
      new THREE.MeshStandardMaterial({ map: esdTex, roughness: 0.75 })
    );
    esdMat.rotation.x = -Math.PI / 2;
    esdMat.position.set(0, 0.885, 0.05);
    workbench.add(esdMat);

    // Overhead LED gantry (upgrades visually!)
    this.workbenchGantry = new THREE.Group();
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.05), steelMat);
    postL.position.set(-1.15, 1.3, -0.52);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.05), steelMat);
    postR.position.set(1.15, 1.3, -0.52);
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.06, 0.08), steelMat);
    topBar.position.set(0, 1.72, -0.52);
    const gantryLed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.025, 0.04), blueAccentMat);
    gantryLed.position.set(0, 1.68, -0.5);
    this.workbenchGantry.add(postL, postR, topBar, gantryLed);
    this.workbenchGantry.visible = false; // enabled on upgrade
    workbench.add(this.workbenchGantry);

    // Workbench monitor + keyboard + tools (screwdriver, thermal paste tube, screw tray)
    const wbMonitor = createMonitorRig(biosTex, darkMetalMat, blueAccentMat);
    wbMonitor.position.set(-0.75, 0.88, -0.36);
    wbMonitor.rotation.y = 0.25;
    workbench.add(wbMonitor);

    const screwTray = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.02, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.6, roughness: 0.3 })
    );
    screwTray.position.set(0.55, 0.89, 0.28);
    workbench.add(screwTray);

    const driverHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 })
    );
    driverHandle.rotation.z = Math.PI / 2;
    driverHandle.position.set(0.55, 0.9, 0.12);
    workbench.add(driverHandle);

    // Interactive 3D PC Case on the Workbench
    this.pcRefs = createInteractivePCModel(pcbTex, this.isSoftwareGl);
    this.pcRefs.root.position.set(0.02, 0.885, -0.02);
    workbench.add(this.pcRefs.root);

    this.scene.add(workbench);
    addContactShadow(0.45, -0.35, 3.0, 1.7);
    registerStation(workbench, 'workbench', 'hoverWorkbench');

    // 5. SECONDARY REPAIR TABLE (3.8, 1.8)
    const repair = new THREE.Group();
    repair.position.set(3.8, 0, 1.8);
    repair.rotation.y = -Math.PI / 2;
    const repairDesk = createCompositeDesk(2.1, 1.0, 0.88, slateTopMat, steelMat);
    const diagUnit = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.24, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.35 })
    );
    diagUnit.position.set(-0.55, 1.0, -0.2);
    const diagScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.8 })
    );
    diagScreen.position.set(-0.55, 1.02, -0.048);
    const repairCase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.44, 0.42), darkMetalMat);
    repairCase.position.set(0.35, 1.1, 0);
    repair.add(repairDesk, diagUnit, diagScreen, repairCase);
    this.scene.add(repair);
    addContactShadow(3.8, 1.8, 1.6, 2.6);
    registerStation(repair, 'repair_table', 'hoverRepair');

    // 6. COMPONENT SHELVES (-0.4, -4.6) with InstancedMesh hardware boxes
    const shelves = new THREE.Group();
    shelves.position.set(-0.4, 0, -4.7);
    const postGeo = new THREE.BoxGeometry(0.06, 2.2, 0.06);
    for (const sx of [-1.8, 0, 1.8]) {
      for (const sz of [-0.3, 0.3]) {
        const post = new THREE.Mesh(postGeo, steelMat);
        post.position.set(sx, 1.1, sz);
        shelves.add(post);
      }
    }
    const shelfBoardGeo = new THREE.BoxGeometry(3.7, 0.04, 0.68);
    for (const sy of [0.35, 0.95, 1.55, 2.15]) {
      const board = new THREE.Mesh(shelfBoardGeo, darkMetalMat);
      board.position.set(0, sy, 0);
      board.receiveShadow = true;
      shelves.add(board);
    }

    // InstancedMesh for 24 hardware retail boxes on shelves
    const boxGeo = new THREE.BoxGeometry(0.28, 0.36, 0.22);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.1 });
    const boxInst = new THREE.InstancedMesh(boxGeo, boxMat, 24);
    const dummy = new THREE.Object3D();
    const palette = [0x0ea5e9, 0x22c55e, 0xef4444, 0x6366f1, 0xf59e0b, 0x334155];
    let idx = 0;
    for (const sy of [0.55, 1.15, 1.75]) {
      for (let bx = 0; bx < 8; bx++) {
        dummy.position.set(-1.45 + bx * 0.41, sy, 0);
        dummy.rotation.y = (bx % 3) * 0.06 - 0.06;
        dummy.scale.set(0.9 + (bx % 2) * 0.15, 0.9 + (idx % 3) * 0.08, 1);
        dummy.updateMatrix();
        boxInst.setMatrixAt(idx, dummy.matrix);
        boxInst.setColorAt(idx, new THREE.Color(palette[idx % palette.length]));
        idx++;
      }
    }
    boxInst.instanceMatrix.needsUpdate = true;
    if (boxInst.instanceColor) boxInst.instanceColor.needsUpdate = true;
    boxInst.computeBoundingSphere();
    shelves.add(boxInst);

    this.extraShelfGroup = new THREE.Group();
    this.extraShelfGroup.position.set(2.8, 0, 0);
    const extraRack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.65), steelMat);
    extraRack.position.y = 1.05;
    this.extraShelfGroup.add(extraRack);
    this.extraShelfGroup.visible = false;
    shelves.add(this.extraShelfGroup);

    this.scene.add(shelves);
    registerStation(shelves, 'shelves', 'hoverShelves');

    // 7. INVENTORY CABINET (-3.6, -4.8)
    const cabinet = new THREE.Group();
    cabinet.position.set(-3.6, 0, -4.8);
    const cabBody = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 0.6), steelMat);
    cabBody.position.y = 1.05;
    cabBody.castShadow = true;
    const cabDoorL = new THREE.Mesh(new THREE.BoxGeometry(0.61, 1.95, 0.03), darkMetalMat);
    cabDoorL.position.set(-0.31, 1.05, 0.31);
    const cabDoorR = new THREE.Mesh(new THREE.BoxGeometry(0.61, 1.95, 0.03), darkMetalMat);
    cabDoorR.position.set(0.31, 1.05, 0.31);
    cabinet.add(cabBody, cabDoorL, cabDoorR);
    this.scene.add(cabinet);
    registerStation(cabinet, 'shelves', 'hoverShelves');

    // 8. HARDWARE TESTING STATION (3.8, -2.8)
    const testing = new THREE.Group();
    testing.position.set(3.8, 0, -2.8);
    testing.rotation.y = -Math.PI / 4;
    const testDesk = createCompositeDesk(2.0, 0.95, 0.82, slateTopMat, darkMetalMat);
    const testMon1 = createMonitorRig(diagTex, darkMetalMat, blueAccentMat);
    testMon1.position.set(-0.35, 0.82, -0.2);
    this.proTestingRig = createMonitorRig(analyticsTex, darkMetalMat, blueAccentMat);
    this.proTestingRig.position.set(0.35, 0.82, -0.15);
    this.proTestingRig.rotation.y = -0.22;
    this.proTestingRig.visible = false; // Unlocked on testing rig upgrade
    const testChair = createChair(leatherMat, steelMat);
    testChair.position.set(0, 0, 0.65);
    testChair.rotation.y = Math.PI;
    testing.add(testDesk, testMon1, this.proTestingRig, testChair);
    this.scene.add(testing);
    addContactShadow(3.8, -2.8, 2.4, 1.8);
    registerStation(testing, 'testing_station', 'hoverTesting');

    // 9. BUSINESS MANAGEMENT COMPUTER (-3.4, -2.8)
    const bizDeskGroup = new THREE.Group();
    bizDeskGroup.position.set(-3.4, 0, -2.8);
    bizDeskGroup.rotation.y = Math.PI / 5;
    const bizDesk = createCompositeDesk(1.9, 0.9, 0.8, woodMat, darkMetalMat);
    const bizMonitor = createMonitorRig(analyticsTex, darkMetalMat, blueAccentMat, true);
    bizMonitor.position.set(0, 0.8, -0.2);
    const bizChair = createChair(leatherMat, steelMat);
    bizChair.position.set(0, 0, 0.65);
    bizChair.rotation.y = Math.PI;
    bizDeskGroup.add(bizDesk, bizMonitor, bizChair);
    this.scene.add(bizDeskGroup);
    addContactShadow(-3.4, -2.8, 2.4, 1.6);
    registerStation(bizDeskGroup, 'business_pc', 'hoverBusiness');

    // 10. TOOL STORAGE (-5.9, -4.6)
    const toolWall = new THREE.Group();
    toolWall.position.set(-5.9, 0, -5.2);
    const chest = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.95, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, metalness: 0.55, roughness: 0.35 })
    );
    chest.position.y = 0.475;
    chest.castShadow = true;
    const pegboard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.04), darkMetalMat);
    pegboard.position.set(0, 1.65, -0.22);
    toolWall.add(chest, pegboard);
    this.scene.add(toolWall);

    // 11. PACKAGING AREA (4.4, 4.4)
    const packing = new THREE.Group();
    packing.position.set(4.2, 0, 4.4);
    const packDesk = createCompositeDesk(1.6, 0.9, 0.82, woodMat, steelMat);
    const cardboardMat = new THREE.MeshStandardMaterial({ color: 0xa17c55, roughness: 0.88 });
    const carton1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.38, 0.45), cardboardMat);
    carton1.position.set(-0.35, 1.01, 0);
    const carton2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.35), cardboardMat);
    carton2.position.set(0.3, 0.96, 0.1);
    packing.add(packDesk, carton1, carton2);
    this.scene.add(packing);

    // 12. COMPONENT DISPLAY SHOWCASE (-5.8, -1.6)
    const displayCase = new THREE.Group();
    displayCase.position.set(-5.9, 0, -1.6);
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 1.4), darkMetalMat);
    pedestal.position.y = 0.45;
    const vitrineGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.85, 1.35),
      new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: this.isSoftwareGl ? 0.25 : 0.22,
        roughness: 0.08,
        depthWrite: false,
      })
    );
    vitrineGlass.position.y = 1.32;
    const flagshipGpu = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.06, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.85, roughness: 0.2 })
    );
    flagshipGpu.position.set(0, 1.15, 0);
    displayCase.add(pedestal, vitrineGlass, flagshipGpu);
    this.scene.add(displayCase);

    // 13. MAIN CHARACTER: WORKSHOP OWNER (Stylized 3D Human Technician)
    this.ownerRig = createOwnerCharacter();
    this.ownerRig.root.position.set(0.45, 0, 0.55);
    this.ownerRig.root.lookAt(0.45, 0, -0.35);
    this.scene.add(this.ownerRig.root);

    this.ownerShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.66), shadowMat);
    this.ownerShadow.rotation.x = -Math.PI / 2;
    this.ownerShadow.position.set(0.45, 0.015, 0.55);
    this.scene.add(this.ownerShadow);

    // 14. TUTORIAL 3D BEACON
    this.tutorialBeacon = createTutorialBeacon();
    this.tutorialBeacon.visible = false;
    this.scene.add(this.tutorialBeacon);
  }

  public setLanguage(lang: Language): void {
    this.activeLanguage = lang;
    for (const entry of this.stationTags) {
      tagStationInteractive(entry.obj, entry.stationId, t(lang, entry.labelKey));
    }
  }

  public setControlSettings(sensitivity: number, speed: number): void {
    const sens = Math.max(0.4, Math.min(2.2, sensitivity));
    this.controls.rotateSpeed = sens * 0.85;
    this.controls.zoomSpeed = sens * 0.95;
    this.cameraSpeed = Math.max(0.4, Math.min(2.5, speed));
  }

  public nudgeCamera(dx: number, dz: number): void {
    if (this.isTitleShowcase) return;
    this.isTransitioning = false;
    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x + dx, -7.5, 8.5);
    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z + dz, -5.5, 9.5);
    this.controls.target.x = THREE.MathUtils.clamp(this.controls.target.x + dx, -5.5, 5.5);
    this.controls.target.z = THREE.MathUtils.clamp(this.controls.target.z + dz, -4.5, 5.5);
    this.controls.update();
    this.callbacks.onCameraMoved?.();
  }

  public setTitleShowcase(active: boolean): void {
    if (this.isTitleShowcase === active) return;
    this.isTitleShowcase = active;
    if (!active) {
      this.setCameraMode('overview');
    }
  }

  public setCameraMode(mode: CameraMode): void {
    this.activeCameraMode = mode;
    const preset = CAMERA_PRESETS[mode] ?? CAMERA_PRESETS.overview;
    this.targetCamPos.copy(preset.pos);
    this.targetCamLook.copy(preset.target);
    this.isTransitioning = true;
  }

  public setActiveStationFocus(station: StationId): void {
    switch (station) {
      case 'reception':
        this.ownerTargetPos.set(-3.55, 0, 1.25);
        this.ownerLookTarget.set(-3.6, 0, 2.5);
        this.ownerTargetAnim = 'idle';
        break;
      case 'workbench':
        // Stand slightly beside the bench so owner stays visible without blocking PC interior close-up
        this.ownerTargetPos.set(-0.42, 0, 0.56);
        this.ownerLookTarget.set(0.45, 0, -0.35);
        this.ownerTargetAnim = 'work_bench';
        break;
      case 'repair_table':
        this.ownerTargetPos.set(2.92, 0, 2.25);
        this.ownerLookTarget.set(3.8, 0, 1.8);
        this.ownerTargetAnim = 'inspect';
        break;
      case 'testing_station':
        this.ownerTargetPos.set(3.1, 0, -2.0);
        this.ownerLookTarget.set(3.8, 0, -2.8);
        this.ownerTargetAnim = 'inspect';
        break;
      case 'business_pc':
        this.ownerTargetPos.set(-2.6, 0, -2.1);
        this.ownerLookTarget.set(-3.4, 0, -2.8);
        this.ownerTargetAnim = 'inspect';
        break;
      case 'shelves':
        this.ownerTargetPos.set(-0.4, 0, -3.55);
        this.ownerLookTarget.set(-0.4, 0, -4.7);
        this.ownerTargetAnim = 'inspect';
        break;
      default:
        this.ownerTargetPos.set(0.45, 0, 0.55);
        this.ownerLookTarget.set(0.45, 0, -0.35);
        this.ownerTargetAnim = 'idle';
        break;
    }
  }

  public triggerOwnerCelebration(): void {
    this.ownerCelebrateTimer = 2.4;
    this.customerCelebrateTimer = 2.0;
  }

  public syncTutorialBeacon(visible: boolean, pos?: [number, number, number]): void {
    if (!this.tutorialBeacon) return;
    this.tutorialBeacon.visible = visible;
    if (pos) {
      this.beaconBasePos.set(pos[0], pos[1], pos[2]);
    }
  }

  public syncPCBuild(build: PCBuildState, activeStageHint?: string): void {
    this.currentPCBuild = build;
    syncInteractivePCVisuals(this.pcRefs, build, activeStageHint);
  }

  public updateWorkshopUpgrades(upgrades: WorkshopUpgrade[], workshopName: string): void {
    const hasWorkbenchPro = upgrades.some((u) => u.id === 'upg_workbench_pro' && u.purchased);
    const hasTestingPro = upgrades.some((u) => u.id === 'upg_testing_rig' && u.purchased);
    const hasStoragePro = upgrades.some((u) => u.id === 'upg_storage_rack' && u.purchased);
    const hasStudioLight = upgrades.some((u) => u.id === 'upg_lighting_studio' && u.purchased);

    if (this.workbenchGantry) this.workbenchGantry.visible = hasWorkbenchPro;
    if (this.proTestingRig) this.proTestingRig.visible = hasTestingPro;
    if (this.extraShelfGroup) this.extraShelfGroup.visible = hasStoragePro;

    this.accentLights.forEach((l, idx) => {
      l.intensity = hasStudioLight ? (idx === 0 ? 2.6 : 2.1) : idx === 0 ? 1.8 : 1.4;
    });

    if (workshopName && workshopName !== this.lastWorkshopName) {
      this.lastWorkshopName = workshopName;
      const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
      const newTex = createSignTexture(workshopName, maxAniso);
      const mat = this.signMesh.material as THREE.MeshStandardMaterial;
      mat.map = newTex;
      mat.emissiveMap = newTex;
      mat.needsUpdate = true;
      this.signTexture.dispose();
      this.signTexture = newTex;
    }
  }

  public syncOrderCustomers(orders: WorkshopOrder[]): void {
    const active = orders.filter((o) => o.status !== 'Delivered' && o.status !== 'Cancelled').slice(0, 4);
    const activeIds = new Set(active.map((o) => o.id));

    for (const [orderId, actor] of this.customerActors.entries()) {
      if (!activeIds.has(orderId)) {
        this.scene.remove(actor.rig.root);
        this.scene.remove(actor.shadow);
        this.customerActors.delete(orderId);
      }
    }

    const targetSpots: [number, number][] = [
      [-3.6, 3.25],
      [-4.45, 2.45],
      [-4.55, 1.3],
      [-4.55, 0.55],
    ];

    active.forEach((order, idx) => {
      const [tx, tz] = targetSpots[idx % targetSpots.length];
      const existing = this.customerActors.get(order.id);
      if (existing) {
        existing.targetX = tx;
        existing.targetZ = tz;
        return;
      }

      this.doorOpenTimer = 2.2;
      const rig = createCustomerCharacter(order.customer, idx);
      rig.root.position.set(-4.5, 0, 5.2);
      this.scene.add(rig.root);

      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), this.contactShadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(-4.5, 0.014, 5.2);
      this.scene.add(shadow);

      this.customerActors.set(order.id, {
        orderId: order.id,
        rig,
        shadow,
        targetX: tx,
        targetZ: tz,
        phase: idx * 1.45,
        impatient: order.customer.personality === 'Impatient',
      });
    });
  }

  public applyGraphicsQuality(quality: GraphicsQuality): void {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.keyLight.castShadow = false;
      return;
    }

    if (quality === 'low') {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.keyLight.castShadow = false;
    } else if (quality === 'medium') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.keyLight.castShadow = true;
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.keyLight.castShadow = true;
    }
  }

  private bindEvents(): void {
    const dom = this.renderer.domElement;

    const onPointerMove = (e: PointerEvent) => {
      if (this.isTitleShowcase) return;
      const now = performance.now();
      if (now - this.lastHoverCheck < 50) return;
      this.lastHoverCheck = now;

      const rect = dom.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.interactables, true);
      if (hits.length > 0 && hits[0].object.userData.stationLabel) {
        dom.style.cursor = 'pointer';
        this.callbacks.onHoverStation(hits[0].object.userData.stationLabel);
      } else {
        dom.style.cursor = 'grab';
        this.callbacks.onHoverStation(null);
      }
    };

    let downX = 0;
    let downY = 0;
    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (this.isTitleShowcase) return;
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist > 7) return; // Dragged camera, not a click

      const rect = dom.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.interactables, true);
      if (hits.length > 0 && hits[0].object.userData.stationId) {
        this.callbacks.onSelectStation(hits[0].object.userData.stationId as StationId);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'SELECT' || tgt.tagName === 'TEXTAREA')) return;
      this.keysPressed.add(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keysPressed.delete(e.key.toLowerCase());
    };
    const clearInputs = () => {
      this.keysPressed.clear();
    };

    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', clearInputs);

    this.disposables.push({
      dispose: () => {
        dom.removeEventListener('pointermove', onPointerMove);
        dom.removeEventListener('pointerdown', onPointerDown);
        dom.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', clearInputs);
        document.removeEventListener('visibilitychange', clearInputs);
      },
    });
  }

  private handleResize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = Math.max(0.001, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    const dt = Math.min(rawDt, 0.05);
    this.elapsedTime += dt;

    // FPS tracking
    this.fpsFrames++;
    this.fpsAccum += rawDt;
    if (this.fpsAccum >= 0.5) {
      this.callbacks.onFpsUpdate(Math.round(this.fpsFrames / this.fpsAccum));
      this.fpsFrames = 0;
      this.fpsAccum = 0;
    }

    // Title Screen live gentle orbit pan vs Interactive Camera
    if (this.isTitleShowcase) {
      this.titleAngle += dt * 0.14;
      const radius = 11.2;
      this.camera.position.set(
        Math.sin(this.titleAngle) * radius,
        6.2,
        Math.cos(this.titleAngle) * radius
      );
      this.controls.target.set(0, 1.0, -0.5);
      this.controls.update();
    } else if (this.isTransitioning) {
      const lambda = 9.5;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.targetCamPos.x, lambda, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.targetCamPos.y, lambda, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.targetCamPos.z, lambda, dt);

      this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.targetCamLook.x, lambda, dt);
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.targetCamLook.y, lambda, dt);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.targetCamLook.z, lambda, dt);

      if (
        this.camera.position.distanceToSquared(this.targetCamPos) < 0.008 &&
        this.controls.target.distanceToSquared(this.targetCamLook) < 0.008
      ) {
        this.camera.position.copy(this.targetCamPos);
        this.controls.target.copy(this.targetCamLook);
        this.isTransitioning = false;
      }
      this.controls.update();
    } else {
      // WASD & Arrow camera panning clamped inside workshop bounds
      const forwardInput =
        (this.keysPressed.has('w') || this.keysPressed.has('arrowup') ? 1 : 0) -
        (this.keysPressed.has('s') || this.keysPressed.has('arrowdown') ? 1 : 0);
      const rightInput =
        (this.keysPressed.has('d') || this.keysPressed.has('arrowright') ? 1 : 0) -
        (this.keysPressed.has('a') || this.keysPressed.has('arrowleft') ? 1 : 0);

      if (forwardInput !== 0 || rightInput !== 0) {
        this.camera.getWorldDirection(_panForward);
        _panForward.y = 0;
        if (_panForward.lengthSq() > 0.0001) _panForward.normalize();
        _panRight.set(-_panForward.z, 0, _panForward.x);

        const moveAmt = dt * 4.2 * this.cameraSpeed;
        const dx = (_panForward.x * forwardInput + _panRight.x * rightInput) * moveAmt;
        const dz = (_panForward.z * forwardInput + _panRight.z * rightInput) * moveAmt;

        this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x + dx, -7.5, 8.5);
        this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z + dz, -5.5, 9.5);
        this.controls.target.x = THREE.MathUtils.clamp(this.controls.target.x + dx, -5.5, 5.5);
        this.controls.target.z = THREE.MathUtils.clamp(this.controls.target.z + dz, -4.5, 5.5);
        this.callbacks.onCameraMoved?.();
      }
      this.controls.update();
    }

    // Side panel smooth slide open/close animation
    if (this.pcRefs) {
      const targetPanelX = this.currentPCBuild?.sidePanelOpen ? 0.24 : 0.124;
      const targetPanelZ = this.currentPCBuild?.sidePanelOpen ? 0.22 : 0;
      this.pcRefs.sidePanel.position.x = THREE.MathUtils.damp(this.pcRefs.sidePanel.position.x, targetPanelX, 8, dt);
      this.pcRefs.sidePanel.position.z = THREE.MathUtils.damp(this.pcRefs.sidePanel.position.z, targetPanelZ, 8, dt);

      // Spin PC case fans & GPU fans when powered on
      if (this.currentPCBuild?.poweredOn) {
        const spin = dt * 16;
        if (this.currentPCBuild.caseFansConnected) {
          for (const blade of this.pcRefs.fanBlades) blade.rotation.y += spin;
        }
        if (this.currentPCBuild.gpuId && this.currentPCBuild.gpuPowerConnected) {
          for (const gfan of this.pcRefs.gpuFans) gfan.rotation.y += spin;
        }
      }
    }

    // Entrance door swing animation on customer arrival
    if (this.doorOpenTimer > 0) {
      this.doorOpenTimer = Math.max(0, this.doorOpenTimer - dt);
    }
    const targetDoorOffset = this.doorOpenTimer > 0 ? 0.7 : 0;
    this.entranceDoorLeft.position.x = THREE.MathUtils.damp(
      this.entranceDoorLeft.position.x,
      -5.0 - targetDoorOffset,
      6,
      dt
    );
    this.entranceDoorRight.position.x = THREE.MathUtils.damp(
      this.entranceDoorRight.position.x,
      -4.0 + targetDoorOffset,
      6,
      dt
    );

    const elapsed = this.elapsedTime;

    // Tutorial Beacon animation
    if (this.tutorialBeacon && this.tutorialBeacon.visible) {
      this.tutorialBeacon.position.set(
        this.beaconBasePos.x,
        this.beaconBasePos.y + Math.sin(elapsed * 3.2) * 0.14,
        this.beaconBasePos.z
      );
      this.tutorialBeacon.rotation.y += dt * 1.45;
    }

    // Owner character movement & animation
    if (this.ownerCelebrateTimer > 0) {
      this.ownerCelebrateTimer = Math.max(0, this.ownerCelebrateTimer - dt);
    }
    if (this.customerCelebrateTimer > 0) {
      this.customerCelebrateTimer = Math.max(0, this.customerCelebrateTimer - dt);
    }

    if (this.ownerRig) {
      const dx = this.ownerTargetPos.x - this.ownerRig.root.position.x;
      const dz = this.ownerTargetPos.z - this.ownerRig.root.position.z;
      const dist = Math.hypot(dx, dz);
      let ownerAnim: CharacterAnimMode = this.ownerTargetAnim;

      if (dist > 0.06) {
        const step = Math.min(dist, dt * 1.85);
        this.ownerRig.root.position.x += (dx / dist) * step;
        this.ownerRig.root.position.z += (dz / dist) * step;
        this.ownerRig.root.rotation.y = Math.atan2(dx, dz);
        ownerAnim = 'walk';
      } else {
        this.ownerRig.root.lookAt(this.ownerLookTarget.x, 0, this.ownerLookTarget.z);
        if (this.ownerCelebrateTimer > 0) ownerAnim = 'celebrate';
      }
      this.ownerShadow.position.set(this.ownerRig.root.position.x, 0.015, this.ownerRig.root.position.z);
      animateHumanCharacter(this.ownerRig, ownerAnim, dt, elapsed, 0.4);
    }

    // Stylized Customer Actors walking & waiting/impatient/celebrating
    for (const actor of this.customerActors.values()) {
      const dx = actor.targetX - actor.rig.root.position.x;
      const dz = actor.targetZ - actor.rig.root.position.z;
      const dist = Math.hypot(dx, dz);
      let cAnim: CharacterAnimMode = actor.impatient ? 'impatient' : 'idle';

      if (dist > 0.05) {
        const step = Math.min(dist, dt * 1.45);
        actor.rig.root.position.x += (dx / dist) * step;
        actor.rig.root.position.z += (dz / dist) * step;
        actor.rig.root.rotation.y = Math.atan2(dx, dz);
        cAnim = 'walk';
      } else {
        _scratchVec.set(-3.6, 0, 2.2);
        actor.rig.root.lookAt(_scratchVec.x, 0, _scratchVec.z);
        if (this.customerCelebrateTimer > 0) cAnim = 'celebrate';
      }
      actor.shadow.position.set(actor.rig.root.position.x, 0.014, actor.rig.root.position.z);
      animateHumanCharacter(actor.rig, cAnim, dt, elapsed, actor.phase);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    for (const d of this.disposables) d.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
        else mesh.material.dispose();
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

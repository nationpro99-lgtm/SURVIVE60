import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Compass,
  Crosshair,
  Eye,
  Leaf,
  Menu,
  Music,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Trees,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  CALM_ACTIVITIES,
  CalmActivityDef,
  CalmEngineState,
  CalmInputState,
  CalmLessonCard,
  createCalmEngineState,
  getCalmGroundHeightWorld,
  stepCalmEngine,
  triggerCalmInteraction,
} from '../game/calmLevel';
import { GameSettings, InteractiveObject } from '../game/types';
import { buildCalmWorld3D, CalmWorld3DController } from '../game3d/calmWorldBuilder';
import {
  buildFirstPersonHands,
  FirstPersonHandRig,
  triggerHandAction,
  updateFirstPersonHands,
} from '../game3d/models';
import { WORLD_SCALE } from '../game3d/worldBuilder';
import { BreathingExerciseModal } from './BreathingExerciseModal';

interface CalmModeViewProps {
  settings: GameSettings;
  savedCompletedIds: string[];
  onSaveCompletedIds: (ids: string[]) => void;
  onUpdateSettings: (next: GameSettings) => void;
  onExitToMenu: () => void;
}

type CalmHubTab = 'main' | 'activities' | 'sound';

interface CalmHudSnapshot {
  locationLabel: string;
  completedIds: string[];
  targetPrompt: string | null;
  targetName: string | null;
  activeLesson: CalmLessonCard | null;
  crouching: boolean;
  running: boolean;
  inCover: boolean;
  breakerSwitchedOff: boolean;
}

export function CalmModeView({
  settings,
  savedCompletedIds,
  onSaveCompletedIds,
  onUpdateSettings,
  onExitToMenu,
}: CalmModeViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CalmEngineState>(createCalmEngineState(savedCompletedIds));
  const worldRef = useRef<CalmWorld3DController | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const handRigRef = useRef<FirstPersonHandRig | null>(null);
  const isSoftwareGlRef = useRef(false);

  const inputRef = useRef<CalmInputState>({
    up: false,
    down: false,
    left: false,
    right: false,
    joyX: 0,
    joyY: 0,
    sprintHeld: false,
    crouchHeld: false,
  });

  const lookRef = useRef({ yaw: -Math.PI * 0.5, pitch: -0.02 });
  const dragLookRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const touchLookRef = useRef<{ id: number | null; lastX: number; lastY: number }>({
    id: null,
    lastX: 0,
    lastY: 0,
  });
  const activeTargetIdRef = useRef<string | null>(null);

  const [hubOpen, setHubOpen] = useState<boolean>(true);
  const [hubTab, setHubTab] = useState<CalmHubTab>('main');
  const [hasEnteredWorld, setHasEnteredWorld] = useState<boolean>(false);
  const [breathingOpen, setBreathingOpen] = useState<boolean>(false);
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);

  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });
  const joyOriginRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const [mobileCrouchToggle, setMobileCrouchToggle] = useState(false);
  const [mobileSprintToggle, setMobileSprintToggle] = useState(false);

  const hubOpenRef = useRef(hubOpen);
  hubOpenRef.current = hubOpen;
  const breathingOpenRef = useRef(breathingOpen);
  breathingOpenRef.current = breathingOpen;
  const mobileCrouchRef = useRef(mobileCrouchToggle);
  mobileCrouchRef.current = mobileCrouchToggle;
  const mobileSprintRef = useRef(mobileSprintToggle);
  mobileSprintRef.current = mobileSprintToggle;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onSaveCompletedRef = useRef(onSaveCompletedIds);
  onSaveCompletedRef.current = onSaveCompletedIds;

  const [hud, setHud] = useState<CalmHudSnapshot>(() => ({
    locationLabel: engineRef.current.locationLabel,
    completedIds: [...engineRef.current.completedIds],
    targetPrompt: null,
    targetName: null,
    activeLesson: null,
    crouching: false,
    running: false,
    inCover: false,
    breakerSwitchedOff: engineRef.current.breakerSwitchedOff,
  }));

  const calmMusicVol = settings.calmMusicVolume ?? 0.55;
  const calmNatureVol = settings.calmNatureVolume ?? 0.65;
  const calmEffectsReduced = Boolean(settings.calmScreenEffectsReduced);

  const openMenuOverlay = useCallback((tab: CalmHubTab = 'main') => {
    setHubTab(tab);
    setHubOpen(true);
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        // ignore pointer lock release errors
      }
    }
  }, []);

  const enterExploration = useCallback(() => {
    soundEngine.unlock();
    if (!settingsRef.current.muted) {
      soundEngine.startCalmAmbient(
        settingsRef.current.calmMusicVolume ?? 0.55,
        settingsRef.current.calmNatureVolume ?? 0.65
      );
    }
    setHasEnteredWorld(true);
    setHubOpen(false);
    setHubTab('main');
  }, []);

  const restartExploration = useCallback(() => {
    engineRef.current = createCalmEngineState([]);
    onSaveCompletedRef.current([]);
    lookRef.current = { yaw: -Math.PI * 0.5, pitch: -0.02 };
    setHud({
      locationLabel: engineRef.current.locationLabel,
      completedIds: [],
      targetPrompt: null,
      targetName: null,
      activeLesson: null,
      crouching: false,
      running: false,
      inCover: false,
      breakerSwitchedOff: false,
    });
    enterExploration();
  }, [enterExploration]);

  const jumpToActivity = useCallback(
    (act: CalmActivityDef) => {
      const eng = engineRef.current;
      eng.player.x = act.teleportPos.x;
      eng.player.y = act.teleportPos.y;
      eng.player.vx = 0;
      eng.player.vy = 0;
      eng.player.inCoverId = null;
      lookRef.current = { yaw: act.teleportPos.yaw, pitch: -0.04 };
      enterExploration();
    },
    [enterExploration]
  );

  const dismissLesson = useCallback(() => {
    engineRef.current.activeLesson = null;
    engineRef.current.lessonTimer = 0;
    setHud((prev) => ({ ...prev, activeLesson: null }));
  }, []);

  const performInteract = useCallback(() => {
    soundEngine.unlock();
    const res = triggerCalmInteraction(engineRef.current, activeTargetIdRef.current);
    if (handRigRef.current) {
      triggerHandAction(handRigRef.current, res.kind);
    }
    if (res.newlyCompletedId) {
      onSaveCompletedRef.current([...engineRef.current.completedIds]);
    }
    setHud((prev) => ({
      ...prev,
      completedIds: [...engineRef.current.completedIds],
      activeLesson: engineRef.current.activeLesson,
      inCover: Boolean(engineRef.current.player.inCoverId),
      breakerSwitchedOff: engineRef.current.breakerSwitchedOff,
    }));
  }, []);

  // Touch detection
  useEffect(() => {
    const detectTouch = () => {
      const touchCapable =
        'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 900;
      setIsTouchDevice(touchCapable);
    };
    detectTouch();
    window.addEventListener('resize', detectTouch);
    return () => window.removeEventListener('resize', detectTouch);
  }, []);

  // Audio lifecycle
  useEffect(() => {
    soundEngine.unlock();
    soundEngine.startCalmAmbient(calmMusicVol, calmNatureVol);
    return () => {
      soundEngine.stopAmbient();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    soundEngine.setCalmLevels(calmMusicVol, calmNatureVol);
  }, [calmMusicVol, calmNatureVol]);

  // Sync runtime graphics quality & reduced effects with 3D world
  useEffect(() => {
    const renderer = rendererRef.current;
    const world = worldRef.current;
    const sw = isSoftwareGlRef.current;
    if (renderer && world) {
      const dprCap =
        sw || settings.graphicsQuality === 'low'
          ? 1
          : settings.graphicsQuality === 'medium'
            ? 1.5
            : 2;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
      renderer.shadowMap.enabled = !sw && settings.graphicsQuality !== 'low';
      world.setQuality(settings.graphicsQuality, sw);
      world.setReducedEffects(Boolean(settings.calmScreenEffectsReduced));
    }
  }, [settings.graphicsQuality, settings.calmScreenEffectsReduced]);

  // Keyboard & Pointer lock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      soundEngine.unlock();
      const key = e.key.toLowerCase();

      if (key === 'escape') {
        e.preventDefault();
        if (breathingOpenRef.current) {
          setBreathingOpen(false);
        } else if (hubOpenRef.current && hasEnteredWorld) {
          setHubOpen(false);
        } else {
          openMenuOverlay('main');
        }
        return;
      }

      if (hubOpenRef.current || breathingOpenRef.current) return;

      if (key === 'w' || e.key === 'ArrowUp') {
        e.preventDefault();
        inputRef.current.up = true;
      } else if (key === 's' || e.key === 'ArrowDown') {
        e.preventDefault();
        inputRef.current.down = true;
      } else if (key === 'a' || e.key === 'ArrowLeft') {
        e.preventDefault();
        inputRef.current.left = true;
      } else if (key === 'd' || e.key === 'ArrowRight') {
        e.preventDefault();
        inputRef.current.right = true;
      } else if (key === 'shift') {
        inputRef.current.sprintHeld = true;
      } else if (key === 'c' || key === 'control') {
        inputRef.current.crouchHeld = true;
      } else if (key === 'e' && !e.repeat) {
        e.preventDefault();
        performInteract();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') inputRef.current.up = false;
      else if (key === 's' || e.key === 'ArrowDown') inputRef.current.down = false;
      else if (key === 'a' || e.key === 'ArrowLeft') inputRef.current.left = false;
      else if (key === 'd' || e.key === 'ArrowRight') inputRef.current.right = false;
      else if (key === 'shift') inputRef.current.sprintHeld = false;
      else if (key === 'c' || key === 'control') inputRef.current.crouchHeld = false;
    };

    const onPointerLockChange = () => {
      setIsPointerLocked(Boolean(document.pointerLockElement));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
  }, [hasEnteredWorld, openMenuOverlay, performInteract]);

  // --- MAIN THREE.JS RENDER & CALM EXPLORATION LOOP ---
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let isSoftwareGl = false;
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          const rStr = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
          isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software Rasterizer/i.test(rStr);
        }
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    } catch {
      isSoftwareGl = false;
    }
    isSoftwareGlRef.current = isSoftwareGl;

    const quality = settingsRef.current.graphicsQuality;
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl && quality !== 'low',
      powerPreference: 'high-performance',
    });
    const dprCap = isSoftwareGl || quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl && quality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'block h-full w-full cursor-crosshair';

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const world = buildCalmWorld3D(
      renderer,
      engineRef.current,
      quality,
      isSoftwareGl,
      Boolean(settingsRef.current.calmScreenEffectsReduced)
    );
    worldRef.current = world;

    const camera = new THREE.PerspectiveCamera(
      70,
      (mount.clientWidth || window.innerWidth) / (mount.clientHeight || window.innerHeight),
      0.08,
      160
    );
    camera.rotation.order = 'YXZ';
    camera.layers.enable(0);
    camera.layers.disable(1);

    const hands = buildFirstPersonHands(world.mats);
    handRigRef.current = hands;
    camera.add(hands.root);
    world.scene.add(camera);

    if (!isSoftwareGl) {
      renderer.compile(world.scene, camera);
    }

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    raycaster.far = 3.5;
    const screenCenter = new THREE.Vector2(0, 0);

    const canvasEl = renderer.domElement;
    const onCanvasMouseDown = (e: MouseEvent) => {
      if (hubOpenRef.current || breathingOpenRef.current) return;
      soundEngine.unlock();
      dragLookRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
      if (!document.pointerLockElement && canvasEl.requestPointerLock) {
        try {
          const p = canvasEl.requestPointerLock() as unknown as Promise<void> | undefined;
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch {
          // fallback click-drag stays active
        }
      }
    };

    const onWindowMouseUp = () => {
      dragLookRef.current.active = false;
    };

    const onWindowMouseMove = (e: MouseEvent) => {
      if (hubOpenRef.current || breathingOpenRef.current) return;
      let dx = 0;
      let dy = 0;
      if (document.pointerLockElement === canvasEl) {
        dx = e.movementX;
        dy = e.movementY;
      } else if (dragLookRef.current.active) {
        dx = e.clientX - dragLookRef.current.lastX;
        dy = e.clientY - dragLookRef.current.lastY;
        dragLookRef.current.lastX = e.clientX;
        dragLookRef.current.lastY = e.clientY;
      } else {
        return;
      }
      const sens = 0.0026;
      lookRef.current.yaw -= dx * sens;
      lookRef.current.pitch = Math.max(
        -Math.PI * 0.42,
        Math.min(Math.PI * 0.42, lookRef.current.pitch - dy * sens)
      );
    };

    canvasEl.addEventListener('mousedown', onCanvasMouseDown);
    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('mousemove', onWindowMouseMove);

    const onResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let contextLost = false;
    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
    };
    canvasEl.addEventListener('webglcontextlost', onContextLost);
    canvasEl.addEventListener('webglcontextrestored', onContextRestored);

    const glCtx = isSoftwareGl ? renderer.getContext() : null;
    const afterDraw = (cb: () => void) => {
      if (isSoftwareGl && glCtx && 'fenceSync' in glCtx) {
        const g = glCtx as WebGL2RenderingContext;
        const fence = g.fenceSync(g.SYNC_GPU_COMMANDS_COMPLETE, 0);
        g.flush();
        if (fence) {
          setTimeout(() => {
            g.deleteSync(fence);
            cb();
          }, 80);
          return;
        }
      }
      rafId = requestAnimationFrame(cb);
    };

    let rafId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let hudSyncAcc = 0;
    let eyeHeight = 1.65;
    let smoothedGroundY = 0;
    let smoothedBobAmp = 0;
    let smoothedStrafeRoll = 0;

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
      lastTime = now;

      const engine = engineRef.current;
      const inp = inputRef.current;
      const strafe = (inp.right ? 1 : 0) - (inp.left ? 1 : 0) + inp.joyX;

      if (!hubOpenRef.current && !breathingOpenRef.current) {
        const forward = (inp.up ? 1 : 0) - (inp.down ? 1 : 0) - inp.joyY;
        const yaw = lookRef.current.yaw;
        const worldMoveX = -Math.sin(yaw) * forward + Math.cos(yaw) * strafe;
        const worldMoveY = -Math.cos(yaw) * forward - Math.sin(yaw) * strafe;

        stepCalmEngine(
          engine,
          {
            up: false,
            down: false,
            left: false,
            right: false,
            joyX: worldMoveX,
            joyY: worldMoveY,
            sprintHeld: inp.sprintHeld || mobileSprintRef.current,
            crouchHeld: inp.crouchHeld || mobileCrouchRef.current,
          },
          dt
        );
        engine.player.facingX = -Math.sin(yaw);
        engine.player.facingY = -Math.cos(yaw);
      } else {
        engine.elapsed += dt;
      }

      const p = engine.player;
      const reducedMotion = settingsRef.current.reducedCameraMotion;
      const motionScale = reducedMotion ? 0.2 : 1.0;

      const targetGroundY = getCalmGroundHeightWorld(p.x * WORLD_SCALE, p.y * WORLD_SCALE);
      smoothedGroundY = THREE.MathUtils.damp(smoothedGroundY, targetGroundY, 12, dt);

      const targetEyeY = p.inCoverId ? 0.62 : p.crouching ? 0.96 : 1.65;
      eyeHeight = THREE.MathUtils.damp(eyeHeight, targetEyeY, 10, dt);

      const speedMag = Math.hypot(p.vx, p.vy);
      const targetBobAmp =
        speedMag > 16 && !p.inCoverId && !hubOpenRef.current
          ? (0.022 + p.runBlend * 0.016) * Math.min(1, speedMag / 160) * motionScale
          : 0;
      smoothedBobAmp = THREE.MathUtils.damp(smoothedBobAmp, targetBobAmp, 12, dt);

      const bobY = Math.sin(p.walkPhase * 2) * smoothedBobAmp;
      const bobX = Math.cos(p.walkPhase) * smoothedBobAmp * 0.55;
      const targetStrafeRoll =
        !p.inCoverId && speedMag > 20 && !hubOpenRef.current
          ? -strafe * 0.012 * motionScale
          : 0;
      smoothedStrafeRoll = THREE.MathUtils.damp(smoothedStrafeRoll, targetStrafeRoll, 9, dt);

      camera.position.set(
        p.x * WORLD_SCALE + bobX,
        smoothedGroundY + eyeHeight + bobY,
        p.y * WORLD_SCALE
      );
      camera.rotation.y = lookRef.current.yaw;
      camera.rotation.x = lookRef.current.pitch + (p.inCoverId ? -0.14 : 0);
      camera.rotation.z = smoothedStrafeRoll;

      updateFirstPersonHands(hands, dt, engine.elapsed, {
        speedMag: hubOpenRef.current ? 0 : speedMag,
        walkPhase: p.walkPhase,
        runBlend: p.runBlend,
        crouching: p.crouching,
        inCover: Boolean(p.inCoverId),
        bracing: false,
        recoilIntensity: 0,
        reducedMotion,
      });

      // Layer 1 raycast for interactive learning objects
      raycaster.setFromCamera(screenCenter, camera);
      const hits = raycaster.intersectObjects(world.raycastTargets, false);
      let rayInteractive: InteractiveObject | null = null;
      for (const hit of hits) {
        const hitId = hit.object.userData.interactiveId as string | undefined;
        if (!hitId) continue;
        const found = engine.interactives.find((o) => o.id === hitId);
        if (found) {
          const distBp = Math.hypot(p.x - (found.x + found.w / 2), p.y - (found.y + found.h / 2));
          if (distBp <= found.radius + 55) {
            rayInteractive = found;
            break;
          }
        }
      }
      const activeTarget = rayInteractive || engine.nearestInteractive;
      activeTargetIdRef.current = activeTarget ? activeTarget.id : null;

      world.update(dt, engine.elapsed, engine, activeTargetIdRef.current);
      if (!contextLost) {
        renderer.render(world.scene, camera);
      }

      hudSyncAcc += dt;
      if (hudSyncAcc >= 0.08) {
        hudSyncAcc = 0;
        const targetPrompt = activeTarget
          ? activeTarget.id === 'calm_cover_table' && p.inCoverId
            ? activeTarget.secondaryPrompt || activeTarget.prompt
            : activeTarget.prompt
          : null;
        setHud({
          locationLabel: engine.locationLabel,
          completedIds: [...engine.completedIds],
          targetPrompt,
          targetName: activeTarget ? activeTarget.name : null,
          activeLesson: engine.lessonTimer > 0 ? engine.activeLesson : null,
          crouching: p.crouching,
          running: p.running,
          inCover: Boolean(p.inCoverId),
          breakerSwitchedOff: engine.breakerSwitchedOff,
        });
      }

      afterDraw(tick);
    };

    if (isSoftwareGl) afterDraw(tick);
    else rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(rafId);
      canvasEl.removeEventListener('mousedown', onCanvasMouseDown);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('resize', onResize);
      canvasEl.removeEventListener('webglcontextlost', onContextLost);
      canvasEl.removeEventListener('webglcontextrestored', onContextRestored);
      world.dispose();
      renderer.dispose();
    };
  }, []);

  // Touch handlers for mobile joystick & look
  const showTouchControls = !hubOpen && !breathingOpen && (isTouchDevice || settings.forceTouchControls);
  const canResume = hasEnteredWorld || savedCompletedIds.length > 0;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#dbeafe] select-none">
      {/* Isolated WebGL Mount */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />

      {/* Active Calm Exploration HUD (No backdrop-blur over WebGL, NO Timer, NO Damage!) */}
      {!hubOpen && !breathingOpen && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-5">
          {/* Top Bar */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-emerald-900/15 bg-[#f7f5ee]/95 px-4 py-2.5 shadow-md">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white shrink-0">
                <Leaf className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                  <span>Calm Mode</span>
                  <span>·</span>
                  <span>No Timer</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-slate-900">
                  {hud.locationLabel} ·{' '}
                  <span className="text-emerald-700 tabular-nums">
                    {hud.completedIds.length} / {CALM_ACTIVITIES.length} Explored
                  </span>
                </div>
              </div>
            </div>

            <div className="pointer-events-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (document.pointerLockElement) document.exitPointerLock();
                  setBreathingOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-sky-700/20 bg-[#e0f2fe]/95 px-3.5 py-2.5 text-sm sm:text-base font-bold text-sky-950 shadow-sm hover:bg-sky-200 transition-colors whitespace-nowrap"
              >
                <Wind className="h-4 w-4 text-sky-700" />
                <span>Breathe</span>
              </button>

              <button
                type="button"
                onClick={() => openMenuOverlay('activities')}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-800/20 bg-[#f7f5ee]/95 px-3.5 py-2.5 text-sm sm:text-base font-bold text-emerald-950 shadow-sm hover:bg-emerald-50 transition-colors whitespace-nowrap"
              >
                <BookOpen className="h-4 w-4 text-emerald-700" />
                <span>Activities</span>
              </button>

              <button
                type="button"
                onClick={() => openMenuOverlay('sound')}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-800/20 bg-[#f7f5ee]/95 px-3.5 py-2.5 text-sm sm:text-base font-bold text-emerald-950 shadow-sm hover:bg-emerald-50 transition-colors whitespace-nowrap"
              >
                {settings.muted ? (
                  <VolumeX className="h-4 w-4 text-slate-500" />
                ) : (
                  <Volume2 className="h-4 w-4 text-emerald-700" />
                )}
                <span>Sound</span>
              </button>

              <button
                type="button"
                onClick={() => openMenuOverlay('main')}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm sm:text-base font-bold text-white shadow-sm hover:bg-emerald-900 transition-colors whitespace-nowrap"
              >
                <Menu className="h-4 w-4" />
                <span>Menu</span>
              </button>
            </div>
          </div>

          {/* Center Crosshair + Gentle Interaction Prompt */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center">
              <Crosshair
                className={`h-6 w-6 transition-colors ${
                  hud.targetPrompt ? 'text-emerald-600' : 'text-white/75'
                }`}
              />
            </div>

            {hud.targetPrompt && (
              <div className="mt-4 rounded-2xl border border-emerald-700/25 bg-[#f7f5ee]/95 px-5 py-2.5 text-center shadow-lg">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  {hud.targetName}
                </div>
                <div className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                  {hud.targetPrompt}
                </div>
              </div>
            )}

            {!isPointerLocked && !showTouchControls && !hud.targetPrompt && (
              <div className="mt-6 rounded-xl bg-[#f7f5ee]/90 px-4 py-1.5 text-xs sm:text-sm font-semibold text-emerald-950 shadow-sm">
                Click or drag view to look · WASD Walk · E Interact · Esc Menu
              </div>
            )}
          </div>

          {/* Bottom Learning Card & Mobile Controls */}
          <div className="flex flex-col items-center gap-3">
            {hud.activeLesson && (
              <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-emerald-800/25 bg-[#f7f5ee]/95 p-4 sm:p-5 text-slate-900 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                      {hud.activeLesson.category} · Safety Discovery
                    </div>
                    <h3 className="font-display text-xl sm:text-2xl font-extrabold text-emerald-950 mt-0.5">
                      {hud.activeLesson.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={dismissLesson}
                    aria-label="Close learning tip"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-900/10 hover:text-slate-900"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-700">
                  {hud.activeLesson.tip}
                </p>

                {hud.activeLesson.items && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {hud.activeLesson.items.map((item) => (
                      <div
                        key={item.name}
                        className="rounded-xl border border-emerald-900/10 bg-white px-3 py-2 text-xs sm:text-sm"
                      >
                        <div className="font-bold text-emerald-900">{item.name}</div>
                        <div className="text-slate-600">{item.purpose}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showTouchControls && (
              <div className="pointer-events-auto flex w-full items-end justify-between gap-4 pb-1">
                {/* Left Virtual Joystick */}
                <div
                  onTouchStart={(e) => {
                    const touch = e.changedTouches[0];
                    if (!touch) return;
                    joyOriginRef.current = {
                      id: touch.identifier,
                      x: touch.clientX,
                      y: touch.clientY,
                    };
                  }}
                  onTouchMove={(e) => {
                    const origin = joyOriginRef.current;
                    if (!origin) return;
                    const touch = Array.from(e.changedTouches).find(
                      (t) => t.identifier === origin.id
                    );
                    if (!touch) return;
                    const dx = touch.clientX - origin.x;
                    const dy = touch.clientY - origin.y;
                    const maxR = 44;
                    const dist = Math.hypot(dx, dy);
                    const scale = dist > maxR ? maxR / dist : 1;
                    const cx = dx * scale;
                    const cy = dy * scale;
                    setJoyOffset({ x: cx, y: cy });
                    inputRef.current.joyX = cx / maxR;
                    inputRef.current.joyY = cy / maxR;
                  }}
                  onTouchEnd={() => {
                    joyOriginRef.current = null;
                    setJoyOffset({ x: 0, y: 0 });
                    inputRef.current.joyX = 0;
                    inputRef.current.joyY = 0;
                  }}
                  className="relative h-28 w-28 rounded-full border-2 border-emerald-900/30 bg-[#f7f5ee]/85 flex items-center justify-center touch-none shadow-md"
                >
                  <div
                    style={{ transform: `translate(${joyOffset.x}px, ${joyOffset.y}px)` }}
                    className="h-12 w-12 rounded-full bg-emerald-700 border-2 border-white shadow"
                  />
                </div>

                {/* Right Look Area & Action Buttons */}
                <div className="flex items-center gap-2.5">
                  <div
                    onTouchStart={(e) => {
                      const t = e.changedTouches[0];
                      if (!t) return;
                      touchLookRef.current = { id: t.identifier, lastX: t.clientX, lastY: t.clientY };
                    }}
                    onTouchMove={(e) => {
                      const ref = touchLookRef.current;
                      if (ref.id === null) return;
                      const t = Array.from(e.changedTouches).find((c) => c.identifier === ref.id);
                      if (!t) return;
                      const dx = t.clientX - ref.lastX;
                      const dy = t.clientY - ref.lastY;
                      ref.lastX = t.clientX;
                      ref.lastY = t.clientY;
                      lookRef.current.yaw -= dx * 0.0045;
                      lookRef.current.pitch = Math.max(
                        -Math.PI * 0.4,
                        Math.min(Math.PI * 0.4, lookRef.current.pitch - dy * 0.0045)
                      );
                    }}
                    onTouchEnd={() => {
                      touchLookRef.current.id = null;
                    }}
                    className="h-20 w-24 rounded-2xl border border-emerald-900/20 bg-[#f7f5ee]/70 flex items-center justify-center text-xs font-bold text-emerald-950 touch-none"
                  >
                    LOOK
                  </div>

                  <button
                    type="button"
                    onClick={() => setMobileCrouchToggle((v) => !v)}
                    className={`h-14 w-14 rounded-full border-2 text-xs font-extrabold shadow ${
                      mobileCrouchToggle
                        ? 'border-emerald-700 bg-emerald-700 text-white'
                        : 'border-emerald-800/30 bg-[#f7f5ee]/95 text-emerald-950'
                    }`}
                  >
                    LOW
                  </button>

                  <button
                    type="button"
                    onClick={() => setMobileSprintToggle((v) => !v)}
                    className={`h-14 w-14 rounded-full border-2 text-xs font-extrabold shadow ${
                      mobileSprintToggle
                        ? 'border-sky-600 bg-sky-600 text-white'
                        : 'border-emerald-800/30 bg-[#f7f5ee]/95 text-emerald-950'
                    }`}
                  >
                    BRISK
                  </button>

                  <button
                    type="button"
                    onClick={performInteract}
                    className="h-18 w-18 rounded-full border-2 border-emerald-700 bg-emerald-700 text-base font-extrabold text-white shadow-lg active:scale-95"
                  >
                    USE
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calm Mode Hub / Pause Overlay */}
      {hubOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/55 p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-3xl border border-emerald-900/20 bg-[#f7f5ee] text-slate-900 shadow-2xl overflow-hidden my-auto">
            {/* Soft Botanical Header */}
            <div className="bg-gradient-to-r from-[#dfeee5] via-[#eef6f0] to-[#e0f2fe] px-6 sm:px-8 py-6 border-b border-emerald-900/10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
                  <Trees className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-emerald-800">
                    Peaceful Preparedness · No Timer · Zero Pressure
                  </div>
                  <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-emerald-950 leading-tight">
                    CALM MODE
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white/90 border border-emerald-900/10 px-4 py-2 text-sm font-bold text-emerald-900 tabular-nums">
                  {hud.completedIds.length} / {CALM_ACTIVITIES.length} Activities Explored
                </div>
              </div>
            </div>

            {/* Sub-Tabs Navigation */}
            <div className="px-6 sm:px-8 pt-4 flex flex-wrap gap-2 border-b border-emerald-900/10 bg-[#f1efe6]">
              <button
                type="button"
                onClick={() => setHubTab('main')}
                className={`px-4 py-2.5 rounded-t-xl text-sm sm:text-base font-bold transition-colors whitespace-nowrap ${
                  hubTab === 'main'
                    ? 'bg-[#f7f5ee] text-emerald-900 border-t border-x border-emerald-900/10'
                    : 'text-slate-600 hover:text-emerald-900'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setHubTab('activities')}
                className={`px-4 py-2.5 rounded-t-xl text-sm sm:text-base font-bold transition-colors whitespace-nowrap ${
                  hubTab === 'activities'
                    ? 'bg-[#f7f5ee] text-emerald-900 border-t border-x border-emerald-900/10'
                    : 'text-slate-600 hover:text-emerald-900'
                }`}
              >
                Learning Activities ({hud.completedIds.length}/{CALM_ACTIVITIES.length})
              </button>
              <button
                type="button"
                onClick={() => setHubTab('sound')}
                className={`px-4 py-2.5 rounded-t-xl text-sm sm:text-base font-bold transition-colors whitespace-nowrap ${
                  hubTab === 'sound'
                    ? 'bg-[#f7f5ee] text-emerald-900 border-t border-x border-emerald-900/10'
                    : 'text-slate-600 hover:text-emerald-900'
                }`}
              >
                Sound &amp; Comfort Settings
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto">
              {hubTab === 'main' && (
                <div>
                  <p className="text-base sm:text-lg text-slate-700 leading-relaxed mb-6">
                    Take a slow walk through a sunlit safe house, garden trail, gentle brook, and high-ground gazebo. Learn essential disaster preparedness habits—without timers, alarms, or pressure.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {canResume && (
                      <button
                        type="button"
                        onClick={enterExploration}
                        className="flex items-center gap-3.5 rounded-2xl bg-emerald-700 p-4 text-left text-white shadow-md hover:bg-emerald-800 transition-colors"
                      >
                        <Play className="h-6 w-6 fill-current shrink-0" />
                        <div>
                          <div className="text-lg font-extrabold">Resume Exploration</div>
                          <div className="text-xs text-emerald-100">
                            Continue right where you left off
                          </div>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={hasEnteredWorld ? restartExploration : enterExploration}
                      className={`flex items-center gap-3.5 rounded-2xl p-4 text-left transition-colors shadow-sm ${
                        canResume
                          ? 'border border-emerald-900/15 bg-white text-emerald-950 hover:bg-emerald-50'
                          : 'bg-emerald-700 text-white hover:bg-emerald-800 sm:col-span-2 lg:col-span-1'
                      }`}
                    >
                      {hasEnteredWorld ? (
                        <RotateCcw className="h-6 w-6 text-emerald-700 shrink-0" />
                      ) : (
                        <Compass className="h-6 w-6 shrink-0" />
                      )}
                      <div>
                        <div className="text-lg font-extrabold">
                          {hasEnteredWorld ? 'Start Fresh Walk' : 'Explore Environment'}
                        </div>
                        <div
                          className={`text-xs ${
                            canResume ? 'text-slate-600' : 'text-emerald-100'
                          }`}
                        >
                          {hasEnteredWorld
                            ? 'Reset exploration checklist'
                            : 'Enter sunlit 3D safe house & garden'}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setHubTab('activities')}
                      className="flex items-center gap-3.5 rounded-2xl border border-emerald-900/15 bg-white p-4 text-left text-emerald-950 shadow-sm hover:bg-emerald-50 transition-colors"
                    >
                      <BookOpen className="h-6 w-6 text-emerald-700 shrink-0" />
                      <div>
                        <div className="text-lg font-extrabold">Learning Activities</div>
                        <div className="text-xs text-slate-600">
                          8 hands-on preparedness lessons
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBreathingOpen(true)}
                      className="flex items-center gap-3.5 rounded-2xl border border-sky-700/20 bg-[#e0f2fe] p-4 text-left text-sky-950 shadow-sm hover:bg-sky-200/70 transition-colors"
                    >
                      <Wind className="h-6 w-6 text-sky-700 shrink-0" />
                      <div>
                        <div className="text-lg font-extrabold">Breathing Exercise</div>
                        <div className="text-xs text-sky-800">
                          Calming 4-4-6 &amp; Box breathing
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setHubTab('sound')}
                      className="flex items-center gap-3.5 rounded-2xl border border-emerald-900/15 bg-white p-4 text-left text-emerald-950 shadow-sm hover:bg-emerald-50 transition-colors"
                    >
                      <Sliders className="h-6 w-6 text-emerald-700 shrink-0" />
                      <div>
                        <div className="text-lg font-extrabold">Sound Settings</div>
                        <div className="text-xs text-slate-600">
                          Music, nature sounds &amp; accessibility
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.stopAmbient();
                        onExitToMenu();
                      }}
                      className="flex items-center gap-3.5 rounded-2xl border border-slate-300 bg-[#efede4] p-4 text-left text-slate-800 shadow-sm hover:bg-slate-200 transition-colors"
                    >
                      <ArrowLeft className="h-6 w-6 text-slate-700 shrink-0" />
                      <div>
                        <div className="text-lg font-extrabold">Return</div>
                        <div className="text-xs text-slate-600">Back to Main Menu</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {hubTab === 'activities' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <p className="text-sm sm:text-base text-slate-700">
                      Explore these stations in the 3D Safe House and Meadow, or jump straight to any lesson:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {CALM_ACTIVITIES.map((act) => {
                      const done = hud.completedIds.includes(act.id);
                      return (
                        <div
                          key={act.id}
                          className={`rounded-2xl border p-4 transition-colors ${
                            done
                              ? 'border-emerald-600/35 bg-[#ebf5ee]'
                              : 'border-emerald-900/12 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                                {act.category}
                              </span>
                              <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                                {act.title}
                              </h3>
                            </div>
                            {done && (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                            {act.shortHint}
                          </p>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => jumpToActivity(act)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap"
                            >
                              <Compass className="h-3.5 w-3.5" />
                              <span>Visit in 3D</span>
                            </button>
                            <span className="text-xs font-semibold text-slate-500">
                              {done ? 'Explored' : 'Not yet visited'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {hubTab === 'sound' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Peaceful Music Slider */}
                    <div className="rounded-2xl border border-emerald-900/12 bg-white p-5">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 font-bold text-emerald-950">
                          <Music className="h-5 w-5 text-emerald-700" />
                          <span>Peaceful Background Music</span>
                        </div>
                        <span className="text-sm font-bold text-emerald-700 tabular-nums">
                          {Math.round(calmMusicVol * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={calmMusicVol}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...settings,
                            calmMusicVolume: Number(e.target.value),
                          })
                        }
                        className="w-full accent-emerald-700"
                      />
                      <p className="text-xs text-slate-500 mt-1.5">
                        Soft ambient harmonic pad and gentle pentatonic notes
                      </p>
                    </div>

                    {/* Gentle Nature Ambience Slider */}
                    <div className="rounded-2xl border border-emerald-900/12 bg-white p-5">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 font-bold text-emerald-950">
                          <Trees className="h-5 w-5 text-emerald-700" />
                          <span>Nature Sounds (Breeze &amp; Birds)</span>
                        </div>
                        <span className="text-sm font-bold text-emerald-700 tabular-nums">
                          {Math.round(calmNatureVol * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={calmNatureVol}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...settings,
                            calmNatureVolume: Number(e.target.value),
                          })
                        }
                        className="w-full accent-emerald-700"
                      />
                      <p className="text-xs text-slate-500 mt-1.5">
                        Gentle wind through leaves, soft brook, and distant songbirds
                      </p>
                    </div>
                  </div>

                  {/* Accessibility & Audio Toggles */}
                  <div className="rounded-2xl border border-emerald-900/12 bg-white p-5 space-y-4">
                    <h3 className="font-display text-xl font-extrabold text-emerald-950 flex items-center gap-2">
                      <Eye className="h-5 w-5 text-emerald-700" />
                      <span>Accessibility &amp; Comfort</span>
                    </h3>

                    <label className="flex items-center justify-between gap-4 cursor-pointer">
                      <div>
                        <div className="font-bold text-slate-900">Mute All Audio</div>
                        <div className="text-sm text-slate-600">
                          Explore completely silently with visual prompts only
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.muted}
                        onChange={(e) =>
                          onUpdateSettings({ ...settings, muted: e.target.checked })
                        }
                        className="h-5 w-5 accent-emerald-700"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-4 cursor-pointer border-t border-slate-100 pt-3">
                      <div>
                        <div className="font-bold text-slate-900">Reduce Camera Motion</div>
                        <div className="text-sm text-slate-600">
                          Minimizes walking head-bob and lateral camera sway
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.reducedCameraMotion}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...settings,
                            reducedCameraMotion: e.target.checked,
                          })
                        }
                        className="h-5 w-5 accent-emerald-700"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-4 cursor-pointer border-t border-slate-100 pt-3">
                      <div>
                        <div className="font-bold text-slate-900">Reduce Screen &amp; Particle Effects</div>
                        <div className="text-sm text-slate-600">
                          Calms wind sway, floating sunlit motes, and pulsing glows
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={calmEffectsReduced}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...settings,
                            calmScreenEffectsReduced: e.target.checked,
                          })
                        }
                        className="h-5 w-5 accent-emerald-700"
                      />
                    </label>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={enterExploration}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-base font-bold text-white hover:bg-emerald-800 transition-colors"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Return to Exploration</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Guided Breathing Exercise Overlay */}
      <BreathingExerciseModal
        isOpen={breathingOpen}
        onClose={() => setBreathingOpen(false)}
        reducedEffects={calmEffectsReduced}
      />
    </div>
  );
}

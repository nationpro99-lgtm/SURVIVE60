import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronRight,
  Crosshair,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  createGameEngineState,
  GameEngineState,
  InputState,
  stepGameEngine,
  triggerInteraction,
} from '../game/engine';
import { renderMiniMap } from '../game/renderer';
import { ACHIEVEMENTS, DISASTER_META } from '../game/storage';
import {
  DisasterId,
  GameMode,
  GameSettings,
  InteractiveObject,
  LevelSummary,
  MissionObjective,
  PlayPhase,
  ToastFeedback,
} from '../game/types';
import {
  buildFirstPersonHands,
  FirstPersonHandRig,
  triggerHandAction,
  updateFirstPersonHands,
} from '../game3d/models';
import { buildWorld3D, WORLD_SCALE, World3DController } from '../game3d/worldBuilder';

interface PlayableLevelViewProps {
  disaster: DisasterId;
  mode: GameMode;
  settings: GameSettings;
  onUpdateSettings: (next: GameSettings) => void;
  onRunFinished: (
    summary: Omit<LevelSummary, 'newlyUnlockedAchievements'>,
    extraFlags: {
      usedProperCover?: boolean;
      soundedFireAlarm?: boolean;
      crouchedInSmoke?: boolean;
    }
  ) => string[];
  onNextDisaster: (next: DisasterId) => void;
  onOpenCoachWithSummary: (summary: Omit<LevelSummary, 'newlyUnlockedAchievements'>) => void;
  onExitToMenu: () => void;
}

interface HudSnapshot {
  hp: number;
  maxHp: number;
  stamina: number;
  timeRemaining: number;
  elapsed: number;
  score: number;
  safetyAccuracy: number;
  objectives: MissionObjective[];
  targetPrompt: string | null;
  targetName: string | null;
  targetTrainingTip: string | null;
  activeHazardWarning: string | null;
  inCover: boolean;
  crouching: boolean;
  running: boolean;
  inSmoke: boolean;
  inWater: boolean;
  damageFlash: number;
  toasts: ToastFeedback[];
  eqPhase: string;
}

const NEXT_DISASTER: Record<DisasterId, DisasterId> = {
  earthquake: 'flood',
  flood: 'fire',
  fire: 'earthquake',
};

const INITIAL_YAW: Record<DisasterId, number> = {
  earthquake: -Math.PI * 0.45,
  flood: 0,
  fire: -Math.PI * 0.42,
};

function AnimatedScoreNumber({ target }: { target: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const start = performance.now();
    const duration = 680;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(target * eased));
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target]);

  return <>{display}</>;
}

export function PlayableLevelView({
  disaster,
  mode,
  settings,
  onUpdateSettings,
  onRunFinished,
  onNextDisaster,
  onOpenCoachWithSummary,
  onExitToMenu,
}: PlayableLevelViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const miniMapRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngineState>(createGameEngineState(disaster, mode));
  const worldRef = useRef<World3DController | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const handRigRef = useRef<FirstPersonHandRig | null>(null);
  const isSoftwareGlRef = useRef(false);

  const inputRef = useRef<InputState>({
    up: false,
    down: false,
    left: false,
    right: false,
    joyX: 0,
    joyY: 0,
    actionHeld: false,
    sprintHeld: false,
    crouchHeld: false,
  });

  // First-person look angles & strafe lean
  const lookRef = useRef({ yaw: INITIAL_YAW[disaster], pitch: -0.04 });
  const dragLookRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });
  const touchLookRef = useRef<{ id: number | null; lastX: number; lastY: number }>({
    id: null,
    lastX: 0,
    lastY: 0,
  });
  const activeTargetIdRef = useRef<string | null>(null);

  const [runId, setRunId] = useState(0);
  const [phase, setPhase] = useState<PlayPhase>('active');
  const phaseRef = useRef<PlayPhase>('active');
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [showControlsInPause, setShowControlsInPause] = useState(false);
  const [mobileCrouchToggle, setMobileCrouchToggle] = useState(false);
  const [mobileSprintToggle, setMobileSprintToggle] = useState(false);
  const mobileCrouchRef = useRef(false);
  const mobileSprintRef = useRef(false);
  mobileCrouchRef.current = mobileCrouchToggle;
  mobileSprintRef.current = mobileSprintToggle;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [summary, setSummary] = useState<LevelSummary | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });
  const joyOriginRef = useRef<{ id: number; x: number; y: number } | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(() => ({
    hp: 100,
    maxHp: 100,
    stamina: 100,
    timeRemaining: 60,
    elapsed: 0,
    score: 1000,
    safetyAccuracy: 100,
    objectives: engineRef.current.objectives,
    targetPrompt: null,
    targetName: null,
    targetTrainingTip: null,
    activeHazardWarning: null,
    inCover: false,
    crouching: false,
    running: false,
    inSmoke: false,
    inWater: false,
    damageFlash: 0,
    toasts: [],
    eqPhase: 'tremor',
  }));

  const setPlayPhase = useCallback((next: PlayPhase) => {
    phaseRef.current = next;
    setPhase(next);
    if (next !== 'active' && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        // ignore pointer lock exit errors
      }
    }
  }, []);

  const performInteract = useCallback(() => {
    soundEngine.unlock();
    const kind = triggerInteraction(engineRef.current, activeTargetIdRef.current);
    if (handRigRef.current) {
      triggerHandAction(handRigRef.current, kind);
    }
  }, []);

  const resetLevel = useCallback(() => {
    engineRef.current = createGameEngineState(disaster, mode);
    lookRef.current = { yaw: INITIAL_YAW[disaster], pitch: -0.04 };
    inputRef.current = {
      up: false,
      down: false,
      left: false,
      right: false,
      joyX: 0,
      joyY: 0,
      actionHeld: false,
      sprintHeld: false,
      crouchHeld: false,
    };
    activeTargetIdRef.current = null;
    setMobileCrouchToggle(false);
    setMobileSprintToggle(false);
    setSummary(null);
    setShowControlsInPause(false);
    setPlayPhase('active');
    setRunId((n) => n + 1);
    soundEngine.unlock();
    soundEngine.startDisasterAmbient(disaster);
  }, [disaster, mode, setPlayPhase]);

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

  useEffect(() => {
    engineRef.current = createGameEngineState(disaster, mode);
    lookRef.current = { yaw: INITIAL_YAW[disaster], pitch: -0.04 };
    setSummary(null);
    setShowControlsInPause(false);
    setPlayPhase('active');
    soundEngine.unlock();
    soundEngine.startDisasterAmbient(disaster);
    return () => {
      soundEngine.stopAmbient();
    };
  }, [disaster, mode, setPlayPhase]);

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
    }
  }, [settings.graphicsQuality]);

  // Keyboard & Pointer Lock listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      soundEngine.unlock();
      const key = e.key.toLowerCase();

      if (key === 'escape') {
        e.preventDefault();
        if (phaseRef.current === 'active') {
          setPlayPhase('paused');
        } else if (phaseRef.current === 'paused') {
          setPlayPhase('active');
        }
        return;
      }

      if (phaseRef.current !== 'active') return;

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
      } else if (key === 'e') {
        e.preventDefault();
        if (!e.repeat) {
          performInteract();
        }
      } else if (e.code === 'Space') {
        e.preventDefault();
        inputRef.current.actionHeld = true;
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
      else if (e.code === 'Space') inputRef.current.actionHeld = false;
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
  }, [performInteract, setPlayPhase]);

  // --- MAIN THREE.JS 3D RENDER & SIMULATION LOOP ---
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
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGl && quality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'block h-full w-full cursor-crosshair';

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const world = buildWorld3D(renderer, engineRef.current, quality, isSoftwareGl);
    worldRef.current = world;

    const camera = new THREE.PerspectiveCamera(
      72,
      (mount.clientWidth || window.innerWidth) / (mount.clientHeight || window.innerHeight),
      0.08,
      145
    );
    camera.rotation.order = 'YXZ';
    camera.layers.enable(0);
    camera.layers.disable(1);

    // Attach articulated first-person hands & tactical flashlight onto camera
    const hands = buildFirstPersonHands(world.mats);
    handRigRef.current = hands;
    const flashlight = new THREE.SpotLight(0xfffbeb, 7.2, 20, Math.PI * 0.24, 0.55, 1.35);
    flashlight.position.set(0.24, -0.18, -0.45);
    const flashTarget = new THREE.Object3D();
    flashTarget.position.set(0, -0.05, -6);
    camera.add(hands.root, flashlight, flashTarget);
    flashlight.target = flashTarget;
    world.scene.add(camera);

    if (!isSoftwareGl) {
      renderer.compile(world.scene, camera);
    }

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    raycaster.far = 3.2;
    const screenCenter = new THREE.Vector2(0, 0);

    const canvasEl = renderer.domElement;
    const onCanvasMouseDown = (e: MouseEvent) => {
      if (phaseRef.current !== 'active') return;
      soundEngine.unlock();
      dragLookRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
      if (!document.pointerLockElement && canvasEl.requestPointerLock) {
        try {
          const maybePromise = canvasEl.requestPointerLock() as unknown as Promise<void> | undefined;
          if (maybePromise && typeof maybePromise.catch === 'function') {
            maybePromise.catch(() => {});
          }
        } catch {
          // fallback drag-to-look remains active
        }
      }
    };

    const onWindowMouseUp = () => {
      dragLookRef.current.active = false;
    };

    const onWindowMouseMove = (e: MouseEvent) => {
      if (phaseRef.current !== 'active') return;
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

      const sens = 0.0028;
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
    let eyeY = 1.65;
    let smoothedStrafeRoll = 0;
    let smoothedBobAmp = 0;

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
      lastTime = now;

      const engine = engineRef.current;
      const inp = inputRef.current;
      const strafe = (inp.right ? 1 : 0) - (inp.left ? 1 : 0) + inp.joyX;

      if (phaseRef.current === 'active' && !engine.finished) {
        const forward = (inp.up ? 1 : 0) - (inp.down ? 1 : 0) - inp.joyY;
        const yaw = lookRef.current.yaw;

        const worldMoveX = -Math.sin(yaw) * forward + Math.cos(yaw) * strafe;
        const worldMoveY = -Math.cos(yaw) * forward - Math.sin(yaw) * strafe;

        stepGameEngine(
          engine,
          {
            up: false,
            down: false,
            left: false,
            right: false,
            joyX: worldMoveX,
            joyY: worldMoveY,
            actionHeld: inp.actionHeld || (disaster === 'fire' && mobileCrouchRef.current),
            sprintHeld: Boolean(inp.sprintHeld) || mobileSprintRef.current,
            crouchHeld: Boolean(inp.crouchHeld) || mobileCrouchRef.current,
          },
          dt
        );

        engine.player.facingX = -Math.sin(yaw);
        engine.player.facingY = -Math.cos(yaw);

        if (engine.finished && engine.summary) {
          soundEngine.stopAmbient();
          const unlocked = onRunFinished(engine.summary, {
            usedProperCover: engine.usedProperCover,
            soundedFireAlarm: engine.soundedFireAlarm,
            crouchedInSmoke: engine.crouchedInSmoke,
          });
          setSummary({
            ...engine.summary,
            newlyUnlockedAchievements: unlocked,
          });
          setPlayPhase(engine.summary.victory ? 'victory' : 'gameover');
        }
      }

      // --- CINEMATIC CAMERA & EXPONENTIAL DAMPING ---
      const p = engine.player;
      const reducedMotion = settingsRef.current.reducedCameraMotion;
      const motionScale = reducedMotion ? 0.25 : 1.0;

      const targetEyeY = p.inCoverId
        ? 0.62
        : p.crouching
          ? 0.94
          : p.bracing
            ? 1.32
            : p.inWater
              ? 1.54
              : 1.65;
      eyeY = THREE.MathUtils.damp(eyeY, targetEyeY, 10, dt);

      // Smooth walk-to-run FOV widening
      const targetFov = 72 + p.runBlend * (reducedMotion ? 1.5 : 5.2);
      if (Math.abs(camera.fov - targetFov) > 0.03) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
        camera.updateProjectionMatrix();
      }

      // Smooth movement head-bobbing + strafe sway
      const speedMag = Math.hypot(p.vx, p.vy);
      const targetBobAmp =
        speedMag > 16 && !p.inCoverId
          ? (0.028 + p.runBlend * 0.024) * Math.min(1, speedMag / 160) * motionScale
          : 0;
      smoothedBobAmp = THREE.MathUtils.damp(smoothedBobAmp, targetBobAmp, 12, dt);

      const bobY = Math.sin(p.walkPhase * 2) * smoothedBobAmp;
      const bobX = Math.cos(p.walkPhase) * smoothedBobAmp * 0.65;
      const targetStrafeRoll =
        !p.inCoverId && speedMag > 20 ? -strafe * (0.015 + p.runBlend * 0.014) * motionScale : 0;
      smoothedStrafeRoll = THREE.MathUtils.damp(smoothedStrafeRoll, targetStrafeRoll, 9, dt);

      // Earthquake shake + impact recoil kick
      const shakeWorldX = engine.shakeOffsetX * 0.011 * motionScale;
      const shakeWorldY = engine.shakeOffsetY * 0.011 * motionScale;
      const recoilKickPitch = p.recoilIntensity * 0.055 * motionScale;
      const recoilRoll = Math.sin(engine.elapsed * 32) * p.recoilIntensity * 0.028 * motionScale;

      camera.position.set(
        p.x * WORLD_SCALE + bobX + shakeWorldX,
        eyeY + bobY + shakeWorldY - p.recoilIntensity * 0.04 * motionScale,
        p.y * WORLD_SCALE
      );
      camera.rotation.y = lookRef.current.yaw;
      camera.rotation.x = lookRef.current.pitch + recoilKickPitch + (p.inCoverId ? -0.14 : 0);
      camera.rotation.z =
        smoothedStrafeRoll +
        recoilRoll +
        (engine.disaster === 'earthquake' ? engine.shakeOffsetX * 0.0028 * motionScale : 0);

      // Update articulated first-person hand animations
      updateFirstPersonHands(hands, dt, engine.elapsed, {
        speedMag,
        walkPhase: p.walkPhase,
        runBlend: p.runBlend,
        crouching: p.crouching,
        inCover: Boolean(p.inCoverId),
        bracing: p.bracing,
        recoilIntensity: p.recoilIntensity,
        reducedMotion,
      });

      // Center-screen 3D Raycast against Layer 1 interactive proxies
      raycaster.setFromCamera(screenCenter, camera);
      const hits = raycaster.intersectObjects(world.raycastTargets, false);
      let rayInteractive: InteractiveObject | null = null;
      for (const hit of hits) {
        const hitId = hit.object.userData.interactiveId as string | undefined;
        if (!hitId) continue;
        const found = engine.interactives.find((o) => o.id === hitId);
        if (found && (!found.used || found.kind === 'cover_table')) {
          const distBp = Math.hypot(p.x - (found.x + found.w / 2), p.y - (found.y + found.h / 2));
          if (distBp <= found.radius + 52) {
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

      const mm = miniMapRef.current;
      if (mm) {
        const mmCtx = mm.getContext('2d');
        if (mmCtx) {
          renderMiniMap(mmCtx, engine, mm.width, mm.height);
        }
      }

      hudSyncAcc += dt;
      if (hudSyncAcc >= 0.065) {
        hudSyncAcc = 0;
        const isCoverToggle =
          activeTarget?.kind === 'cover_table' && engine.player.inCoverId === activeTarget.id;
        setHud({
          hp: Math.round(engine.player.hp),
          maxHp: engine.player.maxHp,
          stamina: Math.round(engine.player.stamina),
          timeRemaining: engine.timeRemaining,
          elapsed: engine.elapsed,
          score: Math.max(0, Math.round(engine.score)),
          safetyAccuracy: Math.max(0, Math.round(engine.safetyAccuracy)),
          objectives: engine.objectives.map((o) => ({ ...o })),
          targetPrompt: activeTarget
            ? isCoverToggle
              ? activeTarget.secondaryPrompt || 'Leave Cover'
              : activeTarget.prompt
            : null,
          targetName: activeTarget ? activeTarget.name : null,
          targetTrainingTip: activeTarget ? activeTarget.trainingTip : null,
          activeHazardWarning: engine.activeHazardWarning,
          inCover: Boolean(engine.player.inCoverId),
          crouching: engine.player.crouching,
          running: engine.player.running,
          inSmoke: engine.player.inSmoke,
          inWater: engine.player.inWater,
          damageFlash: engine.player.damageFlash,
          toasts: [...engine.toasts],
          eqPhase: engine.eqPhase,
        });
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      canvasEl.removeEventListener('mousedown', onCanvasMouseDown);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('resize', onResize);
      canvasEl.removeEventListener('webglcontextlost', onContextLost);
      canvasEl.removeEventListener('webglcontextrestored', onContextRestored);
      world.dispose();
      renderer.dispose();
      worldRef.current = null;
      rendererRef.current = null;
      handRigRef.current = null;
    };
  }, [disaster, mode, runId, onRunFinished, setPlayPhase]);

  // Mobile left-thumb movement joystick
  const handleJoyStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (phaseRef.current !== 'active') return;
    soundEngine.unlock();
    const touch = e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    joyOriginRef.current = {
      id: touch.identifier,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };

  const handleJoyMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const origin = joyOriginRef.current;
    if (!origin) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === origin.id) {
        const maxDist = 44;
        const dx = t.clientX - origin.x;
        const dy = t.clientY - origin.y;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(maxDist, dist);
        const angle = Math.atan2(dy, dx);
        const ox = Math.cos(angle) * clamped;
        const oy = Math.sin(angle) * clamped;
        setJoyOffset({ x: ox, y: oy });
        inputRef.current.joyX = ox / maxDist;
        inputRef.current.joyY = oy / maxDist;
      }
    }
  };

  const handleJoyEnd = () => {
    joyOriginRef.current = null;
    setJoyOffset({ x: 0, y: 0 });
    inputRef.current.joyX = 0;
    inputRef.current.joyY = 0;
  };

  // Mobile right-side touch-look pad
  const handleTouchLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (phaseRef.current !== 'active') return;
    const t = e.changedTouches[0];
    touchLookRef.current = { id: t.identifier, lastX: t.clientX, lastY: t.clientY };
  };

  const handleTouchLookMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchLookRef.current.id === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === touchLookRef.current.id) {
        const dx = t.clientX - touchLookRef.current.lastX;
        const dy = t.clientY - touchLookRef.current.lastY;
        touchLookRef.current.lastX = t.clientX;
        touchLookRef.current.lastY = t.clientY;
        lookRef.current.yaw -= dx * 0.0055;
        lookRef.current.pitch = Math.max(
          -Math.PI * 0.42,
          Math.min(Math.PI * 0.42, lookRef.current.pitch - dy * 0.0055)
        );
      }
    }
  };

  const handleTouchLookEnd = () => {
    touchLookRef.current.id = null;
  };

  const meta = DISASTER_META[disaster];
  const activeObjective =
    hud.objectives.find((o) => !o.completed) || hud.objectives[hud.objectives.length - 1];
  const hpStatus = hud.hp > 65 ? 'STABLE' : hud.hp > 30 ? 'CAUTION' : 'CRITICAL';
  const hpBarColor = hud.hp > 65 ? 'bg-emerald-500' : hud.hp > 30 ? 'bg-amber-500' : 'bg-red-500';
  const showTouchUI = isTouchDevice || settings.forceTouchControls;

  const contextActionLabel =
    disaster === 'fire'
      ? mobileCrouchToggle || hud.crouching
        ? 'LOW ON'
        : 'STAY LOW'
      : disaster === 'earthquake'
        ? 'BRACE'
        : 'DASH';

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#060a11] select-none">
      {/* 3D WebGL Viewport */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />

      {/* Mobile Touch-Look Overlay on Right Half */}
      {showTouchUI && phase === 'active' && (
        <div
          onTouchStart={handleTouchLookStart}
          onTouchMove={handleTouchLookMove}
          onTouchEnd={handleTouchLookEnd}
          onTouchCancel={handleTouchLookEnd}
          aria-label="Camera Look Area"
          className="absolute inset-y-0 right-0 left-1/2 z-10 touch-none"
        />
      )}

      {/* Damage, Water & Smoke Atmospheric Screen Vignettes */}
      {hud.damageFlash > 0.05 && (
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-opacity"
          style={{
            boxShadow: `inset 0 0 115px rgba(239, 68, 68, ${Math.min(0.88, hud.damageFlash * 0.88)})`,
          }}
        />
      )}
      {hud.inWater && (
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            boxShadow: 'inset 0 0 90px rgba(14, 165, 233, 0.32)',
          }}
        />
      )}
      {hud.inSmoke && !hud.crouching && (
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              'linear-gradient(to bottom, rgba(15, 23, 42, 0.72), rgba(15, 23, 42, 0.28) 65%, transparent)',
          }}
        />
      )}

      {/* Center First-Person Reticle & Raycast Prompt */}
      {phase === 'active' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center">
          <div
            className={`flex items-center justify-center transition-transform duration-150 ${
              hud.targetPrompt ? 'scale-125 text-amber-300' : 'text-slate-100/80'
            }`}
          >
            <Crosshair className="h-7 w-7 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.2} />
          </div>
          {hud.targetPrompt && (
            <div className="mt-4 rounded-xl border-2 border-amber-400/90 bg-[#080d17]/92 px-4 py-2 text-center shadow-2xl">
              <div className="text-base sm:text-lg font-extrabold text-amber-300">
                [E] {hud.targetPrompt}
              </div>
              {hud.targetName && (
                <div className="text-xs sm:text-sm font-semibold text-slate-200">{hud.targetName}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- HIGH-CONTRAST TOP HUD (No backdrop-blur over WebGL) --- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-5">
        <div className="pointer-events-auto rounded-xl border border-slate-700/90 bg-[#0a111d]/92 px-4 py-3 shadow-xl min-w-[205px] sm:min-w-[280px]">
          <div className="flex items-center justify-between gap-2 text-sm sm:text-base font-bold mb-1.5">
            <span className={meta.accentColor}>{meta.title}</span>
            <span className="text-slate-300 capitalize">{mode}</span>
          </div>

          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-sm sm:text-base font-bold text-slate-300">HEALTH</span>
            <span className="font-mono-tabular text-xl sm:text-2xl font-extrabold text-slate-50">
              {hud.hp}/{hud.maxHp}
            </span>
          </div>
          <div className="h-3 w-full rounded-md bg-slate-800 overflow-hidden mb-2">
            <div
              className={`h-full transition-all duration-150 ${hpBarColor}`}
              style={{ width: `${Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100))}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-300 mb-1">
            <span>STAMINA</span>
            <span className="font-mono-tabular text-sky-300">
              {hud.running ? 'SPRINTING' : hud.crouching ? 'CROUCHING' : `${hud.stamina}%`}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden mb-2">
            <div
              className="h-full bg-sky-400 transition-all duration-150"
              style={{ width: `${Math.max(0, Math.min(100, hud.stamina))}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 text-sm font-bold font-mono-tabular">
            <span
              className={
                hud.hp > 65 ? 'text-emerald-400' : hud.hp > 30 ? 'text-amber-400' : 'text-red-400'
              }
            >
              {hpStatus}
            </span>
            <span className="text-slate-200">SCORE {hud.score}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/90 bg-[#0a111d]/92 px-4 sm:px-6 py-3 shadow-xl text-center max-w-[220px] sm:max-w-md">
          <div className="text-xs sm:text-sm font-bold tracking-wider text-slate-300">
            {mode === 'survival' ? 'TIME REMAINING' : 'TRAINING MODE'}
          </div>
          <div
            className={`font-mono-tabular text-2xl sm:text-4xl font-extrabold leading-tight mt-0.5 ${
              mode === 'survival' && hud.timeRemaining <= 15
                ? 'text-red-400'
                : mode === 'training'
                  ? 'text-emerald-400'
                  : 'text-slate-50'
            }`}
          >
            {mode === 'survival' ? `${hud.timeRemaining.toFixed(1)}s` : `${hud.elapsed.toFixed(0)}s`}
          </div>
          <div className="text-sm sm:text-lg font-bold text-orange-300 mt-1 truncate">
            {activeObjective ? activeObjective.text : 'Reach Safe Zone'}
          </div>
        </div>

        <div className="pointer-events-auto flex items-start gap-2.5">
          <div className="hidden sm:block rounded-xl border border-slate-700/90 bg-[#0a111d]/92 p-1.5 shadow-xl">
            <canvas ref={miniMapRef} width={152} height={96} className="block rounded-lg w-[152px] h-[96px]" />
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setPlayPhase(phase === 'paused' ? 'active' : 'paused')}
              aria-label="Pause game"
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-[#0a111d]/92 text-slate-100 hover:bg-slate-800 transition-colors shadow-lg"
            >
              <Pause className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, muted: !settings.muted })}
              aria-label={settings.muted ? 'Unmute audio' : 'Mute audio'}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-[#0a111d]/92 text-slate-100 hover:bg-slate-800 transition-colors shadow-lg"
            >
              {settings.muted ? (
                <VolumeX className="h-5 w-5 text-slate-400" />
              ) : (
                <Volume2 className="h-5 w-5 text-orange-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* --- FLOATING TOAST FEEDBACK STACK --- */}
      <div className="pointer-events-none absolute top-40 sm:top-36 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 w-full max-w-xl px-4">
        {hud.activeHazardWarning && (
          <div className="flex items-center gap-2.5 rounded-xl border-2 border-red-500/80 bg-red-950/95 px-4 py-2 text-sm sm:text-base font-bold text-red-100 shadow-2xl">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <span>HAZARD: {hud.activeHazardWarning}</span>
          </div>
        )}
        {hud.toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl border px-4 py-2.5 text-sm sm:text-base font-bold shadow-2xl text-center ${
              t.tone === 'good'
                ? 'border-emerald-400/70 bg-emerald-950/95 text-emerald-100'
                : t.tone === 'danger'
                  ? 'border-red-400/80 bg-red-950/95 text-red-100'
                  : t.tone === 'warn'
                    ? 'border-amber-400/80 bg-amber-950/95 text-amber-100'
                    : 'border-sky-400/70 bg-slate-900/95 text-sky-100'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* --- BOTTOM OBJECTIVE & CONTROLS BAR --- */}
      <div
        className={`pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-2.5 px-4 ${
          showTouchUI ? 'bottom-40 sm:bottom-6' : 'bottom-5'
        }`}
      >
        {mode === 'training' && settings.showTrainingHints && hud.targetTrainingTip && (
          <div className="max-w-2xl rounded-xl border border-emerald-500/60 bg-[#0b1719]/95 px-5 py-2.5 text-base sm:text-lg font-semibold text-emerald-200 text-center shadow-xl">
            Safety Tip: {hud.targetTrainingTip}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-5 rounded-xl border border-slate-700/90 bg-[#0a111d]/92 px-5 py-3 shadow-2xl max-w-4xl">
          <div className="text-base sm:text-[20px] font-bold text-slate-100 text-center sm:text-left">
            <span className="text-orange-400 mr-2">OBJECTIVE:</span>
            <span>{activeObjective?.text}</span>
          </div>
          <span className="hidden sm:inline text-slate-600" aria-hidden="true">
            |
          </span>
          <div className="text-base sm:text-[18px] font-bold text-amber-300 whitespace-nowrap">
            {hud.targetPrompt
              ? `Press E: ${hud.targetPrompt}`
              : disaster === 'fire'
                ? 'Space / C: Stay Low · Shift: Run'
                : disaster === 'earthquake' && (hud.eqPhase === 'shaking' || hud.inCover)
                  ? 'Hold Space: Brace · C: Crouch'
                  : !showTouchUI && !isPointerLocked
                    ? 'Click/Drag Look · Shift Run · C Crouch'
                    : 'Shift Run · C Crouch'}
          </div>
        </div>
      </div>

      {/* --- MOBILE VIRTUAL JOYSTICK & ACTION BUTTONS --- */}
      {showTouchUI && phase === 'active' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex items-end justify-between px-4 sm:px-8">
          <div
            onTouchStart={handleJoyStart}
            onTouchMove={handleJoyMove}
            onTouchEnd={handleJoyEnd}
            onTouchCancel={handleJoyEnd}
            aria-label="Movement Joystick"
            className="pointer-events-auto relative h-32 w-32 sm:h-36 sm:w-36 rounded-full border-2 border-slate-400/70 bg-slate-900/80 flex items-center justify-center touch-none shadow-2xl"
          >
            <div
              className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-orange-500/90 border-2 border-orange-200 shadow-lg"
              style={{
                transform: `translate(${joyOffset.x}px, ${joyOffset.y}px)`,
              }}
            />
          </div>

          <div className="pointer-events-auto flex items-end gap-2.5 sm:gap-3.5">
            <button
              type="button"
              onClick={() => setMobileSprintToggle((prev) => !prev)}
              className={`h-16 w-16 rounded-full border-2 font-extrabold text-xs leading-tight flex items-center justify-center shadow-xl transition-colors ${
                mobileSprintToggle || hud.running
                  ? 'border-orange-200 bg-orange-500 text-slate-950'
                  : 'border-slate-500 bg-slate-900/90 text-slate-200'
              }`}
            >
              {mobileSprintToggle ? 'RUN ON' : 'RUN'}
            </button>

            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                if (disaster === 'fire') {
                  setMobileCrouchToggle((prev) => !prev);
                } else {
                  inputRef.current.actionHeld = true;
                }
              }}
              onTouchEnd={() => {
                if (disaster !== 'fire') {
                  inputRef.current.actionHeld = false;
                }
              }}
              onClick={() => {
                if (disaster === 'fire') {
                  setMobileCrouchToggle((prev) => !prev);
                }
              }}
              className={`h-20 w-20 rounded-full border-2 font-extrabold text-sm leading-tight flex items-center justify-center shadow-xl transition-colors ${
                mobileCrouchToggle || hud.crouching
                  ? 'border-sky-200 bg-sky-500 text-slate-950'
                  : 'border-amber-400/80 bg-slate-900/90 text-amber-200'
              }`}
            >
              {contextActionLabel}
            </button>

            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                performInteract();
              }}
              onClick={() => performInteract()}
              className={`h-24 w-24 rounded-full border-2 font-extrabold text-base flex flex-col items-center justify-center shadow-2xl transition-colors ${
                hud.targetPrompt
                  ? 'border-emerald-200 bg-emerald-500 text-slate-950'
                  : 'border-slate-500 bg-slate-900/90 text-slate-200'
              }`}
            >
              <span>USE</span>
              {hud.targetPrompt && (
                <span className="text-xs font-bold max-w-[82px] truncate px-1 mt-0.5">
                  {hud.targetPrompt}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* --- PAUSE OVERLAY --- */}
      {phase === 'paused' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/82 p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0d1523] p-6 sm:p-7 shadow-2xl space-y-5 my-auto"
          >
            <div className="text-center">
              <h2 className="font-display text-4xl font-extrabold text-slate-50">Game Paused</h2>
              <p className="text-base text-slate-300 mt-1">
                {meta.title} · {mode === 'survival' ? 'Survival Mode' : 'Training Mode'}
              </p>
            </div>

            {showControlsInPause ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 text-base text-slate-200 space-y-3">
                <div className="text-lg font-bold text-slate-50">First-Person 3D Controls</div>
                <div>Walk: WASD / Arrow Keys / Mobile Joystick</div>
                <div>Run / Sprint: Hold Shift / Mobile RUN Toggle</div>
                <div>Crouch: Hold C / Ctrl (or Space in Office Fire)</div>
                <div>Look Around: Click View (Mouse Look) or Click-Drag / Right-Side Touch</div>
                <div>Interact: Aim Crosshair + Press E / USE Button</div>
                <div>Context Action: Space (Stay Low in Fire, Brace in Quake, Dash in Flood)</div>
                <div>Pause: Escape</div>
                <button
                  type="button"
                  onClick={() => setShowControlsInPause(false)}
                  className="mt-3 w-full rounded-xl bg-slate-800 py-3 text-base font-bold text-slate-100 hover:bg-slate-700"
                >
                  Back to Pause Menu
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setPlayPhase('active')}
                    className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-orange-500 py-3.5 text-lg font-bold text-slate-950 hover:bg-orange-400 transition-colors"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    <span>Resume</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetLevel}
                    className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-slate-800 py-3.5 text-lg font-bold text-slate-100 hover:bg-slate-700 transition-colors"
                  >
                    <RotateCcw className="h-5 w-5" />
                    <span>Restart Level</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowControlsInPause(true)}
                    className="w-full rounded-xl border border-slate-700 py-3 text-lg font-semibold text-slate-100 hover:bg-slate-800 transition-colors"
                  >
                    Controls
                  </button>
                </div>

                {/* Graphics Quality & Comfort Camera */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
                  <div className="text-base font-bold text-slate-100">3D Graphics Quality</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, graphicsQuality: q })}
                        className={`rounded-lg py-2 text-sm font-bold capitalize transition-colors ${
                          settings.graphicsQuality === q
                            ? 'bg-orange-500 text-slate-950'
                            : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-sm font-bold text-slate-200">Reduce Camera Motion</span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          ...settings,
                          reducedCameraMotion: !settings.reducedCameraMotion,
                        })
                      }
                      className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                        settings.reducedCameraMotion
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {settings.reducedCameraMotion ? 'Reduced' : 'Standard'}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-base">
                    <span className="font-bold text-slate-100">Audio Volume</span>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, muted: !settings.muted })}
                      className="text-orange-400 hover:text-orange-300 font-bold"
                    >
                      {settings.muted ? 'Unmute' : 'Mute'}
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.masterVolume * 100)}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, masterVolume: Number(e.target.value) / 100 })
                    }
                    className="w-full h-3 accent-orange-500 cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.stopAmbient();
                    onExitToMenu();
                  }}
                  className="w-full rounded-xl border border-slate-700 py-3 text-base font-semibold text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
                >
                  Return to Main Menu
                </button>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* --- CINEMATIC VICTORY / GAME OVER SCREEN --- */}
      {(phase === 'victory' || phase === 'gameover') && summary && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/88 p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.24 }}
            className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-[#0c1422] p-6 sm:p-8 shadow-2xl my-auto"
          >
            <div className="flex items-start gap-4 mb-7">
              <div
                className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 ${
                  summary.victory
                    ? 'bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/20'
                    : 'bg-red-500/20 text-red-400 shadow-lg shadow-red-500/20'
                }`}
              >
                {summary.victory ? (
                  <ShieldCheck className="h-9 w-9" />
                ) : (
                  <ShieldAlert className="h-9 w-9" />
                )}
              </div>
              <div>
                <div className="text-sm sm:text-base font-bold text-slate-300">
                  {meta.title} · {summary.mode === 'survival' ? 'Survival Mode' : 'Training Mode'}
                </div>
                <h2 className="font-display text-4xl sm:text-[44px] font-extrabold tracking-tight text-slate-50 leading-none mt-1">
                  {summary.victory ? 'SURVIVAL COMPLETED' : 'SURVIVAL FAILED'}
                </h2>
                {!summary.victory && summary.failureReason && (
                  <p className="text-base sm:text-lg font-medium text-red-300 mt-2 leading-snug">
                    {summary.failureReason}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4">
                <div className="text-sm font-medium text-slate-300">Final Score</div>
                <div className="font-mono-tabular text-3xl sm:text-4xl font-extrabold text-orange-400 mt-1">
                  <AnimatedScoreNumber target={summary.score} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4">
                <div className="text-sm font-medium text-slate-300">Time Survived</div>
                <div className="font-mono-tabular text-3xl sm:text-4xl font-extrabold text-slate-100 mt-1">
                  {summary.timeSurvived.toFixed(1)}s
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4">
                <div className="text-sm font-medium text-slate-300">Safety Accuracy</div>
                <div className="font-mono-tabular text-3xl sm:text-4xl font-extrabold text-emerald-400 mt-1">
                  {summary.safetyAccuracy}%
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4">
                <div className="text-sm font-medium text-slate-300">Objectives</div>
                <div className="font-mono-tabular text-2xl font-bold text-slate-100 mt-1">
                  {summary.objectivesCompleted}/{summary.totalObjectives}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4">
                <div className="text-sm font-medium text-slate-300">Hazards Avoided</div>
                <div className="font-mono-tabular text-2xl font-bold text-sky-400 mt-1">
                  {summary.hazardsAvoided}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4">
                <div className="text-sm font-medium text-slate-300">Damage Received</div>
                <div className="font-mono-tabular text-2xl font-bold text-red-400 mt-1">
                  {Math.round(summary.damageTaken)} HP
                </div>
              </div>
            </div>

            {summary.newlyUnlockedAchievements.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border-2 border-amber-400/60 bg-amber-500/15 p-4 mb-6 shadow-lg shadow-amber-500/10"
              >
                <div className="flex items-center gap-2.5 text-base font-extrabold text-amber-300 mb-1.5">
                  <Award className="h-5 w-5" />
                  <span>Achievement Unlocked!</span>
                </div>
                <div className="flex flex-wrap gap-4 text-base font-semibold text-amber-100">
                  {summary.newlyUnlockedAchievements.map((id) => {
                    const def = ACHIEVEMENTS.find((a) => a.id === id);
                    return <span key={id}>· {def?.title || id}</span>;
                  })}
                </div>
              </motion.div>
            )}

            <div className="rounded-xl border border-slate-800 bg-[#070c14] p-5 mb-7">
              <h3 className="text-base font-bold text-slate-100 mb-3">Key Safety Lessons</h3>
              <ul className="space-y-2 text-base sm:text-lg text-slate-200">
                {summary.lessonsLearned.map((lesson, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-1" />
                    <span>{lesson}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpenCoachWithSummary(summary)}
                className="rounded-xl border border-sky-500/60 bg-sky-500/15 px-5 py-3 text-base sm:text-lg font-bold text-sky-200 hover:bg-sky-500/25 transition-colors whitespace-nowrap shrink-0"
              >
                AI Coach Debrief
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={resetLevel}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-base sm:text-lg font-bold text-slate-100 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-5 w-5" />
                  <span>{summary.victory ? 'Replay' : 'Retry'}</span>
                </button>

                {summary.victory && (
                  <button
                    type="button"
                    onClick={() => onNextDisaster(NEXT_DISASTER[disaster])}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-base sm:text-lg font-extrabold text-slate-950 hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/25 whitespace-nowrap shrink-0"
                  >
                    <span>Next Disaster</span>
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.stopAmbient();
                    onExitToMenu();
                  }}
                  className="rounded-xl border border-slate-700 px-5 py-3 text-base sm:text-lg font-semibold text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  Main Menu
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

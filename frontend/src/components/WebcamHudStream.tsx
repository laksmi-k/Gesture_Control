import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { Camera, CameraOff, Maximize2, RefreshCw, ScanFace, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { classifyLandmarks, demoLandmarks, loadClassifier, predictionForDemo, unknownPrediction, type GestureKey, type GesturePrediction, type Landmark } from "@/lib/gesture";
import type * as tf from "@tensorflow/tfjs";

interface WebcamHudStreamProps {
  onGesture: (prediction: GesturePrediction) => void;
}

type CameraMode = "idle" | "loading" | "live" | "demo" | "error";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const HAND_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const DEMO_SEQUENCE: Array<Exclude<GestureKey, "unknown">> = ["open-hand", "point-right", "point-left", "thumbs-up", "closed-fist"];
const BONES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") return "CAMERA ACCESS DENIED // Allow camera permission, then retry.";
  if (name === "NotFoundError") return "NO OPTIC SENSOR FOUND // Connect a webcam, then retry.";
  if (name === "NotReadableError") return "OPTIC SENSOR BUSY // Close other camera apps, then retry.";
  if (!window.isSecureContext) return "SECURE CONTEXT REQUIRED // Open this console over HTTPS or localhost.";
  return "SENSOR INITIALIZATION FAILED // Use demo simulation or retry.";
}

function drawLandmarks(canvas: HTMLCanvasElement | null, points: Landmark[] | null, showOverlay: boolean) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = canvas.clientWidth || 640;
  const height = canvas.clientHeight || 360;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  if (!points || !showOverlay) return;
  const pointAt = (point: Landmark) => ({ x: point.x * width, y: point.y * height });
  context.lineWidth = 1.5;
  context.strokeStyle = "rgba(0, 240, 255, 0.68)";
  context.shadowBlur = 8;
  context.shadowColor = "#00F0FF";
  BONES.forEach(([from, to]) => {
    const start = pointAt(points[from]);
    const end = pointAt(points[to]);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  });
  points.forEach((point, index) => {
    const position = pointAt(point);
    context.beginPath();
    context.fillStyle = index === 0 ? "#10B981" : "#00F0FF";
    context.arc(position.x, position.y, index === 0 ? 5 : 3.5, 0, Math.PI * 2);
    context.fill();
  });
  context.shadowBlur = 0;
}

export default function WebcamHudStream({ onGesture }: WebcamHudStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const modelRef = useRef<tf.LayersModel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const demoTimerRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const busyRef = useRef(false);
  const stableKeyRef = useRef<GestureKey>("unknown");
  const stableCountRef = useRef(0);
  const lastDispatchRef = useRef(0);
  const fpsRef = useRef({ last: performance.now(), frames: 0 });
  const [mode, setMode] = useState<CameraMode>("idle");
  const [status, setStatus] = useState("STANDBY // OPTIC SENSOR READY");
  const [prediction, setPrediction] = useState<GesturePrediction>(unknownPrediction());
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [mirrored, setMirrored] = useState(true);
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);

  const stopAll = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (demoTimerRef.current !== null) window.clearInterval(demoTimerRef.current);
    demoTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    videoRef.current?.pause();
    if (videoRef.current) videoRef.current.srcObject = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    modelRef.current?.dispose();
    modelRef.current = null;
    setMode("idle");
    setStatus("STANDBY // OPTIC SENSOR READY");
    setLandmarks(null);
    drawLandmarks(canvasRef.current, null, showOverlay);
  };

  useEffect(() => () => stopAll(), []);

  const dispatchIfStable = (next: GesturePrediction) => {
    if (next.key === "unknown") {
      stableCountRef.current = 0;
      stableKeyRef.current = "unknown";
      return;
    }
    if (stableKeyRef.current === next.key) stableCountRef.current += 1;
    else {
      stableKeyRef.current = next.key;
      stableCountRef.current = 1;
    }
    const cooldown = next.key === "point-right" || next.key === "point-left" ? 700 : 1100;
    if (stableCountRef.current >= 3 && performance.now() - lastDispatchRef.current > cooldown) {
      lastDispatchRef.current = performance.now();
      onGesture(next);
    }
  };

  const processFrame = async () => {
    const video = videoRef.current;
    const detector = landmarkerRef.current;
    if (!video || !detector) return;
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastVideoTimeRef.current && !busyRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      busyRef.current = true;
      const startedAt = performance.now();
      const result: HandLandmarkerResult = detector.detectForVideo(video, performance.now());
      const points = (result.landmarks[0] as Landmark[] | undefined) ?? null;
      setLandmarks(points);
      drawLandmarks(canvasRef.current, points, showOverlay);
      const next = points ? await classifyLandmarks(points, modelRef.current) : unknownPrediction();
      setPrediction(next);
      setLatency(Math.round(performance.now() - startedAt));
      if (points) dispatchIfStable(next);
      fpsRef.current.frames += 1;
      if (performance.now() - fpsRef.current.last > 1000) {
        setFps(fpsRef.current.frames);
        fpsRef.current = { last: performance.now(), frames: 0 };
      }
      busyRef.current = false;
    }
    frameRef.current = requestAnimationFrame(() => void processFrame());
  };

  const startCamera = async () => {
    stopAll();
    setMode("loading");
    setStatus("INITIALIZING // LOADING MEDIAPIPE TASKS");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API unavailable");
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const [detector, model, stream] = await Promise.all([
        HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }),
        loadClassifier(),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
      ]);
      landmarkerRef.current = detector;
      modelRef.current = model;
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("Video element unavailable");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setMode("live");
      setStatus(model ? "LIVE // MEDIAPIPE + CUSTOM TF.JS MODEL" : "LIVE // MEDIAPIPE + TF.JS LOCAL CLASSIFIER");
      frameRef.current = requestAnimationFrame(() => void processFrame());
    } catch (error) {
      stopAll();
      setMode("error");
      setStatus(cameraErrorMessage(error));
    }
  };

  const startDemo = () => {
    stopAll();
    setMode("demo");
    setStatus("DEMO SIMULATION // LOCAL LANDMARK STREAM");
    let sequenceIndex = 0;
    const publish = () => {
      const key = DEMO_SEQUENCE[sequenceIndex % DEMO_SEQUENCE.length];
      const next = predictionForDemo(key);
      setPrediction(next);
      const points = demoLandmarks(key);
      setLandmarks(points);
      drawLandmarks(canvasRef.current, points, showOverlay);
      onGesture(next);
      sequenceIndex += 1;
    };
    publish();
    demoTimerRef.current = window.setInterval(publish, 2200);
  };

  const startOrStop = () => {
    if (mode === "live" || mode === "demo" || mode === "loading") stopAll();
    else void startCamera();
  };

  const percent = Math.round(prediction.confidence * 100);
  return (
    <section className="hud-panel hud-brackets flex min-h-[470px] flex-col overflow-hidden" data-testid="webcam-stream-container">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="relative grid size-8 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/5" data-testid="vision-sensor-icon">
            <ScanFace className="size-4 text-cyan-300" />
            <span className="absolute inset-0 animate-ping rounded-full border border-cyan-300/20" />
          </div>
          <div>
            <p className="metric-label" data-testid="vision-panel-kicker">VISION INPUT</p>
            <p className="mt-1 text-sm font-semibold tracking-wide text-slate-100" data-testid="vision-panel-title">Hand landmark stream</p>
          </div>
        </div>
        <Badge variant="outline" className={`${mode === "live" || mode === "demo" ? "border-emerald-400/40 text-emerald-300" : "border-amber-400/35 text-amber-300"} gap-1.5 rounded-full font-mono text-[10px] tracking-wider`} data-testid="camera-status-badge">
          <span className="size-1.5 rounded-full bg-current" /> {mode === "live" ? "CAMERA LIVE" : mode === "demo" ? "DEMO ACTIVE" : mode === "error" ? "ATTENTION" : "STANDBY"}
        </Badge>
      </div>

      <div className="relative mx-4 mt-4 aspect-video overflow-hidden rounded-sm border border-white/10 bg-[#06070A] sm:mx-5" data-testid="webcam-viewport">
        <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`} data-testid="webcam-video-element" />
        <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 h-full w-full ${mirrored ? "-scale-x-100" : ""}`} data-testid="landmark-canvas-overlay" aria-label="Live hand landmark visualization" />
        <div className="scanline pointer-events-none absolute inset-0" />
        <div className="hud-corner hud-corner-tl" />
        <div className="hud-corner hud-corner-tr" />
        <div className="hud-corner hud-corner-bl" />
        <div className="hud-corner hud-corner-br" />
        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 font-mono text-[10px] tracking-widest text-slate-400" data-testid="tracking-status-label">
          <span className={`size-2 rounded-full ${landmarks ? "bg-emerald-400 shadow-[0_0_10px_#10B981]" : "bg-amber-400 animate-pulse"}`} />
          {landmarks ? "TARGET ACQUIRED // 21 NODES" : "SEARCHING TARGET // PLACE HAND IN RETICLE"}
        </div>
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div className="rounded-sm border border-cyan-300/25 bg-[#08090C]/80 px-3 py-2 backdrop-blur" data-testid="current-gesture-hud-badge">
            <p className="metric-label text-cyan-300/70">CURRENT GESTURE</p>
            <p className="mt-1 font-mono text-sm font-bold tracking-wider text-white">{prediction.label}</p>
          </div>
          <div className="min-w-32 rounded-sm border border-white/10 bg-[#08090C]/80 px-3 py-2 backdrop-blur" data-testid="confidence-meter-bar">
            <div className="flex items-center justify-between gap-3"><span className="metric-label">CONFIDENCE</span><span className="font-mono text-xs text-cyan-300">{percent}%</span></div>
            <div className="mt-2 flex gap-1" aria-label={`Confidence ${percent}%`}>
              {Array.from({ length: 10 }, (_, index) => <span key={index} className={`h-1.5 flex-1 ${index < Math.round(percent / 10) ? "bg-cyan-300 shadow-[0_0_7px_#00F0FF]" : "bg-white/10"}`} />)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 py-3 sm:px-5" data-testid="vision-telemetry-row">
        <div className="telemetry-cell" data-testid="vision-fps-value"><span className="metric-label">FPS</span><strong>{mode === "demo" ? "60" : fps || "--"}</strong></div>
        <div className="telemetry-cell" data-testid="vision-latency-value"><span className="metric-label">LATENCY</span><strong>{mode === "demo" ? "08" : latency || "--"}<small> ms</small></strong></div>
        <div className="telemetry-cell" data-testid="vision-engine-value"><span className="metric-label">ENGINE</span><strong>{mode === "live" ? "GPU" : mode === "demo" ? "SIM" : "--"}</strong></div>
      </div>
      {mode === "error" && <div className="mx-4 mb-3 rounded-sm border border-rose-400/25 bg-rose-400/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-rose-200 sm:mx-5" data-testid="camera-permission-banner">{status}</div>}
      {mode === "loading" && <div className="mx-4 mb-3 flex items-center gap-2 rounded-sm border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 font-mono text-[11px] text-cyan-200 sm:mx-5" data-testid="camera-loading-banner"><RefreshCw className="size-3 animate-spin" />{status}</div>}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-white/8 px-4 py-3 sm:px-5">
        <Button size="sm" onClick={startOrStop} className="gap-2 rounded-sm bg-cyan-300 text-[#071014] hover:bg-cyan-200" data-testid={mode === "live" || mode === "demo" || mode === "loading" ? "camera-stop-button" : "camera-start-button"}>
          {mode === "live" || mode === "demo" || mode === "loading" ? <CameraOff className="size-3.5" /> : <Camera className="size-3.5" />}
          {mode === "live" || mode === "demo" || mode === "loading" ? "Stop sensor" : "Start sensor"}
        </Button>
        <Button size="sm" variant="outline" onClick={startDemo} className="gap-2 rounded-sm border-white/12 bg-transparent text-slate-300 hover:border-cyan-300/40 hover:bg-cyan-300/5 hover:text-cyan-200" data-testid="demo-simulation-button"><Sparkles className="size-3.5" />Demo simulation</Button>
        <Button size="icon-sm" variant="ghost" onClick={() => setMirrored((value) => !value)} className="ml-auto rounded-sm text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Toggle mirrored camera" data-testid="mirror-video-button"><RefreshCw className="size-4" /></Button>
        <Button size="icon-sm" variant="ghost" onClick={() => setShowOverlay((value) => !value)} className="rounded-sm text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Toggle landmark overlay" data-testid="landmark-toggle-switch"><ScanFace className={`size-4 ${showOverlay ? "text-cyan-300" : ""}`} /></Button>
        <Button size="icon-sm" variant="ghost" className="rounded-sm text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Fullscreen vision viewport" data-testid="vision-fullscreen-button" onClick={() => void document.querySelector<HTMLElement>("[data-testid='webcam-viewport']")?.requestFullscreen()}><Maximize2 className="size-4" /></Button>
      </div>
    </section>
  );
}
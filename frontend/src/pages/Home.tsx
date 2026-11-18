import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Command, HelpCircle, RotateCcw, ShieldCheck, Zap } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import GestureReferenceModal from "../components/GestureReferenceModal";
import PresentationDeck, { type Slide } from "../components/PresentationDeck";
import WebcamHudStream from "../components/WebcamHudStream";
import { GESTURE_ACTION_NAMES, GESTURE_REFERENCE, type GesturePrediction } from "../lib/gesture";
import { useGestureSocket } from "../lib/gestureSocket";

const SLIDES: Slide[] = [
  { index: 1, title: "Autonomous Touchless Interfaces", subtitle: "Computer vision and 21-point skeletal coordinate processing", badge: "01 // SYSTEM OVERVIEW", image: "https://images.unsplash.com/photo-1674027444485-cec3da58eef4?auto=format&fit=crop&w=1400&q=80", highlights: ["Edge landmark extraction", "21-node tensor mapping", "Touch-free interaction"] },
  { index: 2, title: "Deep Neural Network Architecture", subtitle: "Multilayer perception for real-time pose classification", badge: "02 // NEURAL PIPELINE", image: "https://images.unsplash.com/photo-1697577418970-95d99b5a55cf?auto=format&fit=crop&w=1400&q=80", highlights: ["Wrist-relative features", "Scale-resistant vectors", "Sub-15ms inference"] },
  { index: 3, title: "Real-time Command Dispatcher", subtitle: "Debounced state machines reject false-positive triggers", badge: "03 // HCI PROTOCOL", image: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1400&q=80", highlights: ["Stability consensus", "Temporal hysteresis", "Directional commands"] },
  { index: 4, title: "Industry Deployments & Impact", subtitle: "Keynotes, healthcare theatres, and smart labs without touch", badge: "04 // APPLICATION HORIZONS", image: "https://images.unsplash.com/photo-1582192730841-2a682d7375f9?auto=format&fit=crop&w=1400&q=80", highlights: ["Hands-free navigation", "Sterile environments", "Universal accessibility"] },
];

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [lastCommand, setLastCommand] = useState("");
  const [trackingArmed, setTrackingArmed] = useState(true);
  const { sendAction } = useGestureSocket();

  const goNext = useCallback(() => setCurrentIndex((index) => Math.min(index + 1, SLIDES.length - 1)), []);
  const goPrev = useCallback(() => setCurrentIndex((index) => Math.max(index - 1, 0)), []);
  const resetDeck = useCallback(() => { setCurrentIndex(0); setIsPlaying(false); setBookmarked(false); setLastCommand("DECK RESET"); }, []);
  const handleGesture = useCallback((prediction: GesturePrediction) => {
    if (!trackingArmed) return;
    const actionName = GESTURE_ACTION_NAMES[prediction.key];
    if (actionName) sendAction(actionName);
    if (prediction.key === "point-right") { goNext(); setLastCommand(`NEXT SLIDE DETECTED // ${Math.round(prediction.confidence * 100)}%`); }
    if (prediction.key === "point-left") { goPrev(); setLastCommand(`PREVIOUS SLIDE DETECTED // ${Math.round(prediction.confidence * 100)}%`); }
    if (prediction.key === "open-hand") { setIsPlaying((playing) => !playing); setLastCommand(`PLAY/PAUSE DISPATCHED // ${Math.round(prediction.confidence * 100)}%`); }
    if (prediction.key === "thumbs-up") { setBookmarked(true); setLastCommand(`SLIDE ${String(currentIndex + 1).padStart(2, "0")} BOOKMARKED`); }
    if (prediction.key === "closed-fist") { setTrackingArmed(false); setLastCommand("STANDBY // GESTURE INPUT PAUSED"); }
  }, [currentIndex, goNext, goPrev, sendAction, trackingArmed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === " ") { event.preventDefault(); setIsPlaying((playing) => !playing); }
      if (event.key.toLowerCase() === "c") setTrackingArmed((armed) => !armed);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(goNext, 5000);
    return () => window.clearInterval(timer);
  }, [goNext, isPlaying]);

  const activeGestureText = useMemo(() => GESTURE_REFERENCE.find((gesture) => gesture.key === "open-hand")?.action ?? "Play / pause deck", []);

  return (
    <div className="min-h-svh bg-[#08090C] text-slate-100" data-testid="app-shell">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0A0D14]/90 px-4 backdrop-blur-xl sm:px-6" data-testid="app-header">
        <div className="mx-auto flex h-16 max-w-[1720px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3" data-testid="app-brand-logo">
            <div className="grid size-9 shrink-0 place-items-center rounded-sm border border-cyan-300/35 bg-cyan-300/5 shadow-[0_0_24px_rgba(0,240,255,.12)]"><Command className="size-4 text-cyan-300" /></div>
            <div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate font-[family-name:var(--font-display)] text-sm font-bold tracking-[0.12em] text-white sm:text-base">GESTURE<span className="text-cyan-300">OS</span> <span className="text-slate-500">AI</span></h1><Badge variant="outline" className="hidden border-cyan-300/25 px-1.5 py-0 font-mono text-[9px] tracking-wider text-cyan-300/80 sm:inline-flex">MVP // 0.1</Badge></div><p className="hidden font-mono text-[9px] tracking-[0.16em] text-slate-500 sm:block">TOUCHLESS COMMAND CONSOLE</p></div>
          </div>
          <div className="hidden items-center gap-2 lg:flex" data-testid="header-telemetry-group">
            <div className="telemetry-pill" data-testid="telemetry-fps-badge"><Activity className="size-3 text-emerald-300" /><span>FPS 60</span></div>
            <div className="telemetry-pill" data-testid="telemetry-latency-badge"><Zap className="size-3 text-amber-300" /><span>LATENCY 08MS</span></div>
            <div className="telemetry-pill" data-testid="telemetry-camera-badge"><span className={`size-1.5 rounded-full ${trackingArmed ? "bg-emerald-400" : "bg-amber-400"}`} /><span>{trackingArmed ? "INPUT ARMED" : "STANDBY"}</span></div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden items-center gap-2 border-r border-white/10 pr-3 text-right xl:flex" data-testid="header-mode-info"><p className="metric-label">MODE</p><p className="font-mono text-[10px] text-slate-300">MEDIAPIPE GPU</p></div>
            <Button variant="ghost" size="sm" onClick={() => setGuideOpen(true)} className="gap-2 rounded-sm text-slate-400 hover:bg-white/5 hover:text-cyan-200" data-testid="gesture-guide-modal-trigger"><HelpCircle className="size-4" /><span className="hidden sm:inline">Gesture guide</span></Button>
            <Button variant="ghost" size="icon-sm" onClick={resetDeck} className="rounded-sm text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Reset console" data-testid="console-reset-button"><RotateCcw className="size-4" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1720px] px-4 py-5 sm:px-6 sm:py-7">
        <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end" data-testid="workspace-intro">
          <div><p className="metric-label text-cyan-300/75" data-testid="workspace-kicker">COMMAND WORKSPACE // LOCAL INFERENCE</p><h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-extrabold uppercase tracking-tight text-white sm:text-3xl" data-testid="workspace-title">Control the room without touching it.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400" data-testid="workspace-description">A focused computer-vision cockpit for hand landmarks, gesture intent, and presentation flow. Video stays in this browser.</p></div>
          <div className="flex items-center gap-2 self-start rounded-sm border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 font-mono text-[10px] tracking-wider text-emerald-300 md:self-auto" data-testid="privacy-status"><ShieldCheck className="size-3.5" />LOCAL PROCESSING // NO VIDEO UPLOAD</div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-7"><WebcamHudStream onGesture={handleGesture} /></div>
          <div className="lg:col-span-5"><PresentationDeck slides={SLIDES} currentIndex={currentIndex} isPlaying={isPlaying} bookmarked={bookmarked} lastCommand={lastCommand} onSelect={setCurrentIndex} onPrev={goPrev} onNext={goNext} onTogglePlay={() => setIsPlaying((playing) => !playing)} onReset={resetDeck} onBookmark={() => { setBookmarked(true); setLastCommand(`SLIDE ${String(currentIndex + 1).padStart(2, "0")} BOOKMARKED`); }} /></div>
        </div>

        <section className="mt-5 hud-panel" data-testid="gesture-matrix-panel">
          <div className="flex flex-col justify-between gap-3 border-b border-white/8 px-4 py-4 sm:flex-row sm:items-center sm:px-5"><div><p className="metric-label text-slate-500" data-testid="gesture-matrix-kicker">COMMAND VOCABULARY</p><h2 className="mt-1 text-base font-semibold tracking-wide text-slate-200" data-testid="gesture-matrix-title">Gesture matrix</h2></div><div className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-slate-500" data-testid="gesture-matrix-tip"><span className="size-1.5 rounded-full bg-cyan-300" />{activeGestureText}<span className="text-slate-700">//</span> hold pose to dispatch</div></div>
          <div className="grid grid-cols-2 divide-x divide-y divide-white/8 sm:grid-cols-5 sm:divide-y-0">
            {GESTURE_REFERENCE.map((gesture) => <div key={gesture.key} className="group p-4 transition-colors hover:bg-white/[0.025]" data-testid={`gesture-card-${gesture.key}`}><div className="flex items-start justify-between gap-2"><span className="size-2 rounded-full" style={{ backgroundColor: gesture.color, boxShadow: `0 0 11px ${gesture.color}` }} /><span className="font-mono text-[9px] text-slate-600">0{GESTURE_REFERENCE.indexOf(gesture) + 1}</span></div><p className="mt-4 font-mono text-[11px] font-semibold tracking-wider text-slate-200">{gesture.label}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{gesture.action}</p></div>)}
          </div>
        </section>

        <footer className="flex flex-col gap-2 py-5 font-mono text-[9px] tracking-wider text-slate-600 sm:flex-row sm:items-center sm:justify-between" data-testid="app-footer"><span>GESTUREOS AI // EDGE-FIRST INTERACTION SYSTEM</span><span>ARROW KEYS / SPACE / C = KEYBOARD FALLBACK</span></footer>
      </main>
      <GestureReferenceModal open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  );
}

import { useRef } from "react";
import { Check, ChevronLeft, ChevronRight, Maximize2, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Slide {
  index: number;
  title: string;
  subtitle: string;
  badge: string;
  image: string;
  highlights: string[];
}

interface PresentationDeckProps {
  slides: Slide[];
  currentIndex: number;
  isPlaying: boolean;
  bookmarked: boolean;
  lastCommand: string;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onReset: () => void;
  onBookmark: () => void;
}

export default function PresentationDeck({ slides, currentIndex, isPlaying, bookmarked, lastCommand, onSelect, onPrev, onNext, onTogglePlay, onReset, onBookmark }: PresentationDeckProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const slide = slides[currentIndex];
  return (
    <section className="hud-panel hud-brackets flex min-h-[470px] flex-col overflow-hidden" data-testid="presentation-stage-container">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3 sm:px-5">
        <div>
          <p className="metric-label text-cyan-300/70" data-testid="presentation-kicker">ACTIVE PRESENTATION</p>
          <p className="mt-1 text-sm font-semibold tracking-wide text-slate-100" data-testid="presentation-title">GestureOS AI / Keynote 01</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-slate-400" data-testid="slide-index-counter">
          <span className={`size-1.5 rounded-full ${isPlaying ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          {isPlaying ? "AUTO-FLOW" : "MANUAL"} <span className="text-slate-600">//</span> {String(currentIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </div>
      </div>

      <div ref={stageRef} className="relative mx-4 mt-4 min-h-[272px] flex-1 overflow-hidden rounded-sm border border-white/10 bg-[#080b11] sm:mx-5" data-testid="slide-current-view">
        <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: `url(${slide.image})` }} />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,#08090C_12%,rgba(8,9,12,.8)_50%,rgba(8,9,12,.42))]" />
        <div className="hud-corner hud-corner-tl" /><div className="hud-corner hud-corner-tr" /><div className="hud-corner hud-corner-bl" /><div className="hud-corner hud-corner-br" />
        <div className="relative flex h-full min-h-[272px] flex-col justify-end p-5 sm:p-7">
          <p className="metric-label text-cyan-300" data-testid="slide-badge-text">{slide.badge}</p>
          <h2 className="mt-3 max-w-md font-[family-name:var(--font-display)] text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl" data-testid="slide-title-text">{slide.title}</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300" data-testid="slide-subtitle-text">{slide.subtitle}</p>
          <div className="mt-5 grid max-w-lg gap-2 sm:grid-cols-3">
            {slide.highlights.map((highlight, index) => <div className="border-l border-cyan-300/50 pl-2 font-mono text-[10px] leading-relaxed text-slate-400" key={highlight} data-testid={`slide-highlight-${index + 1}`}>{highlight}</div>)}
          </div>
        </div>
        {lastCommand && <div className="absolute right-4 top-4 flex items-center gap-2 border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 font-mono text-[10px] tracking-wider text-emerald-200" data-testid="gesture-command-beacon"><Check className="size-3.5" />{lastCommand}</div>}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 sm:px-5" data-testid="slide-thumbnails-strip">
        {slides.map((item, index) => <button key={item.index} type="button" onClick={() => onSelect(index)} className={`group relative min-w-20 overflow-hidden rounded-sm border text-left transition-[border-color,opacity,transform] active:scale-95 ${currentIndex === index ? "border-cyan-300/80 opacity-100" : "border-white/10 opacity-60 hover:border-white/30 hover:opacity-90"}`} aria-label={`Select slide ${index + 1}`} data-testid={`slide-thumbnail-${index + 1}`}>
          <img src={item.image} alt="" className="h-10 w-20 object-cover grayscale" />
          <span className="absolute bottom-1 left-1 font-mono text-[9px] text-white">0{index + 1}</span>
        </button>)}
      </div>

      <div className="flex items-center gap-2 border-t border-white/8 px-4 py-3 sm:px-5">
        <Button variant="outline" size="icon-sm" onClick={onPrev} className="rounded-sm border-white/12 bg-transparent text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200" aria-label="Previous slide" data-testid="btn-slide-prev"><ChevronLeft className="size-4" /></Button>
        <Button variant="outline" size="icon-sm" onClick={onNext} className="rounded-sm border-white/12 bg-transparent text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200" aria-label="Next slide" data-testid="btn-slide-next"><ChevronRight className="size-4" /></Button>
        <Button variant="outline" size="sm" onClick={onTogglePlay} className="gap-2 rounded-sm border-white/12 bg-transparent font-mono text-[10px] tracking-wider text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200" data-testid="btn-slide-play-pause">{isPlaying ? <Pause className="size-3" /> : <Play className="size-3" />}{isPlaying ? "Pause" : "Play"}</Button>
        <Button variant="ghost" size="sm" onClick={onBookmark} className={`gap-2 rounded-sm font-mono text-[10px] tracking-wider ${bookmarked ? "text-amber-300" : "text-slate-400"}`} data-testid="btn-slide-bookmark"><Check className="size-3" />{bookmarked ? "Bookmarked" : "Bookmark"}</Button>
        <Button variant="ghost" size="icon-sm" onClick={onReset} className="ml-auto rounded-sm text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Reset presentation" data-testid="btn-slide-reset"><RotateCcw className="size-4" /></Button>
        <Button variant="ghost" size="icon-sm" onClick={() => void stageRef.current?.requestFullscreen()} className="rounded-sm text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Fullscreen presentation" data-testid="btn-slide-fullscreen"><Maximize2 className="size-4" /></Button>
      </div>
    </section>
  );
}
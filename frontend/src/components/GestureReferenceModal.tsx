import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GESTURE_REFERENCE } from "@/lib/gesture";

interface GestureReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GestureReferenceModal({ open, onOpenChange }: GestureReferenceModalProps) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg border-white/10 bg-[#10141c] text-slate-100">
      <DialogHeader>
        <DialogTitle className="font-[family-name:var(--font-display)] tracking-wide">Gesture command matrix</DialogTitle>
        <DialogDescription className="text-slate-400">Hold a pose for a moment. GestureOS uses a stability window and cooldown to reject accidental triggers.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2" data-testid="gesture-guide-dialog">
        {GESTURE_REFERENCE.map((gesture) => <div key={gesture.key} className="flex items-center justify-between border border-white/8 bg-white/[0.02] px-3 py-3" data-testid={`gesture-guide-${gesture.key}`}>
          <div className="flex items-center gap-3"><span className="size-2 rounded-full" style={{ backgroundColor: gesture.color, boxShadow: `0 0 12px ${gesture.color}` }} /><span className="font-mono text-xs tracking-wider text-white">{gesture.label}</span></div>
          <span className="text-xs text-slate-400">{gesture.action}</span>
        </div>)}
      </div>
      <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-2 gap-2 border-white/12 bg-transparent text-slate-300" data-testid="gesture-guide-close-btn"><X className="size-4" />Close matrix</Button>
    </DialogContent>
  </Dialog>;
}
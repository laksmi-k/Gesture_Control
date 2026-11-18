import * as tf from '@tensorflow/tfjs';

export type GestureKey =
  | "open-hand"
  | "point-right"
  | "point-left"
  | "thumbs-up"
  | "closed-fist"
  | "unknown";

export type Landmark = { x: number; y: number; z: number };

export interface GesturePrediction {
  key: GestureKey;
  label: string;
  command: string;
  confidence: number;
}

export const GESTURE_REFERENCE: Array<{
  key: Exclude<GestureKey, "unknown">;
  label: string;
  action: string;
  color: string;
}> = [
  { key: "open-hand", label: "OPEN HAND", action: "Play / pause deck", color: "#10B981" },
  { key: "point-right", label: "POINT RIGHT", action: "Next slide", color: "#00F0FF" },
  { key: "point-left", label: "POINT LEFT", action: "Previous slide", color: "#00F0FF" },
  { key: "thumbs-up", label: "THUMBS UP", action: "Confirm / bookmark", color: "#F59E0B" },
  { key: "closed-fist", label: "CLOSED FIST", action: "Standby gesture control", color: "#F43F5E" },
];

export const GESTURE_ACTION_NAMES: Partial<Record<GestureKey, string>> = {
  "open-hand": "play_pause",
  "point-right": "next_slide",
  "point-left": "previous_slide",
  "thumbs-up": "confirm",
  "closed-fist": "standby",
};

const LABELS: Record<GestureKey, { label: string; command: string }> = {
  "open-hand": { label: "OPEN HAND", command: "CMD_PLAY_PAUSE" },
  "point-right": { label: "POINT RIGHT", command: "CMD_SLIDE_NEXT" },
  "point-left": { label: "POINT LEFT", command: "CMD_SLIDE_PREV" },
  "thumbs-up": { label: "THUMBS UP", command: "CMD_CONFIRM" },
  "closed-fist": { label: "CLOSED FIST", command: "CMD_STANDBY_TOGGLE" },
  unknown: { label: "SEARCHING", command: "NO_COMMAND" },
};

export function normalizeLandmarks(points: Landmark[]): number[] {
  if (points.length !== 21) throw new Error("Expected 21 hand landmarks");
  const wrist = points[0];
  const centered = points.map((point) => [point.x - wrist.x, point.y - wrist.y, point.z - wrist.z]);
  const scale = Math.max(...centered.map(([x, y, z]) => Math.hypot(x, y, z)), 1e-6);
  return centered.flatMap(([x, y, z]) => [x / scale, y / scale, z / scale]);
}

function isExtended(points: Landmark[], tip: number, pip: number): boolean {
  return points[tip].y < points[pip].y;
}

function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function labelFor(key: GestureKey, confidence: number): GesturePrediction {
  return { key, ...LABELS[key], confidence };
}

function heuristicScores(points: Landmark[]): Record<GestureKey, number> {
  if (points.length !== 21) {
    return {
      "open-hand": 0.02,
      "point-right": 0.02,
      "point-left": 0.02,
      "thumbs-up": 0.02,
      "closed-fist": 0.02,
      unknown: 0.92,
    };
  }

  const fingers = [
    isExtended(points, 8, 6),
    isExtended(points, 12, 10),
    isExtended(points, 16, 14),
    isExtended(points, 20, 18),
  ];
  const extendedCount = fingers.filter(Boolean).length;
  const thumbUp = points[4].y < points[3].y && points[4].y < points[0].y - 0.04;
  const pinch = distance(points[4], points[8]) < 0.08;
  const indexOnly = fingers[0] && extendedCount === 1 && !pinch;
  const indexRight = points[8].x > points[5].x;
  const scores: Record<GestureKey, number> = {
    "open-hand": extendedCount === 4 ? 0.96 : extendedCount >= 3 ? 0.68 : 0.04,
    "point-right": indexOnly && indexRight ? 0.94 : 0.03,
    "point-left": indexOnly && !indexRight ? 0.94 : 0.03,
    "thumbs-up": thumbUp && extendedCount <= 1 ? 0.9 : 0.03,
    "closed-fist": extendedCount === 0 && !thumbUp ? 0.9 : 0.04,
    unknown: 0.08,
  };
  if (pinch) scores.unknown = 0.58;
  return scores;
}

export async function loadClassifier(path = "/models/gesture/model.json"): Promise<tf.LayersModel | null> {
  await tf.ready();
  try {
    return await tf.loadLayersModel(path);
  } catch {
    return null;
  }
}

export async function classifyLandmarks(
  points: Landmark[],
  model: tf.LayersModel | null,
): Promise<GesturePrediction> {
  if (points.length !== 21) return labelFor("unknown", 0);

  if (model) {
    const input = tf.tensor2d([normalizeLandmarks(points)], [1, 63]);
    const output = model.predict(input);
    const tensor = Array.isArray(output) ? output[0] : output;
    const scores: number[] = Array.from(await tensor.data()) as number[];
    input.dispose();
    tensor.dispose();
    const keys: GestureKey[] = ["open-hand", "point-right", "point-left", "thumbs-up", "closed-fist"];
    const index = scores.indexOf(Math.max(...scores));
    return labelFor(keys[index] ?? "unknown", scores[index] ?? 0);
  }

  // The shipped MVP keeps the inference local even before a custom model.json is supplied.
  // TensorFlow.js turns the geometric feature scores into a normalized probability vector.
  const scores = heuristicScores(points);
  const tensor = tf.tensor1d([
    scores["open-hand"],
    scores["point-right"],
    scores["point-left"],
    scores["thumbs-up"],
    scores["closed-fist"],
    scores.unknown,
  ]);
  const probabilities: number[] = Array.from(await tensor.softmax().data(), (value) => Number(value));
  tensor.dispose();
  const keys: GestureKey[] = ["open-hand", "point-right", "point-left", "thumbs-up", "closed-fist", "unknown"];
  const index = probabilities.indexOf(Math.max(...probabilities));
  return labelFor(keys[index] ?? "unknown", probabilities[index] ?? 0);
}

export function predictionForDemo(key: Exclude<GestureKey, "unknown">): GesturePrediction {
  return labelFor(key, 0.96);
}

export function unknownPrediction(): GesturePrediction {
  return labelFor("unknown", 0);
}

export function demoLandmarks(key: Exclude<GestureKey, "unknown">): Landmark[] {
  const points: Landmark[] = Array.from({ length: 21 }, (_, index) => ({
    x: 0.5 + ((index % 5) - 2) * 0.055,
    y: 0.6 - Math.floor(index / 5) * 0.09,
    z: 0,
  }));
  if (key === "open-hand") {
    [4, 8, 12, 16, 20].forEach((index, finger) => {
      points[index] = { x: 0.34 + finger * 0.08, y: 0.22, z: 0 };
    });
  } else if (key === "closed-fist") {
    points.forEach((point, index) => {
      if (index > 0) point.y = 0.52 + (index % 3) * 0.025;
    });
  } else if (key === "point-right" || key === "point-left") {
    points[8] = { x: key === "point-right" ? 0.86 : 0.14, y: 0.38, z: 0 };
    points[7] = { x: key === "point-right" ? 0.69 : 0.31, y: 0.45, z: 0 };
  } else {
    points[4] = { x: 0.5, y: 0.18, z: 0 };
  }
  return points;
}
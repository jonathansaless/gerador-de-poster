export type PaperId = 'a4' | 'a3' | 'letter';
export type Orientation = 'portrait' | 'landscape';
export type FitMode = 'contain' | 'cover';
export type RenderMode = 'normal' | 'halftone';

export type Settings = {
  columns: number;
  rows: number;
  paper: PaperId;
  orientation: Orientation;
  margin: number;
  overlap: number;
  fit: FitMode;
  zoom: number;
  offsetX: number;
  offsetY: number;
  rotation: 0 | 90 | 180 | 270;
  flipX: boolean;
  grayscale: boolean;
  brightness: number;
  contrast: number;
  mode: RenderMode;
  dotSize: number;
  cropMarks: boolean;
  pageLabels: boolean;
  guidePage: boolean;
  dpi: 150 | 200 | 300;
};

export type SourceAsset = {
  name: string;
  kind: 'image' | 'pdf';
  file: File;
  image: HTMLImageElement;
  url: string;
  width: number;
  height: number;
  pdfPage: number;
  pdfPages: number;
};

export const PAPERS: Record<PaperId, { label: string; width: number; height: number }> = {
  a4: { label: 'A4', width: 210, height: 297 },
  a3: { label: 'A3', width: 297, height: 420 },
  letter: { label: 'Carta', width: 215.9, height: 279.4 },
};

export const initialSettings: Settings = {
  columns: 2,
  rows: 2,
  paper: 'a4',
  orientation: 'portrait',
  margin: 10,
  overlap: 0,
  fit: 'contain',
  zoom: 100,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  flipX: false,
  grayscale: false,
  brightness: 100,
  contrast: 100,
  mode: 'normal',
  dotSize: 5,
  cropMarks: true,
  pageLabels: true,
  guidePage: true,
  dpi: 200,
};

export type Metrics = {
  paperW: number;
  paperH: number;
  printableW: number;
  printableH: number;
  stepW: number;
  stepH: number;
  posterW: number;
  posterH: number;
  count: number;
};

export function getMetrics(s: Settings): Metrics {
  const base = PAPERS[s.paper];
  const paperW = s.orientation === 'portrait' ? base.width : base.height;
  const paperH = s.orientation === 'portrait' ? base.height : base.width;
  const printableW = paperW - 2 * s.margin;
  const printableH = paperH - 2 * s.margin;
  const overlap = Math.min(s.overlap, printableW - 2, printableH - 2);
  const stepW = printableW - overlap;
  const stepH = printableH - overlap;
  return {
    paperW, paperH, printableW, printableH, stepW, stepH,
    posterW: printableW + (s.columns - 1) * stepW,
    posterH: printableH + (s.rows - 1) * stepH,
    count: s.columns * s.rows,
  };
}

export function centimeters(mm: number) {
  return (mm / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

export function recommendedLayouts(aspect: number, paper: PaperId, orientation: Orientation, margin: number) {
  const base = PAPERS[paper];
  const w = (orientation === 'portrait' ? base.width : base.height) - 2 * margin;
  const h = (orientation === 'portrait' ? base.height : base.width) - 2 * margin;
  const combos = [
    [2, 2], [2, 3], [3, 2], [3, 3], [2, 4], [4, 2], [3, 4], [4, 3], [4, 4],
    [1, 2], [2, 1], [1, 3], [3, 1],
  ];
  return combos
    .map(([cols, rows]) => ({
      cols, rows,
      ratio: (cols * w) / (rows * h),
      score: Math.abs(Math.log(((cols * w) / (rows * h)) / aspect)) + Math.abs(cols * rows - 4) * 0.035,
    }))
    .sort((a, b) => a.score - b.score);
}

export function imageScale(asset: SourceAsset, s: Settings, m: Metrics) {
  const rotated = s.rotation === 90 || s.rotation === 270;
  const iw = rotated ? asset.height : asset.width;
  const ih = rotated ? asset.width : asset.height;
  const scale = s.fit === 'contain'
    ? Math.min(m.posterW / iw, m.posterH / ih)
    : Math.max(m.posterW / iw, m.posterH / ih);
  return scale * s.zoom / 100;
}

export function estimatedDpi(asset: SourceAsset, s: Settings, m: Metrics) {
  const mmPerSourcePx = imageScale(asset, s, m);
  return Math.round(25.4 / mmPerSourcePx);
}

export function columnLabel(index: number) {
  let n = index + 1;
  let label = '';
  while (n > 0) {
    n -= 1;
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

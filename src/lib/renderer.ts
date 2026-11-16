import type { Metrics, Settings, SourceAsset } from './config';
import { columnLabel, getMetrics, imageScale } from './config';

export type HalftoneData = {
  values: Uint8ClampedArray;
  columns: number;
  rows: number;
  spacingX: number;
  spacingY: number;
};

export class CancelledError extends Error {
  constructor() { super('Geração cancelada.'); }
}

export function drawArtwork(ctx: CanvasRenderingContext2D, asset: SourceAsset, s: Settings, m: Metrics) {
  const scale = imageScale(asset, s, m);
  ctx.save();
  ctx.translate(m.posterW / 2 + (s.offsetX / 200) * m.posterW,
    m.posterH / 2 + (s.offsetY / 200) * m.posterH);
  ctx.rotate(s.rotation * Math.PI / 180);
  if (s.flipX) ctx.scale(-1, 1);
  ctx.filter = `grayscale(${s.grayscale ? 100 : 0}%) brightness(${s.brightness}%) contrast(${s.contrast}%)`;
  ctx.drawImage(asset.image, -asset.width * scale / 2, -asset.height * scale / 2,
    asset.width * scale, asset.height * scale);
  ctx.restore();
}

export function createHalftone(asset: SourceAsset, s: Settings, m: Metrics): HalftoneData {
  const columns = Math.max(1, Math.ceil(m.posterW / s.dotSize));
  const rows = Math.max(1, Math.ceil(m.posterH / s.dotSize));
  const canvas = document.createElement('canvas');
  canvas.width = columns;
  canvas.height = rows;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Não foi possível preparar o efeito pontilhado.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, columns, rows);
  ctx.save();
  ctx.scale(columns / m.posterW, rows / m.posterH);
  drawArtwork(ctx, asset, s, m);
  ctx.restore();
  const values = ctx.getImageData(0, 0, columns, rows).data;
  canvas.width = canvas.height = 0;
  return { values, columns, rows,
    spacingX: m.posterW / columns,
    spacingY: m.posterH / rows };
}

export function drawHalftone(
  ctx: CanvasRenderingContext2D, data: HalftoneData,
  visible?: { x: number; y: number; width: number; height: number },
) {
  const fromX = visible ? Math.max(0, Math.floor(visible.x / data.spacingX) - 1) : 0;
  const fromY = visible ? Math.max(0, Math.floor(visible.y / data.spacingY) - 1) : 0;
  const toX = visible ? Math.min(data.columns, Math.ceil((visible.x + visible.width) / data.spacingX) + 1) : data.columns;
  const toY = visible ? Math.min(data.rows, Math.ceil((visible.y + visible.height) / data.spacingY) + 1) : data.rows;
  const baseRadius = Math.min(data.spacingX, data.spacingY) * 0.49;
  ctx.save();
  ctx.fillStyle = '#242724';
  for (let row = fromY; row < toY; row++) {
    for (let col = fromX; col < toX; col++) {
      const idx = (row * data.columns + col) * 4;
      const darkness = 1 - (data.values[idx] * 0.2126 + data.values[idx + 1] * 0.7152 + data.values[idx + 2] * 0.0722) / 255;
      if (darkness < 0.025) continue;
      const radius = baseRadius * Math.sqrt(darkness);
      ctx.beginPath();
      ctx.arc((col + 0.5) * data.spacingX, (row + 0.5) * data.spacingY, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawCropMarks(ctx: CanvasRenderingContext2D, s: Settings, m: Metrics) {
  if (s.margin < 2.5) return;
  const x1 = s.margin, x2 = s.margin + m.printableW;
  const y1 = s.margin, y2 = s.margin + m.printableH;
  const len = Math.min(4.5, s.margin - 1.2);
  ctx.save();
  ctx.strokeStyle = '#707675';
  ctx.lineWidth = 0.16;
  // Printer-friendly marks: only the white paper margin is inked.
  for (const x of [x1, x2]) {
    for (const y of [y1, y2]) {
      const dirX = x === x1 ? -1 : 1;
      const dirY = y === y1 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x + dirX * 0.65, y); ctx.lineTo(x + dirX * len, y);
      ctx.moveTo(x, y + dirY * 0.65); ctx.lineTo(x, y + dirY * len);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawTile(
  ctx: CanvasRenderingContext2D, asset: SourceAsset, s: Settings,
  m: Metrics, col: number, row: number, dots?: HalftoneData,
) {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, m.paperW, m.paperH);
  const tileX = col * m.stepW;
  const tileY = row * m.stepH;
  ctx.save();
  ctx.beginPath();
  ctx.rect(s.margin, s.margin, m.printableW, m.printableH);
  ctx.clip();
  ctx.translate(s.margin - tileX, s.margin - tileY);
  if (dots) drawHalftone(ctx, dots, { x: tileX, y: tileY, width: m.printableW, height: m.printableH });
  else drawArtwork(ctx, asset, s, m);
  ctx.restore();
  if (s.cropMarks) drawCropMarks(ctx, s, m);
  if (s.pageLabels && s.margin >= 5) {
    ctx.save();
    ctx.fillStyle = '#555d5a';
    ctx.font = '2.6px Arial, sans-serif';
    ctx.textBaseline = 'middle';
    const number = row * s.columns + col + 1;
    ctx.fillText(`${columnLabel(col)}${row + 1}  ·  folha ${number}/${m.count}`, s.margin, m.paperH - s.margin / 2);
    ctx.restore();
  }
  ctx.restore();
}

function wrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const candidate = `${line}${line ? ' ' : ''}${word}`;
    if (ctx.measureText(candidate).width > width && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else line = candidate;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineHeight;
}

export function drawGuide(ctx: CanvasRenderingContext2D, asset: SourceAsset, s: Settings, m: Metrics, dots?: HalftoneData) {
  // All guide coordinates use a virtual 210 × 297 mm canvas, adapted to the selected paper.
  ctx.save();
  ctx.scale(m.paperW / 210, m.paperH / 297);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 210, 297);
  ctx.fillStyle = '#b7653f';
  ctx.fillRect(16, 17, 3.5, 13);
  ctx.fillStyle = '#222822';
  ctx.font = 'bold 8px Arial, sans-serif';
  ctx.fillText('Guia de montagem', 24, 24);
  ctx.fillStyle = '#67716d';
  ctx.font = '3.3px Arial, sans-serif';
  ctx.fillText(`${m.count} folhas  •  ${s.columns} colunas × ${s.rows} linhas  •  ${s.paper.toUpperCase()}`, 24, 32);

  const maxW = 147;
  const maxH = 135;
  const scale = Math.min(maxW / m.posterW, maxH / m.posterH);
  const posterW = m.posterW * scale;
  const posterH = m.posterH * scale;
  const x = (210 - posterW) / 2;
  const y = 49 + (135 - posterH) / 2;
  ctx.save();
  ctx.fillStyle = '#f9f7f2';
  ctx.fillRect(x, y, posterW, posterH);
  ctx.beginPath();
  ctx.rect(x, y, posterW, posterH);
  ctx.clip();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (dots) drawHalftone(ctx, dots);
  else drawArtwork(ctx, asset, s, m);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#ad653e';
  ctx.lineWidth = 0.45;
  ctx.strokeRect(x, y, posterW, posterH);
  for (let i = 1; i < s.columns; i++) {
    const lineX = x + i * m.stepW * scale;
    ctx.beginPath(); ctx.moveTo(lineX, y); ctx.lineTo(lineX, y + posterH); ctx.stroke();
  }
  for (let i = 1; i < s.rows; i++) {
    const lineY = y + i * m.stepH * scale;
    ctx.beginPath(); ctx.moveTo(x, lineY); ctx.lineTo(x + posterW, lineY); ctx.stroke();
  }
  const boundariesX = Array.from({ length: s.columns + 1 }, (_, i) => i === s.columns ? m.posterW : i * m.stepW);
  const boundariesY = Array.from({ length: s.rows + 1 }, (_, i) => i === s.rows ? m.posterH : i * m.stepH);
  for (let c = 0; c < s.columns; c++) {
    const cx = x + ((boundariesX[c] + boundariesX[c + 1]) / 2) * scale;
    ctx.fillStyle = '#343a36';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 3px Arial, sans-serif';
    ctx.fillText(columnLabel(c), cx, y - 4);
  }
  for (let r = 0; r < s.rows; r++) {
    const cy = y + ((boundariesY[r] + boundariesY[r + 1]) / 2) * scale;
    ctx.fillStyle = '#343a36';
    ctx.font = 'bold 3px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(r + 1), x - 5, cy);
    for (let c = 0; c < s.columns; c++) {
      const cx = x + ((boundariesX[c] + boundariesX[c + 1]) / 2) * scale;
      const minCell = Math.min((boundariesX[c + 1] - boundariesX[c]) * scale, (boundariesY[r + 1] - boundariesY[r]) * scale);
      const radius = Math.max(2.0, Math.min(7.4, minCell * 0.25));
      ctx.fillStyle = 'rgba(29, 34, 32, 0.86)';
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.min(4, radius * 0.9)}px Arial, sans-serif`;
      ctx.fillText(String(r * s.columns + c + 1), cx, cy + 0.2);
    }
  }
  ctx.restore();
  ctx.fillStyle = '#b7653f';
  ctx.font = 'bold 3.1px Arial, sans-serif';
  ctx.fillText('COMECE AQUI', x, Math.max(41, y - 9));

  ctx.fillStyle = '#59625d';
  ctx.font = '3.1px Arial, sans-serif';
  ctx.fillText('Monte da esquerda para a direita e de cima para baixo. Siga as letras e os números.', 17, 197);
  ctx.fillStyle = '#ddd9d0';
  ctx.fillRect(17, 204, 176, 0.35);
  ctx.fillStyle = '#222822';
  ctx.font = 'bold 5.3px Arial, sans-serif';
  ctx.fillText('Antes de imprimir', 17, 214);

  const entries = [
    ['1. Use tamanho real', 'Na janela de impressão, escolha 100% ou Tamanho real. Não use Ajustar à página.'],
    ['2. Confira o papel', `Selecione ${s.paper.toUpperCase()} e orientação ${s.orientation === 'portrait' ? 'retrato' : 'paisagem'}. Imprima uma folha de teste.`],
    ['3. Organize as folhas', 'Recorte as margens brancas das emendas. Siga as letras e os números de cada página.'],
    ['4. Monte o pôster', s.overlap > 0 ? `Sobreponha ${s.overlap} mm da imagem nas emendas e fixe pelo verso com fita.` : 'Encoste as partes impressas pelas bordas e fixe pelo verso com fita.'],
  ];
  entries.forEach(([heading, detail], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const baseX = col === 0 ? 17 : 109;
    const baseY = row === 0 ? 225 : 246;
    ctx.fillStyle = '#303630';
    ctx.font = 'bold 3.75px Arial, sans-serif';
    ctx.fillText(heading, baseX, baseY);
    ctx.fillStyle = '#626b65';
    ctx.font = '3.2px Arial, sans-serif';
    wrappedText(ctx, detail, baseX, baseY + 5, 83, 4.05);
  });

  ctx.fillStyle = '#f7f3ec';
  ctx.fillRect(17, 267, 176, 19);
  ctx.fillStyle = '#262c27';
  ctx.textAlign = 'center';
  ctx.font = 'bold 5.8px Arial, sans-serif';
  ctx.fillText(`Tamanho final: ${(m.posterW / 10).toFixed(1).replace('.', ',')} × ${(m.posterH / 10).toFixed(1).replace('.', ',')} cm`, 105, 275);
  ctx.font = '3.2px Arial, sans-serif';
  ctx.fillStyle = '#646c67';
  ctx.fillText(`${m.count} folhas de pôster${s.guidePage ? ' + este guia' : ''}   •   Gerado no Posterfeito`, 105, 281);
  ctx.restore();
}

function mmToPt(mm: number) { return mm * 72 / 25.4; }

function makePageCanvas(m: Metrics, dpi: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(m.paperW / 25.4 * dpi);
  canvas.height = Math.round(m.paperH / 25.4 * dpi);
  return canvas;
}

async function canvasJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array<ArrayBuffer>> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('O navegador não conseguiu gerar a imagem da página.')), 'image/jpeg', 0.93);
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function generatePosterPdf(
  asset: SourceAsset,
  s: Settings,
  onProgress: (current: number, total: number) => void,
  shouldCancel: () => boolean,
): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const m = getMetrics(s);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Pôster - ${asset.name}`);
  pdf.setSubject(`Pôster ${s.columns}x${s.rows} criado no Posterfeito`);
  pdf.setCreator('Posterfeito');
  const dots = s.mode === 'halftone' ? createHalftone(asset, s, m) : undefined;
  const canvas = makePageCanvas(m, s.dpi);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Sem memória suficiente para preparar o PDF neste navegador.');
  const ppmX = canvas.width / m.paperW;
  const ppmY = canvas.height / m.paperH;
  const total = m.count + (s.guidePage ? 1 : 0);

  for (let row = 0; row < s.rows; row++) {
    for (let col = 0; col < s.columns; col++) {
      if (shouldCancel()) throw new CancelledError();
      // Reinitializing a canvas also resets transforms, clips and filters.
      canvas.width = canvas.width;
      const fresh = canvas.getContext('2d', { alpha: false });
      if (!fresh) throw new Error('Não foi possível renderizar uma das páginas.');
      fresh.scale(ppmX, ppmY);
      drawTile(fresh, asset, s, m, col, row, dots);
      const jpg = await pdf.embedJpg(await canvasJpegBytes(canvas));
      const page = pdf.addPage([mmToPt(m.paperW), mmToPt(m.paperH)]);
      page.drawImage(jpg, { x: 0, y: 0, width: mmToPt(m.paperW), height: mmToPt(m.paperH) });
      onProgress(row * s.columns + col + 1, total);
      await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    }
  }

  if (s.guidePage) {
    if (shouldCancel()) throw new CancelledError();
    canvas.width = canvas.width;
    const fresh = canvas.getContext('2d', { alpha: false });
    if (!fresh) throw new Error('Não foi possível renderizar o guia.');
    fresh.scale(ppmX, ppmY);
    drawGuide(fresh, asset, s, m, dots);
    const jpg = await pdf.embedJpg(await canvasJpegBytes(canvas));
    const page = pdf.addPage([mmToPt(m.paperW), mmToPt(m.paperH)]);
    page.drawImage(jpg, { x: 0, y: 0, width: mmToPt(m.paperW), height: mmToPt(m.paperH) });
    onProgress(total, total);
  }
  canvas.width = canvas.height = 0;
  if (shouldCancel()) throw new CancelledError();
  const bytes = await pdf.save({ useObjectStreams: true });
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

export function renderHalftonePreview(
  canvas: HTMLCanvasElement, asset: SourceAsset, s: Settings,
  m: Metrics,
) {
  const w = Math.min(960, Math.max(240, Math.round(m.posterW / m.posterH * 800)));
  const h = Math.round(w * m.posterH / m.posterW);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.scale(w / m.posterW, h / m.posterH);
  drawHalftone(ctx, createHalftone(asset, s, m));
  ctx.restore();
}

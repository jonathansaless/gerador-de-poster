import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import {
  ArrowDownToLine, ArrowLeftRight, Check, ChevronDown, CircleHelp,
  FileImage, FileText, Grid2X2, ImagePlus, Layers3, Maximize2,
  Minus, Move, Printer, RotateCcw, RotateCw, Ruler, ShieldCheck,
  SlidersHorizontal, Sparkles, UploadCloud, X,
} from 'lucide-react';
import {
  centimeters, columnLabel, estimatedDpi, getMetrics, imageScale,
  initialSettings, PAPERS, recommendedLayouts,
} from './lib/config';
import type { Settings, SourceAsset } from './lib/config';
import { loadAsset } from './lib/imports';
import { CancelledError, generatePosterPdf, renderHalftonePreview } from './lib/renderer';

type Status = 'idle' | 'loading' | 'generating';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function PageIcon({ cols, rows }: { cols: number; rows: number }) {
  return (
    <div className="layout-icon" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
      {Array.from({ length: cols * rows }, (_, i) => <span key={i} />)}
    </div>
  );
}

function Field({ label, detail, children }: { label: string; detail?: string; children: ReactNode }) {
  return <div className="form-field"><div className="field-head"><label>{label}</label>{detail && <small>{detail}</small>}</div>{children}</div>;
}

function Slider({ value, min, max, step = 1, onChange, suffix = '' }: {
  value: number; min: number; max: number; step?: number; onChange: (n: number) => void; suffix?: string;
}) {
  return <div className="slider-control"><input aria-label="Ajuste" type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /><output>{value}{suffix}</output></div>;
}

function Switch({ checked, onChange, label, detail }: {
  checked: boolean; onChange: (next: boolean) => void; label: string; detail?: string;
}) {
  return <label className="switch-row"><span className="switch-text"><strong>{label}</strong>{detail && <small>{detail}</small>}</span><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span className="switch" aria-hidden="true" /></label>;
}

function Preview({ asset, s, large = false }: { asset: SourceAsset; s: Settings; large?: boolean }) {
  const m = useMemo(() => getMetrics(s), [s]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(!large);
  const [zoomPreview, setZoomPreview] = useState(1);
  const scale = imageScale(asset, s, m);
  const imageCssW = asset.width * scale / m.posterW * 100;
  const imageCssH = asset.height * scale / m.posterH * 100;

  useEffect(() => {
    if (s.mode !== 'halftone' || !canvasRef.current) return;
    renderHalftonePreview(canvasRef.current, asset, s, m);
  }, [asset, s, m]);

  const gridCells = useMemo(() => {
    const edgesX = Array.from({ length: s.columns + 1 }, (_, i) => (i === s.columns ? m.posterW : i * m.stepW));
    const edgesY = Array.from({ length: s.rows + 1 }, (_, i) => (i === s.rows ? m.posterH : i * m.stepH));
    return Array.from({ length: m.count }, (_, i) => {
      const col = i % s.columns;
      const row = Math.floor(i / s.columns);
      return {
        text: `${columnLabel(col)}${row + 1}`,
        left: `${((edgesX[col] + edgesX[col + 1]) / 2) / m.posterW * 100}%`,
        top: `${((edgesY[row] + edgesY[row + 1]) / 2) / m.posterH * 100}%`,
      };
    });
  }, [s.columns, s.rows, m]);

  const pointerStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  // Preview supports viewing drag, while image positioning is adjusted using the dedicated sliders.
  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (zoomPreview === 1) return;
    pointerStart.current = { x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointerStart.current) return;
    setPan({
      x: pointerStart.current.ox + e.clientX - pointerStart.current.x,
      y: pointerStart.current.oy + e.clientY - pointerStart.current.y,
    });
  }
  function resetPreviewZoom() {
    setZoomPreview(1);
    setPan({ x: 0, y: 0 });
  }

  return <div className={`preview-wrapper ${large ? 'preview-wrapper-large' : ''}`}>
    <div className="preview-toolbar">
      <div className="preview-info"><span className="stage-pill">PRÉ-VISUALIZAÇÃO</span><span>{s.columns} × {s.rows} folhas</span></div>
      <div className="preview-actions">
        <button type="button" className={`text-button ${showGrid ? 'active' : ''}`} onClick={() => setShowGrid(x => !x)}><Grid2X2 size={15} /> Grade {showGrid ? 'ligada' : 'desligada'}</button>
        {large && <><button aria-label="Reduzir zoom" type="button" className="icon-button" onClick={() => zoomPreview <= 1 ? resetPreviewZoom() : setZoomPreview(x => Math.max(1, x - 0.25))}><Minus size={17} /></button><span className="zoom-number">{Math.round(zoomPreview * 100)}%</span><button type="button" className="icon-button" onClick={() => setZoomPreview(x => Math.min(3, x + 0.25))}><Maximize2 size={17} /></button><button type="button" className="small-action" onClick={resetPreviewZoom}>Reiniciar zoom</button></>}
      </div>
    </div>
    <div className="preview-space">
      <div className="preview-transform" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomPreview})` }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => { pointerStart.current = null; }} onPointerCancel={() => { pointerStart.current = null; }}>
        <div className="poster-preview" style={{ aspectRatio: `${m.posterW} / ${m.posterH}` }}>
          {s.mode === 'halftone' ? <canvas ref={canvasRef} className="dots-preview" aria-label="Prévia da arte no estilo pontilhado" /> : <img
            className="poster-artwork"
            src={asset.url}
            alt="Arte enviada para criação do pôster"
            draggable={false}
            style={{
              width: `${imageCssW}%`, height: `${imageCssH}%`,
              left: `${50 + s.offsetX / 2}%`, top: `${50 + s.offsetY / 2}%`,
              transform: `translate(-50%, -50%) rotate(${s.rotation}deg) scaleX(${s.flipX ? -1 : 1})`,
              filter: `grayscale(${s.grayscale ? 100 : 0}%) brightness(${s.brightness}%) contrast(${s.contrast}%)`,
            }}
          />}
          {showGrid && <div className="grid-overlay" aria-hidden="true">
            {Array.from({ length: s.columns - 1 }, (_, i) => <div key={`v${i}`} className="grid-line vertical" style={{ left: `${(i + 1) * m.stepW / m.posterW * 100}%` }} />)}
            {Array.from({ length: s.rows - 1 }, (_, i) => <div key={`h${i}`} className="grid-line horizontal" style={{ top: `${(i + 1) * m.stepH / m.posterH * 100}%` }} />)}
            {gridCells.map(cell => <span key={cell.text} className="grid-marker" style={{ left: cell.left, top: cell.top }}>{cell.text}</span>)}
          </div>}
        </div>
      </div>
    </div>
    <div className="preview-footer"><span><Ruler size={14} /> {centimeters(m.posterW)} × {centimeters(m.posterH)} cm</span><span>Proporções reais • não representa a escala física na tela</span></div>
  </div>;
}

export default function App() {
  const [s, setS] = useState<Settings>(initialSettings);
  const [asset, setAsset] = useState<SourceAsset | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [fileError, setFileError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [largePreview, setLargePreview] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [manual, setManual] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);
  const loadId = useRef(0);
  const cancelGeneration = useRef(false);
  const sourceUrl = asset?.url;
  const m = useMemo(() => getMetrics(s), [s]);
  const estimated = asset ? estimatedDpi(asset, s, m) : 0;
  const suggestions = useMemo(() => asset ? recommendedLayouts(asset.width / asset.height, s.paper, s.orientation, s.margin).slice(0, 4) : [], [asset, s.paper, s.orientation, s.margin]);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); }, [downloadUrl]);
  // Changing any output parameter invalidates the previously generated PDF.
  useEffect(() => setDownloadUrl(null), [s, asset]);
  useEffect(() => { document.body.style.overflow = largePreview || showHelp ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [largePreview, showHelp]);

  function change<K extends keyof Settings>(key: K, value: Settings[K]) { setS(prev => ({ ...prev, [key]: value })); }

  async function openAsset(file: File, page = 1) {
    const thisLoad = ++loadId.current;
    setFileError('');
    setStatus('loading');
    setDownloadUrl(null);
    try {
      const loaded = await loadAsset(file, page);
      if (thisLoad !== loadId.current) { URL.revokeObjectURL(loaded.url); return; }
      if (page === 1) {
        const layouts = recommendedLayouts(loaded.width / loaded.height, s.paper, s.orientation, s.margin);
        if (layouts[0]) setS(prev => ({ ...prev, columns: layouts[0].cols, rows: layouts[0].rows, zoom: 100, offsetX: 0, offsetY: 0, rotation: 0 }));
      }
      setAsset(loaded);
    } catch (error) {
      if (thisLoad === loadId.current) setFileError(error instanceof Error ? error.message : 'Não foi possível abrir o arquivo.');
    } finally {
      if (thisLoad === loadId.current) setStatus('idle');
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void openAsset(file);
    e.target.value = '';
  }
  function onDropped(e: DragEvent<HTMLElement>) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void openAsset(file);
  }

  async function exportPdf() {
    if (!asset || status !== 'idle') return;
    setStatus('generating'); setFileError(''); setProgress(0);
    cancelGeneration.current = false;
    try {
      const blob = await generatePosterPdf(asset, s, (done, total) => setProgress(Math.round(done / total * 100)), () => cancelGeneration.current);
      if (cancelGeneration.current) return;
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      const filename = `${asset.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9À-ÿ_-]+/g, '-') || 'poster'}-${s.columns}x${s.rows}-${s.paper}.pdf`;
      setDownloadName(filename);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (error) {
      if (!(error instanceof CancelledError)) setFileError(error instanceof Error ? error.message : 'Falha ao gerar o PDF. Tente uma resolução menor.');
    } finally {
      setStatus('idle');
    }
  }

  const busy = status !== 'idle';
  const totalPages = m.count + Number(s.guidePage);

  return <div className="app-shell">
    <header className="site-header">
      <a href="#inicio" className="brand" aria-label="Posterfeito, início"><span className="brand-mark"><Layers3 size={19} strokeWidth={2.2} /></span><span>poster<span className="brand-accent">feito</span><span className="brand-dot">.</span></span></a>
      <div className="header-right"><span className="header-note"><ShieldCheck size={15} /> Seus arquivos ficam no seu navegador</span><button type="button" className="header-help" onClick={() => setShowHelp(true)}><CircleHelp size={17} /> Como imprimir</button></div>
    </header>

    <div className="topline" id="inicio"><strong>Faça um pôster grande com sua impressora comum.</strong><span>Envie uma imagem, escolha as folhas e baixe o PDF pronto para imprimir.</span></div>

    <main className="workspace">
      <aside className="settings-panel">
        <section className="upload-section">
          <div className="section-heading"><span className="step-number">01</span><div><h2>Sua imagem</h2><p>JPG, PNG, WEBP ou PDF</p></div></div>
          <input id="source-file" ref={uploadRef} type="file" accept=".jpg,.jpeg,.png,.webp,.bmp,.gif,.pdf,image/*,application/pdf" hidden onChange={onFileChange} />
          <div className={`upload-box ${dragOver ? 'drag-over' : ''} ${asset ? 'has-file' : ''}`}
            role="button" tabIndex={0} aria-label="Escolher uma imagem ou PDF"
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uploadRef.current?.click(); } }}
            onClick={() => uploadRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDropped}>
            {asset ? <><span className="file-icon"><FileImage size={22} /></span><div className="uploaded-file"><strong title={asset.name}>{asset.name}</strong><small>{asset.width} × {asset.height} px · Clique para trocar</small></div><Check size={17} className="file-check" /></>
              : <><UploadCloud size={25} strokeWidth={1.65} /><strong>{status === 'loading' ? 'Abrindo arquivo…' : 'Clique ou arraste sua arte'}</strong><small>Até 80 MB · processamento local</small></>}
          </div>
          {asset?.kind === 'pdf' && asset.pdfPages > 1 && <Field label="Página do PDF" detail={`${asset.pdfPages} disponíveis`}><select disabled={busy} value={asset.pdfPage} onChange={e => void openAsset(asset.file, Number(e.target.value))}>{Array.from({ length: Math.min(asset.pdfPages, 1000) }, (_, i) => <option key={i} value={i + 1}>Página {i + 1}</option>)}</select></Field>}
          {asset?.kind === 'pdf' && <p className="field-hint">PDF de origem convertido em imagem no navegador. Escolha uma página por vez.</p>}
          {fileError && <div className="error-message" role="alert"><X size={15} /><span>{fileError}</span><button type="button" onClick={() => setFileError('')} aria-label="Fechar aviso"><X size={14} /></button></div>}
        </section>

        <section className="settings-section">
          <div className="section-heading"><span className="step-number">02</span><div><h2>Divisão das folhas</h2><p>Escolha um formato ou personalize</p></div></div>
          {asset && !manual && <><span className="eyebrow">SUGERIDOS PARA SUA IMAGEM</span><div className="layout-list">{suggestions.map((layout, i) => {
            const selected = s.columns === layout.cols && s.rows === layout.rows;
            return <button key={`${layout.cols}-${layout.rows}`} type="button" className={`layout-option ${selected ? 'selected' : ''}`} onClick={() => { change('columns', layout.cols); change('rows', layout.rows); }}>
              <PageIcon cols={layout.cols} rows={layout.rows} /><span><strong>{layout.cols} × {layout.rows} folhas</strong><small>{i === 0 ? 'Melhor proporção para esta imagem' : `${layout.cols * layout.rows} páginas de impressão`}</small></span>{selected && <Check size={17} />}
            </button>;
          })}</div></>}
          {!asset && <div className="example-layout"><PageIcon cols={2} rows={2} /><span>Comece com 2 × 2 folhas. Depois de enviar sua arte, mostraremos sugestões.</span></div>}
          <button type="button" className="manual-toggle" onClick={() => setManual(v => !v)}><SlidersHorizontal size={17} /> Personalizar a divisão <ChevronDown className={manual ? 'turned' : ''} size={16} /></button>
          {manual && <div className="manual-controls"><Field label="Colunas"><div className="number-stepper"><button type="button" aria-label="Menos colunas" onClick={() => change('columns', clamp(s.columns - 1, 1, 8))}>−</button><strong>{s.columns}</strong><button type="button" aria-label="Mais colunas" onClick={() => change('columns', clamp(s.columns + 1, 1, 8))}>+</button></div></Field><Field label="Linhas"><div className="number-stepper"><button type="button" aria-label="Menos linhas" onClick={() => change('rows', clamp(s.rows - 1, 1, 8))}>−</button><strong>{s.rows}</strong><button type="button" aria-label="Mais linhas" onClick={() => change('rows', clamp(s.rows + 1, 1, 8))}>+</button></div></Field></div>}
          <div className="control-pair"><Field label="Papel"><select value={s.paper} onChange={e => change('paper', e.target.value as Settings['paper'])}><option value="a4">A4 · 21 × 29,7 cm</option><option value="a3">A3 · 29,7 × 42 cm</option><option value="letter">Carta · 21,6 × 27,9 cm</option></select></Field><Field label="Orientação"><select value={s.orientation} onChange={e => change('orientation', e.target.value as Settings['orientation'])}><option value="portrait">Retrato</option><option value="landscape">Paisagem</option></select></Field></div>
          <Field label="Margem por folha" detail="Evita cortes pela impressora"><Slider value={s.margin} min={5} max={25} onChange={v => change('margin', v)} suffix=" mm" /></Field>
          <Field label="Sobreposição de montagem" detail="Repetição nas emendas"><Slider value={s.overlap} min={0} max={15} onChange={v => change('overlap', v)} suffix=" mm" /></Field>
        </section>

        <section className="settings-section">
          <div className="section-heading"><span className="step-number">03</span><div><h2>Ajustar a arte</h2><p>Enquadramento e acabamento</p></div></div>
          <Field label="Enquadramento"><div className="segmented"><button type="button" className={s.fit === 'contain' ? 'selected' : ''} onClick={() => change('fit', 'contain')}>Mostrar inteira</button><button type="button" className={s.fit === 'cover' ? 'selected' : ''} onClick={() => change('fit', 'cover')}>Preencher</button></div></Field>
          <Field label="Zoom"><Slider value={s.zoom} min={50} max={250} step={5} onChange={v => change('zoom', v)} suffix="%" /></Field>
          <div className="control-pair"><Field label="Mover na horizontal"><Slider value={s.offsetX} min={-100} max={100} onChange={v => change('offsetX', v)} suffix="%" /></Field><Field label="Mover na vertical"><Slider value={s.offsetY} min={-100} max={100} onChange={v => change('offsetY', v)} suffix="%" /></Field></div>
          <div className="inline-actions"><button type="button" onClick={() => change('rotation', ((s.rotation + 270) % 360) as Settings['rotation'])}><RotateCcw size={16} /> Girar esquerda</button><button type="button" onClick={() => change('rotation', ((s.rotation + 90) % 360) as Settings['rotation'])}><RotateCw size={16} /> Girar direita</button><button type="button" className={s.flipX ? 'toggled' : ''} onClick={() => change('flipX', !s.flipX)}><ArrowLeftRight size={16} /> Espelhar</button></div>
          <div className="adjustment-row"><Field label="Brilho"><Slider value={s.brightness} min={50} max={150} step={5} onChange={v => change('brightness', v)} suffix="%" /></Field><Field label="Contraste"><Slider value={s.contrast} min={50} max={150} step={5} onChange={v => change('contrast', v)} suffix="%" /></Field></div>
          <Switch label="Preto e branco" detail="Impressão sem cores" checked={s.grayscale} onChange={v => change('grayscale', v)} />
          <Field label="Estilo de impressão"><div className="segmented"><button type="button" className={s.mode === 'normal' ? 'selected' : ''} onClick={() => change('mode', 'normal')}>Imagem original</button><button type="button" className={s.mode === 'halftone' ? 'selected' : ''} onClick={() => change('mode', 'halftone')}>Pontos artísticos</button></div></Field>
          {s.mode === 'halftone' && <Field label="Tamanho dos pontos" detail="Efeito tipo Rasterbator"><Slider value={s.dotSize} min={2} max={15} step={1} onChange={v => change('dotSize', v)} suffix=" mm" /></Field>}
          <button type="button" className="reset-link" onClick={() => setS(prev => ({ ...prev, fit: 'contain', zoom: 100, offsetX: 0, offsetY: 0, rotation: 0, flipX: false, grayscale: false, brightness: 100, contrast: 100, mode: 'normal', dotSize: 5 }))}><RotateCcw size={14} /> Restaurar ajustes da imagem</button>
        </section>
      </aside>

      <section className="center-stage">
        {asset ? <><div className="center-heading"><div><h2>Seu pôster</h2><p>Veja como sua arte ficará dividida antes de imprimir.</p></div><button type="button" className="outline-button" onClick={() => setLargePreview(true)}><Maximize2 size={16} /> Ampliar</button></div><Preview asset={asset} s={s} /><div className="preview-annotation"><Move size={16} /><span>Use os controles “Zoom” e “Mover” ao lado para ajustar o enquadramento. As linhas mostram onde as páginas serão divididas.</span></div></> : <div className="empty-stage"><div className="empty-illustration" aria-hidden="true"><div><FileImage size={49} strokeWidth={1.3} /></div><span className="empty-grid-line one"/><span className="empty-grid-line two" /></div><div className="empty-copy"><h2>Sua arte, em tamanho de pôster.</h2><p>Envie uma imagem ou PDF para ver a divisão em tempo real. Sem precisar criar conta.</p><button type="button" className="primary-button" onClick={() => uploadRef.current?.click()}><ImagePlus size={18} /> Escolher imagem</button></div><div className="empty-features"><span><Check size={15} /> Impressão A4, A3 e Carta</span><span><Check size={15} /> PDF com guia opcional</span><span><Check size={15} /> Arquivo processado no aparelho</span></div></div>}
      </section>

      <aside className="output-panel">
        <div className="output-head"><span className="eyebrow">RESUMO</span><span className="live-label"><span /> Atualizado</span></div>
        <div className="summary-list">
          <div><span>Divisão</span><strong>{s.columns} × {s.rows} folhas</strong></div>
          <div><span>Papel</span><strong>{PAPERS[s.paper].label} · {s.orientation === 'portrait' ? 'Retrato' : 'Paisagem'}</strong></div>
          <div><span>Margens</span><strong>{s.margin} mm</strong></div>
          <div><span>Sobreposição</span><strong>{s.overlap} mm</strong></div>
        </div>
        <div className="output-dimensions"><span>TAMANHO FINAL ESTIMADO</span><strong>{centimeters(m.posterW)} <span>×</span> {centimeters(m.posterH)} <small>cm</small></strong></div>

        <div className="output-divider" />
        <div className="quality-heading"><span className="eyebrow">QUALIDADE DA IMAGEM</span>{asset && <strong className={estimated >= 150 ? 'quality-good' : estimated >= 100 ? 'quality-medium' : 'quality-poor'}>{estimated} DPI</strong>}</div>
        {asset ? <><div className="quality-track"><div style={{ width: `${clamp(estimated / 300 * 100, 2, 100)}%` }} className={estimated >= 150 ? 'good' : estimated >= 100 ? 'medium' : 'poor'} /></div><div className="quality-labels"><span>Baixa</span><span>Boa a partir de 150 DPI</span></div><p className="quality-note">{estimated >= 150 ? 'Boa definição estimada para impressão.' : estimated >= 100 ? 'Pode apresentar leve perda de nitidez de perto.' : 'A imagem pode ficar pixelada. Tente usar um arquivo de maior resolução ou menos folhas.'}</p></> : <p className="summary-placeholder">A avaliação de nitidez aparecerá depois que você enviar sua imagem.</p>}

        <div className="output-divider" />
        <span className="eyebrow export-eyebrow">OPÇÕES DO PDF</span>
        <Switch label="Guia de montagem na última página" detail="Pode retirar sem afetar o pôster" checked={s.guidePage} onChange={v => change('guidePage', v)} />
        <Switch label="Marcas de corte" detail="Pequenas marcas nas margens" checked={s.cropMarks} onChange={v => change('cropMarks', v)} />
        <Switch label="Identificar folhas" detail="A1, B1, A2, B2…" checked={s.pageLabels} onChange={v => change('pageLabels', v)} />
        <Field label="Qualidade do PDF" detail="Mais DPI = arquivo maior"><select value={s.dpi} onChange={e => change('dpi', Number(e.target.value) as Settings['dpi'])}><option value={150}>150 DPI · rápido</option><option value={200}>200 DPI · equilibrado</option><option value={300}>300 DPI · alta qualidade</option></select></Field>
        {s.dpi === 300 && m.count > 12 && <p className="warning-note">Atenção: muitas folhas a 300 DPI podem exigir bastante memória. Se travar, use 150 ou 200 DPI.</p>}
        <div className="total-summary"><FileText size={18} /><div><strong>{totalPages} páginas no PDF</strong><small>{m.count} para o pôster{s.guidePage ? ' + 1 de instruções' : ''}</small></div></div>
        <button disabled={!asset || status === 'loading'} type="button" className="generate-button" onClick={status === 'generating' ? () => { cancelGeneration.current = true; } : () => void exportPdf()}>
          {status === 'generating' ? <><span className="button-spinner" /> {cancelGeneration.current ? 'Cancelando…' : `Gerando PDF… ${progress}%`}</> : status === 'loading' ? <><span className="button-spinner" /> Abrindo arquivo…</> : <><ArrowDownToLine size={19} /> Gerar e baixar PDF</>}
        </button>
        {status === 'generating' && <div className="progress-track"><div style={{ width: `${progress}%` }} /></div>}
        {downloadUrl && status === 'idle' && <div className="download-success"><Check size={17}/><span>PDF gerado.</span><a href={downloadUrl} download={downloadName}>Baixar novamente</a></div>}
        <p className="generation-note"><ShieldCheck size={15} /> Gratuito, sem cadastro e sem enviar sua arte a servidores.</p>
        <div className="print-help"><button type="button" onClick={() => setShowHelp(true)}><Printer size={17} /> Como imprimir corretamente <ChevronDown size={15} /></button></div>
      </aside>
    </main>

    <footer className="site-footer"><span>Posterfeito · Um pôster maior, sem complicação.</span><span>Os arquivos não são armazenados no site. Você pode fechar a página depois do download.</span></footer>

    {largePreview && asset && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setLargePreview(false); }}><div className="modal-preview" role="dialog" aria-modal="true" aria-label="Pré-visualização ampliada"><div className="modal-header"><strong>Pré-visualização ampliada</strong><button type="button" onClick={() => setLargePreview(false)} aria-label="Fechar"><X size={21} /></button></div><Preview asset={asset} s={s} large /></div></div>}
    {showHelp && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowHelp(false); }}><div className="help-modal" role="dialog" aria-modal="true" aria-label="Como imprimir seu pôster"><div className="modal-header"><strong>Como imprimir seu pôster</strong><button type="button" onClick={() => setShowHelp(false)} aria-label="Fechar"><X size={21} /></button></div><div className="help-content"><div className="help-intro"><Printer size={23} /><p>A configuração mais importante é imprimir em <strong>100% / Tamanho real</strong>. A opção “Ajustar à página” muda o tamanho do pôster e desalinha as emendas.</p></div><ol><li><strong>Abra o PDF baixado</strong> no leitor de sua preferência.</li><li><strong>Selecione o papel correto</strong> ({PAPERS[s.paper].label}) e {s.orientation === 'portrait' ? 'retrato' : 'paisagem'}.</li><li><strong>Defina escala de 100%</strong> e uma página do PDF por folha de papel.</li><li><strong>Faça uma folha de teste</strong> para confirmar as medidas antes de imprimir tudo.</li><li><strong>Recorte as margens internas</strong>, alinhe pelas letras e números e cole as folhas pelo verso.{s.overlap > 0 ? ` Use a sobreposição de ${s.overlap} mm para casar as imagens.` : ''}</li></ol><div className="help-tip"><Sparkles size={19} /><span>Você pode incluir essas instruções no PDF usando a opção “Guia de montagem na última página”.</span></div></div></div></div>}
  </div>;
}

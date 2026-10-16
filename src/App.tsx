import { useEffect, useRef, useState } from 'react';
import { Brightling, DEFAULT_COLOURS, LIBRARY_KEY, makeFrame, makePack, nameAvailable, PALETTES, parseLibrary, Template } from './maker';
import { CharacterId, clampPoint, DEFAULT_SCENE, HEIGHT, moveTowards, parseScene, Point, Scene, STORAGE_KEY, WIDTH } from './scene';
import { directionTo, frameForDistance, Motion, STOP_MS, TURN_MS, WALK_SPEED } from './walking';
import { waveFrameAt } from './wave';
import { generateBrightlingFrames, OLIVER_SPEC, svgDataUrl } from './brightling';

const SPRITE_HEIGHT = 355;
const SPRITE_WIDTH = 213;
const WAVE_WIDTH = 245;
const legacyFrames = generateBrightlingFrames(OLIVER_SPEC);
const legacySprites = { idle: svgDataUrl(legacyFrames.idle), side: legacyFrames.side.map(svgDataUrl), wave: legacyFrames.wave.map(svgDataUrl) };
const emptyMotion = (): Motion => ({ direction: 1, distance: 0, turnUntil: 0, stopUntil: 0, moving: false });
const readScene = (): Scene => { try { return parseScene(localStorage.getItem(STORAGE_KEY)) ?? structuredClone(DEFAULT_SCENE); } catch { return structuredClone(DEFAULT_SCENE); } };
const readLibrary = (): Brightling[] => { try { return parseLibrary(localStorage.getItem(LIBRARY_KEY)); } catch { return []; } };
const spriteSource = (id: string, pose: 'idle' | 'side' | 'wave', frame = 0): string => {
  if (id === 'oliver') return pose === 'idle' ? legacySprites.idle : legacySprites[pose][frame];
  if (pose === 'idle') return `/art/${id}-0.png`;
  if (pose === 'side') return frame === 0 ? `/art/${id}-side-0.png` : `/art/${id}-side-v3-${frame}.png`;
  return `/art/${id}-wave-${frame + 1}.png`;
};
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
}
type Sprite = HTMLImageElement | HTMLCanvasElement;
type Pack = { idle: Sprite; side: Sprite[]; wave: Sprite[] };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const savedRef = useRef<Scene>(readScene());
  const positionsRef = useRef<Record<string, Point>>(Object.fromEntries(Object.entries(savedRef.current.characters).map(([id, value]) => [id, { ...value.start }])));
  const destinationsRef = useRef<Record<string, Point | null>>(Object.fromEntries(Object.entries(savedRef.current.characters).map(([id, value]) => [id, value.destination])));
  const motionsRef = useRef<Record<string, Motion>>(Object.fromEntries(Object.keys(savedRef.current.characters).map(id => [id, emptyMotion()])));
  const selectedRef = useRef<CharacterId>('max');
  const playingRef = useRef(false);
  const waveRef = useRef<{ id: CharacterId; startedAt: number } | null>(null);
  const dragRef = useRef<{ id: CharacterId; origin: Point; offset: Point; moved: boolean } | null>(null);
  const [sceneIds, setSceneIds] = useState(() => Object.keys(savedRef.current.characters));
  const [library, setLibrary] = useState(readLibrary);
  const [selected, setSelected] = useState<CharacterId>('max');
  const [playing, setPlaying] = useState(false);
  const [waving, setWaving] = useState(false);
  const [notice, setNotice] = useState('Drag a character, then click the floor to choose where they walk.');
  const [makerOpen, setMakerOpen] = useState(false);
  const [template, setTemplate] = useState<Template>('male');
  const [draftName, setDraftName] = useState('');
  const [colours, setColours] = useState(DEFAULT_COLOURS.male);
  const [preview, setPreview] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const ids = sceneIds.filter(id => !unavailable.includes(id) && (!id.startsWith('brightling-') || library.some(item => item.id === id)));
  const custom = (id: string) => library.find(item => item.id === id);
  const name = (id: string) => id === 'max' ? 'Max' : id === 'maxine' ? 'Maxine' : id === 'oliver' ? OLIVER_SPEC.name : custom(id)?.name ?? 'Brightling';
  const colour = (id: string) => id === 'max' ? '#13bfc0' : id === 'maxine' ? '#ee61ab' : id === 'oliver' ? OLIVER_SPEC.bodyColour : custom(id)?.body ?? '#777777';

  useEffect(() => {
    if (!makerOpen) return;
    let active = true;
    setPreview(''); setPreviewError(false);
    makeFrame({ template, ...colours }, '0').then(canvas => { if (active) setPreview(canvas.toDataURL('image/png')); }).catch(() => { if (active) setPreviewError(true); });
    return () => { active = false; };
  }, [makerOpen, template, colours]);

  useEffect(() => {
    let active = true;
    Promise.allSettled(library.map(async item => [item.id, (await makeFrame(item, '0')).toDataURL('image/png')] as const))
      .then(results => { if (!active) return; setThumbnails(Object.fromEntries(results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []))); if (results.some(result => result.status === 'rejected')) setNotice('A saved Brightling could not load its artwork. Other characters are still available.'); });
    return () => { active = false; };
  }, [library]);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    let active = true, animation = 0, last = 0;
    Promise.all([loadImage('/art/living-room.png'), ...ids.map(async id => {
      const item = library.find(character => character.id === id);
      if (item) return makePack(item).catch(error => { if (active) setUnavailable(previous => previous.includes(id) ? previous : [...previous, id]); throw error; });
      return { idle: await loadImage(spriteSource(id, 'idle')), side: await Promise.all(Array.from({ length: 5 }, (_, frame) => loadImage(spriteSource(id, 'side', frame)))), wave: await Promise.all(Array.from({ length: 3 }, (_, frame) => loadImage(spriteSource(id, 'wave', frame)))) };
    })]).then(([room, ...packs]) => {
      if (!active) return;
      const sprites = Object.fromEntries(ids.map((id, index) => [id, packs[index]])) as Record<string, Pack>;
      const render = (time: number) => {
        const elapsed = Math.min((time - last) / 1000 || 0, 0.05); last = time;
        if (playingRef.current) {
          let activeMotion = false;
          for (const id of ids) {
            const motion = motionsRef.current[id];
            if (!motion.moving && time >= motion.stopUntil) continue;
            activeMotion = true;
            if (!motion.moving || time < motion.turnUntil) continue;
            const target = destinationsRef.current[id]; if (!target) continue;
            const before = positionsRef.current[id];
            const after = moveTowards(before, target, WALK_SPEED * elapsed);
            positionsRef.current[id] = after;
            motion.distance += Math.hypot(after.x - before.x, after.y - before.y);
            if (after.x === target.x && after.y === target.y) { motion.moving = false; motion.stopUntil = time + STOP_MS; }
          }
          if (!activeMotion) { playingRef.current = false; setPlaying(false); setNotice('Walk complete. Reset returns to the saved starting positions.'); }
        }
        const wave = waveRef.current;
        const waveFrame = wave ? waveFrameAt(time - wave.startedAt) : null;
        if (wave && waveFrame === null) { waveRef.current = null; setWaving(false); setNotice(`${name(wave.id)} finished waving.`); }
        context.clearRect(0, 0, WIDTH, HEIGHT); context.drawImage(room, 0, 0, WIDTH, HEIGHT);
        for (const id of ids) {
          const destination = destinationsRef.current[id]; if (!destination) continue;
          context.save(); context.strokeStyle = colour(id); context.fillStyle = '#fffdf4'; context.lineWidth = 6; context.setLineDash([11, 9]);
          context.beginPath(); context.arc(destination.x, destination.y, 21, 0, Math.PI * 2); context.fill(); context.stroke(); context.setLineDash([]);
          context.beginPath(); context.arc(destination.x, destination.y, 6, 0, Math.PI * 2); context.fillStyle = colour(id); context.fill(); context.restore();
        }
        for (const id of [...ids].sort((a, b) => positionsRef.current[a].y - positionsRef.current[b].y)) {
          const p = positionsRef.current[id], motion = motionsRef.current[id];
          const showingSide = playingRef.current && (motion.moving || time < motion.stopUntil);
          const frame = showingSide && motion.moving && time >= motion.turnUntil ? frameForDistance(motion.distance) : 0;
          context.save(); context.fillStyle = 'rgba(68, 42, 75, .22)'; context.beginPath(); context.ellipse(p.x, p.y - 3, 87, 17, 0, 0, Math.PI * 2); context.fill();
          if (id === selectedRef.current) { context.strokeStyle = colour(id); context.lineWidth = 5; context.beginPath(); context.ellipse(p.x, p.y - 3, 91, 22, 0, 0, Math.PI * 2); context.stroke(); }
          const bob = showingSide && motion.moving && frame % 2 === 0 ? 3 : 0;
          if (showingSide) {
            context.translate(p.x, p.y); context.scale(motion.direction, 1);
            const width = id === 'oliver' ? 239 : frame === 0 ? SPRITE_WIDTH : 239;
            context.drawImage(sprites[id].side[frame], -width / 2, -SPRITE_HEIGHT - bob, width, SPRITE_HEIGHT);
          } else if (wave?.id === id && waveFrame !== null && waveFrame > 0) {
            context.drawImage(sprites[id].wave[waveFrame - 1], p.x - WAVE_WIDTH / 2, p.y - SPRITE_HEIGHT, WAVE_WIDTH, SPRITE_HEIGHT);
          } else context.drawImage(sprites[id].idle, p.x - SPRITE_WIDTH / 2, p.y - SPRITE_HEIGHT, SPRITE_WIDTH, SPRITE_HEIGHT);
          context.restore();
        }
        animation = requestAnimationFrame(render);
      };
      animation = requestAnimationFrame(render);
    }).catch(() => { if (active) setNotice('Artwork could not load. Check the local assets and refresh.'); });
    return () => { active = false; cancelAnimationFrame(animation); };
  }, [sceneIds, library, unavailable]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => { const box = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - box.left) * WIDTH / box.width, y: (event.clientY - box.top) * HEIGHT / box.height }; };
  const select = (id: CharacterId) => { selectedRef.current = id; setSelected(id); setNotice(`${name(id)} selected. Drag to position, then click the floor for a destination.`); };
  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (playingRef.current) return;
    waveRef.current = null; setWaving(false);
    const point = pointFromEvent(event);
    const hit = [...ids].sort((a, b) => positionsRef.current[b].y - positionsRef.current[a].y).find(id => { const p = positionsRef.current[id]; return Math.abs(point.x - p.x) < SPRITE_WIDTH * .43 && point.y >= p.y - SPRITE_HEIGHT * .88 && point.y <= p.y; });
    if (hit) { select(hit); dragRef.current = { id: hit, origin: point, offset: { x: positionsRef.current[hit].x - point.x, y: positionsRef.current[hit].y - point.y }, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }
    else if (point.y >= 570) { destinationsRef.current[selectedRef.current] = clampPoint(point); setNotice(`${name(selectedRef.current)}'s walking destination is set. Press Play.`); }
  };
  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => { const drag = dragRef.current; if (!drag) return; const point = pointFromEvent(event); if (Math.hypot(point.x - drag.origin.x, point.y - drag.origin.y) > 5) drag.moved = true; if (drag.moved) positionsRef.current[drag.id] = clampPoint({ x: point.x + drag.offset.x, y: point.y + drag.offset.y }); };
  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => { const drag = dragRef.current; if (drag?.moved) setNotice(`${name(drag.id)} positioned. Click the floor to choose a destination.`); dragRef.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  const play = () => {
    if (!ids.some(id => { const target = destinationsRef.current[id]; return target && Math.hypot(target.x - positionsRef.current[id].x, target.y - positionsRef.current[id].y) > 1; })) { setNotice('Choose a Brightling destination first.'); return; }
    waveRef.current = null; setWaving(false); const now = performance.now();
    for (const id of ids) { const target = destinationsRef.current[id], motion = motionsRef.current[id]; motion.moving = !!target && Math.hypot(target.x - positionsRef.current[id].x, target.y - positionsRef.current[id].y) > 1; motion.distance = 0; motion.stopUntil = 0; if (motion.moving && target) { motion.direction = directionTo(positionsRef.current[id], target, motion.direction); motion.turnUntil = now + TURN_MS; } }
    playingRef.current = true; setPlaying(true); setNotice('Walking to the selected destinations…');
  };
  const wave = () => { if (playingRef.current || waveRef.current) return; waveRef.current = { id: selectedRef.current, startedAt: performance.now() }; setWaving(true); setNotice(`${name(selectedRef.current)} is waving hello!`); };
  const reset = () => { playingRef.current = false; setPlaying(false); waveRef.current = null; setWaving(false); for (const id of sceneIds) { motionsRef.current[id].moving = false; motionsRef.current[id].stopUntil = 0; positionsRef.current[id] = { ...savedRef.current.characters[id].start }; } setNotice('Restored the saved starting positions.'); };
  const save = () => { const scene: Scene = { version: 1, characters: Object.fromEntries(sceneIds.map(id => [id, { start: { ...positionsRef.current[id] }, destination: destinationsRef.current[id] && { ...destinationsRef.current[id] } }])) }; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scene)); savedRef.current = scene; setNotice('Scene saved on this device. Reset now returns to these positions.'); } catch { setNotice('Could not save the scene in this browser. Check site storage settings.'); } };
  const open = () => {
    let scene: Scene | null = null; try { scene = parseScene(localStorage.getItem(STORAGE_KEY)); } catch { /* storage unavailable */ }
    if (!scene) { setNotice('No saved scene found on this device yet.'); return; }
    playingRef.current = false; setPlaying(false); waveRef.current = null; setWaving(false); savedRef.current = scene;
    const entries = Object.entries(scene.characters);
    for (const [id, character] of entries) { motionsRef.current[id] = emptyMotion(); positionsRef.current[id] = { ...character.start }; destinationsRef.current[id] = character.destination; }
    setSceneIds(entries.map(([id]) => id));
    if (!entries.some(([id]) => id === selectedRef.current && !unavailable.includes(id) && (!id.startsWith('brightling-') || library.some(item => item.id === id)))) { selectedRef.current = 'max'; setSelected('max'); }
    setNotice(entries.every(([id]) => !id.startsWith('brightling-') || library.some(item => item.id === id)) ? 'Saved scene reopened.' : 'Saved scene reopened; missing Brightling data was kept but cannot be displayed.');
  };
  const changeTemplate = (value: Template) => { setTemplate(value); setColours(DEFAULT_COLOURS[value]); };
  const saveBrightling = async () => {
    const cleanName = draftName.trim().replace(/\s+/g, ' ');
    if (!cleanName || cleanName.length > 32) { setNotice('Enter a name between 1 and 32 characters.'); return; }
    if (!nameAvailable(cleanName, library)) { setNotice('That name is already in use. Choose another.'); return; }
    setLoading(true);
    try {
      await makePack({ template, ...colours });
      const item: Brightling = { id: `brightling-${crypto.randomUUID()}`, name: cleanName, template, ...colours };
      const next = [...library, item]; localStorage.setItem(LIBRARY_KEY, JSON.stringify(next)); setLibrary(next);
      setMakerOpen(false); setDraftName(''); setNotice(`${item.name} saved. Add them to the living room below.`);
    } catch { setNotice('Could not save this Brightling. Check artwork files and browser storage.'); }
    finally { setLoading(false); }
  };
  const addBrightling = (item: Brightling) => {
    if (sceneIds.includes(item.id)) { select(item.id); return; }
    const count = ids.length - 2;
    const start = clampPoint({ x: 720 + count * 110, y: 780 + (count % 2) * 45 });
    positionsRef.current[item.id] = start; destinationsRef.current[item.id] = null; motionsRef.current[item.id] = emptyMotion();
    savedRef.current.characters[item.id] = { start: { ...start }, destination: null };
    setSceneIds([...sceneIds, item.id]); select(item.id); setNotice(`${item.name} added. Drag to place, then save the scene.`);
  };

  return <div className="app-shell">
    <header className="header"><div className="brand"><span className="brand-star">✦</span><div><strong>BrightSenAppsTales</strong><small>2D CARTOON MAKER</small></div></div><span className="local-badge"><span /> Saved in this browser</span></header>
    <main className="main">
      <div className="intro"><div><p className="eyebrow">THE LITTLE LIVING ROOM</p><h1>Make a moment <em>move.</em></h1><p>Place your Brightlings, choose where they walk, and press play.</p></div><button className="maker-toggle" onClick={() => setMakerOpen(!makerOpen)} aria-expanded={makerOpen}>{makerOpen ? 'Close Maker' : '+ Brightling Maker'}</button></div>
      {makerOpen && <section className="maker-panel" aria-label="Brightling Maker"><div className="maker-fields"><h2>Make a Brightling</h2><p>Choose a template and colours. The approved artwork and animations stay intact.</p><label>Template<select value={template} onChange={event => changeTemplate(event.target.value as Template)}><option value="male">Male · Max template</option><option value="female">Female · Maxine template</option></select></label><label>Name<input value={draftName} maxLength={32} onChange={event => setDraftName(event.target.value)} placeholder="e.g. Charlie" /></label>{(['body', 'hair', 'clothing'] as const).map(key => <fieldset className="colour-field" key={key}><legend>{key === 'clothing' ? 'Main clothing colour' : `${key[0].toUpperCase()}${key.slice(1)} colour`}</legend><div className="swatches">{PALETTES[key].map(value => <button key={value} type="button" className={`swatch ${colours[key] === value ? 'chosen' : ''}`} style={{ background: value }} onClick={() => setColours({ ...colours, [key]: value })} aria-label={`${key} ${value}`} aria-pressed={colours[key] === value} />)}</div></fieldset>)}<button className="maker-save" disabled={!preview || loading} onClick={saveBrightling}>{loading ? 'Preparing frames…' : 'Save Brightling'}</button></div><div className="maker-preview"><strong>Live preview</strong>{preview ? <img src={preview} alt={`${draftName.trim() || 'New Brightling'} front-facing preview`} /> : <span>{previewError ? 'Artwork unavailable' : 'Preparing preview…'}</span>}<small>Same artwork and colours used in the scene</small></div></section>}
      <div className="workspace"><section className="stage-panel" aria-label="Cartoon stage"><div className="stage-top"><span><span className="live-dot" /> LIVING ROOM</span><span>Click a character, then the floor</span></div><canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Living room scene with draggable Brightlings" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} /><div className="stage-bottom"><span>✦ &nbsp; Your scene</span><span>Drag to place · Click to set destination</span></div></section>
        <aside className="sidebar"><div className="side-heading"><span className="side-number">01</span><div><h2>Characters</h2><p>Pick who you want to move</p></div></div><div className="character-list">{ids.map(id => <button key={id} className={`character-card ${selected === id ? 'active' : ''}`} style={{ '--character-colour': colour(id) } as React.CSSProperties} onClick={() => select(id)} aria-pressed={selected === id}><img src={custom(id) ? thumbnails[id] : spriteSource(id, 'idle')} alt="" /><span><strong>{name(id)}</strong><small>{selected === id ? 'Selected · ready to move' : 'Click to select'}</small></span><span className="radio-mark" /></button>)}</div><button className="wave-button" onClick={wave} disabled={playing || waving} aria-label={`Wave ${name(selected)}`}>✋ &nbsp; Wave {name(selected)}</button>
          {library.length > 0 && <div className="library"><h3>Saved Brightlings</h3>{library.map(item => <button key={item.id} onClick={() => addBrightling(item)} disabled={!thumbnails[item.id] || unavailable.includes(item.id)}><img src={thumbnails[item.id]} alt="" /><span>{item.name}<small>{unavailable.includes(item.id) || !thumbnails[item.id] ? 'Artwork unavailable' : sceneIds.includes(item.id) ? 'In scene · select' : 'Add to scene'}</small></span><b>{sceneIds.includes(item.id) ? '✓' : '+'}</b></button>)}</div>}
          <div className="divider" /><div className="side-heading"><span className="side-number">02</span><div><h2>Make it move</h2><p>Watch your scene come to life</p></div></div><div className="actions"><button className="play-button" onClick={play} disabled={playing}><span>▶</span> {playing ? 'Playing…' : 'Play scene'}</button><button className="reset-button" onClick={reset}>↺ &nbsp; Reset positions</button></div><div className="divider" /><div className="side-heading"><span className="side-number">03</span><div><h2>Keep your scene</h2><p>Come back to it any time</p></div></div><div className="save-actions"><button onClick={save}>↓ &nbsp; Save scene</button><button onClick={open}>↗ &nbsp; Open saved</button></div><p className="storage-note">Stored locally in this browser as scene JSON.</p></aside></div><div className="tip"><span>✦</span><p role="status">{notice}</p></div>
    </main>
  </div>;
}

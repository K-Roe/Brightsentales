import { useEffect, useRef, useState } from 'react';
import { CharacterId, clampPoint, DEFAULT_SCENE, HEIGHT, moveTowards, parseScene, Point, Scene, STORAGE_KEY, WIDTH } from './scene';
import { directionTo, frameForDistance, Motion, STOP_MS, TURN_MS, WALK_SPEED } from './walking';
import { waveFrameAt } from './wave';
import { generateBrightlingFrames, OLIVER_SPEC, svgDataUrl } from './brightling';

const ids: CharacterId[] = ['max', 'maxine', 'oliver'];
const names: Record<CharacterId, string> = { max: 'Max', maxine: 'Maxine', oliver: OLIVER_SPEC.name };
const colours: Record<CharacterId, string> = { max: '#13bfc0', maxine: '#ee61ab', oliver: OLIVER_SPEC.bodyColour };
const SPRITE_HEIGHT = 355;
const SPRITE_WIDTH = 213;
const WAVE_WIDTH = 245;
const oliverFrames = generateBrightlingFrames(OLIVER_SPEC);
const oliverSprites = {
  idle: svgDataUrl(oliverFrames.idle),
  side: oliverFrames.side.map(svgDataUrl),
  wave: oliverFrames.wave.map(svgDataUrl),
};
const spriteSource = (id: CharacterId, pose: 'idle' | 'side' | 'wave', frame = 0): string => {
  if (id === 'oliver') return pose === 'idle' ? oliverSprites.idle : oliverSprites[pose][frame];
  if (pose === 'idle') return `/art/${id}-0.png`;
  if (pose === 'side') return frame === 0 ? `/art/${id}-side-0.png` : `/art/${id}-side-v3-${frame}.png`;
  return `/art/${id}-wave-${frame + 1}.png`;
};

function readSaved(): Scene {
  try { return parseScene(localStorage.getItem(STORAGE_KEY)) ?? structuredClone(DEFAULT_SCENE); }
  catch { return structuredClone(DEFAULT_SCENE); }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const savedRef = useRef<Scene>(readSaved());
  const positionsRef = useRef<Record<CharacterId, Point>>({
    max: { ...savedRef.current.characters.max.start },
    maxine: { ...savedRef.current.characters.maxine.start },
    oliver: { ...savedRef.current.characters.oliver.start },
  });
  const destinationsRef = useRef<Record<CharacterId, Point | null>>({
    max: savedRef.current.characters.max.destination,
    maxine: savedRef.current.characters.maxine.destination,
    oliver: savedRef.current.characters.oliver.destination,
  });
  const selectedRef = useRef<CharacterId>('max');
  const playingRef = useRef(false);
  const waveRef = useRef<{ id: CharacterId; startedAt: number } | null>(null);
  const motionsRef = useRef<Record<CharacterId, Motion>>({
    max: { direction: 1, distance: 0, turnUntil: 0, stopUntil: 0, moving: false },
    maxine: { direction: 1, distance: 0, turnUntil: 0, stopUntil: 0, moving: false },
    oliver: { direction: 1, distance: 0, turnUntil: 0, stopUntil: 0, moving: false },
  });
  const dragRef = useRef<{ id: CharacterId; origin: Point; offset: Point; moved: boolean } | null>(null);
  const [selected, setSelected] = useState<CharacterId>('max');
  const [playing, setPlaying] = useState(false);
  const [waving, setWaving] = useState(false);
  const [notice, setNotice] = useState('Drag a character, then click the floor to choose where they walk.');

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context) return;
    let active = true;
    let animation = 0;
    let last = 0;
    Promise.all([loadImage('/art/living-room.png'), ...ids.map(async id => ({
      idle: await loadImage(spriteSource(id, 'idle')),
      side: await Promise.all(Array.from({ length: 5 }, (_, frame) => loadImage(spriteSource(id, 'side', frame)))),
      wave: await Promise.all(Array.from({ length: 3 }, (_, frame) => loadImage(spriteSource(id, 'wave', frame)))),
    }))]).then(([room, ...spritePacks]) => {
      if (!active) return;
      const packs = Object.fromEntries(ids.map((id, index) => [id, spritePacks[index]])) as Record<CharacterId, (typeof spritePacks)[number]>;
      const render = (time: number) => {
        const elapsed = Math.min((time - last) / 1000 || 0, 0.05);
        last = time;
        if (playingRef.current) {
          let activeMotion = false;
          for (const id of ids) {
            const motion = motionsRef.current[id];
            if (!motion.moving && time >= motion.stopUntil) continue;
            activeMotion = true;
            if (!motion.moving || time < motion.turnUntil) continue;
            const target = destinationsRef.current[id];
            if (!target) continue;
            const before = positionsRef.current[id];
            const after = moveTowards(before, target, WALK_SPEED * elapsed);
            positionsRef.current[id] = after;
            motion.distance += Math.hypot(after.x - before.x, after.y - before.y);
            if (after.x === target.x && after.y === target.y) {
              motion.moving = false;
              motion.stopUntil = time + STOP_MS;
            }
          }
          if (!activeMotion) { playingRef.current = false; setPlaying(false); setNotice('Walk complete. Reset returns to the saved starting positions.'); }
        }
        const wave = waveRef.current;
        const waveFrame = wave ? waveFrameAt(time - wave.startedAt) : null;
        if (wave && waveFrame === null) {
          waveRef.current = null;
          setWaving(false);
          setNotice(`${names[wave.id]} finished waving.`);
        }
        context.clearRect(0, 0, WIDTH, HEIGHT);
        context.drawImage(room, 0, 0, WIDTH, HEIGHT);
        for (const id of ids) {
          const destination = destinationsRef.current[id];
          if (!destination) continue;
          context.save();
          context.strokeStyle = colours[id];
          context.fillStyle = '#fffdf4';
          context.lineWidth = 6;
          context.setLineDash([11, 9]);
          context.beginPath(); context.arc(destination.x, destination.y, 21, 0, Math.PI * 2); context.fill(); context.stroke();
          context.setLineDash([]);
          context.beginPath(); context.arc(destination.x, destination.y, 6, 0, Math.PI * 2); context.fillStyle = colours[id]; context.fill();
          context.restore();
        }
        for (const id of [...ids].sort((a, b) => positionsRef.current[a].y - positionsRef.current[b].y)) {
          const p = positionsRef.current[id];
          const motion = motionsRef.current[id];
          const showingSide = playingRef.current && (motion.moving || time < motion.stopUntil);
          const frame = showingSide && motion.moving && time >= motion.turnUntil ? frameForDistance(motion.distance) : 0;
          context.save();
          context.fillStyle = 'rgba(68, 42, 75, .22)';
          context.beginPath(); context.ellipse(p.x, p.y - 3, 87, 17, 0, 0, Math.PI * 2); context.fill();
          if (id === selectedRef.current) {
            context.strokeStyle = colours[id]; context.lineWidth = 5;
            context.beginPath(); context.ellipse(p.x, p.y - 3, 91, 22, 0, 0, Math.PI * 2); context.stroke();
          }
          const bob = showingSide && motion.moving && frame % 2 === 0 ? 3 : 0;
          if (showingSide) {
            context.translate(p.x, p.y);
            context.scale(motion.direction, 1);
            const width = id === 'oliver' ? 239 : frame === 0 ? SPRITE_WIDTH : 239;
            context.drawImage(packs[id].side[frame], -width / 2, -SPRITE_HEIGHT - bob, width, SPRITE_HEIGHT);
          } else if (wave?.id === id && waveFrame !== null && waveFrame > 0) {
            context.drawImage(packs[id].wave[waveFrame - 1], p.x - WAVE_WIDTH / 2, p.y - SPRITE_HEIGHT, WAVE_WIDTH, SPRITE_HEIGHT);
          } else {
            context.drawImage(packs[id].idle, p.x - SPRITE_WIDTH / 2, p.y - SPRITE_HEIGHT, SPRITE_WIDTH, SPRITE_HEIGHT);
          }
          context.restore();
        }
        animation = requestAnimationFrame(render);
      };
      animation = requestAnimationFrame(render);
    }).catch(() => setNotice('Artwork could not load. Refresh the page to try again.'));
    return () => { active = false; cancelAnimationFrame(animation); };
  }, []);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - box.left) * WIDTH / box.width, y: (event.clientY - box.top) * HEIGHT / box.height };
  };

  const select = (id: CharacterId) => { selectedRef.current = id; setSelected(id); setNotice(`${names[id]} selected. Drag to position, then click the floor for a destination.`); };

  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (playingRef.current) return;
    waveRef.current = null;
    setWaving(false);
    const point = pointFromEvent(event);
    const hit = [...ids].reverse().find(id => {
      const p = positionsRef.current[id];
      return Math.abs(point.x - p.x) < SPRITE_WIDTH * .43 && point.y >= p.y - SPRITE_HEIGHT * .88 && point.y <= p.y;
    });
    if (hit) {
      select(hit);
      dragRef.current = { id: hit, origin: point, offset: { x: positionsRef.current[hit].x - point.x, y: positionsRef.current[hit].y - point.y }, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (point.y >= 570) {
      destinationsRef.current[selectedRef.current] = clampPoint(point);
      setNotice(`${names[selectedRef.current]}’s walking destination is set. Press Play.`);
    }
  };

  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointFromEvent(event);
    if (Math.hypot(point.x - drag.origin.x, point.y - drag.origin.y) > 5) drag.moved = true;
    if (drag.moved) positionsRef.current[drag.id] = clampPoint({ x: point.x + drag.offset.x, y: point.y + drag.offset.y });
  };

  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag?.moved) setNotice(`${names[drag.id]} positioned. Click the floor to choose a destination.`);
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const play = () => {
    if (!ids.some(id => {
      const target = destinationsRef.current[id];
      return target && Math.hypot(target.x - positionsRef.current[id].x, target.y - positionsRef.current[id].y) > 1;
    })) { setNotice('Choose a Brightling destination first.'); return; }
    waveRef.current = null; setWaving(false);
    const now = performance.now();
    for (const id of ids) {
      const target = destinationsRef.current[id];
      const motion = motionsRef.current[id];
      motion.moving = !!target && Math.hypot(target.x - positionsRef.current[id].x, target.y - positionsRef.current[id].y) > 1;
      motion.distance = 0;
      motion.stopUntil = 0;
      if (motion.moving && target) {
        motion.direction = directionTo(positionsRef.current[id], target, motion.direction);
        motion.turnUntil = now + TURN_MS;
      }
    }
    playingRef.current = true; setPlaying(true); setNotice('Walking to the selected destinations…');
  };

  const wave = () => {
    if (playingRef.current || waveRef.current) return;
    waveRef.current = { id: selectedRef.current, startedAt: performance.now() };
    setWaving(true);
    setNotice(`${names[selectedRef.current]} is waving hello!`);
  };

  const reset = () => {
    playingRef.current = false; setPlaying(false);
    waveRef.current = null; setWaving(false);
    for (const id of ids) { motionsRef.current[id].moving = false; motionsRef.current[id].stopUntil = 0; }
    for (const id of ids) positionsRef.current[id] = { ...savedRef.current.characters[id].start };
    setNotice('Restored the saved starting positions.');
  };

  const save = () => {
    const scene: Scene = { version: 1, characters: {
      max: { start: { ...positionsRef.current.max }, destination: destinationsRef.current.max && { ...destinationsRef.current.max } },
      maxine: { start: { ...positionsRef.current.maxine }, destination: destinationsRef.current.maxine && { ...destinationsRef.current.maxine } },
      oliver: { start: { ...positionsRef.current.oliver }, destination: destinationsRef.current.oliver && { ...destinationsRef.current.oliver } },
    } };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scene)); savedRef.current = scene; setNotice('Scene saved on this device. Reset now returns to these positions.'); }
    catch { setNotice('Could not save the scene in this browser. Check site storage settings.'); }
  };

  const open = () => {
    let scene: Scene | null = null;
    try { scene = parseScene(localStorage.getItem(STORAGE_KEY)); } catch { /* handled below */ }
    if (!scene) { setNotice('No saved scene found on this device yet.'); return; }
    playingRef.current = false; setPlaying(false); savedRef.current = scene;
    waveRef.current = null; setWaving(false);
    for (const id of ids) { motionsRef.current[id].moving = false; motionsRef.current[id].stopUntil = 0; }
    for (const id of ids) { positionsRef.current[id] = { ...scene.characters[id].start }; destinationsRef.current[id] = scene.characters[id].destination; }
    setNotice('Saved scene reopened.');
  };

  return <div className="app-shell">
    <header className="header">
      <div className="brand"><span className="brand-star">✦</span><div><strong>BrightSenAppsTales</strong><small>2D CARTOON MAKER · MILESTONE 1</small></div></div>
      <span className="local-badge"><span /> Saved in this browser</span>
    </header>
    <main className="main">
      <div className="intro"><div><p className="eyebrow">THE LITTLE LIVING ROOM</p><h1>Make a moment <em>move.</em></h1><p>Place Max, Maxine and Oliver, choose where they walk, and press play.</p></div><div className="step-pill">01 <span>Set the scene</span></div></div>
      <div className="workspace">
        <section className="stage-panel" aria-label="Cartoon stage">
          <div className="stage-top"><span><span className="live-dot" /> LIVING ROOM</span><span>Click a character, then the floor</span></div>
          <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Living room scene with draggable Max, Maxine and Oliver" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} />
          <div className="stage-bottom"><span>✦ &nbsp; Your scene</span><span>Drag to place · Click to set destination</span></div>
        </section>
        <aside className="sidebar">
          <div className="side-heading"><span className="side-number">01</span><div><h2>Characters</h2><p>Pick who you want to move</p></div></div>
          <div className="character-list">{ids.map(id => <button key={id} className={`character-card ${selected === id ? 'active' : ''}`} style={{ '--character-colour': colours[id] } as React.CSSProperties} onClick={() => select(id)} aria-pressed={selected === id}><img src={spriteSource(id, 'idle')} alt="" /><span><strong>{names[id]}</strong><small>{selected === id ? 'Selected · ready to move' : 'Click to select'}</small></span><span className="radio-mark" /></button>)}</div>
          <button className="wave-button" onClick={wave} disabled={playing || waving} aria-label={`Wave ${names[selected]}`}>✋ &nbsp; Wave {names[selected]}</button>
          <div className="divider" />
          <div className="side-heading"><span className="side-number">02</span><div><h2>Make it move</h2><p>Watch your scene come to life</p></div></div>
          <div className="actions"><button className="play-button" onClick={play} disabled={playing}><span>▶</span> {playing ? 'Playing…' : 'Play scene'}</button><button className="reset-button" onClick={reset}>↺ &nbsp; Reset positions</button></div>
          <div className="divider" />
          <div className="side-heading"><span className="side-number">03</span><div><h2>Keep your scene</h2><p>Come back to it any time</p></div></div>
          <div className="save-actions"><button onClick={save}>↓ &nbsp; Save scene</button><button onClick={open}>↗ &nbsp; Open saved</button></div>
          <p className="storage-note">Stored locally in this browser as scene JSON.</p>
        </aside>
      </div>
      <div className="tip"><span>✦</span><p role="status">{notice}</p></div>
    </main>
  </div>;
}

import type { MouseEvent } from 'react';

type Props = {
  canSave: boolean;
  canPlay: boolean;
  hasSelection: boolean;
  hasCharacter: boolean;
  hasMax: boolean;
  hasMaxine: boolean;
  isLivingRoom: boolean;
  playing: boolean;
  leftWidth: number;
  inspectorWidth: number;
  showHelp: boolean;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onProjects?: () => void;
  onDeselect: () => void;
  onHierarchy: () => void;
  onAssets: () => void;
  onLeftWidth: (width: number) => void;
  onInspectorWidth: (width: number) => void;
  onAddMax: () => void;
  onAddMaxine: () => void;
  onLivingRoom: () => void;
  onWalk: () => void;
  onWave: () => void;
  onPlayPause: () => void;
  onStop: () => void;
  onReplay: () => void;
  onClassic?: () => void;
  onHelp: () => void;
};

export default function Studio31Menu(props: Props) {
  const run = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.currentTarget.closest('details')?.removeAttribute('open');
    action();
  };
  return <><nav className="studio31-menu" aria-label="Editor menu">
    <details><summary>File</summary><div><button onClick={event => run(event, props.onNew)}>New scene</button><button onClick={event => run(event, props.onOpen)}>Open scene…</button><button disabled={!props.canSave} onClick={event => run(event, props.onSave)}>Save scene</button><button disabled={!props.onProjects} onClick={event => run(event, () => props.onProjects?.())}>Projects</button></div></details>
    <details><summary>Edit</summary><div><button disabled={!props.hasSelection} onClick={event => run(event, props.onDeselect)}>Deselect</button></div></details>
    <details><summary>View</summary><div><button onClick={event => run(event, props.onHierarchy)}>Hierarchy</button><button onClick={event => run(event, props.onAssets)}>Asset browser</button><label>Left panel width<input type="range" min="150" max="300" value={props.leftWidth} onChange={event => props.onLeftWidth(Number(event.target.value))} /></label><label>Inspector width<input type="range" min="250" max="420" value={props.inspectorWidth} onChange={event => props.onInspectorWidth(Number(event.target.value))} /></label></div></details>
    <details><summary>Scene</summary><div><button disabled={props.hasMax} onClick={event => run(event, props.onAddMax)}>Add Max</button><button disabled={props.hasMaxine} onClick={event => run(event, props.onAddMaxine)}>Add Maxine</button><button disabled={props.isLivingRoom} onClick={event => run(event, props.onLivingRoom)}>Use Living Room</button></div></details>
    <details><summary>Animation</summary><div><button disabled={!props.hasCharacter} onClick={event => run(event, props.onWalk)}>Walk to a point</button><button disabled={!props.hasCharacter} onClick={event => run(event, props.onWave)}>Wave</button><button disabled={!props.canPlay} onClick={event => run(event, props.onPlayPause)}>{props.playing ? 'Pause' : 'Play'}</button><button onClick={event => run(event, props.onStop)}>Stop</button><button disabled={!props.canPlay} onClick={event => run(event, props.onReplay)}>Replay</button></div></details>
    <details><summary>Window</summary><div><button disabled={!props.onClassic} onClick={event => run(event, () => props.onClassic?.())}>Classic Studio</button></div></details>
    <details><summary>Help</summary><div><button onClick={event => run(event, props.onHelp)}>{props.showHelp ? 'Hide quick guide' : 'Show quick guide'}</button></div></details>
  </nav>{props.showHelp && <p className="studio31-help" role="status">Add a Brightling in Assets. Select them on the stage, drag at 0 seconds, choose Walk and click the floor. Scrub the timeline, add Wave, then Play and Save.</p>}</>;
}

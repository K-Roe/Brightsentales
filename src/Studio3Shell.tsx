import type { Appearance } from './appearance';
import type { EpisodeLibrary } from './episodes';
import { placesIn, type PlaceOrganisation } from './placeFolders';
import type { TimedLibrary } from './timedScenes';
import type { Workspace } from './workspacePreference';

export type StudioTab = 'projects' | 'characters' | 'places' | 'scenes' | 'intros' | 'episodes' | 'credits' | 'music' | 'voice' | 'audio' | 'playground' | 'unity' | 'settings';

const mainLinks: { tab: StudioTab; label: string; icon: string }[] = [
  { tab: 'projects', label: 'Projects', icon: '▦' },
  { tab: 'scenes', label: 'Cartoon Editor', icon: '▣' },
  { tab: 'characters', label: 'Asset Library', icon: '✦' },
  { tab: 'music', label: 'Audio Studio', icon: '♫' },
  { tab: 'episodes', label: 'Episode Maker', icon: '▤' },
];
const toolLinks: { tab: StudioTab; label: string; icon: string }[] = [
  { tab: 'places', label: 'Places', icon: '▧' },
  { tab: 'voice', label: 'Voice Maker', icon: '♬' },
  { tab: 'audio', label: 'Audio Library', icon: '♪' },
  { tab: 'playground', label: 'Playground', icon: '▶' },
  { tab: 'intros', label: 'Intros', icon: '★' },
  { tab: 'credits', label: 'Credits', icon: '❖' },
  { tab: 'unity', label: 'Cartoon Preview', icon: '◇' },
];

export function studioTabLabel(tab: StudioTab): string {
  return [...mainLinks, ...toolLinks, { tab: 'settings' as const, label: 'Settings', icon: '⚙' }].find(link => link.tab === tab)?.label ?? 'Studio';
}

export function Studio3Sidebar({ activeTab, onNavigate }: { activeTab: StudioTab; onNavigate: (tab: StudioTab) => void }) {
  const links = (items: typeof mainLinks) => items.map(({ tab, label, icon }) =>
    <button key={tab} type="button" title={label} className={activeTab === tab ? 'active' : ''} aria-current={activeTab === tab ? 'page' : undefined} onClick={() => onNavigate(tab)}><span aria-hidden="true" className="studio3-nav-icon">{icon}</span><span>{label}</span></button>);
  return <aside className="studio3-sidebar">
    <div className="studio3-brand"><span className="studio3-brand-mark" aria-hidden="true">✦</span><div><strong>BrightTales</strong><small>UNITY STUDIO 3.0</small></div></div>
    <div className="studio3-sidebar-scroll">
      <p className="studio3-nav-caption">WORKSPACE</p>
      <nav className="studio3-nav" aria-label="Unity Studio navigation">{links(mainLinks)}</nav>
      <p className="studio3-nav-caption">YOUR TOOLS</p>
      <nav className="studio3-nav studio3-nav-tools" aria-label="Creative tools">{links(toolLinks)}</nav>
    </div>
    <div className="studio3-sidebar-footer"><button type="button" title="Settings" className={activeTab === 'settings' ? 'active' : ''} onClick={() => onNavigate('settings')}><span aria-hidden="true" className="studio3-nav-icon">⚙</span> Settings</button><p><span className="studio3-local-dot" /> Local workspace</p></div>
  </aside>;
}

export function Studio3Projects({ scenes, episodes, places, onScene, onNavigate }: { scenes: TimedLibrary; episodes: EpisodeLibrary; places: PlaceOrganisation; onScene: (id: string) => void; onNavigate: (tab: StudioTab) => void }) {
  return <section className="studio3-projects">
    <div className="studio3-project-hero"><div className="studio3-project-hero-copy"><p className="studio3-kicker">YOUR CARTOON WORKSPACE</p><h1>Bring a story to life.</h1><p>Create a scene, direct Max and Maxine, and preview the result through the existing local Unity connection.</p><div className="studio3-hero-actions"><button type="button" className="studio3-primary" onClick={() => onNavigate('scenes')}>Open Cartoon Editor <span aria-hidden="true">↗</span></button><button type="button" onClick={() => onNavigate('unity')}>Cartoon Preview</button></div></div><img src="/art/living-room.png" alt="Approved Living Room cartoon background" /></div>
    <div className="studio3-section-heading"><div><p className="studio3-kicker">CONTINUE WORKING</p><h2>Saved scenes</h2></div><span>{scenes.scenes.length} in this browser</span></div>
    {scenes.scenes.length ? <div className="studio3-project-grid">{scenes.scenes.map(scene => <button type="button" key={scene.id} onClick={() => onScene(scene.id)}><span className="studio3-project-card-art">{placesIn(places).find(place => place.id === scene.placeId)?.background ? <img src={placesIn(places).find(place => place.id === scene.placeId)!.background!} alt="" /> : <span aria-hidden="true">Scene</span>}</span><span className="studio3-project-card-body"><strong>{scene.name}</strong><small>{scene.duration.toFixed(1)}s · {Object.keys(scene.characters).length} Brightlings · {scene.actions.length} actions</small><span>Open in editor ↗</span></span></button>)}</div> : <div className="studio3-empty-project"><strong>Your first scene starts here.</strong><p>Use the Cartoon Editor to make a scene with the artwork and tools already in your Studio.</p><button type="button" onClick={() => onNavigate('scenes')}>Create a scene</button></div>}
    <div className="studio3-project-shortcuts"><button type="button" onClick={() => onNavigate('characters')}><span aria-hidden="true">✦</span><strong>Brightling Maker</strong><small>Create and manage characters</small></button><button type="button" onClick={() => onNavigate('music')}><span aria-hidden="true">♫</span><strong>Music Studio</strong><small>Compose with local instruments</small></button><button type="button" onClick={() => onNavigate('episodes')}><span aria-hidden="true">▤</span><strong>Episode Maker</strong><small>{episodes.episodes.length} saved episodes</small></button></div>
  </section>;
}

export function WorkspaceSettings({ workspace, appearance, onWorkspace, onAppearance, storageIssue }: { workspace: Workspace; appearance: Appearance; onWorkspace: (next: Workspace) => void; onAppearance: (next: Appearance) => void; storageIssue: string | null }) {
  return <section className="studio3-settings"><p className="studio3-kicker">PREFERENCES</p><h1>Settings</h1><p>Choose how BrightTales opens on this browser. Both workspaces use the same saved scenes and libraries.</p>
    <div className="studio3-settings-card"><div><p className="studio3-kicker">WORKSPACE</p><h2>Preferred Studio</h2><p>Your selection opens automatically next time. You can change it at any time without restarting the Studio.</p></div><fieldset aria-label="Preferred Studio"><label className={workspace === 'studio3' ? 'selected' : ''}><input type="radio" name="preferred-studio" checked={workspace === 'studio3'} onChange={() => onWorkspace('studio3')} /><span><strong>Unity Studio 3.0</strong><small>Professional editing layout with optional Unity preview</small></span></label><label className={workspace === 'classic' ? 'selected' : ''}><input type="radio" name="preferred-studio" checked={workspace === 'classic'} onChange={() => onWorkspace('classic')} /><span><strong>Classic Studio</strong><small>The original BrightSenAppsTales workspace</small></span></label></fieldset></div>
    <div className="studio3-settings-card"><div><p className="studio3-kicker">APPEARANCE</p><h2>Colour theme</h2><p>Uses the existing Studio appearance preference in both workspaces.</p></div><label className="studio3-theme-setting">Appearance<select aria-label="Appearance" value={appearance} onChange={event => onAppearance(event.target.value as Appearance)}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label></div>
    {storageIssue && <p role="alert" className="storage-alert">{storageIssue}</p>}
  </section>;
}

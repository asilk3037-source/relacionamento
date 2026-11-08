import { loadArtManifest, api, token, setMe, store, route, go, renderRoute, renderNav, applyTheme, view, html, art, $, toast, on } from './core.js';
import { bootAuth } from './screens/auth.js';
import { bootOnboarding } from './screens/onboarding.js';
import { bootDiscover } from './screens/discover.js';
import { bootMatches } from './screens/matches.js';
import { bootPaths, collector } from './screens/paths.js';
import { bootMe } from './screens/me.js';
import { bootPlans } from './screens/plans.js';

bootAuth(); bootOnboarding(); bootDiscover(); bootMatches(); bootPaths(); bootMe(); bootPlans();

const PUBLIC = ['/welcome', '/signup', '/login', '/forgot'];
const guard = () => {
  const path = location.hash.replace(/^#/, '') || '/';
  const me = store.get().me;
  if (!me) { if (!PUBLIC.includes(path)) { location.hash = '#/welcome'; return false; } return true; }
  if (PUBLIC.includes(path)) { location.hash = '#/discover'; return false; }
  if (me.user.status === 'suspended' && path !== '/suspended') { location.hash = '#/suspended'; return false; }
  if (me.user.status === 'pending_verification' && path !== '/verify') { location.hash = '#/verify'; return false; }
  if (me.user.status === 'active' && !me.settings.onboardingDone && !path.startsWith('/onboarding') && !['/me', '/settings'].includes(path)) { location.hash = '#/onboarding/1'; return false; }
  return true;
};
const render = () => { if (guard()) { renderRoute().then(() => collector.sync()); } };
window.addEventListener('hashchange', render);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(store.get().me?.settings?.theme));

async function boot() {
  applyTheme(); await loadArtManifest();
  if (token.get()) {
    try { setMe(await api('GET', '/me', undefined, { noAuthRedirect: true })); } catch (e) { if (e.status === 401) token.set(null); }
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('/sw.js').catch(() => {});
  if (!location.hash) location.hash = store.get().me ? '#/discover' : '#/welcome';
  render();
  // Atualiza o contador de conversas não lidas, sem exibir prévias.
  setInterval(async () => { if (store.get().me?.user.status === 'active' && document.visibilityState === 'visible') { try { const { matches } = await api('GET', '/matches'); store.set({ unreadChats: matches.filter((m) => m.unread).length }); renderNav(); } catch { /* offline */ } } }, 20000);
}
window.addEventListener('offline', () => toast('Você está sem conexão.'));
boot();

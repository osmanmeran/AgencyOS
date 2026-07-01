// Blocks accidental navigation away from a dirty form.
//
// Covers: clicking an in-app link (sidebar, breadcrumbs, nav bar) while a
// form is dirty. Tab close/refresh/typing a new URL is handled separately by
// each page's native `beforeunload` listener (see useUnsavedChangesGuard).
//
// Known gap: the browser back/forward button isn't intercepted. Reliably
// blocking it requires React Router's useBlocker, which only works with a
// data router (createBrowserRouter); this app uses plain BrowserRouter.
// Intercepting popstate manually is possible but fragile — by the time the
// event fires, the router has already swapped routes and unmounted the form,
// so there's a visible flicker and a risk of losing the very state we're
// trying to protect. Not worth the complexity for this edge case.

let activeMessage = null;
let installed = false;

export function registerDirtyGuard(message) {
  activeMessage = message;
}

export function unregisterDirtyGuard() {
  activeMessage = null;
}

function isModifiedClick(e) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

function handleClick(e) {
  if (!activeMessage || e.defaultPrevented || isModifiedClick(e)) return;

  const anchor = e.target.closest('a');
  if (!anchor) return;
  if (anchor.target && anchor.target !== '_self') return; // new tab/window
  if (anchor.hasAttribute('download')) return;

  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) return;

  let url;
  try { url = new URL(href, window.location.href); } catch { return; }
  if (url.origin !== window.location.origin) return; // let beforeunload handle external navigation

  if (!window.confirm(activeMessage)) {
    e.preventDefault();
    e.stopPropagation();
  }
}

export function installGlobalNavigationGuard() {
  if (installed) return;
  installed = true;
  document.addEventListener('click', handleClick, true);
}

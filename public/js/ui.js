/* Eatsy — UI helpers: money, escaping, toasts, modals, reveal */
'use strict';

const INR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const vegMark = (veg) => `
  <span class="vegmark ${veg ? 'veg' : 'nonveg'}" title="${veg ? 'Veg' : 'Non-veg'}" aria-label="${veg ? 'Veg' : 'Non-veg'}">
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 14.4 9.6 22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z"/></svg>
  </span>`;

/* ---------- toasts ---------- */
function toast(msg, type = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '⚠️' };
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<span class="t-ico">${icons[type]}</span><span>${esc(msg)}</span>`;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => {
    t.classList.add('leaving');
    setTimeout(() => t.remove(), 380);
  }, 3400);
}

/* ---------- modal ---------- */
function openModal({ title, sub, body, actions }) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-scrim show" id="modalScrim">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h3>${esc(title)}</h3>
        ${sub ? `<p class="m-sub">${esc(sub)}</p>` : ''}
        <div class="m-body">${body}</div>
        <div class="m-actions">
          <button class="btn btn-ghost" data-m="cancel">Cancel</button>
          ${actions || `<button class="btn btn-brand" data-m="ok">Confirm</button>`}
        </div>
      </div>
    </div>`;
  const scrim = root.firstElementChild;
  const handlers = [];
  const close = () => { root.innerHTML = ''; };
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
  scrim.querySelector('[data-m="cancel"]').addEventListener('click', close);
  const ok = scrim.querySelector('[data-m="ok"]');
  if (ok) ok.addEventListener('click', () => { handlers.forEach(fn => fn()); close(); });
  return {
    close,
    onOk(cb) { handlers.push(cb); },
    root: scrim
  };
}

/* ---------- reveal on scroll ---------- */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); revealObserver.unobserve(en.target); }
  });
}, { threshold: 0.1 });
function observeReveals(container) {
  (container || document).querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

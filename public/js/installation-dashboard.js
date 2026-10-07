(() => {
  const dashboard = document.querySelector('[data-live-dashboard]');
  if (!dashboard) return;

  const endpoint = dashboard.dataset.liveUrl;
  const progressList = document.getElementById('dashboard-progress-list');
  const issuesList = document.getElementById('dashboard-issues-list');
  const syncState = document.getElementById('dashboard-sync-state');
  const updatedAt = document.getElementById('dashboard-updated-at');
  let isLoading = false;

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  function renderProgress(installations) {
    const fragment = document.createDocumentFragment();

    if (!installations.length) {
      fragment.append(createElement('p', 'py-6 text-center text-xs text-slate-500', 'Nuk ka instalime për filtrat e zgjedhur.'));
      progressList.replaceChildren(fragment);
      return;
    }

    installations.forEach(installation => {
      const row = createElement('a', 'block py-3 hover:bg-slate-50 dark:hover:bg-slate-900/40');
      row.href = `/instalimet/${Number(installation.id)}`;

      const heading = createElement('div', 'flex items-center justify-between gap-3');
      const identity = createElement('div', 'min-w-0');
      const title = createElement('p', 'truncate text-xs font-semibold text-slate-800 dark:text-slate-200');
      title.textContent = `${installation.elevatorModel} · ${installation.serialNumber}`;
      const detail = createElement('p', 'truncate text-[11px] text-slate-500', `${installation.project?.name || '-'} · ${installation.status}`);
      identity.append(title, detail);

      const percentage = Math.max(0, Math.min(100, Number(installation.progressPercent) || 0));
      const value = createElement('span', `shrink-0 text-xs font-bold ${percentage === 100 ? 'text-emerald-500' : 'text-amber-500'}`, `${percentage}%`);
      heading.append(identity, value);

      const track = createElement('div', 'mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700');
      const bar = createElement('div', `h-full rounded-full ${percentage === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`);
      bar.style.width = `${percentage}%`;
      track.append(bar);
      row.append(heading, track);
      fragment.append(row);
    });

    progressList.replaceChildren(fragment);
  }

  function renderIssues(tickets) {
    const fragment = document.createDocumentFragment();

    if (!tickets.length) {
      fragment.append(createElement('p', 'py-6 text-center text-xs text-slate-500', 'Nuk ka probleme aktive për këto instalime.'));
      issuesList.replaceChildren(fragment);
      return;
    }

    tickets.forEach(ticket => {
      const row = createElement('a', 'block py-3 hover:bg-slate-50 dark:hover:bg-slate-900/40');
      row.href = `/servisi/${Number(ticket.id)}`;

      const header = createElement('div', 'flex items-center justify-between gap-2');
      header.append(createElement('span', 'font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200', `${ticket.number} · ${ticket.serialNumber || 'Pa numër serik'}`));

      const priorityClasses = ticket.priority === 'Kritik'
        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
        : ticket.priority === 'I lartë'
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
      header.append(createElement('span', `shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${priorityClasses}`, ticket.priority));

      const description = String(ticket.problemDescription || 'Pa përshkrim problemi');
      const summary = createElement('p', 'mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300', description.length > 120 ? `${description.slice(0, 120)}…` : description);
      const technician = ticket.technician?.fullName || 'Pa teknik të caktuar';
      const detail = createElement('p', 'mt-1 text-[10px] text-slate-500', `${ticket.status} · ${technician}`);
      row.append(header, summary, detail);
      fragment.append(row);
    });

    issuesList.replaceChildren(fragment);
  }

  async function refreshDashboard() {
    if (isLoading || document.hidden) return;
    isLoading = true;

    try {
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Refresh failed');
      const data = await response.json();

      document.querySelector('[data-stat="total"]').textContent = data.summary.total;
      document.querySelector('[data-stat="averageProgress"]').textContent = data.summary.averageProgress;
      document.querySelector('[data-stat="inProgress"]').textContent = data.summary.inProgress;
      document.querySelector('[data-stat="testing"]').textContent = data.summary.testing;
      document.querySelector('[data-stat="openProblems"]').textContent = data.summary.openProblems;
      renderProgress(data.installations);
      renderIssues(data.tickets);
      updatedAt.textContent = new Date(data.updatedAt).toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      syncState.textContent = 'Live · rifreskohet çdo 15 sekonda';
      syncState.classList.remove('text-rose-400');
    } catch (error) {
      syncState.textContent = 'Rifreskimi live nuk është i disponueshëm';
      syncState.classList.add('text-rose-400');
    } finally {
      isLoading = false;
    }
  }

  window.setInterval(refreshDashboard, 15000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshDashboard();
  });
})();

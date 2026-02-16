const form = document.getElementById('entryForm');
const weekStartInput = document.getElementById('weekStart');
const hoursInput = document.getElementById('hours');
const noteInput = document.getElementById('note');
const entriesBody = document.getElementById('entriesBody');
const averageEl = document.getElementById('average');
const statusEl = document.getElementById('status');
const weekCountEl = document.getElementById('weekCount');

function todayMonday() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day + 6) % 7;
  now.setDate(now.getDate() - diff);
  return now.toISOString().split('T')[0];
}

weekStartInput.value = todayMonday();

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || 'Unbekannter Fehler');
  }

  return response.json();
}

function renderEntries(entries) {
  entriesBody.innerHTML = '';
  for (const entry of entries) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.week_start}</td>
      <td>${Number(entry.hours).toFixed(2)} h</td>
      <td>${entry.note || ''}</td>
      <td><button class="delete" data-id="${entry.id}">Löschen</button></td>
    `;
    entriesBody.appendChild(row);
  }

  for (const btn of document.querySelectorAll('button.delete')) {
    btn.addEventListener('click', async () => {
      if (!confirm('Eintrag wirklich löschen?')) return;
      await api(`/api/weeks/${btn.dataset.id}`, { method: 'DELETE' });
      await refresh();
    });
  }
}

function renderStats(stats) {
  averageEl.textContent = `${Number(stats.average_hours).toFixed(2)} h`;
  weekCountEl.textContent = `${stats.period_weeks} / ${stats.max_period}`;
  statusEl.textContent = stats.within_limit ? '✅ Im Limit' : '⚠️ Über 20h im Durchschnitt';
  statusEl.className = `value ${stats.within_limit ? 'status-ok' : 'status-warn'}`;
}

async function refresh() {
  const [entries, stats] = await Promise.all([api('/api/weeks'), api('/api/stats')]);
  renderEntries(entries);
  renderStats(stats);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/weeks', {
      method: 'POST',
      body: JSON.stringify({
        week_start: weekStartInput.value,
        hours: Number(hoursInput.value),
        note: noteInput.value || null,
      }),
    });

    form.reset();
    weekStartInput.value = todayMonday();
    await refresh();
  } catch (error) {
    alert(error.message);
  }
});

refresh().catch((error) => alert(`Fehler beim Laden: ${error.message}`));

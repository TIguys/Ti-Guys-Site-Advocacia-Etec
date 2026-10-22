/**
 * Advocacia ETEC - Lógica de Controle SPA, Autenticação e Interatividade
 */

// REGISTRO DE FUNÇÕES GLOBAIS NO ESCOPO WINDOW PARA FUNCIONALIDADE TOTAL DOS BOTÕES

// === AUTENTICAÇÃO E SESSÃO DO USUÁRIO ===
window.mostrarCadastro = function() {
  document.getElementById('view-login')?.classList.add('hidden');
  const panel = document.getElementById('view-register');
  panel?.classList.remove('hidden');
  panel?.classList.add('flex');
};

window.alternarVisibilidadeSenha = function(id, button) {
  const input = document.getElementById(id);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  const icon = button?.querySelector('.material-symbols-outlined');
  if (icon) icon.textContent = input.type === 'password' ? 'visibility' : 'visibility_off';
};

window.solicitarSecretaria = function() {
  window.showToast('Use o botão de agendamento para ligar para a secretaria.', 'support_agent');
};

window.renderPortalCliente = function() {
  const user = db.getSession();
  if (!user) return;
  const name = document.getElementById('cliente-portal-nome');
  if (name) name.textContent = user.name;
  const cliente = db.getClientes().find(c => c.id === user.clienteId || String(c.email || '').toLowerCase() === String(user.email || '').toLowerCase());
  const list = document.getElementById('cliente-proximas-consultas');
  if (!list) return;
  const future = db.getConsultas().filter(c => cliente && c.clienteId === cliente.id && c.status !== 'cancelada' && new Date(c.inicio) >= new Date()).sort((a,b) => new Date(a.inicio)-new Date(b.inicio));
  list.innerHTML = future.length ? future.map(c => {
    const adv = db.getAdvogados().find(a => a.id === c.advogadoId);
    const srv = db.getServicos().find(s => s.id === c.servicoId);
    return `<article class="p-4 rounded-lg border border-stone-200 dark:border-stone-700"><strong>${formatDateIsoToBr(c.inicio)} · ${formatTimeIso(c.inicio)}–${formatTimeIso(c.fim)}</strong><p class="text-sm text-stone-500 mt-1">${srv?.descricao || 'Consulta'} · ${adv?.nomeCompleto || 'Advogado'} · ${c.modalidade || ''}</p><p class="text-xs mt-1">${c.sala || ''}</p></article>`;
  }).join('') : '<p class="text-sm text-stone-500">Você ainda não tem consultas futuras agendadas.</p>';
};

function renderPortalAdvogado() {
  const user = db.getSession();
  const lawyer = db.getAdvogados().find(a => a.id === user?.advogadoId || String(a.email || '').toLowerCase() === String(user?.email || '').toLowerCase()) || (user?.id === 'user-2' ? db.getAdvogados().find(a => a.nomeCompleto.includes('Carlos')) : null);
  const name = document.getElementById('adv-portal-nome');
  const list = document.getElementById('advogado-agenda-consultas');
  if (!list) return;
  if (name) name.textContent = lawyer ? lawyer.nomeCompleto : `Agenda de ${user?.name || 'advogado'}`;
  const all = db.getConsultas().filter(c => lawyer && c.advogadoId === lawyer.id && c.status !== 'cancelada').sort((a,b) => new Date(a.inicio)-new Date(b.inicio));
  list.innerHTML = all.length ? all.map(c => {
    const cli = db.getClientes().find(x => x.id === c.clienteId);
    const srv = db.getServicos().find(x => x.id === c.servicoId);
    return `<article class="bg-white dark:bg-darksurface p-5 rounded-xl border border-stone-200 dark:border-stone-800"><div class="flex flex-wrap justify-between gap-3"><div><strong>${formatDateIsoToBr(c.inicio)} · ${formatTimeIso(c.inicio)}–${formatTimeIso(c.fim)}</strong><p class="text-sm mt-1">${cli?.nomeCompleto || 'Cliente'} · ${srv?.descricao || 'Consulta'}</p><p class="text-xs text-stone-500 mt-1">${c.modalidade || ''} ${c.sala || ''}</p></div><div class="font-serif font-bold text-brand-800 dark:text-gold-400">${formatMoney(c.valorHonorario)}<small class="block text-[10px] font-sans text-stone-500">honorário</small></div></div></article>`;
  }).join('') : '<p class="text-sm text-stone-500">Nenhuma consulta cadastrada para este advogado.</p>';
}

window.mostrarLogin = function() {
  document.getElementById('view-register')?.classList.add('hidden');
  document.getElementById('view-register')?.classList.remove('flex');
  document.getElementById('view-login')?.classList.remove('hidden');
};

async function derivePasswordHash(password, salt) {
  if (!window.crypto?.subtle) throw new Error('A criptografia segura não está disponível. Abra o sistema em localhost ou HTTPS.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
}

function formatBrazilianPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  const areaCode = digits.slice(0, 2);
  if (digits.length <= 6) return `(${areaCode}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${areaCode}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${areaCode}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatBrazilianDocument(value) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function hasValidCpfCnpj(value) {
  const digits = value.replace(/\D/g, '');
  if (/^(\d)\1+$/.test(digits)) return false;

  if (digits.length === 11) {
    const calculateDigit = (base, weights) => {
      const remainder = weights.reduce((sum, weight, index) =>
        sum + Number(base[index]) * weight, 0) % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };
    const first = calculateDigit(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = calculateDigit(digits.slice(0, 9) + first, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return digits.endsWith(`${first}${second}`);
  }

  if (digits.length === 14) {
    const calculateDigit = (base, weights) => {
      const remainder = weights.reduce((sum, weight, index) =>
        sum + Number(base[index]) * weight, 0) % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };
    const first = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = calculateDigit(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return digits.endsWith(`${first}${second}`);
  }

  return false;
}

function gerarSaltSenha() {
  return crypto.getRandomValues(new Uint8Array(16)).reduce((hex, byte) => hex + byte.toString(16).padStart(2, '0'), '');
}

window.loginRapido = function(tipo) {
  const roleSelect = document.getElementById('login-role');
  let user = {
    id: 'user-1',
    name: 'Secretaria Central',
    role: 'Operacional • ETEC Bragança',
    badge: 'SEC',
    email: 'secretaria@advocaciaetec.com.br'
  };

  if (tipo === 'advogado') {
    if (roleSelect) roleSelect.value = 'advogado';
    user = {
      id: 'user-2',
      name: 'Dr. Carlos Eduardo',
      role: 'Sócio-Diretor • OAB/SP 123456',
      badge: 'CE',
      email: 'carlos.eduardo@advocaciaetec.com.br'
    };
  }
  if (tipo === 'secretaria' && roleSelect) roleSelect.value = 'secretaria';

  db.setSession(user);
  iniciarSessaoUI(user);
  window.showToast(`Bem-vindo(a), ${user.name}!`);
};

window.fazerLogout = function() {
  window.alternarMenuNavegacao(false, false);
  db.clearSession();
  const viewLogin = document.getElementById('view-login');
  const mainHeader = document.getElementById('main-header');
  const mainContent = document.getElementById('main-content');
  const mainFooter = document.getElementById('main-footer');

  if (viewLogin) viewLogin.classList.remove('hidden');
  if (mainHeader) mainHeader.classList.add('hidden');
  if (mainContent) mainContent.classList.add('hidden');
  if (mainFooter) mainFooter.classList.add('hidden');

  window.showToast('Sessão encerrada.');
};

function iniciarSessaoUI(user) {
  const viewLogin = document.getElementById('view-login');
  const mainHeader = document.getElementById('main-header');
  const mainContent = document.getElementById('main-content');
  const mainFooter = document.getElementById('main-footer');

  if (viewLogin) viewLogin.classList.add('hidden');
  if (mainHeader) mainHeader.classList.remove('hidden');
  if (mainContent) mainContent.classList.remove('hidden');
  if (mainFooter) mainFooter.classList.remove('hidden');

  const elBadge = document.getElementById('user-avatar-badge');
  const elName = document.getElementById('user-display-name');
  const elRole = document.getElementById('user-display-role');

  if (elBadge) elBadge.textContent = user.badge || 'SEC';
  if (elName) elName.textContent = user.name || 'Secretaria Central';
  if (elRole) elRole.textContent = user.role || 'Operacional';

  const isClient = user.role === 'cliente';
  const isLawyer = user.role === 'advogado' || user.id === 'user-2';
  const isSecretary = user.id === 'user-1' || user.role === 'secretaria' || String(user.role || '').startsWith('Operacional');
  document.getElementById('btn-open-navigation')?.classList.toggle('hidden', !isSecretary);
  document.getElementById('staff-navigation-drawer')?.classList.toggle('hidden', true);
  document.getElementById('staff-navigation-drawer')?.setAttribute('aria-hidden', 'true');
  document.getElementById('btn-open-navigation')?.setAttribute('aria-expanded', 'false');
  document.getElementById('nav-cadastros')?.classList.toggle('hidden', !isSecretary);
  document.body.classList.remove('navigation-open');

  if (user.role === 'cliente') window.navegarPara('area-cliente');
  else if (user.role === 'advogado' || user.id === 'user-2') window.navegarPara('area-advogado');
  else window.navegarPara('dashboard');
}

window.alternarTemaGlobal = function() {
  const htmlEl = document.documentElement;
  const isDark = htmlEl.classList.contains('dark');
  const newTheme = isDark ? 'light' : 'dark';

  if (newTheme === 'dark') {
    htmlEl.classList.remove('light');
    htmlEl.classList.add('dark');
  } else {
    htmlEl.classList.remove('dark');
    htmlEl.classList.add('light');
  }

  db.setTheme(newTheme);
  window.showToast(`Modo ${newTheme === 'dark' ? 'Escuro' : 'Claro'} ativado.`, 'light_mode');
};

window.alternarMenuNavegacao = function(abrir, devolverFoco = true) {
  const drawer = document.getElementById('staff-navigation-drawer');
  const trigger = document.getElementById('btn-open-navigation');
  if (!drawer || !trigger || trigger.classList.contains('hidden')) return;

  const wasOpen = !drawer.classList.contains('hidden');
  drawer.classList.toggle('hidden', !abrir);
  drawer.setAttribute('aria-hidden', String(!abrir));
  trigger.setAttribute('aria-expanded', String(abrir));
  document.body.classList.toggle('navigation-open', abrir);

  if (abrir) {
    document.getElementById('btn-close-navigation')?.focus();
  } else if (devolverFoco && wasOpen) {
    trigger.focus();
  }
};

window.navegarPara = function(viewId) {
  window.alternarMenuNavegacao(false);
  const currentUser = db.getSession();
  const isSecretary = currentUser?.id === 'user-1' || currentUser?.role === 'secretaria' || String(currentUser?.role || '').startsWith('Operacional');
  if (currentUser && !isSecretary) {
    if (currentUser.role === 'advogado' || currentUser.id === 'user-2') {
      if (viewId !== 'area-advogado') viewId = 'area-advogado';
    } else if (viewId !== 'area-cliente') viewId = 'area-cliente';
  }
  const spaViews = document.querySelectorAll('.spa-view');
  const navLinks = document.querySelectorAll('#staff-navigation .nav-link');

  spaViews.forEach(view => {
    if (view.id === `view-${viewId}`) {
      view.classList.remove('hidden');
    } else {
      view.classList.add('hidden');
    }
  });

  navLinks.forEach(link => {
    if (link.getAttribute('data-view') === viewId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  renderView(viewId);
  document.dispatchEvent(new CustomEvent('app:viewchange', { detail: { viewId } }));
};

window.fecharModal = function(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('hidden');
};

window.fecharModalOnBackdrop = function(event, modalId) {
  if (event.target && event.target.classList.contains('modal-backdrop')) {
    window.fecharModal(modalId);
  }
};

window.showToast = function(mensagem, icon = 'check_circle', isError = false) {
  const toast = document.getElementById('toast-notificacao');
  const toastMsg = document.getElementById('toast-mensagem');
  const toastIcon = document.getElementById('toast-icon');

  if (!toast || !toastMsg || !toastIcon) return;

  toastMsg.textContent = mensagem;
  toastIcon.textContent = icon;
  toastIcon.className = `material-symbols-outlined text-[20px] ${isError ? 'text-red-500' : 'text-gold-400'}`;
  toast.classList.remove('hidden');
  toast.classList.add('flex');

  setTimeout(() => {
    toast.classList.add('hidden');
    toast.classList.remove('flex');
  }, 3000);
};

// FORMATADORES UTILS
function formatMoney(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function formatDateIsoToBr(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTimeIso(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3]) ? date : null;
}

function formatLocalDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
}

function parseBrazilianDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || '');
  if (!match) return null;
  return parseLocalDateKey(`${match[3]}-${match[2]}-${match[1]}`);
}

function formatBrazilianDateInput(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function getMonthKey(year, monthIndex) {
  const date = new Date(year, monthIndex, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shiftCalendarDate(date, unit, amount) {
  if (unit === 'day') {
    const shifted = new Date(date);
    shifted.setDate(shifted.getDate() + amount);
    return shifted;
  }
  const targetMonth = new Date(
    date.getFullYear() + (unit === 'year' ? amount : 0),
    date.getMonth() + (unit === 'month' ? amount : 0),
    1
  );
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(date.getDate(), lastDay));
}

let dashboardFinanceChart = null;
let dashboardConsultationChart = null;

function createDashboardChart(canvas, labels, datasets, formatter) {
  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#cbd5e1' : '#57534e';
  const gridColor = isDark ? 'rgba(203, 213, 225, 0.12)' : 'rgba(87, 83, 78, 0.12)';
  return new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: 'bottom',
          labels: { color: textColor }
        },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed.y;
              return `${context.dataset.label ? `${context.dataset.label}: ` : ''}${formatter(value)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor, callback: formatter }
        }
      }
    }
  });
}

function renderFinanceDashboard() {
  const periodSelect = document.getElementById('dash-finance-period');
  const dateInput = document.getElementById('dash-finance-date');
  const comparisonSelect = document.getElementById('dash-finance-comparison');
  const financeCanvas = document.getElementById('chartDashFinance');
  const consultationCanvas = document.getElementById('chartDashConsultas');
  if (!periodSelect || !dateInput || !comparisonSelect || !financeCanvas || !consultationCanvas) return;

  if (!dateInput.value) dateInput.value = formatLocalDateKey(localDateKey(new Date()));
  const referenceDate = parseBrazilianDate(dateInput.value);
  if (!referenceDate) {
    const chartError = document.getElementById('dash-finance-chart-error');
    if (chartError) {
      chartError.textContent = 'Informe uma data válida no formato dia/mês/ano para exibir os gráficos.';
      chartError.classList.remove('hidden');
    }
    return;
  }
  const period = periodSelect.value;
  const comparisonOptions = period === 'daily'
    ? [
        { value: 'previous', label: 'Dia anterior' },
        { value: 'previous-month', label: 'Mesmo dia do mês anterior' },
        { value: 'previous-year', label: 'Mesmo dia do ano anterior' }
      ]
    : period === 'monthly'
      ? [
          { value: 'previous', label: 'Mês anterior' },
          { value: 'previous-year', label: 'Mesmo mês do ano anterior' }
        ]
      : [{ value: 'previous-year', label: 'Ano anterior' }];

  const selectedComparison = comparisonSelect.value;
  comparisonSelect.innerHTML = comparisonOptions.map(option =>
    `<option value="${option.value}">${option.label}</option>`
  ).join('');
  comparisonSelect.value = comparisonOptions.some(option => option.value === selectedComparison)
    ? selectedComparison
    : comparisonOptions[0].value;

  const consultations = db.getConsultas().filter(consultation =>
    consultation.status !== 'cancelada' && /^\d{4}-\d{2}-\d{2}/.test(consultation.inicio || '')
  );
  const statsForPeriod = (key, granularity) => consultations.reduce((stats, consultation) => {
    const dateKey = consultation.inicio.slice(0, 10);
    const matches = granularity === 'day'
      ? dateKey === key
      : granularity === 'month'
        ? dateKey.slice(0, 7) === key
        : dateKey.slice(0, 4) === key;
    if (matches) {
      stats.count += 1;
      const amount = Number(consultation.valorHonorario);
      if (Number.isFinite(amount)) stats.total += amount;
    }
    return stats;
  }, { count: 0, total: 0 });

  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth();
  let currentKey;
  let comparisonKey;
  let granularity;
  let currentLabel;
  let comparisonLabel;
  let rows;

  if (period === 'daily') {
    granularity = 'day';
    currentKey = localDateKey(referenceDate);
    const comparisonDate = comparisonSelect.value === 'previous'
      ? shiftCalendarDate(referenceDate, 'day', -1)
      : comparisonSelect.value === 'previous-month'
        ? shiftCalendarDate(referenceDate, 'month', -1)
        : shiftCalendarDate(referenceDate, 'year', -1);
    comparisonKey = localDateKey(comparisonDate);
    currentLabel = `Dia ${formatLocalDateKey(currentKey)}`;
    comparisonLabel = formatLocalDateKey(comparisonKey);
    rows = [{
      label: currentLabel,
      comparisonLabel,
      chartLabel: currentLabel,
      current: statsForPeriod(currentKey, 'day'),
      comparison: statsForPeriod(comparisonKey, 'day')
    }];
  } else if (period === 'monthly') {
    granularity = 'month';
    currentKey = getMonthKey(referenceYear, referenceMonth);
    const comparisonMonth = comparisonSelect.value === 'previous'
      ? new Date(referenceYear, referenceMonth - 1, 1)
      : new Date(referenceYear - 1, referenceMonth, 1);
    comparisonKey = getMonthKey(comparisonMonth.getFullYear(), comparisonMonth.getMonth());
    currentLabel = getMonthLabel(currentKey);
    comparisonLabel = getMonthLabel(comparisonKey);
    const comparisonDays = new Date(
      comparisonMonth.getFullYear(),
      comparisonMonth.getMonth() + 1,
      0
    ).getDate();
    const currentDays = new Date(referenceYear, referenceMonth + 1, 0).getDate();
    rows = Array.from({ length: Math.max(currentDays, comparisonDays) }, (_, index) => {
      const day = index + 1;
      const currentDateKey = day <= currentDays
        ? `${currentKey}-${String(day).padStart(2, '0')}`
        : null;
      const compareDateKey = day <= comparisonDays
        ? `${comparisonKey}-${String(day).padStart(2, '0')}`
        : null;
      return {
        label: currentDateKey ? formatLocalDateKey(currentDateKey) : '—',
        comparisonLabel: compareDateKey ? formatLocalDateKey(compareDateKey) : '—',
        chartLabel: `Dia ${String(day).padStart(2, '0')}`,
        current: currentDateKey ? statsForPeriod(currentDateKey, 'day') : { count: 0, total: 0 },
        comparison: compareDateKey ? statsForPeriod(compareDateKey, 'day') : { count: 0, total: 0 }
      };
    });
  } else {
    granularity = 'year';
    currentKey = String(referenceYear);
    comparisonKey = String(referenceYear - 1);
    currentLabel = `Ano ${currentKey}`;
    comparisonLabel = `Ano ${comparisonKey}`;
    rows = Array.from({ length: 12 }, (_, index) => {
      const monthKey = getMonthKey(referenceYear, index);
      const compareMonthKey = getMonthKey(referenceYear - 1, index);
      return {
        label: getMonthLabel(monthKey).replace(` de ${referenceYear}`, ''),
        comparisonLabel: getMonthLabel(compareMonthKey).replace(` de ${referenceYear - 1}`, ''),
        chartLabel: getMonthLabel(monthKey).replace(` de ${referenceYear}`, ''),
        current: statsForPeriod(monthKey, 'month'),
        comparison: statsForPeriod(compareMonthKey, 'month')
      };
    });
  }

  const currentTotal = statsForPeriod(currentKey, granularity);
  const comparisonTotal = statsForPeriod(comparisonKey, granularity);
  const difference = currentTotal.total - comparisonTotal.total;
  const changeElement = document.getElementById('dash-finance-change');
  const changePercentElement = document.getElementById('dash-finance-change-percent');
  const currentLabelElement = document.getElementById('dash-finance-current-label');
  const comparisonLabelElement = document.getElementById('dash-finance-compare-label');
  const currentTotalElement = document.getElementById('dash-finance-current-total');
  const comparisonTotalElement = document.getElementById('dash-finance-compare-total');
  const currentCountElement = document.getElementById('dash-finance-current-count');
  const comparisonCountElement = document.getElementById('dash-finance-compare-count');

  if (currentLabelElement) currentLabelElement.textContent = currentLabel;
  if (comparisonLabelElement) comparisonLabelElement.textContent = comparisonLabel;
  if (currentTotalElement) currentTotalElement.textContent = formatMoney(currentTotal.total);
  if (comparisonTotalElement) comparisonTotalElement.textContent = formatMoney(comparisonTotal.total);
  if (currentCountElement) currentCountElement.textContent = `${currentTotal.count} ${currentTotal.count === 1 ? 'consulta' : 'consultas'}`;
  if (comparisonCountElement) comparisonCountElement.textContent = `${comparisonTotal.count} ${comparisonTotal.count === 1 ? 'consulta' : 'consultas'}`;
  if (changeElement) {
    changeElement.textContent = `${difference > 0 ? '+' : ''}${formatMoney(difference)}`;
    changeElement.classList.toggle('text-emerald-700', difference > 0);
    changeElement.classList.toggle('dark:text-emerald-400', difference > 0);
    changeElement.classList.toggle('text-red-700', difference < 0);
    changeElement.classList.toggle('dark:text-red-400', difference < 0);
    changeElement.classList.toggle('text-stone-800', difference === 0);
    changeElement.classList.toggle('dark:text-stone-100', difference === 0);
  }
  if (changePercentElement) {
    changePercentElement.textContent = comparisonTotal.total === 0
      ? currentTotal.total === 0 ? 'Sem variação' : 'Sem base anterior para calcular percentual'
      : `${difference > 0 ? '+' : ''}${new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(difference / comparisonTotal.total)}`;
  }

  const chartError = document.getElementById('dash-finance-chart-error');
  if (typeof Chart === 'undefined') {
    if (chartError) {
      chartError.textContent = 'Não foi possível carregar os gráficos. Verifique a conexão e recarregue a página.';
      chartError.classList.remove('hidden');
    }
    return;
  }
  if (chartError) chartError.classList.add('hidden');

  const financeTitle = document.getElementById('dash-finance-chart-title');
  const consultationTitle = document.getElementById('dash-consultas-chart-title');
  if (financeTitle) {
    financeTitle.textContent = period === 'daily'
      ? `Honorários — ${currentLabel} x ${comparisonLabel}`
      : period === 'monthly'
        ? `Honorários por dia — ${currentLabel} x ${comparisonLabel}`
        : `Honorários por mês — ${currentLabel} x ${comparisonLabel}`;
  }
  if (consultationTitle) {
    consultationTitle.textContent = period === 'daily'
      ? `Consultas — ${currentLabel} x ${comparisonLabel}`
      : period === 'monthly'
        ? `Consultas por dia — ${currentLabel} x ${comparisonLabel}`
        : `Consultas por mês — ${currentLabel} x ${comparisonLabel}`;
  }

  const chartLabels = period === 'daily'
    ? [currentLabel, comparisonLabel]
    : rows.map(row => row.chartLabel);
  const financeDatasets = period === 'daily'
    ? [{
        label: 'Honorários',
        data: [currentTotal.total, comparisonTotal.total],
        backgroundColor: ['#701A24', '#CFAC4C'],
        borderRadius: 6
      }]
    : [
        {
          label: currentLabel,
          data: rows.map(row => row.current.total),
          backgroundColor: '#701A24',
          borderRadius: 6
        },
        {
          label: comparisonLabel,
          data: rows.map(row => row.comparison.total),
          backgroundColor: '#CFAC4C',
          borderRadius: 6
        }
      ];
  const consultationDatasets = period === 'daily'
    ? [{
        label: 'Consultas',
        data: [currentTotal.count, comparisonTotal.count],
        backgroundColor: ['#3D0B12', '#B89635'],
        borderRadius: 6
      }]
    : [
        {
          label: currentLabel,
          data: rows.map(row => row.current.count),
          backgroundColor: '#3D0B12',
          borderRadius: 6
        },
        {
          label: comparisonLabel,
          data: rows.map(row => row.comparison.count),
          backgroundColor: '#B89635',
          borderRadius: 6
        }
      ];

  dashboardFinanceChart?.destroy();
  dashboardConsultationChart?.destroy();
  dashboardFinanceChart = createDashboardChart(
    financeCanvas,
    chartLabels,
    financeDatasets,
    value => formatMoney(value)
  );
  dashboardConsultationChart = createDashboardChart(
    consultationCanvas,
    chartLabels,
    consultationDatasets,
    value => String(Number(value).toLocaleString('pt-BR'))
  );
}

// RENDERIZADOR DE VISÕES
function renderView(viewId) {
  switch (viewId) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'clientes':
      renderClientes();
      break;
    case 'advogados':
      renderAdvogados();
      break;
    case 'consultas':
      renderConsultas();
      break;
    case 'relatorios':
      renderRelatorios();
      break;
    case 'area-cliente': window.renderPortalCliente(); break;
    case 'area-advogado': renderPortalAdvogado(); break;
  }
}

// ========================================================
// RENDER VISÃO 1: DASHBOARD DA SECRETÁRIA (F6)
// ========================================================
function renderDashboard() {
  const now = new Date();
  const optionsDate = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = now.toLocaleDateString('pt-BR', optionsDate);
  const dateStrFormatted = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  const elDate = document.getElementById('dash-current-date');
  if (elDate) elDate.textContent = dateStrFormatted;

  const consultas = db.getConsultas();
  const clientes = db.getClientes();
  const advogados = db.getAdvogados();

  const hojeYmd = now.toISOString().split('T')[0];
  const consultasHoje = consultas.filter(c => c.inicio.startsWith(hojeYmd) && c.status !== 'cancelada');
  
  const elConsultasHoje = document.getElementById('metric-consultas-hoje');
  if (elConsultasHoje) elConsultasHoje.textContent = consultasHoje.length;

  const elTotalClientes = document.getElementById('metric-total-clientes');
  if (elTotalClientes) elTotalClientes.textContent = clientes.length;

  const elTotalAdvogados = document.getElementById('metric-total-advogados');
  if (elTotalAdvogados) elTotalAdvogados.textContent = advogados.filter(a => a.ativo).length;

  const mesAtualYm = hojeYmd.slice(0, 7);
  const faturamentoMes = consultas
    .filter(c => c.inicio.startsWith(mesAtualYm) && c.status !== 'cancelada')
    .reduce((sum, c) => sum + Number(c.valorHonorario || 0), 0);

  const elFatMes = document.getElementById('metric-faturamento-mes');
  if (elFatMes) elFatMes.textContent = formatMoney(faturamentoMes);

  renderFinanceDashboard();

  // Próximas consultas
  const proximasConsultas = consultas
    .filter(c => new Date(c.inicio) >= new Date() && c.status !== 'cancelada')
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
    .slice(0, 5);

  const tableBody = document.getElementById('dash-proximas-consultas-list');
  if (tableBody) {
    if (proximasConsultas.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-stone-400">Nenhuma consulta futura agendada.</td></tr>`;
    } else {
      tableBody.innerHTML = proximasConsultas.map(c => {
        const cliente = clientes.find(cli => cli.id === c.clienteId);
        const advogado = advogados.find(adv => adv.id === c.advogadoId);
        return `
          <tr class="hover:bg-stone-50 dark:hover:bg-darkcard/50 transition-colors">
            <td class="py-3 px-2 text-stone-900 dark:text-stone-100 font-semibold">
              ${formatDateIsoToBr(c.inicio)} • ${formatTimeIso(c.inicio)}
            </td>
            <td class="py-3 px-2 text-stone-800 dark:text-stone-200">
              <span class="font-medium">${cliente ? cliente.nomeCompleto : 'Cliente Excluído'}</span>
            </td>
            <td class="py-3 px-2 text-stone-700 dark:text-stone-300">
              ${advogado ? advogado.nomeCompleto : 'Advogado'}
            </td>
            <td class="py-3 px-2 font-serif font-bold text-brand-800 dark:text-gold-400">
              ${formatMoney(c.valorHonorario)}
            </td>
            <td class="py-3 px-2 text-right">
              <button onclick="window.navegarPara('consultas')" class="text-stone-400 hover:text-stone-800 dark:hover:text-stone-200">
                Ver na Agenda
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // Advogados livres
  const horaAgoraMs = now.getTime();
  const advogadosLivres = advogados.filter(adv => {
    if (!adv.ativo) return false;
    const emConsulta = consultas.some(c => {
      if (c.advogadoId !== adv.id || c.status === 'cancelada') return false;
      const ini = new Date(c.inicio).getTime();
      const fim = new Date(c.fim).getTime();
      return horaAgoraMs >= ini && horaAgoraMs <= fim;
    });
    return !emConsulta;
  });

  const badgeLivres = document.getElementById('badge-advogados-livres-count');
  if (badgeLivres) badgeLivres.textContent = `${advogadosLivres.length} livres`;

  const livresList = document.getElementById('dash-advogados-livres-list');
  if (livresList) {
    if (advogadosLivres.length === 0) {
      livresList.innerHTML = `<p class="py-4 text-xs text-center text-stone-400">Todos os advogados estão em atendimento ou fora de expediente.</p>`;
    } else {
      livresList.innerHTML = advogadosLivres.map(adv => `
        <div class="py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-semibold font-ui flex items-center justify-center text-xs border border-stone-200 dark:border-stone-700 relative">
              ${adv.nomeCompleto.split(' ').map(n=>n[0]).join('').slice(0, 2)}
              <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-darksurface"></span>
            </div>
            <div>
              <h4 class="text-xs font-semibold text-stone-900 dark:text-stone-100">${adv.nomeCompleto}</h4>
              <p class="text-[11px] text-stone-500 dark:text-stone-400">${adv.areaAtuacao || 'Geral'} • ${adv.nivel}</p>
            </div>
          </div>
          <button onclick="window.agendarParaAdvogado('${adv.id}')" class="px-2.5 py-1 text-xs text-stone-700 dark:text-stone-300 hover:text-brand-900 border border-stone-200 dark:border-stone-700 hover:border-stone-400 rounded transition-colors font-ui">
            Agendar
          </button>
        </div>
      `).join('');
    }
  }
}

// ========================================================
// RENDER VISÃO 2: CLIENTES (F1)
// ========================================================
function renderClientes() {
  const clientes = db.getClientes();
  const elInput = document.getElementById('input-busca-cliente');
  const termo = (elInput ? elInput.value : '').toLowerCase().trim();

  const filtrados = clientes.filter(c =>
    c.nomeCompleto.toLowerCase().includes(termo) ||
    c.cpfCnpj.toLowerCase().includes(termo) ||
    c.email.toLowerCase().includes(termo)
  );

  const tbody = document.getElementById('tabela-clientes-list');
  if (!tbody) return;

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-stone-400">Nenhum cliente encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(c => `
    <tr class="hover:bg-stone-50 dark:hover:bg-darkcard/50 transition-colors">
      <td class="py-3.5 px-6 font-semibold text-stone-900 dark:text-stone-100">${c.nomeCompleto}</td>
      <td class="py-3.5 px-6 text-stone-600 dark:text-stone-400">${c.cpfCnpj}</td>
      <td class="py-3.5 px-6 space-y-0.5">
        <div class="text-stone-800 dark:text-stone-200">${c.telefone}</div>
        <div class="text-stone-400 text-[11px]">${c.email}</div>
      </td>
      <td class="py-3.5 px-6 text-stone-500 dark:text-stone-400">${c.endereco || '—'}</td>
      <td class="py-3.5 px-6 text-right space-x-2">
        <button onclick="window.editarCliente('${c.id}')" class="text-stone-600 dark:text-stone-300 hover:text-brand-800 dark:hover:text-gold-400" title="Editar">
          <span class="material-symbols-outlined text-[18px]">edit</span>
        </button>
        <button onclick="window.excluirCliente('${c.id}')" class="text-stone-400 hover:text-red-600" title="Excluir">
          <span class="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </td>
    </tr>
  `).join('');
}

window.abrirModalCliente = function(clienteId = null) {
  const modalCliente = document.getElementById('modal-cliente');
  document.getElementById('cliente-id').value = '';
  document.getElementById('cliente-nome').value = '';
  document.getElementById('cliente-cpf').value = '';
  document.getElementById('cliente-telefone').value = '';
  document.getElementById('cliente-email').value = '';
  document.getElementById('cliente-endereco').value = '';

  if (clienteId) {
    const cliente = db.getClientes().find(c => c.id === clienteId);
    if (cliente) {
      document.getElementById('modal-cliente-titulo').textContent = 'Editar Cliente';
      document.getElementById('cliente-id').value = cliente.id;
      document.getElementById('cliente-nome').value = cliente.nomeCompleto;
      document.getElementById('cliente-cpf').value = cliente.cpfCnpj;
      document.getElementById('cliente-telefone').value = cliente.telefone;
      document.getElementById('cliente-email').value = cliente.email;
      document.getElementById('cliente-endereco').value = cliente.endereco || '';
    }
  } else {
    document.getElementById('modal-cliente-titulo').textContent = 'Cadastrar Cliente';
  }

  if (modalCliente) modalCliente.classList.remove('hidden');
};

window.editarCliente = window.abrirModalCliente;

window.excluirCliente = function(id) {
  const cliente = db.getClientes().find(c => c.id === id);
  if (!cliente) return;
  if (confirm(`Confirma a exclusão do cliente "${cliente.nomeCompleto}"?`)) {
    db.excluirCliente(id);
    window.showToast('Cliente excluído com sucesso.');
    renderClientes();
    renderDashboard();
  }
};

// ========================================================
// RENDER VISÃO 3: ADVOGADOS (F2)
// ========================================================
function renderAdvogados() {
  const advogados = db.getAdvogados();
  const grid = document.getElementById('grid-advogados-list');
  if (!grid) return;

  if (advogados.length === 0) {
    grid.innerHTML = `<p class="col-span-full py-8 text-center text-stone-400">Nenhum advogado cadastrado.</p>`;
    return;
  }

  grid.innerHTML = advogados.map(adv => `
    <div class="bg-white dark:bg-darksurface p-6 rounded-xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between space-y-4">
      <div>
        <div class="flex items-start justify-between">
          <div>
            <h3 class="font-serif font-bold text-base text-stone-900 dark:text-stone-100">${adv.nomeCompleto}</h3>
            <p class="text-xs text-brand-800 dark:text-gold-400 font-semibold font-ui mt-0.5">${adv.oab}</p>
          </div>
          <span class="px-2 py-0.5 text-[11px] font-semibold bg-stone-100 dark:bg-darkcard text-stone-700 dark:text-stone-300 rounded font-ui">
            ${adv.nivel}
          </span>
        </div>

        <div class="mt-4 space-y-1.5 text-xs text-stone-600 dark:text-stone-400 font-ui">
          <p><strong>Área:</strong> ${adv.areaAtuacao || 'Geral'}</p>
          <p><strong>Expediente:</strong> ${adv.horarioInicioManha}-${adv.horarioFimManha} | ${adv.horarioInicioTarde}-${adv.horarioFimTarde}</p>
        </div>
      </div>

      <div class="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
        <button onclick="window.agendarParaAdvogado('${adv.id}')" class="text-brand-800 dark:text-gold-400 font-semibold hover:underline">
          Agendar Consulta
        </button>
        <div class="space-x-2">
          <button onclick="window.editarAdvogado('${adv.id}')" class="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100" title="Editar">
            <span class="material-symbols-outlined text-[18px]">edit</span>
          </button>
          <button onclick="window.excluirAdvogado('${adv.id}')" class="text-stone-400 hover:text-red-600" title="Excluir">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

window.abrirModalAdvogado = function(advogadoId = null) {
  const modalAdvogado = document.getElementById('modal-advogado');
  document.getElementById('advogado-id').value = '';
  document.getElementById('advogado-nome').value = '';
  document.getElementById('advogado-oab').value = '';
  document.getElementById('advogado-nivel').value = 'Junior';
  document.getElementById('advogado-area').value = '';
  document.getElementById('advogado-hm-ini').value = '09:00';
  document.getElementById('advogado-hm-fim').value = '12:00';
  document.getElementById('advogado-ht-ini').value = '14:00';
  document.getElementById('advogado-ht-fim').value = '18:00';

  if (advogadoId) {
    const adv = db.getAdvogados().find(a => a.id === advogadoId);
    if (adv) {
      document.getElementById('modal-advogado-titulo').textContent = 'Editar Advogado';
      document.getElementById('advogado-id').value = adv.id;
      document.getElementById('advogado-nome').value = adv.nomeCompleto;
      document.getElementById('advogado-oab').value = adv.oab;
      document.getElementById('advogado-nivel').value = adv.nivel;
      document.getElementById('advogado-area').value = adv.areaAtuacao || '';
      document.getElementById('advogado-hm-ini').value = adv.horarioInicioManha || '09:00';
      document.getElementById('advogado-hm-fim').value = adv.horarioFimManha || '12:00';
      document.getElementById('advogado-ht-ini').value = adv.horarioInicioTarde || '14:00';
      document.getElementById('advogado-ht-fim').value = adv.horarioFimTarde || '18:00';
    }
  } else {
    document.getElementById('modal-advogado-titulo').textContent = 'Cadastrar Advogado';
  }

  if (modalAdvogado) modalAdvogado.classList.remove('hidden');
};

window.editarAdvogado = window.abrirModalAdvogado;

window.excluirAdvogado = function(id) {
  const adv = db.getAdvogados().find(a => a.id === id);
  if (!adv) return;
  if (confirm(`Confirma a exclusão do advogado "${adv.nomeCompleto}"?`)) {
    db.excluirAdvogado(id);
    window.showToast('Advogado excluído.');
    renderAdvogados();
    renderDashboard();
  }
};

// ========================================================
// RENDER VISÃO 4: CONSULTAS & AGENDA DIÁRIA (F3 + F4)
// ========================================================
function renderConsultas() {
  const consultas = db.getConsultas();
  const clientes = db.getClientes();
  const advogados = db.getAdvogados();
  const servicos = db.getServicos();

  const tbody = document.getElementById('tabela-consultas-list');
  if (tbody) {
    if (consultas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-stone-400">Nenhuma consulta agendada.</td></tr>`;
    } else {
      tbody.innerHTML = consultas.map(c => {
        const cliente = clientes.find(cli => cli.id === c.clienteId);
        const advogado = advogados.find(adv => adv.id === c.advogadoId);
        const servico = servicos.find(srv => srv.id === c.servicoId);

        let statusBadge = '<span class="px-2 py-0.5 rounded text-[11px] bg-blue-100 text-blue-800">Agendada</span>';
        if (c.status === 'realizada') {
          statusBadge = '<span class="px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800">Realizada</span>';
        } else if (c.status === 'cancelada') {
          statusBadge = '<span class="px-2 py-0.5 rounded text-[11px] bg-stone-100 text-stone-500">Cancelada</span>';
        }

        return `
          <tr class="hover:bg-stone-50 dark:hover:bg-darkcard/50 transition-colors">
            <td class="py-3 px-4 text-stone-900 dark:text-stone-100 font-semibold">
              ${formatDateIsoToBr(c.inicio)}<br/>
              <span class="text-stone-500 font-normal text-[11px]">${formatTimeIso(c.inicio)} - ${formatTimeIso(c.fim)}</span>
            </td>
            <td class="py-3 px-4 font-medium text-stone-800 dark:text-stone-200">${cliente ? cliente.nomeCompleto : 'Cliente Excluído'}</td>
            <td class="py-3 px-4 text-stone-700 dark:text-stone-300">${advogado ? advogado.nomeCompleto : 'Advogado'}</td>
            <td class="py-3 px-4 text-stone-600 dark:text-stone-400">${servico ? servico.descricao : 'Serviço'}</td>
            <td class="py-3 px-4 font-serif font-bold text-brand-800 dark:text-gold-400">${formatMoney(c.valorHonorario)}</td>
            <td class="py-3 px-4">${statusBadge}</td>
            <td class="py-3 px-4 text-right space-x-1">
              ${c.status === 'agendada' ? `
                <button onclick="window.concluirConsulta('${c.id}')" class="text-emerald-600 hover:text-emerald-800" title="Concluir">
                  <span class="material-symbols-outlined text-[18px]">check_circle</span>
                </button>
                <button onclick="window.cancelarConsulta('${c.id}')" class="text-red-500 hover:text-red-700" title="Cancelar">
                  <span class="material-symbols-outlined text-[18px]">cancel</span>
                </button>
              ` : ''}
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  const selectAdv = document.getElementById('select-agenda-advogado');
  const inputData = document.getElementById('input-agenda-data');

  if (selectAdv) {
    selectAdv.innerHTML = advogados.map(a => `<option value="${a.id}">${a.nomeCompleto}</option>`).join('');
  }

  if (inputData && !inputData.value) {
    inputData.value = new Date().toISOString().split('T')[0];
  }

  renderGradeHorarios();
}

function renderGradeHorarios() {
  const selectAdv = document.getElementById('select-agenda-advogado');
  const inputData = document.getElementById('input-agenda-data');
  const container = document.getElementById('grade-horarios-container');

  if (!selectAdv || !inputData || !container) return;

  const advId = selectAdv.value;
  const dataYmd = inputData.value;

  if (!advId || !dataYmd) return;

  const adv = db.getAdvogados().find(a => a.id === advId);
  if (!adv) return;

  const consultasAdv = db.getConsultas().filter(c =>
    c.advogadoId === advId &&
    c.inicio.startsWith(dataYmd) &&
    c.status !== 'cancelada'
  );

  const slots = [];
  for (let h = 8; h < 18; h++) {
    for (let m = 0; m < 60; m += 30) {
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const slotIso = `${dataYmd}T${timeStr}:00`;
      const slotTimeMs = new Date(slotIso).getTime();

      const minAtual = h * 60 + m;
      const [hmI, mmI] = (adv.horarioInicioManha || '09:00').split(':').map(Number);
      const [hmF, mmF] = (adv.horarioFimManha || '12:00').split(':').map(Number);
      const [htI, mtI] = (adv.horarioInicioTarde || '14:00').split(':').map(Number);
      const [htF, mtF] = (adv.horarioFimTarde || '18:00').split(':').map(Number);

      const emExpediente = (minAtual >= hmI * 60 + mmI && minAtual < hmF * 60 + mmF) ||
                           (minAtual >= htI * 60 + mtI && minAtual < htF * 60 + mtF);

      const ocupado = consultasAdv.find(c => {
        const ini = new Date(c.inicio).getTime();
        const fim = new Date(c.fim).getTime();
        return slotTimeMs >= ini && slotTimeMs < fim;
      });

      slots.push({ timeStr, emExpediente, ocupado });
    }
  }

  container.innerHTML = slots.map(s => {
    if (!s.emExpediente) {
      return `
        <div class="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-darkcard/30 text-stone-400 text-center text-xs">
          <span class="font-semibold block">${s.timeStr}</span>
          <span class="text-[10px]">Indisponível</span>
        </div>
      `;
    }

    if (s.ocupado) {
      const cli = db.getClientes().find(c => c.id === s.ocupado.clienteId);
      return `
        <div class="p-2.5 rounded-lg border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-center text-xs shadow-xs" title="O advogado já possui consulta nesse horário.">
          <span class="font-bold block">${s.timeStr}</span>
          <span class="text-[10px] block truncate font-medium">${cli ? cli.nomeCompleto : 'Ocupado'}</span>
        </div>
      `;
    }

    return `
      <button onclick="window.agendarSlotDirect('${advId}', '${dataYmd}', '${s.timeStr}')" class="p-2.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-center text-xs transition-colors cursor-pointer">
        <span class="font-bold block">${s.timeStr}</span>
        <span class="text-[10px] block font-semibold">+ Livre</span>
      </button>
    `;
  }).join('');
}

window.concluirConsulta = function(id) {
  db.concluirConsulta(id);
  window.showToast('Consulta concluída com sucesso!');
  renderConsultas();
  renderDashboard();
};

window.cancelarConsulta = function(id) {
  if (confirm('Deseja realmente cancelar esta consulta?')) {
    db.cancelarConsulta(id);
    window.showToast('Consulta cancelada.');
    renderConsultas();
    renderDashboard();
  }
};

window.agendarParaAdvogado = function(advId) {
  window.navegarPara('consultas');
  window.abrirModalConsulta(advId);
};

window.agendarSlotDirect = function(advId, dataYmd, horaStr) {
  window.abrirModalConsulta(advId, dataYmd, horaStr);
};

function atualizarCalculoHonorarioForm() {
  const elServ = document.getElementById('consulta-servico');
  const elAdv = document.getElementById('consulta-advogado');
  const elVal = document.getElementById('consulta-valor-causa');

  if (!elServ || !elAdv || !elVal) return;

  const servicoId = elServ.value;
  const advogadoId = elAdv.value;
  const valorCausa = parseFloat(elVal.value) || 0;

  const valorEstimado = db.calcularHonorario(servicoId, valorCausa, advogadoId);
  const elEst = document.getElementById('consulta-calculo-estimado');
  if (elEst) elEst.textContent = formatMoney(valorEstimado);

  const srv = db.getServicos().find(s => s.id === servicoId);
  const adv = db.getAdvogados().find(a => a.id === advogadoId);

  const elDet = document.getElementById('consulta-calculo-detalhe');
  if (srv && adv && elDet) {
    const mults = { 'Junior': 1.00, 'Pleno': 1.10, 'Senior': 1.25, 'Especialista': 1.40 };
    let detalhe = `Base: Valor Mínimo ${formatMoney(srv.valorMinimo)}`;
    if (srv.percentual) {
      detalhe += ` ou ${srv.percentual}% da Causa (${formatMoney((srv.percentual/100)*valorCausa)}). Foi aplicado o maior valor.`;
    }
    detalhe += ` Ajuste por nível ${adv.nivel} (+${(mults[adv.nivel]-1)*100}%).`;
    elDet.textContent = detalhe;
  }
}

window.abrirModalConsulta = function(advIdPref = null, dataPref = null, horaIniPref = null) {
  const modalConsulta = document.getElementById('modal-consulta');
  const clientes = db.getClientes();
  const advogados = db.getAdvogados();
  const servicos = db.getServicos();

  if (clientes.length === 0) {
    alert('Cadastre pelo menos um cliente antes de agendar uma consulta.');
    window.navegarPara('clientes');
    window.abrirModalCliente();
    return;
  }

  if (advogados.length === 0) {
    alert('Cadastre pelo menos um advogado antes de agendar uma consulta.');
    window.navegarPara('advogados');
    window.abrirModalAdvogado();
    return;
  }

  document.getElementById('consulta-id').value = '';
  document.getElementById('consulta-cliente').innerHTML = clientes.map(c => `<option value="${c.id}">${c.nomeCompleto}</option>`).join('');
  document.getElementById('consulta-advogado').innerHTML = advogados.map(a => `<option value="${a.id}">${a.nomeCompleto} (${a.nivel})</option>`).join('');
  document.getElementById('consulta-servico').innerHTML = servicos.map(s => `<option value="${s.id}">${s.area} - ${s.descricao}</option>`).join('');

  if (advIdPref) {
    document.getElementById('consulta-advogado').value = advIdPref;
  }

  const hoje = dataPref || new Date().toISOString().split('T')[0];
  document.getElementById('consulta-data').value = hoje;
  
  const hIni = horaIniPref || '14:00';
  document.getElementById('consulta-hora-ini').value = hIni;

  const [hh, mm] = hIni.split(':').map(Number);
  const hFim = `${String(hh + 1).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  document.getElementById('consulta-hora-fim').value = hFim;

  document.getElementById('consulta-valor-causa').value = '';
  document.getElementById('consulta-sala').value = 'Sala 01';
  document.getElementById('consulta-obs').value = '';

  atualizarCalculoHonorarioForm();
  if (modalConsulta) modalConsulta.classList.remove('hidden');
};

// ========================================================
// RENDER VISÃO 5: RELATÓRIOS & CHART.JS (F5)
// ========================================================
let chartInstance = null;

function renderRelatorios() {
  const consultas = db.getConsultas();
  const clientes = db.getClientes();
  const advogados = db.getAdvogados();
  const servicos = db.getServicos();

  const printDate = document.getElementById('print-date');
  if (printDate) printDate.textContent = `Data: ${new Date().toLocaleDateString('pt-BR')}`;

  const hojeYmd = new Date().toISOString().split('T')[0];
  const consultasHoje = consultas.filter(c => c.inicio.startsWith(hojeYmd) && c.status !== 'cancelada');

  const listHoje = document.getElementById('relatorio-consultas-hoje-list');
  if (listHoje) {
    if (consultasHoje.length === 0) {
      listHoje.innerHTML = `<tr><td colspan="5" class="py-3 text-center text-stone-400">Nenhuma consulta agendada para hoje.</td></tr>`;
    } else {
      listHoje.innerHTML = consultasHoje.map(c => {
        const cli = clientes.find(x => x.id === c.clienteId);
        const adv = advogados.find(x => x.id === c.advogadoId);
        const srv = servicos.find(x => x.id === c.servicoId);
        return `
          <tr class="hover:bg-stone-50 dark:hover:bg-darkcard/50">
            <td class="py-2.5 px-2 font-semibold">${formatTimeIso(c.inicio)}</td>
            <td class="py-2.5 px-2 font-medium">${cli ? cli.nomeCompleto : 'Cliente'}</td>
            <td class="py-2.5 px-2">${adv ? adv.nomeCompleto : 'Advogado'}</td>
            <td class="py-2.5 px-2 text-stone-500">${srv ? srv.descricao : 'Serviço'}</td>
            <td class="py-2.5 px-2 text-right font-serif font-bold text-brand-800 dark:text-gold-400">${formatMoney(c.valorHonorario)}</td>
          </tr>
        `;
      }).join('');
    }
  }

  const faturamentoAdv = advogados.map(adv => {
    const consAdv = consultas.filter(c => c.advogadoId === adv.id && c.status !== 'cancelada');
    const total = consAdv.reduce((sum, c) => sum + Number(c.valorHonorario || 0), 0);
    return {
      advogado: adv.nomeCompleto,
      nivel: adv.nivel,
      qtd: consAdv.length,
      total: total
    };
  });

  const listFat = document.getElementById('relatorio-faturamento-advogado-list');
  if (listFat) {
    listFat.innerHTML = faturamentoAdv.map(f => `
      <tr class="hover:bg-stone-50 dark:hover:bg-darkcard/50">
        <td class="py-2.5 px-2 font-semibold text-stone-900 dark:text-stone-100">${f.advogado}</td>
        <td class="py-2.5 px-2 text-stone-600 dark:text-stone-400">${f.nivel}</td>
        <td class="py-2.5 px-2">${f.qtd} consultas</td>
        <td class="py-2.5 px-2 text-right font-serif font-bold text-brand-800 dark:text-gold-400">${formatMoney(f.total)}</td>
      </tr>
    `).join('');
  }

  const ctx = document.getElementById('chartFaturamento');
  if (ctx) {
    if (chartInstance) {
      chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: faturamentoAdv.map(f => f.advogado),
        datasets: [{
          label: 'Faturamento Total (R$)',
          data: faturamentoAdv.map(f => f.total),
          backgroundColor: '#701A24',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) { return 'R$ ' + value; }
            }
          }
        }
      }
    });
  }

  const listCliGeral = document.getElementById('relatorio-clientes-geral-list');
  if (listCliGeral) {
    listCliGeral.innerHTML = clientes.map(c => `
      <tr class="hover:bg-stone-50 dark:hover:bg-darkcard/50">
        <td class="py-2.5 px-2 font-semibold">${c.nomeCompleto}</td>
        <td class="py-2.5 px-2 text-stone-600 dark:text-stone-400">${c.cpfCnpj}</td>
        <td class="py-2.5 px-2">${c.telefone}</td>
        <td class="py-2.5 px-2 text-stone-500">${c.email}</td>
      </tr>
    `).join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const htmlEl = document.documentElement;
  document.getElementById('register-phone')?.addEventListener('input', (event) => {
    event.currentTarget.value = formatBrazilianPhone(event.currentTarget.value);
  });
  document.getElementById('register-cpf-cnpj')?.addEventListener('input', (event) => {
    event.currentTarget.value = formatBrazilianDocument(event.currentTarget.value);
  });

  document.addEventListener('keydown', event => {
    const drawer = document.getElementById('staff-navigation-drawer');
    if (!drawer || drawer.classList.contains('hidden')) return;

    if (event.key === 'Escape') {
      window.alternarMenuNavegacao(false);
    } else if (event.key === 'Tab') {
      const focusableElements = Array.from(drawer.querySelectorAll(
        'button:not([disabled]):not([tabindex="-1"]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(element => element.getClientRects().length > 0);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  });

  document.getElementById('dash-finance-period')?.addEventListener('change', renderFinanceDashboard);
  document.getElementById('dash-finance-date')?.addEventListener('input', (event) => {
    event.currentTarget.value = formatBrazilianDateInput(event.currentTarget.value);
  });
  document.getElementById('dash-finance-date')?.addEventListener('change', renderFinanceDashboard);
  document.getElementById('dash-finance-comparison')?.addEventListener('change', renderFinanceDashboard);

  function aplicarTema(theme) {
    if (theme === 'dark') {
      htmlEl.classList.remove('light');
      htmlEl.classList.add('dark');
    } else {
      htmlEl.classList.remove('dark');
      htmlEl.classList.add('light');
    }
    db.setTheme(theme);
  }

  aplicarTema(db.getTheme());

  db.clearSession();

  // Formulário de Login
  document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email')?.value.trim().toLowerCase();
    const password = document.getElementById('login-senha')?.value || '';
    const requestedRole = document.getElementById('login-role')?.value;

    if (!requestedRole) {
      window.showToast('Selecione como entrar para continuar.', 'error', true);
      return;
    }
    if (!email || !password) {
      window.showToast('Informe e-mail e senha para continuar.', 'error', true);
      return;
    }

    const registered = db.getUsers().find(account => String(account.email || '').toLowerCase() === email);
    let user = null;

    if (registered) {
      const storedRole = registered.role === 'Usuário cadastrado' ? 'cliente' : (registered.role || 'cliente');

      if (storedRole !== requestedRole) {
        window.showToast('Este usuário não corresponde ao perfil selecionado.', 'error', true);
        return;
      }

      const hashedPassword = await derivePasswordHash(password, registered.passwordSalt || '');
      if (hashedPassword !== registered.passwordHash) {
        window.showToast('E-mail ou senha incorretos.', 'error', true);
        return;
      }

      const { passwordHash, passwordSalt, ...safeUser } = registered;
      user = { ...safeUser, role: storedRole, email };
    } else if (requestedRole === 'secretaria' && password === '123456' && email === 'secretaria@advocaciaetec.com.br') {
      user = { id: 'user-1', name: 'Secretaria Central', role: 'secretaria', badge: 'SEC', email };
    } else if (requestedRole === 'advogado' && password === '123456' && email === 'carlos.eduardo@advocaciaetec.com.br') {
      user = { id: 'user-2', name: 'Dr. Carlos Eduardo', role: 'advogado', badge: 'CE', email };
    }

    if (!user) {
      window.showToast('E-mail ou senha incorretos.', 'error', true);
      return;
    }

    if (user.role === 'cliente') {
      let cliente = db.getClientes().find(c => String(c.email || '').toLowerCase() === email);
      if (!cliente) cliente = db.salvarCliente({ nomeCompleto: user.name, email, cpfCnpj: '', telefone: '', endereco: '' });
      user.clienteId = cliente.id;
    }

    db.setSession(user);
    iniciarSessaoUI(user);

    if (user.role === 'cliente') {
      window.navegarPara('area-cliente');
    } else if (user.role === 'advogado' || user.id === 'user-2') {
      window.navegarPara('area-advogado');
    } else {
      window.navegarPara('dashboard');
    }

    window.showToast(`Bem-vindo(a), ${user.name}!`);
  });

  document.getElementById('form-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const cpfCnpj = document.getElementById('register-cpf-cnpj').value.trim();
    const phone = document.getElementById('register-phone').value.trim();
    const address = document.getElementById('register-address').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmation = document.getElementById('register-confirm-password').value;
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10 && phoneDigits.length !== 11) {
      window.showToast('Informe um telefone brasileiro válido com DDD.', 'error', true);
      return;
    }
    if (!hasValidCpfCnpj(cpfCnpj)) {
      const errorMessage = document.getElementById('register-cpf-cnpj-error');
      if (errorMessage) {
        errorMessage.textContent = 'Informe um CPF ou CNPJ válido.';
        errorMessage.classList.remove('hidden');
      }
      window.showToast('Informe um CPF ou CNPJ válido.', 'error', true);
      return;
    }
    document.getElementById('register-cpf-cnpj-error')?.classList.add('hidden');
    if (password !== confirmation) {
      window.showToast('As senhas não coincidem.', 'error', true);
      return;
    }
    if (db.getUsers().some(user => String(user.email || '').toLowerCase() === email)) {
      window.showToast('Já existe uma conta cadastrada com este e-mail.', 'error', true);
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const salt = gerarSaltSenha();
      const passwordHash = await derivePasswordHash(password, salt);
      db.registerUser({
        name,
        email,
        cpfCnpj,
        telefone: phone,
        endereco: address,
        passwordSalt: salt,
        passwordHash,
        role: 'cliente'
      });
      document.getElementById('login-email').value = email;
      document.getElementById('login-senha').value = '';
      form.reset();
      window.mostrarLogin();
      window.showToast('Conta criada. O e-mail informado não foi verificado; use o endereço correto para conseguir entrar.');
    } catch (error) {
      window.showToast(error.message || 'Não foi possível criar a conta.', 'error', true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.getElementById('form-cadastro-cliente-conta')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = document.getElementById('cad-cliente-nome').value.trim();
    const email = document.getElementById('cad-cliente-email').value.trim().toLowerCase();
    const password = document.getElementById('cad-cliente-senha').value;
    const confirmation = document.getElementById('cad-cliente-senha-confirma').value;
    if (password !== confirmation) return window.showToast('As senhas não coincidem.', 'error', true);
    if (db.getUsers().some(account => account.email.toLowerCase() === email)) return window.showToast('Já existe uma conta com este e-mail.', 'error', true);
    try {
      const salt = gerarSaltSenha();
      const passwordHash = await derivePasswordHash(password, salt);
      if (db.getUsers().some(account => account.email.toLowerCase() === email)) throw new Error('Já existe uma conta com este e-mail.');
      const cliente = db.salvarCliente({ nomeCompleto: name, email, cpfCnpj: document.getElementById('cad-cliente-cpf').value.trim(), telefone: document.getElementById('cad-cliente-telefone').value.trim(), endereco: document.getElementById('cad-cliente-endereco').value.trim() });
      db.registerUser({ name, email, passwordSalt: salt, passwordHash, role: 'cliente', clienteId: cliente.id });
      form.reset();
      window.showToast('Cliente cadastrado e conta criada com sucesso.');
      renderClientes();
      renderDashboard();
    } catch (error) {
      window.showToast(error.message || 'Não foi possível criar a conta do cliente.', 'error', true);
    }
  });

  document.getElementById('form-cadastro-advogado-conta')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = document.getElementById('cad-advogado-nome').value.trim();
    const email = document.getElementById('cad-advogado-email').value.trim().toLowerCase();
    const password = document.getElementById('cad-advogado-senha').value;
    const confirmation = document.getElementById('cad-advogado-senha-confirma').value;
    if (password !== confirmation) return window.showToast('As senhas não coincidem.', 'error', true);
    if (db.getUsers().some(account => account.email.toLowerCase() === email)) return window.showToast('Já existe uma conta com este e-mail.', 'error', true);
    try {
      const salt = gerarSaltSenha();
      const passwordHash = await derivePasswordHash(password, salt);
      if (db.getUsers().some(account => account.email.toLowerCase() === email)) throw new Error('Já existe uma conta com este e-mail.');
      const advogado = db.salvarAdvogado({ nomeCompleto: name, email, oab: document.getElementById('cad-advogado-oab').value.trim(), nivel: document.getElementById('cad-advogado-nivel').value, areaAtuacao: document.getElementById('cad-advogado-area').value.trim(), horarioInicioManha: '09:00', horarioFimManha: '12:00', horarioInicioTarde: '14:00', horarioFimTarde: '18:00' });
      db.registerUser({ name, email, passwordSalt: salt, passwordHash, role: 'advogado', advogadoId: advogado.id });
      form.reset();
      window.showToast('Advogado cadastrado e conta criada com sucesso.');
      renderAdvogados();
      renderDashboard();
    } catch (error) {
      window.showToast(error.message || 'Não foi possível criar a conta do advogado.', 'error', true);
    }
  });

  document.getElementById('input-busca-cliente')?.addEventListener('input', renderClientes);
  document.getElementById('select-agenda-advogado')?.addEventListener('change', renderGradeHorarios);
  document.getElementById('input-agenda-data')?.addEventListener('change', renderGradeHorarios);

  document.getElementById('consulta-servico')?.addEventListener('change', atualizarCalculoHonorarioForm);
  document.getElementById('consulta-advogado')?.addEventListener('change', atualizarCalculoHonorarioForm);
  document.getElementById('consulta-valor-causa')?.addEventListener('input', atualizarCalculoHonorarioForm);

  document.getElementById('form-cliente')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const clienteData = {
      id: document.getElementById('cliente-id').value || null,
      nomeCompleto: document.getElementById('cliente-nome').value.trim(),
      cpfCnpj: document.getElementById('cliente-cpf').value.trim(),
      telefone: document.getElementById('cliente-telefone').value.trim(),
      email: document.getElementById('cliente-email').value.trim(),
      endereco: document.getElementById('cliente-endereco').value.trim()
    };

    try {
      db.salvarCliente(clienteData);
      window.fecharModal('modal-cliente');
      window.showToast('Cliente salvo com sucesso!');
      renderClientes();
      renderDashboard();
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById('form-advogado')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const advData = {
      id: document.getElementById('advogado-id').value || null,
      nomeCompleto: document.getElementById('advogado-nome').value.trim(),
      oab: document.getElementById('advogado-oab').value.trim(),
      nivel: document.getElementById('advogado-nivel').value,
      areaAtuacao: document.getElementById('advogado-area').value.trim(),
      horarioInicioManha: document.getElementById('advogado-hm-ini').value,
      horarioFimManha: document.getElementById('advogado-hm-fim').value,
      horarioInicioTarde: document.getElementById('advogado-ht-ini').value,
      horarioFimTarde: document.getElementById('advogado-ht-fim').value
    };

    try {
      db.salvarAdvogado(advData);
      window.fecharModal('modal-advogado');
      window.showToast('Advogado salvo com sucesso!');
      renderAdvogados();
      renderDashboard();
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById('form-consulta')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const dataYmd = document.getElementById('consulta-data').value;
    const horaIni = document.getElementById('consulta-hora-ini').value;
    const horaFim = document.getElementById('consulta-hora-fim').value;

    const inicioIso = `${dataYmd}T${horaIni}:00`;
    const fimIso = `${dataYmd}T${horaFim}:00`;

    const consultaData = {
      id: document.getElementById('consulta-id').value || null,
      clienteId: document.getElementById('consulta-cliente').value,
      advogadoId: document.getElementById('consulta-advogado').value,
      servicoId: document.getElementById('consulta-servico').value,
      valorCausa: parseFloat(document.getElementById('consulta-valor-causa').value) || null,
      inicio: inicioIso,
      fim: fimIso,
      modalidade: document.getElementById('consulta-modalidade').value,
      sala: document.getElementById('consulta-sala').value.trim(),
      observacoes: document.getElementById('consulta-obs').value.trim(),
      status: 'agendada'
    };

    try {
      db.agendarConsulta(consultaData);
      window.fecharModal('modal-consulta');
      window.showToast('Consulta agendada com sucesso!');
      renderConsultas();
      renderDashboard();
    } catch (err) {
      alert(err.message);
    }
  });

  // Quando o Supabase envia dados atualizados, re-renderiza a tela atual
  document.addEventListener('db:synced', () => {
    const visible = document.querySelector('.spa-view:not(.hidden)');
    if (visible && typeof window.renderView === 'function') {
      window.renderView(visible.id.replace('view-', ''));
    }
  });

  const atualizarConsultasVencidas = () => {
    if (!db.atualizarConsultasVencidas()) return;
    const visible = document.querySelector('.spa-view:not(.hidden)');
    if (visible && typeof window.renderView === 'function') {
      window.renderView(visible.id.replace('view-', ''));
    }
  };
  atualizarConsultasVencidas();
  window.setInterval(atualizarConsultasVencidas, 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') atualizarConsultasVencidas();
  });

});

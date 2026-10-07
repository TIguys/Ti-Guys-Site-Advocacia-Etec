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
  window.showToast('Secretaria (telefone fictício): (11) 5555-0100.', 'support_agent');
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
  document.getElementById('staff-navigation-desktop')?.classList.toggle('hidden', !isSecretary);
  document.getElementById('staff-navigation-mobile')?.classList.toggle('hidden', !isSecretary);
  document.getElementById('nav-cadastros')?.classList.toggle('hidden', !isSecretary);
  document.getElementById('nav-cadastros-mobile')?.classList.toggle('hidden', !isSecretary);

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

window.navegarPara = function(viewId) {
  const currentUser = db.getSession();
  const isSecretary = currentUser?.id === 'user-1' || currentUser?.role === 'secretaria' || String(currentUser?.role || '').startsWith('Operacional');
  if (currentUser && !isSecretary) {
    if (currentUser.role === 'advogado' || currentUser.id === 'user-2') {
      if (viewId !== 'area-advogado') viewId = 'area-advogado';
    } else if (!['area-cliente', 'lawai'].includes(viewId)) viewId = 'area-cliente';
  }
  const spaViews = document.querySelectorAll('.spa-view');
  const navLinks = document.querySelectorAll('.nav-link');
  const mobileNavLinks = document.querySelectorAll('.nav-link-mobile');

  spaViews.forEach(view => {
    if (view.id === `view-${viewId}`) {
      view.classList.remove('hidden');
    } else {
      view.classList.add('hidden');
    }
  });

  navLinks.forEach(link => {
    if (link.getAttribute('data-view') === viewId) {
      link.classList.add('active', 'font-semibold', 'text-brand-800', 'dark:text-gold-400', 'border-b-2', 'border-brand-800', 'dark:border-gold-400');
      link.classList.remove('text-stone-600', 'dark:text-stone-400');
    } else {
      link.classList.remove('active', 'font-semibold', 'text-brand-800', 'dark:text-gold-400', 'border-b-2', 'border-brand-800', 'dark:border-gold-400');
      link.classList.add('text-stone-600', 'dark:text-stone-400');
    }
  });

  mobileNavLinks.forEach(link => {
    const fnStr = link.getAttribute('onclick') || '';
    if (fnStr.includes(`'${viewId}'`)) {
      link.classList.add('font-semibold', 'text-brand-800', 'dark:text-gold-400');
      link.classList.remove('text-stone-600', 'dark:text-stone-300');
    } else {
      link.classList.remove('font-semibold', 'text-brand-800', 'dark:text-gold-400');
      link.classList.add('text-stone-600', 'dark:text-stone-300');
    }
  });

  renderView(viewId);
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
    case 'lawai':
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

// ========================================================
// LAW AI (Assistente Jurídico)
// ========================================================
const lawAIHistory = [];
window.enviarMensagemLawAI = function() {
  const lawaiChatBox = document.getElementById('lawai-chat-box');
  const lawaiInput = document.getElementById('lawai-input-msg');

  if (!lawaiChatBox || !lawaiInput) return;

  const msg = lawaiInput.value.trim();
  if (!msg) return;

  const userMessage = document.createElement('div');
  userMessage.className = 'flex items-start justify-end gap-3';
  userMessage.innerHTML = `
    <div class="bg-brand-800 text-white p-3 rounded-lg max-w-[80%] leading-relaxed whitespace-pre-wrap">
      ${String(msg).replace(/</g, '&lt;').replace(/>/g, '&gt;')}
    </div>
  `;
  lawaiChatBox.appendChild(userMessage);

  lawaiInput.value = '';
  lawaiInput.disabled = true;
  document.getElementById('lawai-btn-send')?.setAttribute('disabled', 'disabled');

  const loading = document.createElement('div');
  loading.className = 'flex items-start gap-3';
  loading.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-brand-800 text-gold-400 font-bold flex items-center justify-center shrink-0">AI</div>
    <div class="bg-stone-100 dark:bg-darkcard p-3 rounded-lg text-stone-800 dark:text-stone-200 max-w-[80%] leading-relaxed">
      Pensando...
    </div>
  `;
  lawaiChatBox.appendChild(loading);
  lawaiChatBox.scrollTop = lawaiChatBox.scrollHeight;

  fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg, history: lawAIHistory.slice(-10) })
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível responder neste momento.');
      }
      return data.answer || 'Não houve resposta da inteligência artificial.';
    })
    .then((answer) => {
      loading.remove();
      lawAIHistory.push({ role: 'user', content: msg }, { role: 'assistant', content: answer });
      if (lawAIHistory.length > 10) lawAIHistory.splice(0, lawAIHistory.length - 10);

      const botMessage = document.createElement('div');
      botMessage.className = 'flex items-start gap-3';
      botMessage.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-brand-800 text-gold-400 font-bold flex items-center justify-center shrink-0">AI</div>
        <div class="bg-stone-100 dark:bg-darkcard p-3 rounded-lg text-stone-800 dark:text-stone-200 max-w-[80%] leading-relaxed whitespace-pre-wrap">
          ${String(answer || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}
        </div>
      `;
      lawaiChatBox.appendChild(botMessage);
    })
    .catch((error) => {
      loading.remove();

      const errorText = error instanceof TypeError
        ? 'Não foi possível conectar à IA. Confira se o serviço web da IA está configurado e se OPENAI_API_KEY está definida no servidor.'
        : (error.message || 'Erro ao consultar a IA.');

      const errorMessage = document.createElement('div');
      errorMessage.className = 'flex items-start gap-3';
      errorMessage.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-red-600 text-white font-bold flex items-center justify-center shrink-0">!</div>
        <div class="bg-red-50 text-red-700 p-3 rounded-lg max-w-[80%] leading-relaxed">
          ${String(errorText).replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </div>
      `;
      lawaiChatBox.appendChild(errorMessage);
    })
    .finally(() => {
      lawaiInput.disabled = false;
      document.getElementById('lawai-btn-send')?.removeAttribute('disabled');
      lawaiInput.focus();
      lawaiChatBox.scrollTop = lawaiChatBox.scrollHeight;
    });
};

// INICIALIZAÇÃO EVENT LISTENERS AO CARREGAR DOM
document.addEventListener('DOMContentLoaded', () => {
  const htmlEl = document.documentElement;

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

  // Checa se usuário possui sessão ativa salva
  const savedSession = db.getSession();
  if (savedSession) {
    iniciarSessaoUI(savedSession);
  }

  // Formulário de Login
  document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email')?.value.trim().toLowerCase();
    const password = document.getElementById('login-senha')?.value || '';
    const requestedRole = document.getElementById('login-role')?.value || 'cliente';

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
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value;
    const confirmation = document.getElementById('register-confirm-password').value;
    if (password !== confirmation) {
      window.showToast('As senhas não coincidem.', 'error', true);
      return;
    }
    try {
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
      const passwordHash = await derivePasswordHash(password, salt);
      db.registerUser({ name, email, passwordSalt: salt, passwordHash, role: 'cliente' });
      document.getElementById('login-email').value = email;
      document.getElementById('login-senha').value = '';
      document.getElementById('form-register').reset();
      window.mostrarLogin();
      window.showToast('Conta criada. Entre com seu e-mail e senha.');
    } catch (error) {
      window.showToast(error.message || 'Não foi possível criar a conta.', 'error', true);
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

  document.getElementById('lawai-input-msg')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') window.enviarMensagemLawAI();
  });
  // Quando o Supabase envia dados atualizados, re-renderiza a tela atual
  document.addEventListener('db:synced', () => {
    const visible = document.querySelector('.spa-view:not(.hidden)');
    if (visible && typeof window.renderView === 'function') {
      window.renderView(visible.id.replace('view-', ''));
    }
  });

});

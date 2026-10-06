/**
 * Advocacia ETEC - Camada de Dados
 * Persistência: LocalStorage (cache local) + sincronização Supabase (quando configurado)
 *
 * Como funciona a sincronização:
 * - Ao carregar, o sistema puxa os dados do Supabase e atualiza o LocalStorage
 *   (apenas quando o dado remoto é mais recente que o local).
 * - Toda alteração (salvar cliente, agendar consulta etc.) continua gravando
 *   instantaneamente no LocalStorage e, em seguida, é enviada ao Supabase
 *   (com debounce de 400 ms para não sobrecarregar a rede).
 * - Se o Supabase não estiver configurado ou estiver offline, o sistema segue
 *   funcionando 100% com LocalStorage, como antes.
 */

const STORAGE_KEYS = {
  CLIENTES: 'advocacia_etec_clientes',
  ADVOGADOS: 'advocacia_etec_advogados',
  SERVICOS: 'advocacia_etec_servicos',
  CONSULTAS: 'advocacia_etec_consultas',
  THEME: 'advocacia_etec_theme',
  USER_SESSION: 'advocacia_etec_session',
  USERS: 'advocacia_etec_users'
};

// Prefixo usado para guardar o "timestamp da última sincronização" de cada chave
const SYNC_META_PREFIX = 'advocacia_etec_sync_';

const MULTIPLICADORES_SENIORIDADE = {
  'Junior': 1.00,
  'Pleno': 1.10,
  'Senior': 1.25,
  'Especialista': 1.40
};

// Seed Inicial de Serviços OAB
const SEED_SERVICOS = [
  { id: 'srv-1', area: 'Geral', descricao: 'Consulta jurídica', valorMinimo: 300.00, percentual: null, ativo: true },
  { id: 'srv-2', area: 'Trabalhista', descricao: 'Ação trabalhista (percentual sobre condenação/acordo)', valorMinimo: 1500.00, percentual: 15.00, ativo: true },
  { id: 'srv-3', area: 'Cível', descricao: 'Ação de cobrança', valorMinimo: 1000.00, percentual: 10.00, ativo: true },
  { id: 'srv-4', area: 'Cível', descricao: 'Contrato particular', valorMinimo: 800.00, percentual: null, ativo: true },
  { id: 'srv-5', area: 'Penal', descricao: 'Defesa criminal — caso completo', valorMinimo: 5000.00, percentual: null, ativo: true },
  { id: 'srv-6', area: 'Família', descricao: 'Divórcio consensual', valorMinimo: 2000.00, percentual: null, ativo: true },
  { id: 'srv-7', area: 'Família', descricao: 'Pensão alimentícia', valorMinimo: 1200.00, percentual: 8.00, ativo: true },
  { id: 'srv-8', area: 'Empresarial', descricao: 'Assessoria Societária', valorMinimo: 3500.00, percentual: 5.00, ativo: true }
];

// Seed Inicial de Advogados
const SEED_ADVOGADOS = [
  {
    id: 'adv-1',
    nomeCompleto: 'Dr. Carlos Eduardo',
    oab: 'OAB/SP 123456',
    nivel: 'Senior',
    areaAtuacao: 'Geral & Societário',
    horarioInicioManha: '09:00',
    horarioFimManha: '12:00',
    horarioInicioTarde: '14:00',
    horarioFimTarde: '18:00',
    ativo: true
  },
  {
    id: 'adv-2',
    nomeCompleto: 'Dra. Sofia Mendes',
    oab: 'OAB/SP 234567',
    nivel: 'Especialista',
    areaAtuacao: 'Cível & Imobiliário',
    horarioInicioManha: '09:00',
    horarioFimManha: '12:00',
    horarioInicioTarde: '14:00',
    horarioFimTarde: '18:00',
    ativo: true
  },
  {
    id: 'adv-3',
    nomeCompleto: 'Dr. Roberto Dias',
    oab: 'OAB/SP 345678',
    nivel: 'Pleno',
    areaAtuacao: 'Trabalhista & Tributário',
    horarioInicioManha: '09:00',
    horarioFimManha: '12:00',
    horarioInicioTarde: '14:00',
    horarioFimTarde: '18:00',
    ativo: true
  },
  {
    id: 'adv-4',
    nomeCompleto: 'Dr. Lucas Alencar',
    oab: 'OAB/SP 389120',
    nivel: 'Junior',
    areaAtuacao: 'Direito Digital & LGPD',
    horarioInicioManha: '09:00',
    horarioFimManha: '12:00',
    horarioInicioTarde: '14:00',
    horarioFimTarde: '18:00',
    ativo: true
  },
  {
    id: 'adv-5',
    nomeCompleto: 'Dra. Helena Castro',
    oab: 'OAB/SP 412008',
    nivel: 'Pleno',
    areaAtuacao: 'Família & Sucessões',
    horarioInicioManha: '09:00',
    horarioFimManha: '12:00',
    horarioInicioTarde: '14:00',
    horarioFimTarde: '18:00',
    ativo: true
  },
  {
    id: 'adv-6',
    nomeCompleto: 'Dr. Thiago Arantes',
    oab: 'OAB/SP 356771',
    nivel: 'Senior',
    areaAtuacao: 'Contratos Comerciais',
    horarioInicioManha: '09:00',
    horarioFimManha: '12:00',
    horarioInicioTarde: '14:00',
    horarioFimTarde: '18:00',
    ativo: true
  }
];

// Seed Inicial de Clientes
const SEED_CLIENTES = [
  {
    id: 'cli-1',
    nomeCompleto: 'Grupo Vanguarda Logística',
    cpfCnpj: '14.892.304/0001-92',
    tipo: 'PJ',
    telefone: '(11) 98822-1010',
    email: 'contato@vanguarda.com.br',
    endereco: 'Av. Paulista, 1000, Cj 12 - São Paulo/SP',
    criadoEm: new Date().toISOString()
  },
  {
    id: 'cli-2',
    nomeCompleto: 'Construtora Alvorada S/A',
    cpfCnpj: '03.541.902/0002-18',
    tipo: 'PJ',
    telefone: '(11) 99990-8877',
    email: 'juridico@alvorada.com.br',
    endereco: 'Rua Augusta, 500 - São Paulo/SP',
    criadoEm: new Date().toISOString()
  },
  {
    id: 'cli-3',
    nomeCompleto: 'Dr. Marcos Vinicius Fontes',
    cpfCnpj: '341.890.128-09',
    tipo: 'PF',
    telefone: '(11) 97120-3344',
    email: 'marcos.fontes@email.com',
    endereco: 'Alameda Santos, 120 - São Paulo/SP',
    criadoEm: new Date().toISOString()
  },
  {
    id: 'cli-4',
    nomeCompleto: 'Mariana Albuquerque Costa',
    cpfCnpj: '198.542.871-45',
    tipo: 'PF',
    telefone: '(11) 96340-2288',
    email: 'mariana.albuquerque@email.com',
    endereco: 'Rua Almirante Barroso, 88 - Bragança Paulista/SP',
    criadoEm: new Date().toISOString()
  },
  {
    id: 'cli-5',
    nomeCompleto: 'BioVida Laboratórios Farmacêuticos',
    cpfCnpj: '25.510.984/0001-60',
    tipo: 'PJ',
    telefone: '(11) 98544-9012',
    email: 'contato@biovida.com.br',
    endereco: 'Av. Barão de Itapura, 1500 - Campinas/SP',
    criadoEm: new Date().toISOString()
  }
];

function getFormattedDate(offsetDays = 0, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// Seed Inicial de Consultas
const SEED_CONSULTAS = [
  {
    id: 'con-1',
    clienteId: 'cli-1',
    advogadoId: 'adv-3',
    servicoId: 'srv-2',
    valorCausa: 50000.00,
    valorHonorario: 8250.00,
    inicio: getFormattedDate(0, 14, 0),
    fim: getFormattedDate(0, 15, 0),
    modalidade: 'Presencial',
    sala: 'Sala 02',
    observacoes: 'Contencioso Tributário e trabalhista - Estruturação de defesas fiscais aduaneiras',
    status: 'agendada',
    criadoEm: new Date().toISOString()
  },
  {
    id: 'con-2',
    clienteId: 'cli-2',
    advogadoId: 'adv-2',
    servicoId: 'srv-4',
    valorCausa: 120000.00,
    valorHonorario: 1120.00,
    inicio: getFormattedDate(0, 15, 30),
    fim: getFormattedDate(0, 16, 30),
    modalidade: 'Videoconferência',
    sala: 'Online',
    observacoes: 'Direito Imobiliário & Contratos - Revisão de minuta de incorporação residencial',
    status: 'agendada',
    criadoEm: new Date().toISOString()
  },
  {
    id: 'con-3',
    clienteId: 'cli-3',
    advogadoId: 'adv-1',
    servicoId: 'srv-8',
    valorCausa: 200000.00,
    valorHonorario: 12500.00,
    inicio: getFormattedDate(0, 17, 0),
    fim: getFormattedDate(0, 18, 0),
    modalidade: 'Presencial',
    sala: 'Sala 01',
    observacoes: 'Assessoria Societária - Dissolução parcial de sociedade e apuração de haveres',
    status: 'agendada',
    criadoEm: new Date().toISOString()
  },
  {
    id: 'con-4',
    clienteId: 'cli-4',
    advogadoId: 'adv-5',
    servicoId: 'srv-6',
    valorCausa: null,
    valorHonorario: 2200.00,
    inicio: getFormattedDate(1, 10, 0),
    fim: getFormattedDate(1, 11, 0),
    modalidade: 'Presencial',
    sala: 'Sala 01',
    observacoes: 'Divórcio e Partilha de Bens',
    status: 'agendada',
    criadoEm: new Date().toISOString()
  },
  {
    id: 'con-5',
    clienteId: 'cli-5',
    advogadoId: 'adv-4',
    servicoId: 'srv-1',
    valorCausa: null,
    valorHonorario: 300.00,
    inicio: getFormattedDate(1, 14, 30),
    fim: getFormattedDate(1, 15, 30),
    modalidade: 'Videoconferência',
    sala: 'Online',
    observacoes: 'Auditoria de Propriedade Intelectual & LGPD',
    status: 'agendada',
    criadoEm: new Date().toISOString()
  }
];

class Database {
  constructor() {
    this._pushTimers = {};
    this.initStorage();
    // Inicializa a sincronização em segundo plano sem travar a interface.
    this.initSupabase();
  }

  // === CONFIGURAÇÃO DO SUPABASE ===
  async initSupabase() {
    this.supabase = null;
    this.supabaseReady = false;

    let url = (typeof window !== 'undefined' && window.SUPABASE_URL) || '';
    let key = (typeof window !== 'undefined' && window.SUPABASE_ANON_KEY) || '';

    const isGitHubPages = typeof window !== 'undefined'
      && (window.location.hostname === 'github.io' || window.location.hostname.endsWith('.github.io'));

    if (!isGitHubPages && typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const response = await fetch('/api/config', {
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
          throw new Error('Endpoint de configuração respondeu HTTP ' + response.status);
        }
        const config = await response.json();
        url = config.supabaseUrl || url;
        key = config.supabaseAnonKey || key;
      } catch (e) {
        if (key) {
          console.warn('Não foi possível carregar a configuração do Supabase do servidor; usando a configuração local.', e);
        }
      }
    }

    if (!url || !key) {
      console.info('[Supabase] Chave anon não configurada. Sincronização desativada; os dados permanecem no navegador.');
      return;
    }

    if (typeof window === 'undefined' || !window.supabase) {
      console.warn('Variáveis do Supabase definidas, mas a biblioteca supabase-js não foi carregada.');
      return;
    }

    try {
      this.supabase = window.supabase.createClient(url, key);
      this.supabaseReady = true;
      console.log('[Supabase] Cliente conectado. Sincronização ativa.');
      const remoteKeys = await this.pullFromSupabase();
      if (remoteKeys) {
        for (const key of Object.values(STORAGE_KEYS)) {
          const value = this._readLocal(key);
          if (!remoteKeys.has(key) && value !== null) {
            this._schedulePush(key, value);
          }
        }
      }
    } catch (e) {
      console.warn('Falha ao conectar no Supabase, usando LocalStorage:', e);
    }
  }

  isBrowser() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  // Leitura/gravação puramente local (sem disparar sincronização)
  _readLocal(key) {
    if (this.isBrowser()) {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }
    return this.memoryStore ? this.memoryStore[key] : null;
  }

  _writeLocal(key, value) {
    if (this.isBrowser()) {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      if (!this.memoryStore) this.memoryStore = {};
      this.memoryStore[key] = value;
    }
  }

  getItem(key) {
    return this._readLocal(key);
  }

  setItem(key, value) {
    this._writeLocal(key, value);
    this._schedulePush(key, value);
  }

  // === SINCRONIZAÇÃO COM O SUPABASE ===
  _getSyncMeta(key) {
    return Number(this._readLocal(SYNC_META_PREFIX + key)) || 0;
  }

  _setSyncMeta(key, timestampMs) {
    this._writeLocal(SYNC_META_PREFIX + key, timestampMs);
  }

  _schedulePush(key, value) {
    if (!this.supabaseReady) return;
    clearTimeout(this._pushTimers[key]);
    this._pushTimers[key] = setTimeout(() => this._pushToSupabase(key, value), 400);
  }

  async _pushToSupabase(key, value) {
    try {
      const { error } = await this.supabase
        .from('app_data')
        .upsert(
          { key: key, payload: value, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
      if (error) throw error;
      this._setSyncMeta(key, Date.now());
    } catch (e) {
      console.warn('Supabase: falha ao enviar "' + key + '". Os dados locais estão preservados.', e);
    }
  }

  async pullFromSupabase() {
    if (!this.supabaseReady) return;
    try {
      const { data, error } = await this.supabase
        .from('app_data')
        .select('key, payload, updated_at');
      if (error) throw error;

      let changed = false;
      const rows = data || [];
      for (const row of rows) {
        if (!row || !row.key) continue;
        const remoteMs = Date.parse(row.updated_at) || 0;
        if (remoteMs > this._getSyncMeta(row.key)) {
          this._writeLocal(row.key, row.payload);
          this._setSyncMeta(row.key, remoteMs);
          changed = true;
        }
      }

      if (changed && typeof document !== 'undefined') {
        // Avisa a interface para re-renderizar com os dados vindos do servidor
        document.dispatchEvent(new CustomEvent('db:synced'));
      }
      return new Set(rows.filter(row => row && row.key).map(row => row.key));
    } catch (e) {
      console.warn('Supabase: falha ao baixar dados. Usando cópia local.', e);
      return null;
    }
  }

  initStorage() {
    if (!this.getItem(STORAGE_KEYS.SERVICOS)) {
      this.setItem(STORAGE_KEYS.SERVICOS, SEED_SERVICOS);
    }
    if (!this.getItem(STORAGE_KEYS.ADVOGADOS)) {
      this.setItem(STORAGE_KEYS.ADVOGADOS, SEED_ADVOGADOS);
    }
    if (!this.getItem(STORAGE_KEYS.CLIENTES)) {
      this.setItem(STORAGE_KEYS.CLIENTES, SEED_CLIENTES);
    }
    if (!this.getItem(STORAGE_KEYS.CONSULTAS)) {
      this.setItem(STORAGE_KEYS.CONSULTAS, SEED_CONSULTAS);
    }
    if (!this.getItem(STORAGE_KEYS.USERS)) {
      this.setItem(STORAGE_KEYS.USERS, []);
    }
  }

  // === GERENCIAMENTO DE SESSÃO / USUÁRIO LOGADO ===
  getSession() {
    return this.getItem(STORAGE_KEYS.USER_SESSION) || null;
  }

  setSession(user) {
    this.setItem(STORAGE_KEYS.USER_SESSION, user);
  }

  clearSession() {
    if (this.isBrowser()) {
      localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
    } else if (this.memoryStore) {
      delete this.memoryStore[STORAGE_KEYS.USER_SESSION];
    }
  }

  getUsers() {
    return this.getItem(STORAGE_KEYS.USERS) || [];
  }

  registerUser(user) {
    const users = this.getUsers();
    const email = String(user.email || '').trim().toLowerCase();
    if (users.some(existing => existing.email.toLowerCase() === email)) {
      throw new Error('Já existe uma conta cadastrada com este e-mail.');
    }
    const savedUser = {
      id: 'user-' + Date.now(),
      name: String(user.name || '').trim(),
      email,
      passwordSalt: user.passwordSalt,
      passwordHash: user.passwordHash,
      role: user.role || 'cliente',
      badge: String(user.name || 'U').trim().slice(0, 2).toUpperCase()
    };
    if (savedUser.role === 'cliente') {
      let cliente = this.getClientes().find(item => String(item.email || '').toLowerCase() === email);
      if (!cliente) cliente = this.salvarCliente({ nomeCompleto: savedUser.name, email, cpfCnpj: '', telefone: '', endereco: '' });
      savedUser.clienteId = cliente.id;
    } else if (savedUser.role === 'advogado') {
      const advogado = this.getAdvogados().find(item => item.id === user.advogadoId);
      if (!advogado) throw new Error('Cadastre o perfil profissional do advogado antes de criar a conta.');
      advogado.email = email;
      this.setItem(STORAGE_KEYS.ADVOGADOS, this.getAdvogados().map(item => item.id === advogado.id ? advogado : item));
      savedUser.advogadoId = advogado.id;
    }
    users.push(savedUser);
    this.setItem(STORAGE_KEYS.USERS, users);
    return savedUser;
  }

  // === CÁLCULO DE HONORÁRIOS OAB (F3) ===
  calcularHonorario(servicoId, valorCausa, advogadoId) {
    const servicos = this.getServicos();
    const advogados = this.getAdvogados();

    const servico = servicos.find(s => s.id === servicoId);
    const advogado = advogados.find(a => a.id === advogadoId);

    if (!servico) return 0;

    const vMinimo = Number(servico.valorMinimo) || 0;
    const pct = Number(servico.percentual) || 0;
    const vCausa = Number(valorCausa) || 0;

    const valorPercentual = (pct / 100) * vCausa;
    const valorBase = Math.max(vMinimo, valorPercentual);

    const nivel = advogado ? advogado.nivel : 'Junior';
    const multiplicador = MULTIPLICADORES_SENIORIDADE[nivel] || 1.00;

    const valorFinal = valorBase * multiplicador;
    return Math.round(valorFinal * 100) / 100;
  }

  // === VALIDAÇÃO DE CONFLITO DE AGENDA (F4) ===
  validarConflitoAgenda(advogadoId, inicioIso, fimIso, consultaIdIgnorar = null) {
    const inicio = new Date(inicioIso);
    const fim = new Date(fimIso);

    const duracaoMinutos = (fim.getTime() - inicio.getTime()) / (1000 * 60);
    if (duracaoMinutos < 30) {
      return {
        temConflito: true,
        mensagem: 'A consulta deve ter duração mínima de 30 minutos.'
      };
    }

    const advogado = this.getAdvogados().find(a => a.id === advogadoId);
    if (!advogado) {
      return { temConflito: true, mensagem: 'Advogado não encontrado.' };
    }

    const horaInicio = inicio.getHours() * 60 + inicio.getMinutes();
    const horaFim = fim.getHours() * 60 + fim.getMinutes();

    const [hmI, mmI] = (advogado.horarioInicioManha || '09:00').split(':').map(Number);
    const [hmF, mmF] = (advogado.horarioFimManha || '12:00').split(':').map(Number);
    const [htI, mtI] = (advogado.horarioInicioTarde || '14:00').split(':').map(Number);
    const [htF, mtF] = (advogado.horarioFimTarde || '18:00').split(':').map(Number);

    const minManhaIni = hmI * 60 + mmI;
    const minManhaFim = hmF * 60 + mmF;
    const minTardeIni = htI * 60 + mtI;
    const minTardeFim = htF * 60 + mtF;

    const dentroManha = horaInicio >= minManhaIni && horaFim <= minManhaFim;
    const dentroTarde = horaInicio >= minTardeIni && horaFim <= minTardeFim;

    if (!dentroManha && !dentroTarde) {
      return {
        temConflito: true,
        mensagem: `Horário fora do expediente do advogado (${advogado.horarioInicioManha}-${advogado.horarioFimManha} / ${advogado.horarioInicioTarde}-${advogado.horarioFimTarde}).`
      };
    }

    const consultas = this.getConsultas().filter(c =>
      c.advogadoId === advogadoId &&
      c.status !== 'cancelada' &&
      c.id !== consultaIdIgnorar
    );

    for (const c of consultas) {
      const cStart = new Date(c.inicio).getTime();
      const cEnd = new Date(c.fim).getTime();
      const pStart = inicio.getTime();
      const pEnd = fim.getTime();

      if (Math.max(cStart, pStart) < Math.min(cEnd, pEnd)) {
        return {
          temConflito: true,
          mensagem: 'O advogado já possui consulta nesse horário.'
        };
      }
    }

    return { temConflito: false, mensagem: 'Horário disponível.' };
  }

  // === CLIENTES CRUD (F1) ===
  getClientes() {
    return this.getItem(STORAGE_KEYS.CLIENTES) || [];
  }

  salvarCliente(cliente) {
    const clientes = this.getClientes();
    if (cliente.id) {
      const idx = clientes.findIndex(c => c.id === cliente.id);
      if (idx !== -1) {
        clientes[idx] = { ...clientes[idx], ...cliente };
      }
    } else {
      cliente.id = 'cli-' + Date.now();
      cliente.criadoEm = new Date().toISOString();
      clientes.unshift(cliente);
    }
    this.setItem(STORAGE_KEYS.CLIENTES, clientes);
    return cliente;
  }

  excluirCliente(id) {
    let clientes = this.getClientes();
    clientes = clientes.filter(c => c.id !== id);
    this.setItem(STORAGE_KEYS.CLIENTES, clientes);
  }

  // === ADVOGADOS CRUD (F2) ===
  getAdvogados() {
    return this.getItem(STORAGE_KEYS.ADVOGADOS) || [];
  }

  salvarAdvogado(advogado) {
    const advogados = this.getAdvogados();
    const oabExiste = advogados.some(a =>
      a.oab.trim().toLowerCase() === advogado.oab.trim().toLowerCase() &&
      a.id !== advogado.id
    );

    if (oabExiste) {
      throw new Error(`Já existe um advogado cadastrado com a OAB "${advogado.oab}".`);
    }

    if (advogado.id) {
      const idx = advogados.findIndex(a => a.id === advogado.id);
      if (idx !== -1) {
        advogados[idx] = { ...advogados[idx], ...advogado };
      }
    } else {
      advogado.id = 'adv-' + Date.now();
      advogado.ativo = true;
      advogados.push(advogado);
    }
    this.setItem(STORAGE_KEYS.ADVOGADOS, advogados);
    return advogado;
  }

  excluirAdvogado(id) {
    let advogados = this.getAdvogados();
    advogados = advogados.filter(a => a.id !== id);
    this.setItem(STORAGE_KEYS.ADVOGADOS, advogados);
  }

  // === SERVIÇOS OAB (F3) ===
  getServicos() {
    return this.getItem(STORAGE_KEYS.SERVICOS) || [];
  }

  // === CONSULTAS CRUD (F3 + F4) ===
  getConsultas() {
    return this.getItem(STORAGE_KEYS.CONSULTAS) || [];
  }

  agendarConsulta(consulta) {
    const validacao = this.validarConflitoAgenda(
      consulta.advogadoId,
      consulta.inicio,
      consulta.fim,
      consulta.id
    );

    if (validacao.temConflito) {
      throw new Error(validacao.mensagem);
    }

    consulta.valorHonorario = this.calcularHonorario(
      consulta.servicoId,
      consulta.valorCausa,
      consulta.advogadoId
    );

    const consultas = this.getConsultas();
    if (consulta.id) {
      const idx = consultas.findIndex(c => c.id === consulta.id);
      if (idx !== -1) {
        consultas[idx] = { ...consultas[idx], ...consulta };
      }
    } else {
      consulta.id = 'con-' + Date.now();
      consulta.status = consulta.status || 'agendada';
      consulta.criadoEm = new Date().toISOString();
      consultas.unshift(consulta);
    }

    this.setItem(STORAGE_KEYS.CONSULTAS, consultas);
    return consulta;
  }

  cancelarConsulta(id) {
    const consultas = this.getConsultas();
    const idx = consultas.findIndex(c => c.id === id);
    if (idx !== -1) {
      consultas[idx].status = 'cancelada';
      this.setItem(STORAGE_KEYS.CONSULTAS, consultas);
    }
  }

  concluirConsulta(id) {
    const consultas = this.getConsultas();
    const idx = consultas.findIndex(c => c.id === id);
    if (idx !== -1) {
      consultas[idx].status = 'realizada';
      this.setItem(STORAGE_KEYS.CONSULTAS, consultas);
    }
  }

  // === TEMA LIGHT / DARK ===
  getTheme() {
    return this.getItem(STORAGE_KEYS.THEME) || 'light';
  }

  setTheme(theme) {
    this.setItem(STORAGE_KEYS.THEME, theme);
  }
}

// Instância singleton global
const db = new Database();
if (typeof window !== 'undefined') {
  window.db = db;
}

if (typeof module !== 'undefined') {
  module.exports = { Database, db };
}
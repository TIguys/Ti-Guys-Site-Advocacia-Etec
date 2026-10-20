/**
 * CONFIGURAÇÃO DO SUPABASE — Advocacia ETEC
 *
 * A chave pública é carregada pelo endpoint /api/config a partir do ambiente
 * do servidor. Para hospedagem estática, defina a anon public key aqui.
 * Nunca use a service_role key no navegador.
 */
window.SUPABASE_URL = "https://xfdfnqknajmwzspfqqcw.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_q56H3PCkfwlHyDkOvhs9SA_TWQERnLY";

/**
 * No GitHub Pages, configure a URL pública do backend após implantá-lo.
 * Quando o site e o backend são servidos juntos, usa automaticamente a origem
 * atual. Se continuar vazio no GitHub Pages, usa o modelo local via WebGPU.
 */
window.AI_API_BASE_URL = window.location.hostname === "tiguys.github.io"
  ? ""
  : window.location.origin;

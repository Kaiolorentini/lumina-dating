// ============================================
// LUMINA — CONFIGURAÇÃO DINÂMICA DO EXPO
// app.config.js  (raiz do app: C:\Users\kaio2\vesper\lumina-dating)
//
// 14/10/2026 (merge teste-web → main). Toda a configuração continua no
// app.json. Este arquivo só acrescenta o endereço-base da web
// (experiments.baseUrl = "/app") QUANDO a variável LUMINA_WEB_BASE
// existe — o publicar-site.ps1 liga a variável só durante o export web.
//
// Por quê: com o baseUrl fixo no app.json, o export Android e o
// "eas update" também saíam com o prefixo /app nos caminhos das
// imagens ("Using (experimental) base path: /app"). No Android isso
// não é necessário e é um risco desnecessário para o OTA. Assim:
//   • export web pelo script  → baseUrl /app (site em /app);
//   • export Android / OTA    → sem baseUrl (igual ao main de antes).
// A navegação web não depende disso: src/utils/webBase.ts detecta o
// /app pelo endereço da página.
// ============================================

module.exports = ({ config }) => {
  const webBase = (process.env.LUMINA_WEB_BASE || '').trim();
  if (!webBase) return config;
  if (!/^\/[a-z0-9-]+$/i.test(webBase)) {
    throw new Error(`LUMINA_WEB_BASE inválido: "${webBase}" (use algo como /app)`);
  }
  return {
    ...config,
    experiments: { ...(config.experiments || {}), baseUrl: webBase },
  };
};

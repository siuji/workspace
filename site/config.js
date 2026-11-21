// Configuração do workspace. Edite aqui sem mexer no resto do código.
window.WS_CONFIG = {
  // Nome do site. Aparece no título da aba, na abertura e na tela de celular.
  siteName: 'workspace',

  // Início de carreira. Os anos no site são sempre calculados a partir daqui.
  careerStart: '1999-01-01',

  // Trava de entrada: nome + LinkedIn antes de liberar o site.
  gate: true,

  // Registro de cadastros e visitas numa planilha Google (via Apps Script).
  // DESLIGADO. Para ligar: cole a URL do Apps Script em endpoint e troque enabled para true.
  // Antes de ligar, revisar o aviso de privacidade (LGPD) do formulário de entrada.
  tracking: {
    enabled: false,
    endpoint: ''
  }
};

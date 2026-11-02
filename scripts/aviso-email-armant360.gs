/**
 * Armant 360 · envio automático de e-mail (Google Apps Script)
 * Como instalar (5 minutos, grátis, usa a conta Gmail de quem publica):
 * 1. Entre em https://script.google.com com o Gmail que vai ENVIAR os avisos e clique em "Novo projeto".
 * 2. Apague o conteúdo e cole este arquivo inteiro. Salve.
 * 3. Clique em Implantar → Nova implantação → tipo "App da Web".
 *    Executar como: Eu. Quem pode acessar: Qualquer pessoa. Clique em Implantar e autorize.
 * 4. Copie o endereço que termina em /exec e cole no Armant 360:
 *    Usuários e acessos → Avisos por e-mail → "Endereço do envio automático". Clique em "Enviar e-mail de teste".
 * Limite do Gmail gratuito: cerca de 100 e-mails por dia.
 * Manda: pedidos de acesso (para o administrador) e avisos para cada pessoa (tarefa nova, tarefa atribuída, conta criada).
 * No site com servidor, cole o mesmo endereço quando o 03-funcoes.ps1 pedir (APPS_SCRIPT_URL).
 */
function doPost(e) {
  var d = JSON.parse(e.postData.contents || '{}');
  var para = String(d.para || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) return ContentService.createTextOutput('destinatario invalido');
  var corpo;
  if (d.texto) {
    // avisos do Armant 360 para a pessoa: tarefa nova, tarefa atribuída, conta criada, R.O. da obra
    corpo = 'Olá, ' + String(d.nome || '').split(' ')[0] + '!\n\n' + d.texto + (d.link ? '\n\nAbrir no Armant 360: ' + d.link : '') + '\n\nArmant 360';
  } else if (d.tipo === 'acesso_aprovado') {
    corpo = 'Olá, ' + d.nome + '!\n\nSeu acesso ao Armant 360 foi liberado.\n\nLogin: ' + d.email + '\nSenha inicial: ' + d.senha +
            '\n\nNo primeiro acesso o sistema pede para você criar uma senha nova.\n\nArmant 360';
  } else {
    corpo = (d.teste ? '[TESTE] ' : '') + 'Novo pedido de acesso ao Armant 360\n\n' +
            'Nome: ' + d.nome + '\nGmail: ' + d.email + '\nSetor: ' + d.setor + '\nFunção: ' + (d.funcao || '—') +
            '\nObra: ' + (d.obra || '—') + '\nTelefone: ' + (d.fone || '—') + '\nData: ' + String(d.em || '').replace('T', ' ') +
            '\n\nPara aprovar: Armant 360 → Usuários e acessos → Solicitações de acesso.';
  }
  MailApp.sendEmail({ to: para, subject: String(d.assunto || 'Armant 360'), body: corpo });
  return ContentService.createTextOutput('ok');
}

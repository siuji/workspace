/**
 * workspace · Feedback (Google Apps Script)
 *
 * Guarda cada feedback do site numa planilha Google, manda um e-mail a cada feedback
 * e um relatório mensal. O e-mail vai para a conta Google dona do script (não fica escrito aqui).
 *
 * Como instalar (uma vez):
 * 1. Crie uma planilha nova no Google Sheets (ex.: "workspace feedback").
 * 2. Na planilha: Extensões > Apps Script. Apague o conteúdo e cole este arquivo inteiro. Salve.
 * 3. No menu de funções, escolha "setup" e clique Executar. Autorize quando o Google pedir.
 *    Isso cria a aba "Feedback" e agenda o relatório mensal (dia 1, por volta das 9h).
 * 4. Implantar > Nova implantação > tipo "App da Web".
 *    Executar como: Eu. Quem pode acessar: Qualquer pessoa. Implantar.
 * 5. Copie a URL do App da Web (termina em /exec) e mande para colar em site/config.js (feedback.endpoint).
 */

const SHEET = 'Feedback';
const HEAD = ['Date', 'Name', 'LinkedIn', 'Feedback', 'Page', 'Language', 'Timezone'];

function setup() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (sh.getLastRow() === 0) { sh.appendRow(HEAD); sh.setFrozenRows(1); }
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'monthlyReport').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('monthlyReport').timeBased().onMonthDay(1).atHour(9).create();
}

function doPost(e) {
  let d = {};
  try { d = JSON.parse(e.postData.contents); } catch (x) { return out({ ok: false }); }
  const clip = (v, n) => String(v || '').slice(0, n);
  const name = clip(d.name, 120).trim(), message = clip(d.message, 5000).trim();
  if (name.length < 2 || message.length < 2 || d.website) return out({ ok: false });
  const row = [new Date(), name, clip(d.linkedin, 300), message, clip(d.page, 200), clip(d.lang, 20), clip(d.tz, 60)];
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { (SpreadsheetApp.getActive().getSheetByName(SHEET) || (setup(), SpreadsheetApp.getActive().getSheetByName(SHEET))).appendRow(row); }
  finally { lock.releaseLock(); }
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: 'workspace · New feedback from ' + name,
    body: 'Name: ' + name + '\nLinkedIn: ' + (row[2] || '-') + '\nPage: ' + (row[4] || '-') + '\n\n' + message + '\n\nAll feedback: ' + SpreadsheetApp.getActive().getUrl()
  });
  return out({ ok: true });
}

function monthlyReport() {
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(SHEET);
  const now = new Date(), from = new Date(now.getFullYear(), now.getMonth() - 1, 1), to = new Date(now.getFullYear(), now.getMonth(), 1);
  const rows = sh ? sh.getDataRange().getValues().slice(1).filter((r) => r[0] >= from && r[0] < to) : [];
  const month = Utilities.formatDate(from, Session.getScriptTimeZone(), 'MMMM yyyy');
  const list = rows.map((r) => '- ' + Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'dd/MM HH:mm') + ' · ' + r[1] + (r[2] ? ' (' + r[2] + ')' : '') + '\n  ' + String(r[3]).replace(/\n/g, '\n  ')).join('\n\n');
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: 'workspace · Monthly report · ' + month,
    body: 'Feedback received in ' + month + ': ' + rows.length + '\n\n' + (list || 'No feedback this month.') + '\n\nSpreadsheet: ' + ss.getUrl()
  });
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

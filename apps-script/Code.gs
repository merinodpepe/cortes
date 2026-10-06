/**
 * Backend de "Cortes": API sobre un Google Sheet.
 * Pega este archivo en Extensiones > Apps Script del Sheet,
 * ejecuta setup() una vez y despliega como Web App.
 */

var SHEET_CORTES = 'Cortes';
var SHEET_RESUMEN = 'Resumen';
var SHEET_CONFIG = 'Config';
var HEADERS = ['ID', 'Fecha', 'Cliente', 'Precio', 'Quién', 'Pagado', 'Fecha pago', 'Notas'];
var QUIEN = ['Yeray', 'Jan', 'Conjunto'];
var TZ = Session.getScriptTimeZone();

// Formato de fórmulas que acepta ESTE Sheet. Lo detecta setup() probando las 4 combinaciones
// (nombres en inglés o castellano x separador coma o punto y coma).
var FMT = { es: false, sep: ',' };

var FN_ES = {
  COUNTIFS: 'CONTAR.SI.CONJUNTO', COUNTA: 'CONTARA', SUMIFS: 'SUMAR.SI.CONJUNTO', SUM: 'SUMA',
  EDATE: 'FECHA.MES', DATE: 'FECHA', TODAY: 'HOY', YEAR: 'AÑO', MONTH: 'MES', IFERROR: 'SI.ERROR'
};

/** Adapta una fórmula escrita en inglés con comas al formato detectado (no toca el texto entre comillas). */
function tr_(f) {
  return trWith_(f, FMT);
}
function trWith_(f, fmt) {
  if (!fmt.es && fmt.sep === ',') return f;
  return f.split(/("[^"]*")/).map(function (part, i) {
    if (i % 2) return part;
    if (fmt.sep !== ',') part = part.replace(/,/g, fmt.sep);
    if (fmt.es) {
      part = part.replace(/\b(COUNTIFS|COUNTA|SUMIFS|SUM|EDATE|DATE|TODAY|YEAR|MONTH|IFERROR)\(/g,
        function (m, n) { return FN_ES[n] + '('; });
    }
    return part;
  }).join('');
}

var PRUEBAS = [
  '=SUMIFS(A1:A2,B1:B2,"x")', '=COUNTA(A1:A2)', '=SUM(A1:A2)', '=COUNTIFS(A1:A2,"x")',
  '=EDATE(DATE(2020,1,1),1)', '=IFERROR(1/0,7)', '=YEAR(TODAY())+MONTH(TODAY())'
];

/** Prueba las 4 variantes en una hoja temporal y devuelve la primera en la que todas las fórmulas calculan. */
function detectarFormato_(ss) {
  var tmp = ss.getSheetByName('_test') || ss.insertSheet('_test');
  var variantes = [
    { es: false, sep: ',' }, { es: false, sep: ';' }, { es: true, sep: ';' }, { es: true, sep: ',' }
  ];
  var elegido = null, log = [];
  for (var v = 0; v < variantes.length && !elegido; v++) {
    tmp.clear();
    var ok = true;
    PRUEBAS.forEach(function (f, i) {
      try { tmp.getRange(i + 1, 4).setFormula(trWith_(f, variantes[v])); } catch (e) { ok = false; }
    });
    SpreadsheetApp.flush();
    PRUEBAS.forEach(function (f, i) {
      var val = tmp.getRange(i + 1, 4).getValue();
      if (typeof val !== 'number') ok = false;
    });
    log.push(JSON.stringify(variantes[v]) + ' -> ' + (ok ? 'FUNCIONA' : 'falla'));
    if (ok) elegido = variantes[v];
  }
  ss.deleteSheet(tmp);
  Logger.log('Idioma del Sheet: ' + ss.getSpreadsheetLocale() + '\n' + log.join('\n'));
  return elegido;
}

/** Útil para depurar: muestra qué formato acepta el Sheet (ver Registro de ejecución). */
function diagnostico() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var f = detectarFormato_(ss);
  Logger.log('Elegido: ' + JSON.stringify(f));
}

function trAll_(rows) {
  return rows.map(function (r) { return r.map(tr_); });
}

// ---------- Instalación ----------

/** Ejecutar una sola vez desde el editor. Crea hojas, formato y fórmulas. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var cortes = getOrCreate_(ss, SHEET_CORTES);
  cortes.clear();
  cortes.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
  cortes.setFrozenRows(1);
  cortes.getRange('B2:B').setNumberFormat('dd/mm/yyyy');
  cortes.getRange('G2:G').setNumberFormat('dd/mm/yyyy');
  cortes.getRange('D2:D').setNumberFormat('#,##0.00 "€"');
  cortes.getRange('E2:E').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(QUIEN, true).setAllowInvalid(false).build());
  cortes.getRange('F2:F').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['SI', 'NO'], true).setAllowInvalid(false).build());
  cortes.setColumnWidths(1, 1, 80);
  cortes.setColumnWidths(2, 1, 95);
  cortes.setColumnWidths(3, 1, 160);
  cortes.setColumnWidths(8, 1, 240);

  var config = getOrCreate_(ss, SHEET_CONFIG);
  config.clear();
  config.getRange('A1:B4').setValues([
    ['Persona 1', 'Yeray'],
    ['Persona 2', 'Jan'],
    ['% de Yeray en cortes conjuntos', 50],
    ['Precio habitual del corte (€)', 10]
  ]);
  config.getRange('A1:A4').setFontWeight('bold');
  config.getRange('A5').setValue('El PIN no se guarda aquí. Para cambiarlo ejecuta setPin() editando el valor dentro de la función.');
  config.setColumnWidth(1, 240);

  var fmt = detectarFormato_(ss);
  if (!fmt) {
    SpreadsheetApp.getUi().alert('Ninguna variante de fórmulas funcionó. Idioma del Sheet: ' + ss.getSpreadsheetLocale() +
      '\nLa web funcionará igual, pero la hoja Resumen quedará sin fórmulas. Ejecuta diagnostico() y mira Ver > Registros.');
  } else {
    FMT = fmt;
    buildResumen_(getOrCreate_(ss, SHEET_RESUMEN));
  }

  if (!PropertiesService.getScriptProperties().getProperty('PIN')) {
    PropertiesService.getScriptProperties().setProperty('PIN', '1234');
  }

  // Hoja inicial por defecto (si existe vacía) fuera
  var def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  SpreadsheetApp.getUi().alert('Listo (fórmulas: ' + (fmt ? (fmt.es ? 'castellano' : 'inglés') + ', separador "' + fmt.sep + '"' : 'sin fórmulas') + ').\nPIN actual: ' + PropertiesService.getScriptProperties().getProperty('PIN') +
    '\nCámbialo editando setPin() y ejecutándola.');
}

/** Edita el valor y ejecuta esta función para cambiar el PIN. */
function setPin() {
  var NUEVO_PIN = '1234';
  PropertiesService.getScriptProperties().setProperty('PIN', String(NUEVO_PIN));
}

function getOrCreate_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function buildResumen_(sh) {
  sh.clear();
  var P = 'Cortes!$D$2:$D', Q = 'Cortes!$E$2:$E', G = 'Cortes!$F$2:$F', F = 'Cortes!$B$2:$B', C = 'Cortes!$C$2:$C';
  var rep = 'Config!$B$3/100';
  var mesIni = 'DATE(YEAR(TODAY()),MONTH(TODAY()),1)';
  var mesFin = 'EDATE(' + mesIni + ',1)';
  var enMes = ',' + F + ',">="&' + mesIni + ',' + F + ',"<"&' + mesFin;

  sh.getRange('A1').setValue('RESUMEN (se actualiza solo)').setFontSize(14).setFontWeight('bold');

  // Totales
  sh.getRange('A3:D3').setValues([['', 'Total', 'Mes actual', '']]).setFontWeight('bold');
  sh.getRange('A4:A8').setValues([['Cortes'], ['Facturado'], ['Cobrado'], ['Pendiente (deuda)'], ['']]);
  sh.getRange('B4:B7').setFormulas(trAll_([
    ['=COUNTA(Cortes!$A$2:$A)'],
    ['=SUM(' + P + ')'],
    ['=SUMIFS(' + P + ',' + G + ',"SI")'],
    ['=SUMIFS(' + P + ',' + G + ',"NO")']
  ]));
  sh.getRange('C4:C7').setFormulas(trAll_([
    ['=COUNTIFS(' + F + ',">="&' + mesIni + ',' + F + ',"<"&' + mesFin + ')'],
    ['=SUMIFS(' + P + enMes + ')'],
    ['=SUMIFS(' + P + ',' + G + ',"SI"' + enMes + ')'],
    ['=SUMIFS(' + P + ',' + G + ',"NO"' + enMes + ')']
  ]));

  // Por persona (conjunto repartido según Config)
  sh.getRange('A10:D10').setValues([['Por persona', 'Facturado', 'Cobrado', 'Pendiente']]).setFontWeight('bold');
  function persona(row, nameCell, share) {
    sh.getRange('A' + row).setFormula(tr_('=' + nameCell));
    var cols = [['', ''], ['SI', 'C'], ['NO', 'D']];
    var f = [];
    // facturado
    f.push('=SUMIFS(' + P + ',' + Q + ',A' + row + ')+SUMIFS(' + P + ',' + Q + ',"Conjunto")*' + share);
    f.push('=SUMIFS(' + P + ',' + Q + ',A' + row + ',' + G + ',"SI")+SUMIFS(' + P + ',' + Q + ',"Conjunto",' + G + ',"SI")*' + share);
    f.push('=SUMIFS(' + P + ',' + Q + ',A' + row + ',' + G + ',"NO")+SUMIFS(' + P + ',' + Q + ',"Conjunto",' + G + ',"NO")*' + share);
    sh.getRange('B' + row + ':D' + row).setFormulas(trAll_([f]));
  }
  persona(11, 'Config!$B$1', rep);
  persona(12, 'Config!$B$2', '(1-' + rep + ')');

  // Deudas por cliente
  sh.getRange('A15').setValue('Deudas por cliente').setFontWeight('bold');
  sh.getRange('A16').setFormula(tr_('=IFERROR(QUERY(Cortes!$A$1:$H,"select C, sum(D) where F=\'NO\' group by C order by sum(D) desc label C \'Cliente\', sum(D) \'Debe\'",1),"Sin deudas")'));

  // Por mes (últimos 12)
  sh.getRange('F3:I3').setValues([['Mes', 'Facturado', 'Cobrado', 'Pendiente']]).setFontWeight('bold');
  var rows = [];
  for (var i = 0; i < 12; i++) {
    var r = 4 + i;
    var ini = 'F' + r, fin = 'EDATE(F' + r + ',1)';
    var rng = ',' + F + ',">="&' + ini + ',' + F + ',"<"&' + fin;
    rows.push([
      '=EDATE(' + mesIni + ',-' + i + ')',
      '=SUMIFS(' + P + rng + ')',
      '=SUMIFS(' + P + ',' + G + ',"SI"' + rng + ')',
      '=SUMIFS(' + P + ',' + G + ',"NO"' + rng + ')'
    ]);
  }
  sh.getRange('F4:I15').setFormulas(trAll_(rows));
  sh.getRange('F4:F15').setNumberFormat('mmmm yyyy');

  sh.getRange('B5:D7').setNumberFormat('#,##0.00 "€"');
  sh.getRange('B11:D12').setNumberFormat('#,##0.00 "€"');
  sh.getRange('G4:I15').setNumberFormat('#,##0.00 "€"');
  sh.getRange('B16:B').setNumberFormat('#,##0.00 "€"');
  sh.setColumnWidths(1, 1, 170);
  sh.setColumnWidths(2, 3, 110);
  sh.setColumnWidths(6, 4, 110);
}

// ---------- API ----------

function doGet(e) {
  return handle_(e.parameter || {}, true);
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {}
  return handle_(body, false);
}

function handle_(p, isGet) {
  try {
    var pin = PropertiesService.getScriptProperties().getProperty('PIN');
    if (!pin || String(p.pin) !== String(pin)) return out_({ ok: false, error: 'PIN incorrecto' });

    var action = p.action || 'list';
    if (isGet) {
      if (action === 'list') return out_({ ok: true, data: readAll_() });
      if (action === 'ping') return out_({ ok: true });
      return out_({ ok: false, error: 'Acción desconocida' });
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var res;
      switch (action) {
        case 'add': res = add_(p); break;
        case 'edit': res = edit_(p); break;
        case 'delete': res = del_(p); break;
        case 'markPaid': res = setPaid_(p.ids, true); break;
        case 'markUnpaid': res = setPaid_(p.ids, false); break;
        case 'renameClient': res = rename_(p); break;
        case 'setConfig': res = setConfig_(p); break;
        default: return out_({ ok: false, error: 'Acción desconocida' });
      }
      return out_({ ok: true, data: res });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CORTES);
}

function fmtDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return v ? String(v) : '';
}

function parseDate_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) throw new Error('Fecha inválida');
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

function readAll_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  var cfg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG).getRange('B1:B4').getValues();
  var cuts = [];
  if (last >= 2) {
    var vals = sh.getRange(2, 1, last - 1, 8).getValues();
    vals.forEach(function (r) {
      if (!r[0]) return;
      cuts.push({
        id: String(r[0]), fecha: fmtDate_(r[1]), cliente: String(r[2]), precio: Number(r[3]) || 0,
        quien: String(r[4]), pagado: r[5] === 'SI', fechaPago: fmtDate_(r[6]), notas: String(r[7] || '')
      });
    });
  }
  return {
    cuts: cuts,
    config: {
      personas: [String(cfg[0][0]), String(cfg[1][0])],
      repartoPrimero: Number(cfg[2][0]),
      precioDefecto: Number(cfg[3][0]) || 0
    }
  };
}

function setConfig_(p) {
  var precio = Number(p.precioDefecto);
  if (!isFinite(precio) || precio < 0) throw new Error('Precio inválido');
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG).getRange('B4').setValue(precio);
  return { precioDefecto: precio };
}

function validate_(p) {
  var cliente = String(p.cliente || '').trim();
  if (!cliente) throw new Error('Falta el cliente');
  var precio = Number(p.precio);
  if (!isFinite(precio) || precio < 0) throw new Error('Precio inválido');
  var cfg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG).getRange('B1:B2').getValues();
  var validos = [String(cfg[0][0]), String(cfg[1][0]), 'Conjunto'];
  if (validos.indexOf(p.quien) < 0) throw new Error('Persona inválida');
  return { cliente: cliente, precio: precio, quien: p.quien, notas: String(p.notas || '').slice(0, 300) };
}

function add_(p) {
  var v = validate_(p);
  var id = Utilities.getUuid().slice(0, 8);
  var pagado = !!p.pagado;
  var fecha = parseDate_(p.fecha);
  var fechaPago = pagado ? parseDate_(p.fechaPago || p.fecha) : '';
  var sh = sheet_();
  sh.appendRow([id, fecha, v.cliente, v.precio, v.quien, pagado ? 'SI' : 'NO', fechaPago, v.notas]);
  return { id: id };
}

function findRow_(id) {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function edit_(p) {
  var row = findRow_(p.id);
  if (row < 0) throw new Error('Corte no encontrado');
  var v = validate_(p);
  var pagado = !!p.pagado;
  var fechaPago = pagado ? parseDate_(p.fechaPago || p.fecha) : '';
  sheet_().getRange(row, 2, 1, 7).setValues([[parseDate_(p.fecha), v.cliente, v.precio, v.quien, pagado ? 'SI' : 'NO', fechaPago, v.notas]]);
  return { id: p.id };
}

function del_(p) {
  var row = findRow_(p.id);
  if (row < 0) throw new Error('Corte no encontrado');
  sheet_().deleteRow(row);
  return { id: p.id };
}

function setPaid_(ids, paid) {
  if (!ids || !ids.length) throw new Error('Sin cortes');
  var sh = sheet_();
  var today = new Date();
  ids.forEach(function (id) {
    var row = findRow_(id);
    if (row < 0) return;
    sh.getRange(row, 6, 1, 2).setValues([[paid ? 'SI' : 'NO', paid ? today : '']]);
  });
  return { count: ids.length };
}

function rename_(p) {
  var from = norm_(p.from), to = String(p.to || '').trim();
  if (!from || !to) throw new Error('Nombres inválidos');
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return { count: 0 };
  var rng = sh.getRange(2, 3, last - 1, 1);
  var vals = rng.getValues();
  var n = 0;
  vals.forEach(function (r) { if (norm_(r[0]) === from) { r[0] = to; n++; } });
  rng.setValues(vals);
  return { count: n };
}

function norm_(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

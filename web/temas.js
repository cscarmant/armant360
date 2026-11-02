/* Armant 360 · opções de design (tema de cores). Mesmo layout, só troca as cores principais.
   A escolha fica neste navegador (chave a360tema, fora da sincronização com o banco).
   Padrão = as cores originais do Armant 360. Os outros temas só mudam as variáveis do :root. */
(function () {
  'use strict';
  var KEY = 'a360tema';
  var TEMAS = [
    { id: 'padrao', nome: 'Padrão (Armant)', cores: {} },
    { id: 'azul', nome: 'Azul', cores: { petrol: '#1e3a5f', mint: '#e6f0fb', blue: '#eef4fb', ink: '#1b2b44', muted: '#5a6b82', line: '#dde6f1', canvas: '#f4f7fb', green: '#2f6f8f', amber: '#9e651b' } },
    { id: 'verde', nome: 'Verde', cores: { petrol: '#1f4d3a', mint: '#e8f5ea', blue: '#eef7f1', ink: '#1d3a2c', muted: '#5e7468', line: '#dfe9e2', canvas: '#f5f9f6', green: '#2e7d4f', amber: '#9e651b' } },
    { id: 'grafite', nome: 'Grafite', cores: { petrol: '#2b2f36', mint: '#eceef1', blue: '#f0f2f5', ink: '#23272e', muted: '#666d78', line: '#e0e3e8', canvas: '#f4f5f7', green: '#4a5568', amber: '#9e651b' } }
  ];
  var VARS = ['petrol', 'mint', 'blue', 'ink', 'muted', 'line', 'canvas', 'green', 'amber'];

  function lerTema() { try { return localStorage.getItem(KEY) || 'padrao'; } catch (e) { return 'padrao'; } }
  function gravarTema(id) { try { localStorage.setItem(KEY, id); } catch (e) {} }

  function aplicar(id) {
    var t = TEMAS.filter(function (x) { return x.id === id; })[0] || TEMAS[0];
    var raiz = document.documentElement.style;
    VARS.forEach(function (v) { raiz.removeProperty('--' + v); });
    Object.keys(t.cores).forEach(function (v) { raiz.setProperty('--' + v, t.cores[v]); });
    return t.id;
  }

  function montar() {
    if (document.getElementById('a360-tema')) return;
    var box = document.createElement('label');
    box.id = 'a360-tema';
    box.className = 'a360-tema';
    box.innerHTML = '<span>Design</span><select aria-label="Escolher o design">' +
      TEMAS.map(function (t) { return '<option value="' + t.id + '">' + t.nome + '</option>'; }).join('') + '</select>';
    var sel = box.querySelector('select');
    sel.value = aplicar(lerTema());
    sel.addEventListener('change', function () { gravarTema(aplicar(sel.value)); });
    document.body.appendChild(box);
  }

  var css = document.createElement('style');
  css.textContent = '.a360-tema{position:fixed;right:16px;bottom:16px;z-index:50;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #dde6e3;border-radius:9px;padding:6px 8px;box-shadow:0 4px 16px #0000001a;font-size:11px;color:#50656a}.a360-tema select{border:0;background:transparent;font-size:11px;cursor:pointer;outline:0}';
  document.head.appendChild(css);

  aplicar(lerTema());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();

#!/usr/bin/env bash
# Armant 360 · roda a bateria atual de testes do site (Playwright + Chromium).
# Uso: bash teste-local/rodar-testes.sh            (a partir da pasta projeto/)
# Antes: copie dados-reais-uso-interno/obras-data.js e estoque-data.js para web/ (ficam fora do git).
set -u
cd "$(dirname "$0")/.."
SITE="$PWD/web"; OUT="$PWD/teste-local/saida"; mkdir -p "$OUT/tdl"; cp teste-local/recursos/* "$OUT/"
[ -f web/obras-data.js ] || echo "AVISO: web/obras-data.js ausente (obra real TJ-RS). Copie de dados-reais-uso-interno/."
[ -f web/estoque-data.js ] || echo "AVISO: web/estoque-data.js ausente (base oficial do estoque)."
ATUAIS="test_all2 test_login test_demo test_v2 test_sem_chat test_voltar test_tour test_obras_fict test_obras_ex test_vista_obras test_kanban_obras test_ro_col test_dem_pdf test_gantt test_grafico test_fluxo test_fluxo_pg test_banco test_com test_com_imp test_rotri test_tarefa_foto test_gas test_docs test_consumo test_almox2 test_fotos test_estoque_base test_dono_unico test_catalogo_areas test_pessoa_id test_temas test_nomes_por_id"
falhas=0
for t in $ATUAIS; do
  r=$(timeout 300 node "teste-local/$t.js" "$SITE" "$OUT" 2>&1 | grep -E "FALHA|Error|errors \[.+\]" | head -3)
  if [ -n "$r" ]; then echo "✗ $t"; echo "$r" | sed 's/^/    /'; falhas=$((falhas+1)); else echo "✓ $t"; fi
done
if [ -f ../dados-reais-uso-interno/ORGANIZACAO_ESTOQUE_REV_01.xlsx ]; then
  r=$(timeout 300 node teste-local/test_estoque_real.js "$SITE" ../dados-reais-uso-interno/ORGANIZACAO_ESTOQUE_REV_01.xlsx 2>&1 | grep -E "FALHA|Error"); [ -n "$r" ] && { echo "✗ test_estoque_real"; falhas=$((falhas+1)); } || echo "✓ test_estoque_real"
fi
echo; echo "Falhas: $falhas  (conhecida e antiga: test_inicio — erro ao abrir #atribuidas antes do login)"

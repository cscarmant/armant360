-- Armant 360 · 014 · o setor "Obras" passa a se chamar "Engenharia" (pedido do Valentim, 30/10/2026).
-- Renomeia o setor das pessoas e das regras de acesso já gravadas. As permissões são por módulo, então
-- nenhum módulo muda de dono: só o nome do setor que os libera.

update public.perfis set setor = 'Engenharia' where setor = 'Obras';

update public.permissoes
   set setores = array_replace(setores, 'Obras', 'Engenharia')
 where 'Obras' = any(setores);

-- o texto da regra de R.O. e do cadastro de demanda passa a usar o nome novo
update public.permissoes set nome = 'Menu do R.O.' where modulo = 'ro';

-- Armant 360 · 099 · o superadmin
-- O script 02-banco.ps1 reescreve o e-mail abaixo com o $SuperEmail do config.ps1 antes de enviar ao Supabase.
-- Nível 6 passa por cima de todas as regras (superadmin_tudo), desfaz qualquer alteração (desfazer),
-- executa qualquer SQL pelo app (super_sql) e gerencia logins pela função "admin".
insert into public.perfis(id, nome, email, nivel, setor, funcao, ativo)
values ('USR-001', 'Valentim', 'valentim.arr@gmail.com', 6, 'Diretoria', 'Superadmin', true)
on conflict (email) do update set nivel = 6, ativo = true, funcao = 'Superadmin';

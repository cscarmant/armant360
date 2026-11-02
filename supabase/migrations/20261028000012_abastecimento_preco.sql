-- Armant 360 · 012 · prestação de contas do veículo: preço do litro na bomba e foto do preço
-- (App de campo → Gasolina). A foto do cupom já existia (foto_path); agora há a foto do preço na bomba,
-- o preço informado e a diferença (%) entre o cupom (valor ÷ litros) e a bomba, quando passa de 3%.
alter table public.frota_abastecimentos add column if not exists preco_litro numeric(8,3) check (preco_litro is null or preco_litro > 0);
alter table public.frota_abastecimentos add column if not exists foto_preco_path text;
alter table public.frota_abastecimentos add column if not exists dif_preco numeric(6,1);
create or replace view public.v_abastecimentos_conferencia with (security_invoker = true) as
select a.id, a.data, a.veiculo_id, a.motorista, a.cc, a.posto, a.litros, a.valor,
       round(a.valor / nullif(a.litros, 0), 3) as preco_cupom, a.preco_litro as preco_bomba,
       round(abs(a.valor / nullif(a.litros, 0) - a.preco_litro) / nullif(a.preco_litro, 0) * 100, 1) as diferenca_pct,
       a.foto_path is not null as tem_cupom, a.foto_preco_path is not null as tem_foto_preco
  from public.frota_abastecimentos a;
grant select on public.v_abastecimentos_conferencia to authenticated;

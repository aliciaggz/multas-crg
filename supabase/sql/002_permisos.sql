-- Permite a anon leer las cuatro tablas públicas. staff queda sin permisos ni políticas de lectura.
begin;

revoke all privileges on table
  public.temporadas, public.jugadoras, public.multas, public.gastos_hucha, public.staff
  from public, anon, authenticated;

grant select on table
  public.temporadas, public.jugadoras, public.multas, public.gastos_hucha
  to anon;

drop policy if exists temporadas_lectura_anon on public.temporadas;
create policy temporadas_lectura_anon
  on public.temporadas for select to anon using (true);

drop policy if exists jugadoras_lectura_anon on public.jugadoras;
create policy jugadoras_lectura_anon
  on public.jugadoras for select to anon using (true);

drop policy if exists multas_lectura_anon on public.multas;
create policy multas_lectura_anon
  on public.multas for select to anon using (true);

drop policy if exists gastos_hucha_lectura_anon on public.gastos_hucha;
create policy gastos_hucha_lectura_anon
  on public.gastos_hucha for select to anon using (true);

commit;

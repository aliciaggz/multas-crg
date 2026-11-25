-- T002-11. Ejecutar solo tras publicar y verificar el cliente que usa sesiones.
-- Retira los permisos de las firmas antiguas. Conserva la declaración pública.
begin;

revoke all on function
  public.login_staff(text, text),
  public.registrar_multa(text, text, uuid, text, numeric, integer, integer, date, text, boolean),
  public.marcar_pagada(text, text, uuid, date),
  public.verificar_pago(text, text, uuid, boolean, date),
  public.anular_multa(text, text, uuid, text),
  public.registrar_gasto(text, text, uuid, numeric, text, date),
  public.editar_hucha_inicial(text, text, uuid, numeric, text, date),
  public.crear_temporada(text, text, text, numeric)
from public, anon, authenticated;

commit;

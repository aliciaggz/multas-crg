import { css, html, LitElement, nothing } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';
import catalogo from '../data/catalogo.json';
import type { Destinatario, Multa } from '../data/temporadas-demo';
import { euros, fechaCorta, importeAbonado, importeVisible, nombreConcepto } from '../lib/presentacion';
import { contarFaltas, diasHastaVencimiento, estadoMulta, fechaEnMadrid, importeRegistro, saldoHucha, saldoJugadora } from '../lib/reglas';
import { progresoEscalones } from '../lib/registro-multas';
import type { DeclararPago, GestionarStaff } from '../lib/supabase';
import { aplicaDoble, esTecnico } from '../lib/destinatarios';
import './crg-acciones-multa';

class CrgDetalle extends LitElement {
  static properties = {
    destinatario: { attribute: false }, multas: { attribute: false }, hoy: { attribute: false },
    declarar: { attribute: false }, gestionar: { attribute: false }, volverA: { type: String },
  };

  declare destinatario: Destinatario;
  declare multas: readonly Multa[];
  declare hoy: Date;
  declare declarar?: DeclararPago;
  declare gestionar?: GestionarStaff;
  declare volverA?: string;

  static styles = css`
    :host { display: block; }
    .volver {
      display: inline-flex; min-height: 44px; gap: 0.65rem; align-items: center;
      color: var(--color-primario); text-decoration: none; font-weight: 800; font-size: 0.88rem;
      margin-bottom: 0.45rem;
    }
    .alerta {
      margin: 0 0 0.65rem; border-radius: 0.8rem; background: var(--color-rojo-claro);
      color: var(--color-rojo); padding: 0.65rem 0.8rem; font-size: 0.8rem; font-weight: 800;
    }
    .tarjeta {
      padding: 0.9rem; border: 1px solid var(--color-borde); border-radius: var(--radio-tarjeta);
      background: var(--color-superficie); box-shadow: var(--sombra-tarjeta);
    }
    .perfil, .saldo, .cabecera, .multa-resumen { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
    .perfil { justify-content: flex-start; }
    .dorsal {
      width: 3.5rem; height: 3.5rem; flex: none; border-radius: 50%; display: grid; place-items: center;
      font: 700 1.22rem var(--fuente-etiqueta); background: var(--color-suave);
    }
    .perfil.vencida .dorsal { color: var(--color-rojo); background: var(--color-rojo-claro); }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 1.35rem; font-weight: 800; letter-spacing: -0.045em; }
    .apunte, .multa p { font-size: 0.76rem; font-weight: 600; color: var(--color-gris); }
    .capitana { color: var(--color-dorado-oscuro); margin-top: 0.12rem; }
    .saldo { border-top: 1px solid var(--color-borde); padding-top: 0.65rem; margin-top: 0.75rem; }
    .saldo strong { font: 700 clamp(1.55rem, 7vw, 2.25rem) var(--fuente-etiqueta); white-space: nowrap; }
    .saldo .apunte + .apunte { margin-top: 0.2rem; }
    .rojo { color: var(--color-rojo); }
    h2 { font-size: 1rem; font-weight: 800; letter-spacing: -0.025em; }
    section { margin-top: 1.05rem; }
    .cabecera { margin-bottom: 0.6rem; }
    .escalones { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.4rem; margin-top: 0.5rem; }
    .escalon {
      border: 1px solid var(--color-borde); border-radius: 0.7rem; background: var(--color-fondo);
      text-align: center; padding: 0.45rem 0.2rem; font: 600 0.73rem var(--fuente-etiqueta);
    }
    .escalon strong, .escalon span { display: block; margin-top: 0.12rem; }
    .escalon strong { font-size: 0.86rem; }
    .escalon span { font-size: 0.65rem; line-height: 1.25; }
    .escalon.completado { background: var(--color-suave); border-color: var(--color-verde); }
    .escalon.pendiente { background: var(--color-rojo-claro); border-color: var(--color-rojo); }
    .lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    .multa { border-left: 3px solid transparent; padding-block: 0.62rem; }
    .multa.vencida { border-left-color: var(--color-rojo); }
    .multa h3 { margin-bottom: 0.18rem; font-size: 0.9rem; font-weight: 800; }
    .multa.vencida p { color: var(--color-rojo); }
    .multa .importe { flex: none; text-align: end; font: 700 1rem var(--fuente-etiqueta); white-space: nowrap; }
    .multa del { display: block; font-size: 0.72rem; color: var(--color-gris); }
    details { margin-top: 1rem; }
    summary {
      box-sizing: border-box; min-height: 44px; padding: 0.65rem 0.9rem;
      border: 1px solid var(--color-borde); border-radius: var(--radio-tarjeta); background: var(--color-superficie);
      font-size: 0.83rem; font-weight: 800; cursor: pointer; box-shadow: var(--sombra-tarjeta);
    }
    details ul, details p { margin-top: 0.5rem; }
    :focus-visible { outline: none; }
  `;

  private tarjetaMulta(multa: Multa) {
    const estado = estadoMulta(multa, this.hoy);
    const vencida = estado === 'vencida';
    const importe = importeVisible(multa, this.hoy);
    const dias = diasHastaVencimiento(multa.fecha, this.hoy);
    let etiqueta = dias === 0 ? 'Vence hoy' : dias === 1 ? 'Queda 1 día' : `Quedan ${dias} días`;
    if (multa.estado === 'pagada') {
      etiqueta = multa.fecha_pago ? `Pagada el ${fechaCorta(multa.fecha_pago)}` : 'Pagada';
    } else if (multa.estado === 'pago_declarado') {
      etiqueta = vencida ? 'Vencida · pago pendiente de verificar' : 'Pago pendiente de verificar';
    } else if (vencida) {
      etiqueta = 'Vencida';
    }
    return html`
      <li class=${`multa tarjeta ${vencida ? 'vencida' : ''}`}>
        <div class="multa-resumen">
          <div><h3>${nombreConcepto(multa.concepto_id)}</h3><p>${fechaCorta(multa.fecha)} · ${etiqueta}</p></div>
          <div class=${`importe ${vencida ? 'rojo' : ''}`}>
            ${vencida ? html`<del aria-label="Importe original ${euros(multa.importe)}">${euros(multa.importe)}</del>` : nothing}
            <strong>${euros(importe)}</strong>
          </div>
        </div>
        ${multa.id && (this.gestionar || (multa.estado === 'pendiente' && this.declarar))
          ? keyed(`${multa.id}/${multa.estado}`, html`<crg-acciones-multa .multa=${multa}
              .declarar=${this.declarar} .gestionar=${this.gestionar}></crg-acciones-multa>`) : nothing}
      </li>
    `;
  }

  render() {
    const persona = this.destinatario;
    const tecnico = esTecnico(persona);
    const porImporte = (a: Multa, b: Multa) => importeVisible(a, this.hoy) - importeVisible(b, this.hoy);
    const activas = this.multas.filter(({ estado }) => estado === 'pendiente' || estado === 'pago_declarado').sort(porImporte);
    const vencidas = activas.filter((multa) => estadoMulta(multa, this.hoy) === 'vencida');
    const pagadas = this.multas.filter((multa) => multa.estado === 'pagada' && (this.gestionar || importeAbonado(multa) > 0)).sort(porImporte);
    const faltas = contarFaltas(this.multas);
    const progreso = progresoEscalones(persona, this.multas, fechaEnMadrid(this.hoy));
    const siguiente = progreso.find(({ nivel }) => nivel > faltas)?.nivel;
    const saldo = saldoJugadora(this.multas, this.hoy);

    return html`
      <a class="volver" href=${this.volverA ?? '#inicio'}><span aria-hidden="true">←</span>
        ${this.volverA === '#pagos-pendientes' ? 'Volver a pagos por verificar' : 'Volver a Inicio'}</a>
      ${vencidas.length ? html`<p class="alerta">No convocable · multas vencidas</p>` : nothing}
      <article class="tarjeta">
        <div class=${`perfil ${vencidas.length ? 'vencida' : ''}`}>
          ${tecnico ? nothing : html`<span class="dorsal">#${persona.dorsal}</span>`}
          <div>
            <h1>${persona.nombre}</h1>
            ${aplicaDoble(persona) ? html`<p class="apunte capitana">${tecnico ? 'Cuerpo técnico' : 'Capitana'} · multas ×2</p>` : nothing}
          </div>
        </div>
        <div class="saldo">
          <div>
            <p class="apunte">Total pendiente</p>
            <p class="apunte">${vencidas.length}
              ${vencidas.length === 1 ? 'multa vencida' : 'multas vencidas'}</p>
          </div>
          <strong class=${vencidas.length ? 'rojo' : ''}>${euros(saldo)}</strong>
        </div>
      </article>
      <section class="tarjeta" aria-label="Faltas de asistencia">
        <div class="cabecera"><h2>Faltas de asistencia</h2><span class="apunte">
          ${siguiente ? `${faltas} de ${siguiente}` : `${faltas} · último escalón alcanzado`}
        </span></div>
        <div class="escalones">
          ${progreso.map(({ nivel, estado, importe, faltasRestantes, incluidoEn }) => {
            const concepto = catalogo.find(({ id }) => id === `esc_${nivel}`)!;
            const estadoTexto = estado === 'completado' ? '✓ Completado'
              : estado === 'pendiente' ? `Pendiente · ${euros(importe)}`
                : estado === 'incluido' ? `Incluido en bono de ${incluidoEn} faltas`
                  : `Faltan ${faltasRestantes}`;
            return html`<div class=${`escalon ${estado}`} aria-label="${nivel} faltas: ${estadoTexto}">
              ${nivel} faltas<strong>${euros(importeRegistro(concepto, 1, aplicaDoble(persona)))}</strong>
              <span>${estadoTexto}</span>
            </div>`;
          })}
        </div>
      </section>
      <section aria-label="Sanciones pendientes">
        <div class="cabecera"><h2>Sanciones pendientes (${activas.length})</h2></div>
        ${activas.length ? html`<ul class="lista">${repeat(activas, (multa, indice) => multa.id ?? indice, (multa) => this.tarjetaMulta(multa))}</ul>`
          : html`<p class="apunte tarjeta">Al día · ninguna sanción pendiente.</p>`}
      </section>
      <details>
        <summary>Historial abonado (${pagadas.length}) · ${euros(saldoHucha(0, pagadas.map(importeAbonado)))}</summary>
        ${pagadas.length ? html`<ul class="lista">${repeat(pagadas, (multa, indice) => multa.id ?? indice, (multa) => this.tarjetaMulta(multa))}</ul>`
          : html`<p class="apunte tarjeta">Aún no hay sanciones abonadas.</p>`}
      </details>
    `;
  }
}

customElements.define('crg-detalle', CrgDetalle);

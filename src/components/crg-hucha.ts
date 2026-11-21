import { css, html, LitElement, nothing } from 'lit';
import type { Temporada } from '../data/temporadas-demo';
import { resumirHucha } from '../lib/hucha';
import { euros, fechaCorta } from '../lib/presentacion';

const filtros = [
  { id: 'todos', nombre: 'Todos' }, { id: 'ingreso', nombre: 'Ingresos' }, { id: 'gasto', nombre: 'Gastos' },
] as const;
type Filtro = typeof filtros[number]['id'];

class CrgHucha extends LitElement {
  static properties = { temporada: { attribute: false }, filtro: { state: true } };
  declare temporada: Temporada;
  private declare filtro: Filtro;

  constructor() {
    super();
    this.filtro = 'todos';
  }

  static styles = css`
    :host { display: block; }
    h1, h2, h3, p, dl, dd { margin: 0; }
    .bote { position: relative; overflow: hidden; padding: 1.1rem; border-radius: 1.4rem; color: white; background: linear-gradient(125deg, var(--color-tarjeta-oscura) 45%, #2e2339); box-shadow: 0 10px 25px rgb(15 23 42 / 11%); }
    .bote h1 { font-size: 1.35rem; font-weight: 800; letter-spacing: -0.035em; }
    .temporada { margin-top: 0.25rem; color: #d2d9ea; font: 600 0.78rem var(--fuente-etiqueta); }
    .total { display: block; margin: 0.55rem 0 0.85rem; font: 700 clamp(2.15rem, 8.6vw, 3.2rem) var(--fuente-etiqueta); letter-spacing: -0.05em; }
    .bote img { position: absolute; top: 1rem; right: 0.86rem; width: 5rem; height: 5rem; border-radius: 0.85rem; object-fit: cover; }
    .balance { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
    .balance div { padding: 0.6rem; border: 1px solid rgb(255 255 255 / 16%); background: rgb(255 255 255 / 10%); border-radius: 0.75rem; }
    dt { color: #e4e9f5; font: 700 0.73rem var(--fuente-etiqueta); }
    dd { margin-top: 0.25rem; font: 700 1.03rem var(--fuente-etiqueta); }
    section + section { margin-top: 1.25rem; }
    h2 { font-size: 1.15rem; font-weight: 800; letter-spacing: -0.025em; }
    h2 span { font: 600 0.83rem var(--fuente-etiqueta); color: var(--color-gris); margin-inline-start: 0.35rem; }
    .filtros { margin: 0.65rem 0 0.8rem; display: flex; flex-wrap: wrap; gap: 0.4rem; }
    button { min-height: 44px; padding: 0.3rem 0.8rem; border: 1px solid var(--color-borde); border-radius: 999px; background: var(--color-suave); color: var(--color-primario); font: 700 0.79rem var(--fuente-texto); cursor: pointer; }
    button[aria-pressed='true'] { color: white; background: var(--color-tarjeta-oscura); border-color: transparent; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.45rem; }
    li { display: grid; grid-template-columns: 2.45rem minmax(0, 1fr) auto; align-items: center; gap: 0.6rem; min-height: 3.4rem; padding: 0.5rem 0.7rem; border-radius: var(--radio-tarjeta); border: 1px solid var(--color-borde); background: var(--color-superficie); box-shadow: var(--sombra-tarjeta); }
    .icono { width: 2.45rem; height: 2.45rem; border-radius: 50%; display: grid; place-items: center; background: var(--color-suave); color: var(--color-dorado-oscuro); font-size: 1.1rem; }
    .gasto .icono { background: var(--color-rojo-claro); color: var(--color-rojo); }
    h3 { font-size: 0.86rem; font-weight: 800; }
    .apunte { margin-top: 0.15rem; color: var(--color-gris); font-size: 0.74rem; }
    .importe { white-space: nowrap; font: 700 0.95rem var(--fuente-etiqueta); }
    .gasto .importe { color: var(--color-rojo); }
    .vacio { padding: 0.85rem; border-radius: 0.7rem; background: var(--color-superficie); font-size: 0.84rem; }
    :focus-visible { outline: 2px solid var(--color-rojo); outline-offset: 2px; }
    @media (min-width: 34rem) { .bote img { right: 1.1rem; width: 6.25rem; height: 6.25rem; } }
  `;

  render() {
    const { saldo, ingresado, gastado, movimientos } = resumirHucha(this.temporada);
    const visibles = this.filtro === 'todos' ? movimientos : movimientos.filter(({ tipo }) => tipo === this.filtro);

    return html`
      <section class="bote">
        <h1>La hucha de Nacho</h1><p class="temporada">Temporada ${this.temporada.nombre}</p>
        <strong class="total" aria-label="Saldo ${euros(saldo)}">${euros(saldo)}</strong>
        <img src=${`${import.meta.env.BASE_URL}nacho-pig.png`} width="80" height="80" alt="">
        <dl class="balance">
          <div><dt>Ingresado</dt><dd>${euros(ingresado)}</dd></div>
          <div><dt>Gastado</dt><dd>${euros(gastado)}</dd></div>
        </dl>
      </section>
      <section>
        <h2>Movimientos <span aria-live="polite">${visibles.length}</span></h2>
        <div class="filtros" role="group" aria-label="Filtrar movimientos">
          ${filtros.map(({ id, nombre }) => html`<button type="button" aria-pressed=${this.filtro === id ? 'true' : 'false'}
            @click=${() => { this.filtro = id; }}>${nombre}</button>`)}
        </div>
        ${visibles.length ? html`<ul>${visibles.map((movimiento) => html`
          <li class=${movimiento.tipo}>
            <span class="icono" aria-hidden="true">${movimiento.tipo === 'ingreso' ? '↓' : '↑'}</span>
            <div><h3>${movimiento.concepto}</h3><p class="apunte">
              ${movimiento.tipo === 'gasto' ? 'Gasto · ' : html`Ingreso · `}${movimiento.dorsal !== undefined ? `#${movimiento.dorsal} · ` : nothing}<time datetime=${movimiento.fecha}>${fechaCorta(movimiento.fecha)}</time>
            </p></div>
            <strong class="importe">${movimiento.tipo === 'ingreso' ? '+' : '−'}${euros(movimiento.importe)}</strong>
          </li>
        `)}</ul>` : html`<p class="vacio">No hay movimientos para este filtro.</p>`}
      </section>
    `;
  }
}

customElements.define('crg-hucha', CrgHucha);

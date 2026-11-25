import { css, html, LitElement, nothing } from 'lit';
import catalogo from '../data/catalogo.json';
import { euros } from '../lib/presentacion';

const filtros = [
  { id: 'todas', nombre: 'Todas' }, { id: 'entreno', nombre: 'Entrenos' }, { id: 'partido', nombre: 'Partidos' },
] as const;
type Filtro = typeof filtros[number]['id'];
type Concepto = typeof catalogo[number];

class CrgCatalogo extends LitElement {
  static properties = { filtro: { state: true } };
  private declare filtro: Filtro;

  constructor() {
    super();
    this.filtro = 'todas';
  }

  static styles = css`
    :host { display: block; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 1.5rem; letter-spacing: -0.055em; font-weight: 800; }
    h2 { font-size: 1rem; font-weight: 800; }
    h3 { font-size: 0.85rem; font-weight: 800; }
    .filtros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.25rem; padding: 0.25rem; background: var(--color-suave); border-radius: 0.8rem; margin: 0.8rem 0; }
    button { min-height: 44px; border: 0; border-radius: 0.65rem; background: none; color: var(--color-primario); font: 700 0.85rem var(--fuente-texto); cursor: pointer; }
    button[aria-pressed='true'] { background: var(--color-superficie); box-shadow: var(--sombra-tarjeta); }
    .aviso { display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 0.8rem; border-radius: 0.8rem; background: var(--color-rojo-claro); color: var(--color-rojo); font-size: 0.79rem; font-weight: 700; line-height: 1.4; }
    .aviso span { font-size: 1rem; }
    section { margin-top: 1.1rem; }
    .cabecera { display: flex; align-items: center; gap: 0.45rem; margin-bottom: 0.55rem; }
    .cabecera::before { content: ''; width: 0.4rem; height: 0.4rem; flex: none; border-radius: 50%; background: var(--color-primario); }
    .partido .cabecera::before { background: var(--color-rojo); }
    .conceptos { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.38rem; }
    li { padding: 0.65rem 0.75rem; border: 1px solid var(--color-borde); border-radius: 0.8rem; background: var(--color-superficie); box-shadow: var(--sombra-tarjeta); }
    .conceptos li { display: flex; align-items: center; justify-content: space-between; gap: 0.65rem; }
    .precio { text-align: right; white-space: nowrap; font: 700 0.96rem var(--fuente-etiqueta); }
    .precio small { display: block; color: var(--color-gris); font-size: 0.67rem; }
    .descripcion, .nota { color: var(--color-gris); font-size: 0.74rem; line-height: 1.4; }
    .descripcion { margin-top: 0.18rem; }
    .escalones { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.35rem; list-style: none; margin: 0.5rem 0 0; padding: 0; }
    .escalones li { padding-inline: 0.25rem; text-align: center; background: var(--color-suave); }
    .escalones span { display: block; font-size: 0.73rem; font-weight: 700; }
    .escalones strong { font: 700 0.95rem var(--fuente-etiqueta); }
    .nota { margin-top: 0.95rem; }
    :focus-visible { outline: none; }
  `;

  private grupo(id: 'entreno' | 'partido', nombre: string) {
    const conceptos = catalogo.filter((concepto) => concepto.grupo === id).sort((a, b) => a.importe - b.importe);
    return html`<section class=${id}>
      <h2 class="cabecera">${nombre}</h2>
      <ul class="conceptos">${conceptos.map((concepto) => this.concepto(concepto))}</ul>
    </section>`;
  }

  private concepto(concepto: Concepto) {
    return html`<li>
      <div><h3>${concepto.nombre}</h3><p class="descripcion">${concepto.descripcion}</p></div>
      <span class="precio">${euros(concepto.importe)}${concepto.tipo === 'por_prenda' ? html`<small>por prenda</small>` : nothing}</span>
    </li>`;
  }

  render() {
    return html`
      <h1>Catálogo de multas</h1>
      <div class="filtros" role="group" aria-label="Filtrar conceptos">
        ${filtros.map(({ id, nombre }) => html`<button type="button" aria-pressed=${this.filtro === id ? 'true' : 'false'}
          @click=${() => { this.filtro = id; }}>${nombre}</button>`)}
      </div>
      <p class="aviso"><span aria-hidden="true">⚠</span> Si vence una multa, se duplica y la jugadora queda no convocable. El plazo es de 15 días.</p>
      ${this.filtro !== 'partido' ? html`
        ${this.grupo('entreno', 'Entrenos')}
        <section>
          <h2>Escalones de asistencia</h2>
          <p class="descripcion">Total base por temporada según el último escalón alcanzado.</p>
          <ul class="escalones">${catalogo.filter(({ grupo }) => grupo === 'escalon').sort((a, b) => a.importe - b.importe).map((concepto) => html`
            <li><span>${concepto.id.slice(4)} faltas</span><strong>${euros(concepto.importe)}</strong></li>
          `)}</ul>
        </section>
      ` : nothing}
      ${this.filtro !== 'entreno' ? this.grupo('partido', 'Partidos') : nothing}
      <p class="nota">Reglamento: cuerpo técnico y capitanas ×2.</p>
    `;
  }
}

customElements.define('crg-catalogo', CrgCatalogo);

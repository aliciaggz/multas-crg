import './styles/tokens.css';
import './components/crg-app';

document.querySelector('.salto-contenido')?.addEventListener('click', (evento) => {
  const contenido = document.querySelector('crg-app')?.shadowRoot?.querySelector('main');
  if (!contenido) return;
  evento.preventDefault();
  contenido.focus();
});

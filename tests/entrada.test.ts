import { expect, test } from "vitest";
import entrada from "../index.html?raw";

test("el documento de entrada monta la aplicación y carga su módulo", () => {
  expect(entrada).toContain('<crg-app id="contenido" tabindex="-1"></crg-app>');
  expect(entrada).toContain('href="#contenido"');
  expect(entrada).toContain(
    '<script type="module" src="/src/main.ts"></script>',
  );
});

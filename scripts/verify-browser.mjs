import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const base = 'http://127.0.0.1:4173';
const require = createRequire(join(process.env.QA_NODE_MODULES, '_qa.cjs'));
const { chromium } = require('playwright');
let ready = false;
for (let i=0; i<40; i++) {
  try { if ((await fetch(base)).ok) { ready=true; break; } } catch {}
  await new Promise(r=>setTimeout(r,500));
}
assert.ok(ready, 'Preview did not start');
await mkdir('qa-output',{recursive:true});
const browser = await chromium.launch({headless:true});
try {
  for (const viewport of [{width:1366,height:900},{width:390,height:844}]) {
    const context=await browser.newContext({viewport});
    try {
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror', e=>errors.push(e.message));
      await page.goto(base);
      await page.getByRole('heading',{name:'Resumen de hoy'}).waitFor();
      const nav=page.getByRole('navigation',{name:'Módulos'});
      const newButton=()=>page.getByRole('button',{name:/Nueva vacante/});
      const save=()=>page.getByRole('button',{name:'Guardar',exact:true}).click();
      const fill=async()=> {
        await page.getByLabel('Cargo',{exact:true}).fill('Cargo ficticio QA');
        await page.getByLabel('Unidad',{exact:true}).fill('Unidad demo');
        await page.getByLabel('Cupos',{exact:true}).fill('2');
        await page.getByLabel('Fecha de solicitud',{exact:true}).fill('2026-11-24');
      };
      const row=()=>page.getByRole('row').filter({hasText:'Cargo ficticio QA'});
      await newButton().click();
      await fill();
      await save();
      await page.getByRole('status').waitFor();
      assert.match(await page.getByRole('status').innerText(),/Vacante guardada/);
      assert.equal(await row().count(),1);
      await newButton().click();
      await fill();
      await save();
      await page.getByRole('alert').waitFor();
      assert.match(await page.getByRole('alert').innerText(),/Ya existe/);
      assert.equal(await row().count(),1);
      await page.getByRole('button',{name:'Cancelar',exact:true}).click();
      await row().getByRole('button',{name:'Editar'}).click();
      await page.getByLabel('Cupos',{exact:true}).fill('3');
      await nav.getByRole('button',{name:'Inicio',exact:true}).click();
      await nav.getByRole('button',{name:'Vacantes',exact:true}).click();
      assert.equal(await page.getByLabel('Cupos',{exact:true}).inputValue(),'3');
      await save();
      await page.getByRole('status').waitFor();
      assert.match(await row().innerText(),/3/);
      await page.reload();
      await page.getByRole('heading',{name:'Resumen de hoy'}).waitFor();
      await nav.getByRole('button',{name:'Vacantes',exact:true}).click();
      assert.equal(await row().count(),1);
      assert.equal(await row().getByRole('cell').nth(2).innerText(),'3');
      await page.getByLabel('Buscar vacantes').fill('sin coincidencia');
      assert.equal(await row().count(),0);
      await page.getByLabel('Buscar vacantes').fill('ficticio');
      assert.equal(await row().count(),1);
      await page.getByLabel('Buscar vacantes').clear();
      await page.screenshot({path:'qa-output/vacantes-'+viewport.width+'.png',fullPage:true});
      await row().getByRole('button',{name:'Editar'}).click();
      await page.getByLabel('Estado',{exact:true}).selectOption('Cerrada');
      await save();
      await page.getByRole('status').waitFor();
      await page.getByLabel('Filtrar estado').selectOption('Activa');
      assert.equal(await row().count(),0);
      await page.getByLabel('Filtrar estado').selectOption('Cerrada');
      assert.equal(await row().count(),1);
      await nav.getByRole('button',{name:'Inicio',exact:true}).click();
      await page.screenshot({path:'qa-output/inicio-'+viewport.width+'.png',fullPage:true});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal page overflow');
      assert.deepEqual(errors,[]);
      console.log('BROWSER_PASS '+viewport.width+'x'+viewport.height+' create duplicate edit draft navigation reload search close filters layout');
    } finally {await context.close();}
  }
} finally {await browser.close();}

import {mkdir,readdir,copyFile,stat,cp} from 'node:fs/promises';
import {join} from 'node:path';
const out='public/ocr',core='node_modules/tesseract.js-core',lang='node_modules/@tesseract.js-data/spa';
await mkdir(join(out,'core'),{recursive:true});await mkdir(join(out,'lang'),{recursive:true});
await copyFile('node_modules/tesseract.js/dist/worker.min.js',join(out,'worker.min.js'));
const files=(await readdir(core)).filter(n=>/^tesseract-core(?:-[a-z]+)*\.wasm(?:\.js)?$/.test(n));
for(const variant of ['','-simd','-lstm','-simd-lstm'])if(!files.includes('tesseract-core'+variant+'.wasm.js'))throw Error('OCR core variant absent: '+variant);
for(const name of files)await copyFile(join(core,name),join(out,'core',name));
const preferred=['4.0.0_best_int/spa.traineddata.gz','4.0.0/spa.traineddata.gz','spa.traineddata.gz'];
let model='';for(const p of preferred){try{if((await stat(join(lang,p))).isFile()){model=p;break;}}catch{}}
if(!model)throw Error('Spanish traineddata not found in pinned package');
await copyFile(join(lang,model),join(out,'lang/spa.traineddata.gz'));
for(const [source,label] of [['node_modules/tesseract.js','tesseract'],[core,'core'],[lang,'spa']]){for(const n of await readdir(source)){if(/^(license|notice|copying)(\..*)?$/i.test(n))await copyFile(join(source,n),join(out,label+'-'+n));}}
console.log('OCR_ASSETS_LOCAL',files.length,model);

const pdf='node_modules/pdfjs-dist';const pdfOut=join(out,'pdf');await mkdir(pdfOut,{recursive:true});for(const dir of ['wasm','standard_fonts','cmaps','iccs']){try{await stat(join(pdf,dir));}catch(e){if(dir==='iccs'&&e.code==='ENOENT')continue;throw e;}await cp(join(pdf,dir),join(pdfOut,dir),{recursive:true});}await copyFile(join(pdf,'build/pdf.renderer.min.mjs'),join(pdfOut,'pdf.renderer.min.mjs'));console.log('PDF_RENDER_ASSETS_LOCAL');

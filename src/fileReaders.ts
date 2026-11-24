import {validateGrid,parseDelimited,extractCv,type Grid,type Review} from './imports.js';
export type Sheet={sheet:string;data:Grid};
export async function readTable(file:File,delimiter:string):Promise<Sheet[]>{
 if(file.size>5_000_000)throw Error('Máximo 5 MB por archivo.');
 if(/\.csv$|\.tsv$/i.test(file.name))return [{sheet:'CSV',data:parseDelimited(await file.text(),delimiter)}];
 if(!/\.xlsx$/i.test(file.name))throw Error('Usa CSV, TSV o XLSX.');
 const {default:read}=await import('read-excel-file/browser');
 const sheets=await read(file);
 return sheets.filter(s=>!/clave|password|credencial|secret/i.test(s.sheet)).map(s=>({sheet:s.sheet,data:validateGrid(s.data.map(row=>row.map(c=>c instanceof Date?c.toISOString().slice(0,10):c===null||c===undefined?'':String(c))))}));
}
export async function readPdf(file:File,key:string):Promise<Review>{
 if(!/\.pdf$/i.test(file.name)||file.size>5_000_000)throw Error('PDF inválido o superior a 5 MB.');
 const [pdf,worker]=await Promise.all([import('pdfjs-dist'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
 pdf.GlobalWorkerOptions.workerSrc=worker.default;
 const task=pdf.getDocument({data:new Uint8Array(await file.arrayBuffer()),disableFontFace:true,useSystemFonts:false});
 try{const doc=await task.promise;if(doc.numPages>15)throw Error('Máximo 15 páginas por CV.');let text='';
 for(let p=1;p<=doc.numPages;p++){const page=await doc.getPage(p),content=await page.getTextContent();for(const item of content.items){if('str' in item)text+=item.str+(item.hasEOL?'\n':' ');}text+='\n';if(text.length>1000000)throw Error('Texto demasiado extenso.');page.cleanup();}
 if(!text.trim())throw Error('PDF sin texto seleccionable; requiere OCR.');return extractCv(text,file.name,key);
 }finally{await task.destroy();}
}

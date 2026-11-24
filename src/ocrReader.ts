import {extractCv,type Review} from './imports.js';
const MAX_PIXELS=3_000_000;
export async function readScannedCv(file:File,key:string,stillCurrent:()=>boolean):Promise<Review>{
 if(!/\.(pdf|png|jpe?g)$/i.test(file.name)||file.size>5_000_000||!file.size)throw Error('Usa PDF, PNG o JPG de hasta 5 MB.');
 const {createWorker}=await import('tesseract.js');
 const root=new URL(import.meta.env.BASE_URL+'ocr/',location.href);
 if(root.origin!==location.origin)throw Error('OCR debe usar recursos del mismo origen.');
 const worker=await createWorker('spa',1,{workerPath:new URL('worker.min.js',root).href,corePath:new URL('core/',root).href,langPath:new URL('lang',root).href,workerBlobURL:false,cacheMethod:'none'});
 const assertCurrent=()=>{if(!stillCurrent())throw Error('Lectura cancelada.');};
 let text='';
 async function recognize(canvas:HTMLCanvasElement){assertCurrent();const result=await worker.recognize(canvas);assertCurrent();text+=result.data.text+'\n';if(text.length>100000)throw Error('Texto OCR demasiado extenso.');}
 try{
  assertCurrent();
  if(/\.pdf$/i.test(file.name)){
   const [pdf,asset]=await Promise.all([import('pdfjs-dist'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);pdf.GlobalWorkerOptions.workerSrc=asset.default;
   const task=pdf.getDocument({data:new Uint8Array(await file.arrayBuffer()),disableFontFace:true,useSystemFonts:false});
   try{const doc=await task.promise;if(doc.numPages>3)throw Error('OCR admite hasta tres páginas por PDF.');
    for(let i=1;i<=doc.numPages;i++){assertCurrent();const page=await doc.getPage(i),base=page.getViewport({scale:1});const scale=Math.min(2.5,Math.sqrt(MAX_PIXELS/(base.width*base.height)),3000/base.width,3000/base.height);const viewport=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.floor(viewport.width));canvas.height=Math.max(1,Math.floor(viewport.height));try{await page.render({canvas,viewport}).promise;await recognize(canvas);}finally{canvas.width=0;canvas.height=0;page.cleanup();}}
   }finally{await task.destroy();}
  }else{
   const bitmap=await createImageBitmap(file);try{if(bitmap.width*bitmap.height>20_000_000)throw Error('Imagen demasiado grande.');const scale=Math.min(1,Math.sqrt(MAX_PIXELS/(bitmap.width*bitmap.height)),3000/bitmap.width,3000/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.floor(bitmap.width*scale));canvas.height=Math.max(1,Math.floor(bitmap.height*scale));try{const ctx=canvas.getContext('2d');if(!ctx)throw Error('No se pudo crear imagen local.');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);await recognize(canvas);}finally{canvas.width=0;canvas.height=0;}}finally{bitmap.close();}
  }
  if(!text.trim())throw Error('OCR no reconoció texto. Prueba una imagen más clara.');
  const result=extractCv(text,file.name,key);
  return {...result,values:{...result.values,notes:['OCR DEMO: revisar todos los campos antes de guardar.',result.values.notes].filter(Boolean).join(' ').slice(0,1000)}};
 }finally{await worker.terminate();}
}

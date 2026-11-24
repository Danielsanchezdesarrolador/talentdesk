// Synthetic image-only PDF fixture. No text layer and no candidate records.
export function scannedPdf(jpeg,width,height){
 if(!Buffer.isBuffer(jpeg)||jpeg[0]!==0xff||jpeg[1]!==0xd8||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw Error('Invalid fixture');
 const w=600,h=Math.round(w*height/width),drawing=Buffer.from('q '+w+' 0 0 '+h+' 0 0 cm /Im0 Do Q\n','ascii');
 const stream=(dict,data)=>Buffer.concat([Buffer.from('<< '+dict+' /Length '+data.length+' >>\nstream\n','ascii'),data,Buffer.from('\nendstream','ascii')]);
 const objects=[
 Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
 Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
 Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+w+' '+h+'] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'),
 stream('/Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode',jpeg),
 stream('',drawing)];
 const parts=[Buffer.from('%PDF-1.4\n','ascii')],offsets=[0];let length=parts[0].length;
 for(let i=0;i<objects.length;i++){offsets.push(length);const chunk=Buffer.concat([Buffer.from((i+1)+' 0 obj\n'),objects[i],Buffer.from('\nendobj\n')]);parts.push(chunk);length+=chunk.length;}
 parts.push(Buffer.from('xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+length+'\n%%EOF\n','ascii'));
 return Buffer.concat(parts);
}

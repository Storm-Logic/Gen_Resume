import { jsPDF } from 'jspdf';

export const defaultResumeStyle = { font: 'helvetica', nameSize: 23, bodySize: 10, headingSize: 9, accent: '#243949', alignment: 'left', divider: true, uppercaseHeadings: true, margin: 50, format: 'a4', template: 'simple' };
const rgb = hex => { const clean = (hex || '#243949').replace('#', ''); return [0,2,4].map(i => parseInt(clean.slice(i,i+2),16) || 0); };
const fontFiles = [
  ['normal', new URL('./assets/fonts/LiberationSerif-Regular.ttf', import.meta.url)],
  ['bold', new URL('./assets/fonts/LiberationSerif-Bold.ttf', import.meta.url)],
  ['italic', new URL('./assets/fonts/LiberationSerif-Italic.ttf', import.meta.url)]
];
async function loadFontBase64(url) {
  const bytes = url.protocol === 'file:'
    ? new Uint8Array(await (await import('node:fs/promises')).readFile(url))
    : new Uint8Array(await (await fetch(url)).arrayBuffer());
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary=''; for(let i=0;i<bytes.length;i+=32768) binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return btoa(binary);
}

export async function buildResumePdf(data, sourceStyle = defaultResumeStyle) {
  const style = { ...defaultResumeStyle, ...sourceStyle };
  const boxed = style.template === 'boxed';
  const pdf = new jsPDF({ unit: 'pt', format: style.format === 'letter' ? 'letter' : 'a4' });
  const pdfFont = style.font === 'liberation' ? 'LiberationSerif' : style.font;
  if (style.font === 'liberation') {
    for (const [weight, url] of fontFiles) {
      const filename = url.pathname.split('/').pop();
      pdf.addFileToVFS(filename, await loadFontBase64(url));
      pdf.addFont(filename, pdfFont, weight);
    }
  }
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const left = Math.min(72, Math.max(36, style.margin));
  const width = pageW - 2 * left;
  const bottom = pageH - (boxed ? 52 : left);
  const accent = rgb(style.accent);
  const dark = [25, 25, 25];
  let y = left + (boxed ? 13 : style.nameSize);
  const paintPage = () => { pdf.setFillColor(255,255,255); pdf.rect(0,0,pageW,pageH,'F'); };
  paintPage();
  const newPage = () => { pdf.addPage(); paintPage(); y = boxed ? left - 7 : left + 8; };
  const ensure = height => { if (y + height > bottom) newPage(); };
  const write = (value, options={}) => {
    if (!value) return;
    const { size=style.bodySize, weight='normal', color=dark, align='left', indent=0, after=size*.25, lineHeight=size*1.3 } = options;
    pdf.setFont(pdfFont, weight); pdf.setFontSize(size); pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(String(value), width-indent);
    for (const line of lines) {
      ensure(lineHeight);
      pdf.text(line, align==='center' ? pageW/2 : align==='right' ? pageW-left : left+indent, y, { align });
      y += lineHeight;
    }
    y += after;
  };
  const section = (title, key='') => {
    y += boxed ? 14 : style.bodySize*1.1;
    ensure(boxed ? 28 : 35);
    const label = style.uppercaseHeadings ? title.toUpperCase() : title;
    if (boxed) {
      if (key === 'experience' && style.doubleRule) {
        pdf.setDrawColor(55,55,55); pdf.setLineWidth(.7);
        pdf.line(left,y-18,pageW-left,y-18); pdf.line(left,y-15,pageW-left,y-15);
      }
      pdf.setFillColor(240,240,240); pdf.rect(left,y-10,width,20,'F');
      pdf.setFont(pdfFont,'bold'); pdf.setFontSize(style.headingSize); pdf.setTextColor(...dark);
      pdf.text(label,pageW/2,y+4,{align:'center'});
      y += 31;
    } else {
      if (style.divider) { pdf.setDrawColor(190,190,190); pdf.line(left,y,pageW-left,y); y += style.bodySize*1.6; }
      write(label,{size:style.headingSize,weight:'bold',color:accent,after:style.bodySize*.3});
    }
  };
  const bullet = value => {
    if (!value?.trim()) return;
    const text = value.trim().replace(/^[-•]\s*/,'');
    ensure(style.bodySize*1.5);
    if (boxed) { pdf.setFillColor(...dark); pdf.circle(left+5,y-3,1.6,'F'); write(text,{indent:14,size:style.bodySize,after:1,lineHeight:style.bodySize*1.3}); }
    else write('-  '+text,{indent:3,size:style.bodySize,after:2});
  };
  const titleWithDate = (title,dates,isJob=false) => {
    ensure(32);
    if (!boxed) { write([title,dates].filter(Boolean).join('  |  '),{size:style.bodySize+1,weight:'bold'}); return; }
    const x=left+10, size=style.bodySize;
    if(isJob){pdf.setFillColor(...dark);pdf.triangle(left+4,y-5,left+7,y-2,left+4,y+1,'F');pdf.triangle(left+4,y-5,left+1,y-2,left+4,y+1,'F');}
    pdf.setFont(pdfFont,'bold');pdf.setFontSize(size);pdf.setTextColor(...dark);
    const titleLines=pdf.splitTextToSize(title,width-(dates?110:15));
    pdf.text(titleLines[0]||'',x,y);
    if (dates) {
      pdf.setFont(pdfFont,'normal');pdf.setFontSize(Math.max(8,size-1));
      pdf.text(dates,pageW-left,y,{align:'right'});
      const start=x+pdf.getTextWidth(titleLines[0]||'')+5;
      const end=pageW-left-pdf.getTextWidth(dates)-6;
      if(end>start+12){pdf.setDrawColor(70,70,70);pdf.setLineDashPattern([1,2],0);pdf.line(start,y+1,end,y+1);pdf.setLineDashPattern([],0);}
    } else {
      const start=x+pdf.getTextWidth(titleLines[0]||'')+5;
      if(pageW-left>start+12){pdf.setDrawColor(70,70,70);pdf.setLineDashPattern([1,2],0);pdf.line(start,y+1,pageW-left,y+1);pdf.setLineDashPattern([],0);}
    }
    y += size*1.5;
    titleLines.slice(1).forEach(line=>write(line,{indent:10,size,weight:'bold',after:0}));
  };
  if (boxed) {
    write(data.name.trim(),{size:style.nameSize,weight:'bold',align:'center',color:dark,after:0});
    if (data.targetRole?.trim()) write(data.targetRole.trim(),{size:Math.max(10,style.bodySize+1),weight:'bold',align:'center',after:0});
    if (data.address?.trim()) write(data.address.trim(),{size:Math.max(8,style.bodySize-2),align:'center',after:0});
    y += 9;
    pdf.setFont(pdfFont,'bold');pdf.setFontSize(Math.max(8,style.bodySize-2));pdf.setTextColor(...dark);
    if (data.email) pdf.text(data.email,left,y);
    if (data.links) {pdf.setFont(pdfFont,'normal');const linkLines=pdf.splitTextToSize(data.links,width*.38); linkLines.forEach((line,i)=>pdf.text(line,pageW-left,y+i*9,{align:'right'}));y+=Math.max(0,(linkLines.length-1)*9);}
    y += 8; pdf.setDrawColor(40,40,40);pdf.setLineWidth(1);pdf.line(left,y,pageW-left,y);y+=5;
  } else {
    write(data.name.trim(),{size:style.nameSize,weight:'bold',color:accent,align:style.alignment});
    write([data.email,data.address||data.country,data.links].filter(Boolean).join('   |   '),{size:Math.max(8,style.bodySize-1),color:[95,95,95],align:style.alignment});
    if(data.targetRole?.trim()){y+=style.bodySize*.6;write(data.targetRole.trim(),{size:style.bodySize+2,weight:'bold',color:accent,align:style.alignment});}
  }
  const labels = style.labels || {};
  const jobs=(data.experiences||[]).filter(x=>x.company||x.role||x.details);
  const schools=(data.education||[]).filter(x=>x.school||x.degree||x.details);
  const projects=(data.projects||[]).filter(x=>x.name||x.details);
  const strengths=(data.strengths||[]).filter(Boolean);
  const render = {
    profile(){if(data.summary?.trim()){section(labels.profile||'Profile','profile');write(data.summary.trim(),{size:style.bodySize,lineHeight:style.bodySize*1.3});}},
    experience(){if(jobs.length){section(labels.experience||(boxed?'Employment History':'Experience'),'experience');jobs.forEach(x=>{
      titleWithDate([x.role,x.company].filter(Boolean).join(', '),x.dates,true);
      if(x.location)write(x.location,{indent:boxed?10:0,size:Math.max(8,style.bodySize-1),weight:boxed?'italic':'normal',color:boxed?dark:[95,95,95],after:boxed?2:5});
      (x.details||'').split('\n').filter(Boolean).forEach(bullet);y+=boxed?5:6;
    });}},
    education(){if(schools.length){section(labels.education||'Education','education');schools.forEach(x=>{
      if(boxed){
        const title=[x.degree,x.school].filter(Boolean).join(' - ');
        ensure(38);pdf.setFont(pdfFont,'bold');pdf.setFontSize(style.bodySize);pdf.setTextColor(...dark);
        pdf.setFillColor(...dark);pdf.triangle(left+4,y-5,left+7,y-2,left+4,y+1,'F');pdf.triangle(left+4,y-5,left+1,y-2,left+4,y+1,'F');
        const lines=pdf.splitTextToSize(title,width-12);
        lines.forEach(line=>{pdf.text(line,left+10,y);y+=style.bodySize*1.3;});
        if(x.dates){pdf.setFont(pdfFont,'normal');pdf.setFontSize(Math.max(8,style.bodySize-1));pdf.text(x.dates,pageW-left,y,{align:'right'});pdf.setDrawColor(70,70,70);pdf.setLineDashPattern([1,2],0);pdf.line(left+10,y+1,pageW-left-pdf.getTextWidth(x.dates)-6,y+1);pdf.setLineDashPattern([],0);y+=style.bodySize*1.3;}
      }
      else{write([x.degree,x.dates].filter(Boolean).join(' | '),{size:style.bodySize,weight:'bold',after:0});if(x.school)write(x.school,{size:style.bodySize,after:3});}
      (x.details||'').split('\n').filter(Boolean).forEach(bullet);
    });}},
    skills(){if(data.skills?.trim()){section(labels.skills||(boxed?'Technical Skills':'Skills'),'skills');data.skills.split('\n').filter(Boolean).forEach(line=>{
      const match=boxed?line.match(/^([^:]{2,30}:)\s*(.*)$/):null;
      if(match){ensure(style.bodySize*1.3);pdf.setFont(pdfFont,'bold');pdf.setFontSize(style.bodySize);pdf.setTextColor(...dark);pdf.text(match[1],left,y);const labelWidth=pdf.getTextWidth(match[1])+3;pdf.setFont(pdfFont,'normal');const values=pdf.splitTextToSize(match[2],width-labelWidth);pdf.text(values[0]||'',left+labelWidth,y);y+=style.bodySize*1.3;values.slice(1).forEach(v=>{ensure(style.bodySize*1.3);pdf.text(v,left+labelWidth,y);y+=style.bodySize*1.3;});}
      else write(line,{size:style.bodySize,after:0});
    });}},
    projects(){if(projects.length){if(boxed&&style.projectStartsNewPage&&pdf.getNumberOfPages()===1)newPage();section(labels.projects||(boxed?'Selected Software Projects':'Projects'),'projects');projects.forEach(x=>{
      titleWithDate(x.name,'',boxed);(x.details||'').split('\n').filter(Boolean).forEach(bullet);
      if(x.techStack)write(`Tech Stack: ${x.techStack}`,{indent:boxed?10:0,size:style.bodySize,after:2});y+=boxed?6:6;
    });}},
    strengths(){if(strengths.length){section(labels.strengths||'Professional Strengths','strengths');strengths.forEach(bullet);}}
  };
  for(const key of style.sectionOrder||['profile','experience','skills','education','projects','strengths'])render[key]?.();
  if(boxed){const count=pdf.getNumberOfPages();for(let i=1;i<=count;i++){pdf.setPage(i);pdf.setFont(pdfFont,'normal');pdf.setFontSize(7);pdf.setTextColor(125,125,125);pdf.text([data.name,data.targetRole?.split('|')[0]?.trim()].filter(Boolean).join(style.doubleRule?' - ':' · '),pageW/2,pageH-28,{align:'center'});}}
  return pdf;
}

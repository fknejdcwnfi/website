/** Offline source-controlled pixel conversion. No generated faces or motion. */
type Bin = { n: number; rgb: number[] }
const WIDTH=320,HEIGHT=240,CONTENT_HEIGHT=240
const paletteOf=(frames:Uint8ClampedArray[],size:number):number[][]=>{
 const histogram=new Map<number,{n:number;sum:number[]}>()
 for(const source of frames)for(let i=0;i<source.length;i+=4){const r=source[i]!,g=source[i+1]!,b=source[i+2]!,key=(r>>3)<<10|(g>>3)<<5|b>>3;const v=histogram.get(key);if(v){v.n++;v.sum[0]!+=r;v.sum[1]!+=g;v.sum[2]!+=b}else histogram.set(key,{n:1,sum:[r,g,b]})}
 const boxes:Bin[][]=[[...histogram.values()].map(v=>({n:v.n,rgb:v.sum.map(c=>c/v.n)}))]
 while(boxes.length<size){let selected=-1,best=-1,axis=0;for(let i=0;i<boxes.length;i++){const box=boxes[i]!;if(box.length<2)continue;const range=[0,1,2].map(k=>Math.max(...box.map(v=>v.rgb[k]!))-Math.min(...box.map(v=>v.rgb[k]!)));const k=range.indexOf(Math.max(...range)),score=range[k]!*Math.sqrt(box.reduce((n,v)=>n+v.n,0));if(score>best){selected=i;best=score;axis=k}}
  if(selected<0)break;const box=boxes.splice(selected,1)[0]!.sort((a,b)=>a.rgb[axis]!-b.rgb[axis]!);const half=box.reduce((n,v)=>n+v.n,0)/2;let n=0,cut=1;for(;cut<box.length;cut++){n+=box[cut-1]!.n;if(n>=half)break}cut=Math.min(box.length-1,cut);boxes.push(box.slice(0,cut),box.slice(cut))
 }
 return boxes.map(box=>{const count=box.reduce((n,v)=>n+v.n,0);return[0,1,2].map(k=>Math.round(box.reduce((n,v)=>n+v.rgb[k]!*v.n,0)/count))})
}
const encode=(canvas:HTMLCanvasElement):string=>canvas.toDataURL('image/png').split(',')[1]!
export const authorSourceSequence=(images:HTMLImageElement[],gridWidth=160,paletteSize=80,paletteHex?:readonly string[])=>{
 if(images.length<1||images.length>512||images.some(image=>image.naturalWidth!==358||image.naturalHeight!==267))throw Error('The reference source requires consistently sized 358×267 frames.')
 if(!Number.isInteger(gridWidth)||gridWidth<120||gridWidth>320||!Number.isInteger(paletteSize)||paletteSize<32||paletteSize>128)throw Error('Invalid pixel conversion settings.')
 const gridHeight=gridWidth===160?120:Math.round(gridWidth*267/358)
 const sample=document.createElement('canvas');sample.width=gridWidth;sample.height=gridHeight
 const ctx=sample.getContext('2d',{willReadFrequently:true})!;ctx.imageSmoothingEnabled=false
 const inputs=images.map(image=>{ctx.clearRect(0,0,gridWidth,gridHeight);ctx.drawImage(image,0,0,gridWidth,gridHeight);return ctx.getImageData(0,0,gridWidth,gridHeight).data})
 const palette=paletteHex?paletteHex.map(color=>{if(!/^#[a-f0-9]{6}$/i.test(color))throw Error('Invalid shared palette.');return[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)]}):paletteOf(inputs,paletteSize),lookup=new Map<number,number>()
 const columns=Math.min(16,2**Math.ceil(Math.log2(Math.sqrt(images.length)))),rows=Math.ceil(images.length/columns)
 const atlas=document.createElement('canvas');atlas.width=gridWidth*columns;atlas.height=gridHeight*rows
 const atlasContext=atlas.getContext('2d')!;atlasContext.imageSmoothingEnabled=false
 const frame=document.createElement('canvas');frame.width=WIDTH;frame.height=HEIGHT
 const fctx=frame.getContext('2d',{willReadFrequently:true})!;fctx.imageSmoothingEnabled=false
 const frames:string[]=[],checksums:number[]=[],expectedFrames:Uint8ClampedArray[]=[],paletteColors=palette.map(c=>(0xff000000|c[2]!<<16|c[1]!<<8|c[0]!)>>>0)
 for(let index=0;index<inputs.length;index++){
  const input=inputs[index]!,rgba=new Uint8ClampedArray(input.length)
  for(let i=0;i<input.length;i+=4){const r=input[i]!,g=input[i+1]!,b=input[i+2]!,key=r<<16|g<<8|b;let p=lookup.get(key);if(p===undefined){let best=Infinity;p=0;for(let k=0;k<palette.length;k++){const color=palette[k]!,d=(r-color[0]!)**2+(g-color[1]!)**2+(b-color[2]!)**2;if(d<best){best=d;p=k}}lookup.set(key,p)}const color=palette[p]!;rgba[i]=color[0]!;rgba[i+1]=color[1]!;rgba[i+2]=color[2]!;rgba[i+3]=255}
  expectedFrames.push(rgba);ctx.putImageData(new ImageData(rgba,gridWidth,gridHeight),0,0)
  fctx.clearRect(0,0,WIDTH,HEIGHT);fctx.drawImage(sample,0,0,WIDTH,CONTENT_HEIGHT)
  // Full-source sampling with the small 358/267 -> 4/3 aspect rounding; no crop.
  atlasContext.drawImage(sample,index%columns*gridWidth,Math.floor(index/columns)*gridHeight)
  const bytes=rgba;let checksum=2166136261
  for(const value of bytes)checksum=Math.imul(checksum^value,16777619)
  checksums.push(checksum>>>0);if(index===0)frames.push(encode(frame))
 }
 // Verify packing directly through Canvas before writing any production output.
 let atlasMismatches=0
 for(let index=0;index<inputs.length;index++){
  const packed=atlasContext.getImageData(index%columns*gridWidth,Math.floor(index/columns)*gridHeight,gridWidth,gridHeight).data
  const expected=expectedFrames[index]!;for(let i=0;i<packed.length;i++)if(packed[i]!==expected[i])atlasMismatches++
 }
 return{atlas:encode(atlas),frames,palette:palette.map(c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('')),width:WIDTH,height:HEIGHT,contentHeight:CONTENT_HEIGHT,gridWidth,gridHeight,tileWidth:gridWidth,tileHeight:gridHeight,columns,rows,checksums,atlasMismatches,paletteColors}
}

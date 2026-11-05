#!/usr/bin/env python3
"""Stable original Minecraft pixels with independent rigid rear-hair cutouts.

Generated edits supply selection alpha only. None of their visible RGB replaces
face/body pixels. No optical-flow fields or full-frame animation are read.
"""
from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, binary_dilation
from scale_pixel_art import scale2x
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/calm-circle';OUT.mkdir(parents=True,exist_ok=True)
ART=ROOT/'assets/generated/minecraft-style'
SELECTION=ROOT/'assets/generated/calm-circle'
SIZE=(358,267)
def record(p):
 b=p.read_bytes();return{'file':str(p.relative_to(ROOT)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def read(p):return Image.open(p).convert('RGBA').resize(SIZE,Image.Resampling.NEAREST)
opened=np.asarray(read(ART/'style-master.png').convert('RGB'));closed=np.asarray(read(ART/'closed-eye-master.png').convert('RGB'))
# Same once-learned palette as the accepted static Minecraft portrait. There is
# no frame-dependent palette cache and no generated face substitution.
pool=Image.fromarray(np.concatenate([opened,closed],axis=0)).quantize(colors=256,dither=Image.Dither.NONE)
rgb=np.asarray(pool.convert('RGB'));opened=rgb[:267];closed=rgb[267:]
alpha=np.asarray(read(SELECTION/'cutout-reference.png'))[:,:,3]>=128
clean_alpha=np.asarray(read(SELECTION/'clean-plate-reference.png'))[:,:,3]>=128
r,g,b=opened.astype(np.int16).transpose(2,0,1)
boundary=distance_transform_edt(alpha)<=1.5
background=((b>r+12)&(b>g+5))|((b>g+12)&(r>g+20))|((g-b>50)&(r-g>12))
# Keep blue jewelry even at the narrow silhouette edges.
protected_jewels=np.zeros(alpha.shape,bool);protected_jewels[122:173,126:145]=True;protected_jewels[112:160,226:244]=True
alpha &= ~(boundary & background & (np.maximum.reduce([r,g,b])>80) & ~protected_jewels)
canonical=np.zeros((267,358,4),np.uint8);canonical[:,:,:3]=opened;canonical[:,:,3]=alpha*255;canonical[~alpha,:3]=0
hd=np.asarray(scale2x(Image.fromarray(canonical)))
yy,xx=np.indices(alpha.shape)
# Only rear-hair pixels outside the fixed neck/shoulder silhouette may move.
# Chest curls and every face/body pixel remain fixed. Empty space underneath is
# genuinely transparent, so no copied static strand or invented skin is exposed.
fixed=Image.new('L',SIZE,0);draw=ImageDraw.Draw(fixed)
face_polygon=[(127,95),(143,73),(214,74),(240,94),(232,126),(207,155),(180,172),(157,159),(135,140)]
draw.polygon(face_polygon,fill=255)
draw.rectangle((144,165,230,213),fill=255)
draw.rectangle((126,122,145,173),fill=255)
draw.rectangle((225,112,245,161),fill=255)
fixed_mask=np.asarray(fixed)>0
rear=alpha & ~clean_alpha & (yy>=126) & (yy<211) & ~fixed_mask
left=rear & (xx<145);right=rear & (xx>221)
# Conservative head underlap hides the small pivot seam behind fixed top hair.
underlap=binary_dilation(left|right,iterations=3)&alpha&(yy>=122)&(yy<132)&~fixed_mask
left_layer=left|(underlap&(xx<145));right_layer=right|(underlap&(xx>221))
plate=hd.copy();erased=np.repeat(np.repeat(left|right,2,0),2,1);plate[erased]=0
layers={}
for name,mask in [('left-hair',left_layer),('right-hair',right_layer)]:
 layer=hd.copy();mask=np.repeat(np.repeat(mask,2,0),2,1);layer[~mask]=0;layers[name]=layer
# Local eye state only; the generated closed reference is never a whole face.
eyes=np.zeros_like(hd)
closed_rgba=canonical.copy();closed_rgba[:,:,:3]=closed;closed_rgba[~alpha,:3]=0
closed_hd=np.asarray(scale2x(Image.fromarray(closed_rgba)))
eye_rects=[[121,83,171,111],[191,81,240,111]]
for x0,y0,x1,y1 in eye_rects:eyes[y0*2:y1*2,x0*2:x1*2]=closed_hd[y0*2:y1*2,x0*2:x1*2]
for name,array in [('canonical',hd),('plate',plate),('eyes',eyes),*layers.items()]:
 path=OUT/f'{name}.png';Image.fromarray(array).save(path,optimize=True)
 assert np.array_equal(np.asarray(Image.open(path).convert('RGBA')),array)
# Zero-angle layer composition must recover the one canonical image exactly.
rest=Image.new('RGBA',(716,534))
for name in ['left-hair','right-hair','plate']:rest.alpha_composite(Image.open(OUT/f'{name}.png'))
assert np.array_equal(np.asarray(rest),hd),'Rest assembly differs from the canonical portrait'
assets={name:{'file':name+'.png','width':716,'height':534,'sha256':record(OUT/(name+'.png'))['sha256']}for name in ['canonical','plate','eyes','left-hair','right-hair']}
rig={'version':1,'width':716,'height':534,'logicalWidth':358,'logicalHeight':267,
 'motionKind':'local-rigid-locks','periodMs':12000,'blinkCycleMs':24000,
 'hair':[{'name':'left-hair','pivot':[105*2,124*2],'maxAngle':.022},{'name':'right-hair','pivot':[246*2,124*2],'maxAngle':.022}],
 'eyeRects':[[v*2 for v in rect]for rect in eye_rects],
 'protectedRegions':{'nose-mouth-chin':[158,111,205,167],'central-neck-chain':[169,174,193,249],'left-shoulder':[40,241,70,256],'right-shoulder':[299,241,321,256],'forehead':[169,52,195,75]},
 'qaTimesMs':[0,900,2800,4500,6200,9500,11400,12000,20400],
 'maximumChangedFraction':.18,'liveChangeDeadlineMs':1800,'motionFiles':['plate.png','eyes.png','left-hair.png','right-hair.png'],
 'fixedFacePolygon':face_polygon,'assets':assets,'rearHairNativePixels':[int(left.sum()),int(right.sum())],
 'sources':[record(ART/'style-master.png'),record(ART/'closed-eye-master.png'),record(SELECTION/'cutout-reference.png'),record(SELECTION/'clean-plate-reference.png')],
 'authoring':[record(Path(__file__)),record(ROOT/'scripts/assets/scale_pixel_art.py')],
 'files':[record(OUT/(name+'.png'))for name in assets],
 'notes':['Only selection alpha from generated edits is used; all visible face/body colors come from the same original Minecraft master.',
 'Two rear locks rotate rigidly behind the fixed face, front curls, neck, shoulders and necklace. There is no image flow, scaling, breathing zoom or full-frame deformation.',
 'Motion is deliberately restrained; this is not a source-identical large wind simulation.']}
(OUT/'manifest.json').write_text(json.dumps(rig,ensure_ascii=False,indent=2)+'\n')
compiled={key:rig[key]for key in ['version','width','height','hair','eyeRects','periodMs','blinkCycleMs','assets']}
(ROOT/'src/features/calmPortrait/assets.ts').write_text('// Generated by scripts/assets/export_calm_portrait.py; do not edit.\nexport const calmAssets = '+json.dumps(compiled,indent=2)+' as const\n')
print(json.dumps({'rearHairNativePixels':rig['rearHairNativePixels'],'bytes':sum(v['bytes']for v in rig['files']),'canonical':assets['canonical']['sha256']}))

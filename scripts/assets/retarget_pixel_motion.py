#!/usr/bin/env python3
"""Offline source-driven backward flow for one canonical pixel-art master.

The field maps target/source-video coordinates back to source frame zero. It
retargets a single artwork, rather than generating a new face for each frame.
Motion under occlusion is estimated and must be visually reviewed. Eye regions
use source head translation; source blink states need their separate material.
"""
from __future__ import annotations
import argparse,json,time
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, map_coordinates, median_filter, uniform_filter, zoom
ROOT=Path(__file__).resolve().parents[2]
EYE_REGIONS=((111,75,171,119),(186,74,247,119))

def resize_field(field,shape):
    return zoom(field,(shape[0]/field.shape[0],shape[1]/field.shape[1]),order=1,mode='nearest',prefilter=False)[:shape[0],:shape[1]]

def head_translation(reference,target):
    # A source nose outline, not the changing iris, anchors the rigid eye patch.
    ref=reference[126:150,166:184].astype(np.float32)
    candidates=[]
    for dy in range(-6,7):
        for dx in range(-6,7):
            crop=target[126+dy:150+dy,166+dx:184+dx].astype(np.float32)
            candidates.append((float(np.mean(np.abs(crop-ref))),dx,dy))
    _,dx,dy=min(candidates)
    return dx,dy

def pyramid(image,levels=5):
    layers=[np.asarray(image,dtype=np.float32)/255]
    for _ in range(levels-1):
        sm=gaussian_filter(layers[-1],(.9,.9,0))
        layers.append(sm[::2,::2])
    return layers

def backward_flow(reference,target,levels=5,iterations=12,window=7):
    """Return float32[H,W,2] dx/dy mapping target pixels into reference pixels."""
    if reference.shape!=target.shape or reference.ndim!=3 or reference.shape[2]!=3:
        raise ValueError('Flow expects matching RGB arrays.')
    if np.array_equal(reference,target):return np.zeros((*reference.shape[:2],2),np.float32)
    refs=pyramid(reference,levels);targets=pyramid(target,levels)
    u=v=None
    for level in range(levels-1,-1,-1):
        a=targets[level];b=refs[level]
        h,w=a.shape[:2]
        if u is None:u=np.zeros((h,w),np.float32);v=np.zeros((h,w),np.float32)
        else:
            oldh,oldw=u.shape
            u=resize_field(u,(h,w))*(w/oldw);v=resize_field(v,(h,w))*(h/oldh)
        yy,xx=np.mgrid[:h,:w].astype(np.float32)
        # Derivatives are taken from the moving reference before sampling.
        gy,gx=np.gradient(gaussian_filter(b,(.55,.55,0)),axis=(0,1))
        radius=window if min(h,w)>window else max(3,min(h,w)//2*2-1)
        for iteration in range(iterations):
            coords=np.array([yy+v,xx+u])
            warped=np.stack([map_coordinates(b[...,c],coords,order=1,mode='nearest',prefilter=False)for c in range(3)],axis=-1)
            ix=np.stack([map_coordinates(gx[...,c],coords,order=1,mode='nearest',prefilter=False)for c in range(3)],axis=-1)
            iy=np.stack([map_coordinates(gy[...,c],coords,order=1,mode='nearest',prefilter=False)for c in range(3)],axis=-1)
            diff=warped-a
            # Robust channel-wise residual weights prevent a snow speck or an
            # occluded eyelid from dominating a complete neighborhood.
            weight=1/np.sqrt(diff*diff+.015**2)
            smooth=lambda values:uniform_filter(values.sum(axis=-1),size=radius,mode='nearest')
            aa=smooth(weight*ix*ix)+.0005
            bb=smooth(weight*ix*iy)
            cc=smooth(weight*iy*iy)+.0005
            dd=smooth(weight*ix*diff)
            ee=smooth(weight*iy*diff)
            det=np.maximum(aa*cc-bb*bb,1e-10)
            du=np.clip((bb*ee-cc*dd)/det,-2,2)
            dv=np.clip((bb*dd-aa*ee)/det,-2,2)
            # Modest local regularization keeps flat skin and hair interiors
            # coherent while source outlines remain the registration evidence.
            u+=gaussian_filter(du,.5)*.75
            v+=gaussian_filter(dv,.5)*.75
            if iteration%3==2:
                u=median_filter(u,size=3,mode='nearest');v=median_filter(v,size=3,mode='nearest')
        u=np.clip(u,-w*.45,w*.45);v=np.clip(v,-h*.35,h*.35)
    dx,dy=head_translation(reference,target)
    # The backward displacement for a rigid source-head translation is negative.
    # Feather only the flow patch boundary; no two independent eye images blend.
    mask=np.zeros(u.shape,np.float32)
    for x0,y0,x1,y1 in EYE_REGIONS:
        yy,xx=np.mgrid[y0:y1,x0:x1]
        dist=np.minimum.reduce((xx-x0,x1-1-xx,yy-y0,y1-1-yy))
        mask[y0:y1,x0:x1]=np.clip(dist/5,0,1)
    u=u*(1-mask)-dx*mask;v=v*(1-mask)-dy*mask
    return np.stack((u,v),axis=-1).astype(np.float32)

def jacobian_determinant(flow):
    """Area ratio of the backward deformation; nonpositive values are folds."""
    dy_u,dx_u=np.gradient(flow[...,0]);dy_v,dx_v=np.gradient(flow[...,1])
    return (1+dx_u)*(1+dy_v)-dy_u*dx_v

def exponentiate_velocity(velocity,steps=6):
    """Scaling-and-squaring projects a smooth stationary velocity to a warp."""
    h,w=velocity.shape[:2];yy,xx=np.mgrid[:h,:w].astype(np.float32)
    flow=velocity.copy()/(2**steps)
    for _ in range(steps):
        coords=np.array([yy+flow[...,1],xx+flow[...,0]])
        sampled=np.stack([map_coordinates(flow[...,axis],coords,order=1,mode='nearest',prefilter=False)for axis in range(2)],axis=-1)
        flow+=sampled
    return flow.astype(np.float32)

def regularize_flow(flow,reference,target,sigma=8.0,minimum_determinant=.16):
    """Low-frequency source observation -> conservative, non-folding warp.

    No per-color support masks: abrupt material boundaries punched blue holes
    in the rejected prototype. A soft face constraint keeps a single identity;
    stationary-velocity integration removes local optical-flow inversions.
    Hidden hair layers remain unavailable and displacement is still estimated.
    """
    velocity=np.stack([gaussian_filter(flow[...,axis],sigma)for axis in range(2)],axis=-1)
    h,w=flow.shape[:2]
    dx,dy=head_translation(reference,target)
    face=Image.new('L',(w,h),0);draw=ImageDraw.Draw(face)
    draw.polygon([(140,72),(160,45),(205,45),(230,67),(242,95),
                  (224,133),(200,158),(178,166),(148,148),(128,120),(120,96)],fill=255)
    mask=gaussian_filter(np.asarray(face,dtype=np.float32)/255,5)
    velocity[...,0]=velocity[...,0]*(1-mask)-dx*mask
    velocity[...,1]=velocity[...,1]*(1-mask)-dy*mask
    # Use the full observed amplitude unless its sampled Jacobian would collapse
    # a texel area below the explicit bound. No fold is accepted as "physical".
    output=exponentiate_velocity(velocity)
    if float(jacobian_determinant(output).min())>=minimum_determinant:return output
    low,high=0.,1.
    for _ in range(12):
        amplitude=(low+high)/2
        candidate=exponentiate_velocity(velocity*amplitude)
        if float(jacobian_determinant(candidate).min())>=minimum_determinant:
            low=amplitude;output=candidate
        else:high=amplitude
    if float(jacobian_determinant(output).min())<minimum_determinant-1e-5:
        raise RuntimeError('Could not construct a non-folding source deformation.')
    return output.astype(np.float32)

def warp_master(master,flow,output_size=None):
    """Nearest-color sample a high-resolution master through source-grid flow."""
    source=np.asarray(master.convert('RGB'))
    h,w=flow.shape[:2]
    outw,outh=output_size or (w,h)
    yy,xx=np.mgrid[:outh,:outw].astype(np.float32)
    targetx=(xx+.5)*w/outw-.5;targety=(yy+.5)*h/outh-.5
    coords=np.array([targety,targetx])
    dx=map_coordinates(flow[...,0],coords,order=1,mode='nearest',prefilter=False)
    dy=map_coordinates(flow[...,1],coords,order=1,mode='nearest',prefilter=False)
    sourcex=(targetx+dx+.5)*source.shape[1]/w-.5
    sourcey=(targety+dy+.5)*source.shape[0]/h-.5
    sx=np.clip(np.rint(sourcex).astype(np.int32),0,source.shape[1]-1)
    sy=np.clip(np.rint(sourcey).astype(np.int32),0,source.shape[0]-1)
    return Image.fromarray(source[sy,sx])

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,default=ROOT/'reference-projects/fuji-wind/original/frames')
    p.add_argument('--master',type=Path,default=ROOT/'assets/generated/minecraft-style/style-master.png')
    p.add_argument('--frames',default='0,7,15')
    p.add_argument('--output',type=Path,default=ROOT/'work/style-review/flow')
    p.add_argument('--levels',type=int,default=5);p.add_argument('--iterations',type=int,default=12);p.add_argument('--regularize',type=float,default=8.0)
    args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    reference=Image.open(args.source/'frame_000.png').convert('RGB');ref=np.asarray(reference)
    master=Image.open(args.master).convert('RGB');indices=[int(i)for i in args.frames.split(',')]
    start=time.monotonic();report=[]
    sheet=Image.new('RGB',(716*3,554*len(indices)),'white');draw=ImageDraw.Draw(sheet)
    for row,index in enumerate(indices):
        target=Image.open(args.source/f'frame_{index:03d}.png').convert('RGB');arr=np.asarray(target)
        flow=backward_flow(ref,arr,args.levels,args.iterations)
        if args.regularize and index:flow=regularize_flow(flow,ref,arr,args.regularize)
        np.savez_compressed(args.output/f'flow_{index:03d}.npz',flow=flow)
        warped=warp_master(reference,flow,(716,534));styled=warp_master(master,flow,(716,534))
        warped.save(args.output/f'original-warp-{index:03d}.png');styled.save(args.output/f'style-warp-{index:03d}.png')
        low=np.asarray(warp_master(reference,flow)).astype(np.int16)
        report.append({'frame':index,'meanAbsoluteRGBError':float(np.abs(low-arr).mean()),'flowXRange':[float(flow[...,0].min()),float(flow[...,0].max())],'flowYRange':[float(flow[...,1].min()),float(flow[...,1].max())],'minimumJacobianDeterminant':float(jacobian_determinant(flow).min()),'maximumDisplacement':float(np.linalg.norm(flow,axis=-1).max())})
        for col,(title,image)in enumerate([('Target source frame',target.resize((716,534),Image.Resampling.NEAREST)),('Canonical source warped (diagnostic)',warped),('Single pixel-art master warped (no blink material)',styled)]):
            draw.text((col*716+5,row*554+3),f'{index}: {title}',fill='black');sheet.paste(image,(col*716,row*554+20))
        print(json.dumps(report[-1]),flush=True)
    sheet.save(args.output/'contact.png');(args.output/'report.json').write_text(json.dumps({'conditions':'Backward source0 retarget; low-frequency stationary-velocity diffeomorphic projection; rigid-face support; area bound0.16; estimated occlusion; blink material not applied','seconds':time.monotonic()-start,'frames':report},indent=2)+'\n')

if __name__=='__main__':main()

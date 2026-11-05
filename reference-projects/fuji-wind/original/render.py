#!/usr/bin/env python3
"""從逐幀 PNG 重建動畫，並可選用光流補幀、尺寸縮放與 MP4 輸出。"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

BASE = Path(__file__).resolve().parent


def read_frames():
    paths = sorted((BASE / 'frames').glob('frame_*.png'))
    if not paths:
        raise RuntimeError('找不到 frames/frame_*.png')
    frames = [np.asarray(Image.open(p).convert('RGB')) for p in paths]
    if len({f.shape for f in frames}) != 1:
        raise ValueError('所有輸入影格的尺寸必須一致')
    meta = json.loads((BASE / 'metadata.json').read_text(encoding='utf-8'))
    return frames, meta


def flow_blend(a, b, t):
    """雙向 Farneback 光流估計中間幀；複雜髮絲可能出現扭曲或重影。"""
    import cv2
    h, w = a.shape[:2]
    ga = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY)
    gb = cv2.cvtColor(b, cv2.COLOR_RGB2GRAY)
    opts = dict(pyr_scale=0.5, levels=3, winsize=23,
                iterations=4, poly_n=7, poly_sigma=1.5, flags=0)
    ab = cv2.calcOpticalFlowFarneback(ga, gb, None, **opts)
    ba = cv2.calcOpticalFlowFarneback(gb, ga, None, **opts)
    x, y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    a_warp = cv2.remap(a, x - t*ab[:,:,0], y - t*ab[:,:,1],
                       interpolation=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    b_warp = cv2.remap(b, x - (1-t)*ba[:,:,0], y - (1-t)*ba[:,:,1],
                       interpolation=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    return np.clip((1-t)*a_warp.astype(np.float32)+t*b_warp.astype(np.float32),0,255).astype(np.uint8)


def sample(frames, durations, fps, interpolate):
    """按來源的真實時間戳取樣，並維持原動畫的循環總時長。"""
    end_times = np.cumsum([0]+durations).astype(float)
    total_ms = end_times[-1]
    frame_count = max(1, round(total_ms/1000*fps))
    result=[]
    for i in range(frame_count):
        t = i * total_ms / frame_count
        ix = int(np.searchsorted(end_times, t, side='right') - 1)
        ix = min(ix,len(frames)-1)
        phase=(t-end_times[ix])/durations[ix]
        if interpolate and phase>0.001:
            f=flow_blend(frames[ix],frames[(ix+1)%len(frames)],phase)
        else:
            f=frames[ix]
        result.append(f)
    return result


def resize_frames(frames, scale):
    if scale==1: return frames
    result=[]
    for f in frames:
        h,w=f.shape[:2]
        img=Image.fromarray(f).resize((round(w*scale),round(h*scale)),Image.Resampling.LANCZOS)
        result.append(np.asarray(img))
    return result


def save_gif(frames, path, fps):
    # GIF 時間精度是 10ms，故無法保證每個目標 FPS 都能精確達成
    duration_ms=max(10,round((1000/fps)/10)*10)
    images=[Image.fromarray(f).quantize(colors=256,method=Image.Quantize.MEDIANCUT) for f in frames]
    images[0].save(path,save_all=True,append_images=images[1:],loop=0,
                   duration=duration_ms,disposal=2,optimize=False)


def save_mp4(frames, path, fps):
    import cv2
    h,w=frames[0].shape[:2]
    vw=cv2.VideoWriter(str(path),cv2.VideoWriter_fourcc(*'mp4v'),fps,(w,h))
    if not vw.isOpened():
        raise RuntimeError('無法建立 MP4，請確認 OpenCV 是否支援 mp4v')
    for f in frames:
        vw.write(cv2.cvtColor(f,cv2.COLOR_RGB2BGR))
    vw.release()


def main():
    p=argparse.ArgumentParser(description='從 PNG 影格輸出 GIF 或 MP4')
    p.add_argument('--fps',type=float,default=12.5,help='目標 FPS，預設 12.5')
    p.add_argument('--scale',type=float,default=1.,help='放大倍率（LANCZOS），預設 1')
    p.add_argument('--interpolate',action='store_true',help='啟用雙向光流補幀（非 AI 原生重新生成）')
    p.add_argument('--format',choices=['gif','mp4'],default='gif')
    p.add_argument('--output',default=None,help='輸出路徑')
    args=p.parse_args()
    if args.fps<=0 or args.scale<=0: p.error('--fps 和 --scale 必須大於 0')
    frames,meta=read_frames()
    durations=meta['frame_durations_ms']
    result=sample(frames,durations,args.fps,args.interpolate)
    result=resize_frames(result,args.scale)
    output=Path(args.output or (BASE/'output'/f'animation_{args.fps:g}fps.{args.format}'))
    output.parent.mkdir(parents=True,exist_ok=True)
    if args.format=='gif': save_gif(result,output,args.fps)
    else: save_mp4(result,output,args.fps)
    print(f'輸出: {output} | {len(result)} 幀 | {result[0].shape[1]}x{result[0].shape[0]} | {args.fps:g} FPS (GIF 受 10ms 精度限制)')

if __name__=='__main__':
    main()

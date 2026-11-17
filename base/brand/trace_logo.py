# A kapott APERATION-logó (PNG) hű vektorizálása: maszk → potrace görbék → SVG. Új formát nem rajzol.
import numpy as np, potrace, sys
from PIL import Image
SRC=sys.argv[1]; OUT=sys.argv[2]
im=Image.open(SRC).convert("RGBA"); W,H=im.size
S=4  # felskálázás a pontosabb élekhez
big=im.resize((W*S,H*S),Image.LANCZOS); a=np.asarray(big).astype(float)
alpha=a[...,3]/255; lum=a[...,:3].mean(axis=2)
light=(alpha>0.5)&(lum>128); dark=(alpha>0.5)&(lum<=128)
yy=np.arange(H*S)[:,None]
sym=light&(yy<390*S); txt=light&(yy>=390*S)
# Az eredeti képen az R lába és az A bal szára alul összeér. Szétválasztás: fölül az A bal élének vonala
# a határ; az összeérő sávban (500. sortól az alapvonalig) a két szár a kimért egyeneseiből áll össze
# (forrás-pixelben): R lába [824+0.65t, 845+0.65t], A bal szára [867.2-0.4t, 879.7-0.4t], t = y-502.
xx=np.arange(W*S)[None,:]/S; yv=yy/S; t=yv-502
LA=867.2-0.4*t
zone=(yv>=500)&(yv<537)&(xx>=812)&(xx<=884)
polyR=zone&(xx>=824+0.65*t)&(xx<845+0.65*t)
polyA=zone&(xx>=LA)&(xx<LA+12.5)
ation=(txt&(xx>=LA-1)&~zone)|polyA|(txt&zone&(xx>=LA+6))   # az A keresztvonala is megmarad
aper=(txt&(xx<LA-1)&~zone)|polyR
# megjegyzés: a potracer a False értéket veszi kitöltöttnek, ezért a maszk negáltját adjuk át
def path_d(mask):
    bm=potrace.Bitmap(~mask); pl=bm.trace(turdsize=8*S,turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,alphamax=0.9,opticurve=True,opttolerance=0.2)
    f=lambda p:f"{p.x/S:.2f} {p.y/S:.2f}"
    out=[]
    for c in pl:
        out.append("M"+f(c.start_point))
        for seg in c.segments:
            out.append(("L"+f(seg.c)+" L"+f(seg.end_point)) if seg.is_corner else ("C"+f(seg.c1)+" "+f(seg.c2)+" "+f(seg.end_point)))
        out.append("Z")
    return "".join(out)
# a középső pont: kör, a sötét pixelek súlypontja és területe alapján
ys,xs=np.nonzero(dark); cx,cy=xs.mean()/S,ys.mean()/S; r=(dark.sum()/np.pi)**.5/S
import json
json.dump({"sym":path_d(sym),"txt":path_d(txt),"aper":path_d(aper),"ation":path_d(ation),"dot":[round(cx,2),round(cy,2),round(r,2)],"W":W,"H":H},open(OUT,"w"))
print("dot",cx,cy,r)

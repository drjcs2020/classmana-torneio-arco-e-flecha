import trimesh, numpy as np, math, os
OUT=os.path.dirname(__file__)
COLORS={'A':((17,80,205,255),(240,188,61,255),(89,195,255,255)),'B':((174,29,43,255),(248,180,59,255),(255,94,54,255)),'C':((11,124,81,255),(241,203,88,255),(71,240,164,255))}
DARK=(25,29,45,255); STEEL=(192,201,209,255); PALE=(247,235,196,255)
def colored(mesh,c):
 mesh.visual.vertex_colors=np.tile(c,(len(mesh.vertices),1));return mesh
def ball(s,p,r,c,n):
 m=colored(trimesh.creation.icosphere(subdivisions=2,radius=r),c);m.apply_translation(p);s.add_geometry(m,node_name=n)
def cylinder(s,a,b,r,c,n,sections=12):
 a=np.array(a,float);b=np.array(b,float);v=b-a;length=np.linalg.norm(v)
 if length<1e-6:return
 m=colored(trimesh.creation.cylinder(radius=r,height=length,sections=sections),c)
 m.apply_transform(trimesh.geometry.align_vectors([0,0,1],v));m.apply_translation((a+b)/2);s.add_geometry(m,node_name=n)
def ring(s,center,R,tube,c,n,segments=48,minor=8):
 cx,cy,cz=center;vertices=[];faces=[]
 for i in range(segments):
  a=math.tau*i/segments
  for j in range(minor):
   phi=math.tau*j/minor;rr=R+tube*math.cos(phi)
   vertices.append((cx+rr*math.cos(a),cy+rr*math.sin(a),cz+tube*math.sin(phi)))
 for i in range(segments):
  for j in range(minor):
   a=i*minor+j;b=((i+1)%segments)*minor+j;d=i*minor+(j+1)%minor;e=((i+1)%segments)*minor+(j+1)%minor
   faces.extend([(a,b,e),(a,e,d)])
 s.add_geometry(colored(trimesh.Trimesh(vertices=vertices,faces=faces,process=False),c),node_name=n)
def bow(h):
 body,metal,accent=COLORS[h];s=trimesh.Scene()
 yy=np.linspace(-1.52,1.52,25)
 def xx(z):
  az=abs(z);return .02+.075*math.sin(az*2.0)+.07*(az/1.52)**3
 coords=[(xx(t),float(t),0) for t in yy]
 for i in range(len(coords)-1):cylinder(s,coords[i],coords[i+1],.051 if abs(yy[i])<.62 else .034,body,f'lamina_{i}')
 for sign in (-1,1):
  pts=[(.045,sign*.39,-.045),(.10,sign*.83,-.045),(.12,sign*1.19,-.03),(.16,sign*1.51,-.01)]
  for i in range(len(pts)-1):cylinder(s,pts[i],pts[i+1],.014,metal,f'friso_{sign}_{i}')
  ball(s,pts[-1],.059,metal,'ponteira')
 cylinder(s,coords[0],coords[-1],.006,(39,34,40,255),'corda')
 cylinder(s,(0,-.24,.03),(0,.28,.03),.082,DARK,'empunhadura',18)
 for i in range(7):
  y=-.2+i*.07;cylinder(s,(-.072,y,.08),(.065,y+.015,.08),.008,metal,'anel_empunhadura',8)
 ball(s,(.05,.62,.065),.095,metal,'medalha')
 ball(s,(.05,.62,.12),.062,accent,'pedra_casa')
 cylinder(s,(.05,.06,.1),(.54,.06,.1),.026,STEEL,'braco_da_mira')
 ring(s,(.61,.06,.1),.22,.025,DARK,'anel_mira_escuro')
 ring(s,(.61,.06,.11),.195,.009,metal,'anel_mira_metalico')
 cylinder(s,(.61,-.11,.12),(.61,.23,.12),.006,STEEL,'reticulo_vertical')
 cylinder(s,(.45,.06,.12),(.77,.06,.12),.006,STEEL,'reticulo_horizontal')
 ball(s,(.61,.06,.14),.028,accent,'ponto_central')
 cylinder(s,(-.04,-.23,.03),(-.33,-.53,.26),.022,metal,'estabilizador')
 ball(s,(-.34,-.54,.26),.037,DARK,'contrapeso')
 return s
def arrow(h):
 body,metal,accent=COLORS[h];s=trimesh.Scene()
 cylinder(s,(0,0,-1.3),(0,0,1.28),.026,DARK,'haste_carbono',16)
 cylinder(s,(0,0,1.28),(0,0,1.55),.055,STEEL,'ponta_metalica')
 cone=colored(trimesh.creation.cone(radius=.065,height=.19,sections=16),metal);cone.apply_translation((0,0,1.54));s.add_geometry(cone,node_name='ponta')
 for j in range(3):
  a=math.tau*j/3;v=[];faces=[]
  for z,width in [(-1.22,.025),(-1.05,.16),(-.80,.13),(-.72,.02)]:
   v.append((math.cos(a)*width,math.sin(a)*width,z))
  v.extend([(math.cos(a)*.01-math.sin(a)*.013,math.sin(a)*.01+math.cos(a)*.013,z) for z in [-1.22,-1.05,-.80,-.72]])
  for k in range(3):faces.extend([(k,k+1,k+5),(k,k+5,k+4)])
  s.add_geometry(colored(trimesh.Trimesh(vertices=v,faces=faces,process=False),body if j%2==0 else PALE),node_name=f'pena_{j}')
 cylinder(s,(0,0,-1.4),(0,0,-1.3),.036,metal,'encaixe');return s
def target():
 s=trimesh.Scene();rings=[(1.08,(235,223,192,255)),(1.01,(27,30,35,255)),(.87,(242,242,230,255)),(.72,(27,36,42,255)),(.57,(36,176,217,255)),(.42,(233,57,48,255)),(.26,(255,220,50,255)),(.12,(250,205,53,255))]
 for i,(radius,c) in enumerate(rings):
  m=colored(trimesh.creation.cylinder(radius=radius,height=.03,sections=96),c);m.apply_translation((0,0,.12+i*.004));s.add_geometry(m,node_name=f'anel_pontuacao_{i}')
 ring(s,(0,0,.02),1.1,.045,(232,188,83,255),'aro_dourado')
 for k in range(8):
  a=k*math.tau/8;ball(s,(1.1*math.cos(a),1.1*math.sin(a),.11),.047,(245,197,76,255),f'rebite_{k}')
 ball(s,(0,0,.18),.045,(255,169,11,255),'centro')
 return s
for h,n in [('A','aguia_dourada'),('B','leao_de_fogo'),('C','dragao_de_esmeralda')]:
 for name,fn in [('arco',bow),('flecha',arrow)]:
  path=os.path.join(OUT,f'{name}_{n}.glb');fn(h).export(path);print(path,os.path.getsize(path))
path=os.path.join(OUT,'alvo_suspenso_sem_cavalete.glb');target().export(path);print(path,os.path.getsize(path))

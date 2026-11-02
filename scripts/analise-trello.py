import sys,openpyxl,collections,re,json,unicodedata,datetime
arq,est,out=sys.argv[1],sys.argv[2],sys.argv[3]
def N(s):return unicodedata.normalize('NFD',str(s or '')).encode('ascii','ignore').decode().upper()
wb=openpyxl.load_workbook(arq,data_only=True,read_only=True);ws=wb.worksheets[0]
rows=[r for r in ws.iter_rows(values_only=True) if any(c not in (None,'') for c in r)];h=rows[0];L=[dict(zip(h,r)) for r in rows[1:]]
def campo(d,nomes):
    for n in nomes:
        m=re.search(r'\*\*\s*'+n+r'\s*:?\s*\**\s*:?\s*([^\n*]*)',d,re.I)
        if m and m.group(1).strip(' :*'):return m.group(1).strip(' :*.')
    return ''
def data(s,ref=None):
    m=re.search(r'(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?',s or '')
    if not m:return None
    y=m.group(3);y=int(y) if y else None
    if y and y<100:y+=2000
    try:return (datetime.date(y,int(m.group(2)),int(m.group(1))) if y else None)
    except:return None
UN=r'(?:UNDS?|UNID(?:ADES?)?|UN|PCS?|PÇS?|PC|M|MTS?|METROS?|KG|RL|ROLOS?|CX|CAIXAS?|PAR(?:ES)?|PR|LT|L|BR|BARRAS?|JG|JOGOS?|KITS?|TUBOS?|PCT|PACOTES?|GL|FD|SC)'
item_re=re.compile(r'^\s*[-•*]?\s*(\d+(?:[.,]\d+)?)\s*'+UN+r'?\.?\s*[-–:]?\s*(?:DE\s+)?(.{3,140})$',re.I)
C=[];itens=collections.Counter();porCli=collections.Counter();lin_it=0
for x in L:
    d=str(x['Description'] or '');nome=str(x['Card Name'] or '')
    cli=campo(d,['CLIENTE'])or re.split(r'\s[-–]\s|_',nome)[0]
    cliN=N(cli).strip()
    for k,v in [('BANRISUL','BANRISUL'),('TJSC','TJSC'),('TJ ','TJ-RS'),('TJRS','TJ-RS'),('TJ-RS','TJ-RS'),('CYRELA','CYRELA'),('DMP','DMP/DITIC'),('CMPA','CMPA'),('CAMARA MUNICIPAL','CMPA'),('UNIMED','UNIMED'),('SICREDI','SICREDI'),('CAIXA','CAIXA'),('ARMANT','ARMANT (uso interno)'),('ESTOQUE','ARMANT (uso interno)')]:
        if cliN.startswith(k) or (' '+k) in ' '+cliN[:25]:cliN=v;break
    sol=campo(d,['SOLICITANTE']);tec=campo(d,['T[ÉE]CNICO RESPONS[ÁA]VEL','EQUIPE RESPONS[ÁA]VEL','EQUIPE'])
    ds=data(campo(d,['DATA DE SOLICITA[ÇC][ÃA]O','DATA SOLICITA[ÇC][ÃA]O']));dr=data(campo(d,['DATA DE RETIRADA','PARA DE COLETA','DATA DE COLETA']))
    mm=re.search(r'MATERIA(?:IS|L)',d,re.I);mat=d[mm.end():] if mm else d
    mat=re.split(r'\*\*\s*(T[ÉE]CNICO|EQUIPE|OBS)',mat,flags=re.I)[0]
    its=[]
    for ln in mat.split('\n'):
        m=item_re.match(ln.replace('‌','').strip(' *'))
        if m:
            desc=re.sub(r'\s+',' ',N(m.group(2))).strip(' ;.-')
            desc=re.sub(r'^(UNDS?|UNID\w*|UN|PCS?|PC|M|MTS?|KG|RL|CX|PAR|PR)\s+','',desc)
            if len(desc)>=3:its.append(desc);itens[desc[:60]]+=1
    lin_it+=len(its)
    lab=[l.strip() for l in str(x['Labels'] or '').split(',') if l.strip()]
    num=re.search(r'/c/[^/]+/(\d+)-',str(x['URL'] or ''));C.append({'lista':x['List'],'labels':lab,'cli':cliN or '(sem cliente)','sol':N(sol).split('/')[0].strip(),'tec':N(tec).split('/')[0].strip(' .'),'ds':ds,'dr':dr,'n_it':len(its),'num':int(num.group(1)) if num else None,'membros':[m.strip() for m in str(x['Members'] or '').split(',') if m.strip()]})
    porCli[cliN or '(sem cliente)']+=1
R={}
R['cartoes']=len(C);R['listas']=collections.Counter(c['lista'] for c in C).most_common()
R['labels']=collections.Counter(l for c in C for l in c['labels']).most_common(20)
R['clientes']=porCli.most_common(15);R['n_clientes']=len(porCli)
R['solicitantes']=collections.Counter(c['sol'] for c in C if c['sol']).most_common(10)
R['tecnicos']=collections.Counter(c['tec'] for c in C if c['tec']).most_common(10)
R['membros']=collections.Counter(m for c in C for m in c['membros']).most_common(10)
dts=[c['ds'] for c in C if c['ds'] and 2020<=c['ds'].year<=2027];R['com_data']=len(dts)
if dts:R['periodo']=[min(dts).isoformat(),max(dts).isoformat()];R['por_mes']=sorted(collections.Counter(d.strftime('%Y-%m') for d in dts).items())[-14:]
pr=[(c['dr']-c['ds']).days for c in C if c['ds'] and c['dr'] and 0<=(c['dr']-c['ds']).days<=120]
R['prazo']={'n':len(pr),'media':round(sum(pr)/len(pr),1) if pr else None,'mediana':sorted(pr)[len(pr)//2] if pr else None,'mesmo_dia':sum(1 for p in pr if p==0)}
R['linhas_material']=lin_it;R['cartoes_com_itens']=sum(1 for c in C if c['n_it']);R['itens_distintos']=len(itens)
R['top_itens']=itens.most_common(30)
nums=[c['num'] for c in C if c['num']];R['numeracao']=[min(nums),max(nums)] if nums else None
# cruzamento com o estoque
wb2=openpyxl.load_workbook(est,data_only=True,read_only=True);E=[r for r in wb2.worksheets[0].iter_rows(values_only=True)][1:]
est=[(r[0] or '',N(r[2]),r[10] or 0,r[6]) for r in E if r and r[2]]
tok=lambda s:set(w for w in re.findall(r'[A-Z0-9/.,]+',s) if len(w)>1 and w not in ('DE','DA','DO','COM','PARA','UN','UND'))
def acha(desc):
    T=tok(desc);best=None;bs=0
    for cod,d,q,u in est:
        D=tok(d);
        if not D:continue
        s=len(T&D)/len(T|D)
        if s>bs:bs,best=s,(cod,d,q,u)
    return best,bs
cruz=[]
for d,n in itens.most_common(40):
    b,s=acha(d);cruz.append({'pedido':d,'vezes':n,'estoque':b[1] if b and s>=0.34 else None,'cod':b[0] if b and s>=0.34 else None,'saldo':b[2] if b and s>=0.34 else None,'sim':round(s,2)})
R['cruzamento']=cruz;R['no_estoque']=sum(1 for x in cruz if x['estoque'])
json.dump(R,open(out,'w'),ensure_ascii=False,indent=1,default=str)
print(json.dumps({k:R[k] for k in ['cartoes','listas','labels','clientes','n_clientes','solicitantes','tecnicos','com_data','periodo','prazo','linhas_material','cartoes_com_itens','itens_distintos','numeracao','no_estoque']},ensure_ascii=False,default=str,indent=0)[:6000])
print('TOP ITENS:',R['top_itens'][:30])
print('CRUZ:',[(x['pedido'][:40],x['vezes'],(x['cod'] or '-'),x['saldo']) for x in cruz[:25]])
print('POR MES:',R.get('por_mes'))

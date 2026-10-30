"""Register a fresh completed sound acceptance; preserve historical evidence."""
from pathlib import Path
import argparse,json,hashlib,base64
p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--manifest',required=True);a=p.parse_args()
root=Path(a.root);out=Path(a.manifest);assert not out.exists(),'Refuse to overwrite registered evidence'
sha=lambda b:hashlib.sha256(b).hexdigest()
def spec(p):
 p=Path(p);b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':sha(b)}
receipt=json.loads((root/'receipt.json').read_text());assert receipt['completed'] and receipt['browserCases']==7 and receipt['streamCases']==3
report=json.loads((root/'browser.json').read_text());assert not report['errors'];cases=[];attachments={}
def visit(s):
 for item in s.get('specs',[]):
  for t in item['tests']:
   assert t['expectedStatus']=='passed' and len(t['results'])==1 and t['results'][0]['status']=='passed';cases.append(t)
   for device in ['tandy','speaker']:
    if item['title'].startswith(device+' flight'):
     found=[x for x in t['results'][0].get('attachments',[]) if x['name']=='audio-boundary'];assert len(found)==1
     attachment=root/(device+'-boundary.json');assert not attachment.exists();attachment.write_bytes(base64.b64decode(found[0]['body']));attachments[device+'-route']=spec(attachment)
 for child in s.get('suites',[]):visit(child)
for s in report['suites']:visit(s)
assert len(cases)==7 and len(attachments)==2
m=json.loads(Path('reference/speaker-playback.json').read_text());m['id']='persistent-speaker-current-runtime-playback';m['parentScenario']=spec('reference/speaker-playback.json')
m['artifacts']={**{role:spec(root/name) for role,name in [('sources','sources.json'),('receipt','receipt.json'),('browser','browser.json')]},**attachments}
for path in list(m['verificationSources'])+['scripts/register-speaker-playback.py']:m['verificationSources'][path]=sha(Path(path).read_bytes())
out.write_text(json.dumps(m,indent=2)+'\n');print('Registered7 passing sound browser cases:'+str(out))

# M6.6B render comparison.
# Compares exact rendered WAV bytes from the pre-redesign and redesigned builds.
# The song chain includes a DynamicsCompressor, and repeated renders show small
# 1-LSB differences. The specific source of that variation has not been proven.
import wave, struct, json
def load(p):
    with wave.open(p,'rb') as w:
        n=w.getnframes(); raw=w.readframes(n)
    return list(struct.unpack('<%dh'%(len(raw)//2), raw))
def compare(a,b):
    x,y=load(a),load(b)
    if len(x)!=len(y): return {'error':'length mismatch'}
    diffs=[abs(p-q) for p,q in zip(x,y)]
    nz=[d for d in diffs if d]
    return {'samples':len(x),'identical':len(nz)==0,'differing':len(nz),
            'max_abs_diff':max(diffs),'mean_abs_diff':round(sum(diffs)/len(diffs),5),
            'pct_differing':round(100*len(nz)/len(x),3),'signal_peak':max(abs(p) for p in x)}
pairs=[('song','before','after'),('song','before','redesignA'),('song','redesignA','redesignB'),('effect','before','after')]
out={f'{k}:{a}-vs-{b}':compare(f'render-{a}-{k}.wav', f'render-{b}-{k}.wav') for k,a,b in pairs}
def without_ids(value):
    if isinstance(value,dict): return {k:without_ids(v) for k,v in value.items() if k!='id'}
    if isinstance(value,list): return [without_ids(v) for v in value]
    return value
before=json.load(open('audio-hash-before.json',encoding='utf-8'))
after=json.load(open('audio-hash-after.json',encoding='utf-8'))
out['project_audio_fields_equal']=without_ids(json.loads(before['projectJson']))==without_ids(json.loads(after['projectJson']))
print(json.dumps(out,indent=2))

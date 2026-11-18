#!/usr/bin/env bash
# Prints one line per Noel PR that needs ACTION NOW (exit 0), else prints nothing (exit 1).
# Lines: <repo>#<n>@<head8>:<kind>[:<detail>]  kinds: comments, ci, behind, rerun, merge
# Waiting states (checks pending, approvals outstanding) are NOT actionable and print nothing.
# Failing jobs named required-action-checker / required-actions-checker are never "ci" failures;
# a failed checker with every other check finished is "rerun".
set -u
export GH_TOKEN="$(gh auth token -u noelcf)"
D="$HOME/.local/state/pr-comment-watch"; touch "$D/dispatched.txt" "$D/inflight.txt"
gh search prs --author noelcf --state open --draft=false --limit 50 --json number,repository 2>/dev/null \
 | python3 -c '
import json,sys,subprocess,os,time,re
d=os.path.expanduser("~/.local/state/pr-comment-watch/")
st=set(open(d+"dispatched.txt").read().split())
now=time.time()
for ln in open(d+"inflight.txt"):
    k,_,t=ln.strip().rpartition(" ")
    if k and now-float(t)<2700: st.add(k)
Q="""query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){
isDraft headRefOid mergeStateStatus reviewDecision mergeable
commits(last:1){nodes{commit{committedDate statusCheckRollup{contexts(first:100){nodes{__typename
 ... on CheckRun{name status conclusion detailsUrl} ... on StatusContext{context state targetUrl}}}}}}}
comments(last:50){nodes{createdAt author{login __typename}}}
reviews(last:50){nodes{submittedAt state body author{login __typename}}}
reviewThreads(first:100){nodes{isResolved comments(last:50){nodes{createdAt author{login __typename}}}}}}}}"""
CHK=("required-action-checker","required-actions-checker")
def human(a): return a and a["__typename"]!="Bot" and a["login"]!="noelcf"
def mine_(a): return a and a["login"]=="noelcf"
need=[]
for p in json.load(sys.stdin):
    r=p["repository"]["nameWithOwner"]; n=p["number"]; o_,r_=r.split("/")
    o=subprocess.run(["gh","api","graphql","-f","query="+Q,"-F","o="+o_,"-F","r="+r_,"-F","n=%d"%n],capture_output=True,text=True)
    if o.returncode: continue
    pr=json.loads(o.stdout)["data"]["repository"]["pullRequest"]
    if pr["isDraft"]: continue
    h8=pr["headRefOid"][:8]; pre=f"{r}#{n}@{h8}"
    commit=pr["commits"]["nodes"][0]["commit"]; head=commit["committedDate"]
    def add(kind):
        if f"{pre}:{kind}" not in st: need.append(f"{pre}:{kind}")
    # comments newer than head, unanswered
    mine=[]; theirs=[]
    for c in pr["comments"]["nodes"]:
        if human(c["author"]): theirs.append(c["createdAt"])
        elif mine_(c["author"]): mine.append(c["createdAt"])
    for rv in pr["reviews"]["nodes"]:
        if human(rv["author"]) and (rv["body"] or rv["state"]=="CHANGES_REQUESTED"): theirs.append(rv["submittedAt"])
        elif mine_(rv["author"]): mine.append(rv["submittedAt"])
    for t in pr["reviewThreads"]["nodes"]:
        cs=t["comments"]["nodes"]
        if not t["isResolved"] and cs and human(cs[-1]["author"]): theirs.append(cs[-1]["createdAt"])
    newer=[t for t in theirs if t>head]
    if newer and not (mine and max(mine)>max(newer)): add("comments:"+max(newer))
    # checks
    roll=commit["statusCheckRollup"]; ctx=roll["contexts"]["nodes"] if roll else []
    pending=False; failed=[]; cancelled=[]; chk_failed=[]
    for c in ctx:
        if c["__typename"]=="CheckRun":
            nm=c["name"]; url=c["detailsUrl"] or ""
            if c["status"]!="COMPLETED": pending=True; continue
            cc=c["conclusion"]
            bad = cc in ("FAILURE","TIMED_OUT","STARTUP_FAILURE","ACTION_REQUIRED")
        else:
            nm=c["context"]; url=c["targetUrl"] or ""
            if c["state"] in ("PENDING","EXPECTED"): pending=True; continue
            cc=c["state"]; bad = cc in ("FAILURE","ERROR")
        jid=re.sub(r".*/","",url) or nm
        if nm in CHK:
            if bad: chk_failed.append(jid)
        elif bad: failed.append(jid)
        elif cc=="CANCELLED": cancelled.append(jid)
    if not pending:
        if failed: add("ci:"+",".join(sorted(failed)))
        elif cancelled or chk_failed: add("rerun:"+",".join(sorted(cancelled+chk_failed)))
        elif pr["mergeStateStatus"] in ("BEHIND","DIRTY"): add("behind")
        elif pr["mergeStateStatus"]=="CLEAN" and pr["reviewDecision"]=="APPROVED": add("merge")
print("\n".join(need)); sys.exit(0 if need else 1)
'

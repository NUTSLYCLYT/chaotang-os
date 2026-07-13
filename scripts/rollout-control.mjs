#!/usr/bin/env node
import {pathToFileURL} from 'node:url';
import {
  advanceRollout, collectAcceptance, collectProductionRelease, collectTaskMetric, evaluateRollout,
  inspectRollout, reconcileRolloutState, recordRolloutIncident, rollbackRolloutStage, startRollout, verifyAcceptance,
} from './lib/rollout-controller.mjs';

const value=(args,key)=>{const index=args.indexOf(`--${key}`);return index<0?undefined:args[index+1];};
async function main(){
  const [command,...args]=process.argv.slice(2);
  let result;
  if(command==='start-observe')result=startRollout();
  else if(command==='status')result=inspectRollout();
  else if(command==='evaluate')result=evaluateRollout();
  else if(command==='collect-task')result=collectTaskMetric(value(args,'task'));
  else if(command==='collect-release')result=collectProductionRelease(value(args,'release'));
  else if(command==='verify-acceptance')result=verifyAcceptance(value(args,'id'));
  else if(command==='collect-acceptance')result=collectAcceptance(value(args,'id'));
  else if(command==='record-incident')result=recordRolloutIncident({releaseId:value(args,'release'),ticket:value(args,'ticket'),severity:value(args,'severity'),reason:value(args,'reason')});
  else if(command==='reconcile-pointer')result=reconcileRolloutState({actor:value(args,'actor'),reason:value(args,'reason'),expectedStateWrapper:value(args,'state'),expectedPointerWrapper:value(args,'pointer')});
  else if(command==='rollback-stage')result=rollbackRolloutStage({actor:value(args,'actor'),reason:value(args,'reason')});
  else if(command==='advance'){
    if(args.some(arg=>arg.startsWith('--external')||arg.startsWith('--now')))throw new Error('production promotion facts and wall clock cannot come from CLI flags');
    result=advanceRollout({to:value(args,'to')});
  }else throw new Error('usage: start-observe|status|evaluate|collect-task --task ID|collect-release --release ID|verify-acceptance --id A1..A12|collect-acceptance --id A1..A12|record-incident --release ID --ticket INC-ID --severity P0|P1|P2 --reason R|reconcile-pointer --actor A --reason R --state V --pointer V|rollback-stage --actor A --reason R|advance --to STAGE');
  console.log(JSON.stringify(result,null,2));
  if(command==='evaluate'&&result.eligible!==true)process.exitCode=2;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)main().catch(error=>{console.error(`ROLLOUT STOP: ${error.message}`);process.exitCode=1;});

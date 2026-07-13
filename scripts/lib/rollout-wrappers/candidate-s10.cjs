'use strict';

module.exports=Object.freeze({
  version:'s10-local',
  decide({stage,compliant}){
    return Object.freeze({
      enforced:stage==='enforce_resources'||stage==='mandatory',
      warning:false&&!compliant,
    });
  },
});

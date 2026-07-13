'use strict';

module.exports=Object.freeze({
  version:'s9-local',
  decide({stage,kind,compliant}){
    return Object.freeze({
      enforced:stage==='enforce_paths'&&kind==='path',
      warning:stage==='warn'&&!compliant,
    });
  },
});

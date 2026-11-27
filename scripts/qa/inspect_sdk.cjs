// Inspect actual installed Flagsmith SDK methods
const fs = require('@flagsmith/flagsmith');
const inst = fs.default || fs;

const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(inst)).filter(m => m !== 'constructor');
const own = Object.keys(inst);

console.log('=== @flagsmith/flagsmith prototype methods ===');
console.log(proto.join('\n'));
console.log('');
console.log('=== own keys ===');
console.log(own.join('\n'));
console.log('');
console.log('=== method type checks ===');
['init','getValue','identify','trackEvent','setTrait','getState','logout','getFlags'].forEach(m => {
  console.log(`  ${m}: ${typeof inst[m]}`);
});

const { Flagsmith } = require('@flagsmith/nodejs');
const nProto = Object.getOwnPropertyNames(Flagsmith.prototype).filter(m => m !== 'constructor');
console.log('');
console.log('=== @flagsmith/nodejs prototype methods ===');
console.log(nProto.join('\n'));

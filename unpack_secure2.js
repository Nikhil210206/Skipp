const fs = require('fs');
const code = fs.readFileSync('test_secure2.js', 'utf8');

// A simple unpacker for eval(function(p,a,c,k,e,d)...)
let unpacked = "";
const oldEval = global.eval;
global.eval = function(str) {
    unpacked = str;
};
try {
    eval(code);
} catch(e) {
    console.log(e);
}
global.eval = oldEval;
fs.writeFileSync('secure2_unpacked.js', unpacked);
console.log("Unpacked length:", unpacked.length);

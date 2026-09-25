import re

with open('guardlogin.js', 'r') as f:
    code = f.read()

# It's an eval(function(p,a,c,k,e,d)... packer
# We can just write a quick node script to unpack it or use python

node_script = """
const fs = require('fs');
const code = fs.readFileSync('guardlogin.js', 'utf8');

// replace eval with console.log
const modified = code.replace(/^eval\\(/, 'console.log(');

fs.writeFileSync('unpack.js', modified);
"""

with open('unpack.js', 'w') as f:
    f.write(node_script)

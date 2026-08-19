with open("frontend/src/lib/api.ts", "r") as f:
    content = f.read()

import re
content = re.sub(
    r"randomDelim:\s*string;",
    r"randomDelim: string;\n    honeypotField: string;",
    content
)

content = re.sub(
    r"domainField:\s*captchaSession\.domainField,",
    r"domainField: captchaSession.domainField,\n        honeypotField: captchaSession.honeypotField,",
    content
)

with open("frontend/src/lib/api.ts", "w") as f:
    f.write(content)

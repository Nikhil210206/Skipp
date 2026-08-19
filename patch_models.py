with open("backend/models/student_portal.py", "r") as f:
    content = f.read()

import re
content = re.sub(
    r"random_delim: str = Field\(...\)",
    r"random_delim: str = Field(...)\n    honeypot_field: str = Field(...)",
    content
)

with open("backend/models/student_portal.py", "w") as f:
    f.write(content)

with open("backend/models/student_portal.py", "r") as f:
    content2 = f.read()
    
content2 = re.sub(
    r"random_delim: str",
    r"random_delim: str\n    honeypot_field: str",
    content2
)

with open("backend/models/student_portal.py", "w") as f:
    f.write(content2)

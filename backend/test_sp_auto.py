import sys
import asyncio
sys.path.append('/Users/nikhil/Documents/Skipp/backend')

from services.sp_auto import auto_login_and_fetch

def test():
    try:
        auto_login_and_fetch("ab1234", "dummy_password")
    except Exception as e:
        print(f"Exception raised: {type(e)}")
        print(f"Message: {str(e)}")

test()

import requests
import time

URL = "https://sujith6-fashion-ai.hf.space"

while True:
    try:
        response = requests.get(URL)
        print(f"Pinged server - Status: {response.status_code}")
    except:
        print("Server sleeping - ping failed")
    time.sleep(300)  # ping every 5 minutes
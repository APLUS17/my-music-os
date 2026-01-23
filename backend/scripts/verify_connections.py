import os
import sys
import requests
from dotenv import load_dotenv

def verify_connections():
    load_dotenv()
    
    print("--- Connectivity Validation ---")
    
    # 1. Supabase Verification
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("[FAIL] Supabase credentials missing (SUPABASE_URL, SUPABASE_KEY)")
    else:
        try:
            # Simple health check or table list (assuming public or successful auth)
            headers = {
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}"
            }
            response = requests.get(f"{supabase_url}/rest/v1/", headers=headers, timeout=5)
            if response.status_code == 200 or response.status_code == 404: # 404 might mean no tables but service is up
                print("[PASS] Supabase connection established")
            else:
                print(f"[FAIL] Supabase connection failed: {response.status_code} {response.text}")
        except Exception as e:
            print(f"[FAIL] Supabase connection error: {e}")

    # 2. OpenAI Verification
    openai_key = os.getenv("OPENAI_API_KEY")
    
    if not openai_key:
        print("[FAIL] OpenAI API Key missing (OPENAI_API_KEY)")
    else:
        try:
            headers = {
                "Authorization": f"Bearer {openai_key}"
            }
            # List models payload (minimal)
            response = requests.get("https://api.openai.com/v1/models", headers=headers, timeout=5)
            
            if response.status_code == 200:
                print("[PASS] OpenAI connection established")
            else:
                print(f"[FAIL] OpenAI connection failed: {response.status_code} {response.text}")
        except Exception as e:
            print(f"[FAIL] OpenAI connection error: {e}")

if __name__ == "__main__":
    verify_connections()

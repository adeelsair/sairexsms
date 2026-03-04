import requests
import urllib.parse

# --- VEEVO TECH CONFIGURATION ---
# You will get these details from the Veevo Tech support/dashboard
VEEVO_API_URL = "https://api.veevotech.com/sendsms" # Example URL (Confirm with them)
API_HASH_KEY = "YOUR_VEEVO_HASH_KEY" 
SENDER_ID = "SAIREX-SMS" # This is your "Mask" (The name parents see)

def send_sms_alert(to_number, message_body):
    """
    Sends a Branded SMS via Veevo Tech (Pakistan).
    """
    try:
        # 1. Format the Number
        # Veevo typically requires 923001234567 format (No '+')
        formatted_number = to_number.replace("+", "").strip()
        
        if formatted_number.startswith("03"):
            formatted_number = "92" + formatted_number[1:]

        # 2. Prepare the Payload
        # This is the standard data packet for local gateways
        params = {
            "hash": API_HASH_KEY,
            "receiver": formatted_number,
            "sender": SENDER_ID,
            "message": message_body
        }

        # 3. Send the Request
        response = requests.get(VEEVO_API_URL, params=params)
        
        # 4. Check Result
        # Veevo usually returns JSON or a status code
        print(f"📡 Veevo API Response: {response.text}")

        if response.status_code == 200:
            print(f"✅ SMS SENT to {formatted_number}")
            return True
        else:
            print(f"❌ SMS FAILED: Gateway Error")
            return False

    except Exception as e:
        print(f"❌ SMS ERROR: {e}")
        return False

# Quick test (Run this file directly to test connection)
if __name__ == "__main__":
    print("--- Veevo Tech Integration Test ---")
    test_number = input("Enter test mobile (e.g., 03001234567): ")
    send_sms_alert(test_number, "Welcome to SAIREX SMS. This is a test alert.")
    
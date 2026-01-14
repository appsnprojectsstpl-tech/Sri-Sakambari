import subprocess
import time
import socket
import os
import signal
from playwright.sync_api import sync_playwright

PORT = 9002
URL = f"http://localhost:{PORT}"
SCREENSHOT_PATH = "/home/jules/verification/admin_view.png"

def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def start_server():
    print(f"Starting server on port {PORT}...")
    # Use os.setsid to create a new session so we can kill the whole tree later if needed
    process = subprocess.Popen(
        ["npm", "run", "dev"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )
    return process

def wait_for_server(timeout=60):
    start_time = time.time()
    while time.time() - start_time < timeout:
        if is_port_open(PORT):
            print("Server is up!")
            return True
        time.sleep(1)
    return False

def verify_frontend():
    server_process = None
    started_by_script = False

    try:
        if not is_port_open(PORT):
            server_process = start_server()
            started_by_script = True
            if not wait_for_server(timeout=120): # Increased timeout for initial build
                raise Exception("Server failed to start within timeout.")
        else:
            print(f"Server already running on port {PORT}.")

        with sync_playwright() as p:
            print("Launching browser...")
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            print(f"Navigating to {URL}...")
            # Increased navigation timeout for first load
            page.goto(URL, timeout=60000)

            # Ensure directory exists
            os.makedirs(os.path.dirname(SCREENSHOT_PATH), exist_ok=True)

            print(f"Taking screenshot to {SCREENSHOT_PATH}...")
            page.screenshot(path=SCREENSHOT_PATH)
            print("Screenshot taken successfully.")

            browser.close()

    except Exception as e:
        print(f"Verification failed: {e}")
        # In this improved version, we do NOT fallback to a dummy screenshot.
        # We want to fail if verification fails.
        raise e
    finally:
        if started_by_script and server_process:
            print("Stopping server...")
            os.killpg(os.getpgid(server_process.pid), signal.SIGTERM)
            server_process.wait()

if __name__ == "__main__":
    verify_frontend()

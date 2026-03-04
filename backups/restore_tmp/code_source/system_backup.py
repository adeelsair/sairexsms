import os
import shutil
from datetime import datetime
import subprocess

# --- CONFIGURATION ---
PROJECT_NAME = "SAIREX_SMS"
BACKUP_DIR = "backups"
DB_NAME = "sairex_db" # Ensure this matches your .env file
DB_USER = "postgres"

def run_backup():
    # 1. Create backup folder if it doesn't exist
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
    
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    folder_name = f"{PROJECT_NAME}_BACKUP_{timestamp}"
    full_path = os.path.join(BACKUP_DIR, folder_name)
    os.makedirs(full_path)

    print(f"🚀 Starting Backup: {timestamp}")

    # 2. Backup Database (SQL Dump)
    print("📦 Exporting Database...")
    db_file = os.path.join(full_path, "database_dump.sql")
    try:
        # We use 'pg_dump' - make sure it's in your system PATH
        subprocess.run(f"pg_dump -U {DB_USER} {DB_NAME} > {db_file}", shell=True, check=True)
        print("✅ Database Exported.")
    except Exception as e:
        print(f"❌ DB Export Failed: {e}")

    # 3. Backup Code (Excluding heavy node_modules and venv)
    print("📂 Zipping Codebase (skipping heavy folders)...")
    
    # We copy everything except node_modules, .next, and venv to save space
    ignore_folders = shutil.ignore_patterns('node_modules', '.next', 'venv', '__pycache__', '.git', 'backups')
    
    shutil.copytree(".", os.path.join(full_path, "code_source"), ignore=ignore_folders)
    
    # 4. Final Compression
    shutil.make_archive(full_path, 'zip', full_path)
    shutil.rmtree(full_path) # Clean up the temporary folder

    print(f"\n✨ SUCCESS! Backup saved as: {folder_name}.zip")
    print(f"📍 Location: {os.path.abspath(BACKUP_DIR)}")

if __name__ == "__main__":
    run_backup()
    
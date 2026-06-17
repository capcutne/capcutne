#!/usr/bin/env python3
"""
setup_api_key.py — Lưu OpenAI API key vào PostgreSQL để auto_build.py dùng.
Chạy: python3 setup_api_key.py <your-sk-key>
"""
import os, sys
import psycopg2

def main():
    db_url = os.environ.get('DATABASE_URL', '')
    if not db_url:
        print("LỖI: Không tìm thấy DATABASE_URL")
        sys.exit(1)

    if len(sys.argv) < 2:
        print("Dùng: python3 setup_api_key.py sk-...")
        sys.exit(1)

    api_key = sys.argv[1].strip()
    if not api_key.startswith('sk-'):
        print(f"LỖI: Key phải bắt đầu bằng 'sk-' (nhận: '{api_key[:10]}...')")
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    cur.execute("""
        INSERT INTO app_config (key, value) VALUES ('OPENAI_API_KEY', %s)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    """, (api_key,))
    conn.commit()
    cur.close()
    conn.close()

    print(f"✅ Đã lưu OPENAI_API_KEY vào database (prefix: {api_key[:15]}...)")
    print("   auto_build.py sẽ tự dùng key này khi khởi động.")

if __name__ == "__main__":
    main()

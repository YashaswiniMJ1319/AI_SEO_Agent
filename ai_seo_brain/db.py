# db.py
import psycopg2


# Replace with your Neon DB URL
DATABASE_URL="postgresql://neondb_owner:npg_LsgGr8OmzoA7@ep-delicate-haze-a12tqba0-pooler.ap-southeast-1.aws.neon.tech/seo?sslmode=require&channel_binding=require"
def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL)
    return conn
import pymysql
from config import DB_CONFIG


def get_connection():
    return pymysql.connect(
        host=DB_CONFIG["host"],
        user=DB_CONFIG["user"],
        password=DB_CONFIG["password"],
        database=DB_CONFIG["database"],
        cursorclass=pymysql.cursors.DictCursor
    )


def execute_query(query, params=None, fetchone=False, fetchall=False, commit=False):
    conn = get_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(query, params or ())

            if commit:
                conn.commit()
                return True

            if fetchone:
                return cursor.fetchone()

            if fetchall:
                return cursor.fetchall()

    except Exception as e:
        print("DB ERROR:", e)
        return None

    finally:
        conn.close()
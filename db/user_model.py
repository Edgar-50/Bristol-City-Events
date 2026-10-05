from db.connection import execute_query
from werkzeug.security import generate_password_hash, check_password_hash


def create_user(username, email, password, is_student=False):
    hashed = generate_password_hash(password)

    query = """
    INSERT INTO users (username, email, password_hash, role, is_student)
    VALUES (%s, %s, %s, 'standard_user', %s)
    """

    return execute_query(query, (username, email, hashed, is_student), commit=True)


def get_user_by_email(email):
    return execute_query(
        "SELECT * FROM users WHERE email = %s",
        (email,),
        fetchone=True
    )


def verify_user(email, password):
    user = get_user_by_email(email)

    if user and check_password_hash(user["password_hash"], password):
        return user

    return None
from db.connection import execute_query


def get_all_events():
    query = """
    SELECT e.*, v.venue_name, c.category_name
    FROM events e
    JOIN venues v ON e.venue_id = v.venue_id
    JOIN event_categories c ON e.category_id = c.category_id
    ORDER BY e.start_datetime ASC
    """
    return execute_query(query, fetchall=True)


def get_event(event_id):
    return execute_query(
        "SELECT * FROM events WHERE event_id = %s",
        (event_id,),
        fetchone=True
    )
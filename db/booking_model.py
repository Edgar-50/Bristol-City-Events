from db.connection import execute_query


def create_booking(user, event, num_tickets):
    if event["remaining_tickets"] < num_tickets:
        return "WAITING_LIST"

    price = float(event["base_price"]) * num_tickets

    execute_query("""
        INSERT INTO bookings (
            user_id, event_id, num_tickets,
            gross_price, final_price, receipt_code
        )
        VALUES (%s, %s, %s, %s, %s, UUID())
    """, (
        user["user_id"],
        event["event_id"],
        num_tickets,
        price,
        price
    ), commit=True)

    execute_query("""
        UPDATE events
        SET remaining_tickets = remaining_tickets - %s
        WHERE event_id = %s
    """, (num_tickets, event["event_id"]), commit=True)

    return "BOOKED"


def add_to_waiting_list(user_id, event_id):
    execute_query("""
        INSERT INTO waiting_list (user_id, event_id)
        VALUES (%s, %s)
    """, (user_id, event_id), commit=True)


def cancel_booking(booking_id):
    execute_query("""
        UPDATE bookings
        SET booking_status = 'cancelled'
        WHERE booking_id = %s
    """, (booking_id,), commit=True)

    return True
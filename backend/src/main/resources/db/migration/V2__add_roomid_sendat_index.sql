ALTER TABLE chat_message
    ADD INDEX idx_chat_room_sendat (room_id, send_at ASC);
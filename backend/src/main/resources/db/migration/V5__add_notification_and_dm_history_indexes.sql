ALTER TABLE dm_message
    ADD INDEX idx_dm_message_room_sent_at_id_desc (room_id, sent_at DESC, id DESC);

ALTER TABLE notification
    ADD INDEX idx_notification_receiver_is_read (receiver_member_id, is_read);

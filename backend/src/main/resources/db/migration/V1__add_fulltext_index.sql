ALTER TABLE chat_message
    ADD FULLTEXT INDEX idx_content_ngram (content)
        WITH PARSER ngram;

ALTER TABLE chat_message
    ADD INDEX idx_room_id (room_id);
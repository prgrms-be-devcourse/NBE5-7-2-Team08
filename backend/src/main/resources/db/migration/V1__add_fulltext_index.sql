ALTER TABLE chat_message
    ADD FULLTEXT INDEX idx_content_ngram (content)
    WITH PARSER ngram;
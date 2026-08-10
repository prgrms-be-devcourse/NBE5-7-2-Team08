SELECT '## notification-all-select' AS plan_label;
EXPLAIN ANALYZE
SELECT n.*
FROM notification n
WHERE n.receiver_member_id = 1
LIMIT 20 OFFSET 0;

SELECT '## notification-all-count' AS plan_label;
EXPLAIN ANALYZE
SELECT COUNT(*)
FROM notification n
WHERE n.receiver_member_id = 1;

SELECT '## notification-unread-select' AS plan_label;
EXPLAIN ANALYZE
SELECT n.*
FROM notification n
WHERE n.receiver_member_id = 1
  AND n.is_read = FALSE
LIMIT 20 OFFSET 0;

SELECT '## notification-unread-count' AS plan_label;
EXPLAIN ANALYZE
SELECT COUNT(*)
FROM notification n
WHERE n.receiver_member_id = 1
  AND n.is_read = FALSE;

SELECT '## dm-history-select' AS plan_label;
EXPLAIN ANALYZE
SELECT m.id
FROM dm_message m
WHERE m.room_id = 1
ORDER BY m.sent_at DESC, m.id DESC
LIMIT 20 OFFSET 0;

SELECT '## dm-history-fetch-senders' AS plan_label;
EXPLAIN ANALYZE
SELECT m.id, m.room_id, m.sender_id, m.content, m.type, m.sent_at, member.nickname
FROM dm_message m
JOIN member ON member.member_id = m.sender_id
WHERE m.id IN (__DM_MESSAGE_IDS__);

SELECT '## dm-history-count' AS plan_label;
EXPLAIN ANALYZE
SELECT COUNT(*)
FROM dm_message m
WHERE m.room_id = 1;

SELECT '## chat-history-first-page' AS plan_label;
EXPLAIN ANALYZE
SELECT m.*
FROM chat_message m
WHERE m.room_id = 1
ORDER BY m.message_id DESC
LIMIT 20 OFFSET 0;

SELECT '## chat-history-deep-cursor' AS plan_label;
EXPLAIN ANALYZE
SELECT m.*
FROM chat_message m
WHERE m.room_id = 1
  AND m.message_id < @chat_cursor
ORDER BY m.message_id DESC
LIMIT 20;

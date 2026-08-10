SELECT '## dm-history-before-select' AS plan_label;
EXPLAIN ANALYZE
SELECT m.room_id, m.sender_id, m.content, member.nickname, m.type, m.id, m.sent_at
FROM dm_message m
JOIN member ON member.member_id = m.sender_id
WHERE m.room_id = 1
ORDER BY m.sent_at DESC, m.id DESC
LIMIT 20 OFFSET 0;

SELECT '## dm-history-before-count' AS plan_label;
EXPLAIN ANALYZE
SELECT COUNT(*)
FROM dm_message m
WHERE m.room_id = 1;

CREATE TEMPORARY TABLE generated_numbers AS
WITH digits AS (
    SELECT 0 AS digit UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
    SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL
    SELECT 8 UNION ALL SELECT 9
)
SELECT ones.digit + tens.digit * 10 + hundreds.digit * 100 + thousands.digit * 1000 + ten_thousands.digit * 10000 AS n
FROM digits ones
CROSS JOIN digits tens
CROSS JOIN digits hundreds
CROSS JOIN digits thousands
CROSS JOIN digits ten_thousands
WHERE ones.digit + tens.digit * 10 + hundreds.digit * 100 + thousands.digit * 1000 + ten_thousands.digit * 10000 < @target_rows;

INSERT INTO member (member_id, email, join_at, nickname, password, profile_image, provider, recent_room_id, username)
VALUES
    (1, 'target@example.com', '2026-01-01 00:00:00', 'target', 'password', 'default.png', 'LOCAL', NULL, 'target'),
    (2, 'other@example.com', '2026-01-01 00:00:00', 'other', 'password', 'default.png', 'LOCAL', NULL, 'other');

INSERT INTO dm_room (id, created_at, member1_id, member2_id)
VALUES
    (1, '2026-01-01 00:00:00', 1, 2),
    (2, '2026-01-01 00:00:00', 2, 1);

INSERT INTO chat_room (room_id, created_at, last_sequence, name, repository_url, invite_code, webhook_id)
VALUES
    (1, '2026-01-01 00:00:00', 0, 'target-room', NULL, NULL, NULL),
    (2, '2026-01-01 00:00:00', 0, 'other-room', NULL, NULL, NULL);

INSERT INTO notification (created_at, is_read, reference_id, type, receiver_member_id, sender_member_id)
SELECT TIMESTAMP('2026-01-01 00:00:00') + INTERVAL n SECOND,
       MOD(n, 5) <> 0,
       n,
       'NEW_DM',
       1,
       2
FROM generated_numbers;

INSERT INTO notification (created_at, is_read, reference_id, type, receiver_member_id, sender_member_id)
SELECT TIMESTAMP('2026-01-01 00:00:00') + INTERVAL n SECOND,
       MOD(n, 5) <> 0,
       n,
       'NEW_DM',
       2,
       1
FROM generated_numbers;

INSERT INTO dm_message (content, sent_at, type, room_id, sender_id)
SELECT CONCAT('target dm ', n),
       TIMESTAMP('2026-01-01 00:00:00') + INTERVAL FLOOR(n / 10) SECOND,
       'TEXT',
       1,
       1
FROM generated_numbers;

INSERT INTO dm_message (content, sent_at, type, room_id, sender_id)
SELECT CONCAT('other dm ', n),
       TIMESTAMP('2026-01-01 00:00:00') + INTERVAL FLOOR(n / 10) SECOND,
       'TEXT',
       2,
       2
FROM generated_numbers;

INSERT INTO chat_message (content, created_at, status, type, room_id, member_id, sequence)
SELECT CONCAT('target chat ', n),
       TIMESTAMP('2026-01-01 00:00:00') + INTERVAL FLOOR(n / 10) SECOND,
       'NO_CHANGE',
       'TEXT',
       1,
       1,
       n
FROM generated_numbers;

INSERT INTO chat_message (content, created_at, status, type, room_id, member_id, sequence)
SELECT CONCAT('other chat ', n),
       TIMESTAMP('2026-01-01 00:00:00') + INTERVAL FLOOR(n / 10) SECOND,
       'NO_CHANGE',
       'TEXT',
       2,
       2,
       n
FROM generated_numbers;

DROP TEMPORARY TABLE generated_numbers;

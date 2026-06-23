-- Delete all chat messages (and reactions) for doctor alaadoc@gmail.com
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/delete-doctor-chat-messages-alaadoc.sql
--
-- Preview only (run before delete):
--   SELECT m.id, m.type, m.datetime, m.creator, m.recipient
--   FROM messages m
--   JOIN users u ON u.id = m.creator OR u.id = m.recipient
--   WHERE u.email = 'alaadoc@gmail.com'
--      OR u.id IN (SELECT user_id FROM doctors WHERE email = 'alaadoc@gmail.com');

DO $$
DECLARE
  v_user_id uuid;
  v_message_count int;
  v_emotion_count int;
BEGIN
  SELECT u.id
  INTO v_user_id
  FROM users u
  LEFT JOIN doctors d ON d.user_id = u.id
  WHERE lower(u.email) = lower('alaadoc@gmail.com')
     OR lower(d.email) = lower('alaadoc@gmail.com')
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user/doctor found for email alaadoc@gmail.com';
  END IF;

  SELECT COUNT(*)::int
  INTO v_message_count
  FROM messages
  WHERE creator = v_user_id OR recipient = v_user_id;

  SELECT COUNT(*)::int
  INTO v_emotion_count
  FROM message_emotions me
  WHERE me.message_source = 'chat'
    AND me.message_id IN (
      SELECT id FROM messages
      WHERE creator = v_user_id OR recipient = v_user_id
    );

  RAISE NOTICE 'Doctor user id: %', v_user_id;
  RAISE NOTICE 'Chat messages to delete: %', v_message_count;
  RAISE NOTICE 'Message reactions to delete: %', v_emotion_count;

  DELETE FROM message_emotions me
  WHERE me.message_source = 'chat'
    AND me.message_id IN (
      SELECT id FROM messages
      WHERE creator = v_user_id OR recipient = v_user_id
    );

  DELETE FROM messages
  WHERE creator = v_user_id OR recipient = v_user_id;

  RAISE NOTICE 'Deleted chat messages for alaadoc@gmail.com';
END $$;

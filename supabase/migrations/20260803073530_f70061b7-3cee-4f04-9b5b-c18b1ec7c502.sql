
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_notification(UUID,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_application_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_message_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_review_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_conversation_participant(UUID,UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(UUID,UUID) TO authenticated;

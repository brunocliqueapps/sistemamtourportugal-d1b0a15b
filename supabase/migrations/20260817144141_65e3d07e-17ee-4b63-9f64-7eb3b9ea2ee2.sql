REVOKE ALL ON FUNCTION public.next_client_number() FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.seq_client FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_client_number() TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.seq_client TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_client_number() TO service_role;
GRANT ALL ON SEQUENCE public.seq_client TO service_role;
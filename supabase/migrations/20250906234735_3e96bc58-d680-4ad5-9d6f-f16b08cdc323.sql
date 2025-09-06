-- Only add the realtime setup if not already present
DO $$ 
BEGIN
    -- Try to add the tables to realtime publication, ignore if already exists
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    EXCEPTION
        WHEN duplicate_object THEN
            -- Table is already in the publication, that's fine
            NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION
        WHEN duplicate_object THEN
            -- Table is already in the publication, that's fine
            NULL;
    END;
END $$;
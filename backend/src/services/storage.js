import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'flyers';

export async function uploadFlyerImage(buffer, filename, mimetype)
{
    const ext = filename.split('.').pop();
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storagePath = `uploads/${uniqueName}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer,
        {
            contentType: mimetype,
            upsert: false,
        });

    if (error) throw new Error(`Supabase upload failed: ${error.message}`);

    const {data} = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
}
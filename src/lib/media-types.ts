export type PickedPhoto = { data: Blob | ArrayBuffer; mime: 'image/jpeg' | 'image/png' | 'image/webp'; width: number; height: number };
export type PickedFile = { data: Blob | ArrayBuffer; mime: string; ext: string; name: string; size: number };

export const MAX_PHOTO_EDGE = 2000;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // Supabase ücretsiz planında dosya başına üst sınır 50 MB
export const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/m4a'];
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

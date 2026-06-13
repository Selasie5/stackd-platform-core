import { v2 as cloudinary } from 'cloudinary';
import { config } from '@/config/index';

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

export { cloudinary };

/**
 * Generates a signed payload for client-side uploads to Cloudinary.
 * Used for direct uploads without passing files through the backend.
 * 
 * @param folder - The folder in Cloudinary to upload the file to.
 * @returns Object with timestamp, signature, cloudName, and apiKey to be used by the frontend.
 */
export function generateSignature(folder: string = 'spleenet') {
  const timestamp = Math.round(new Date().getTime() / 1000);
  
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder,
    },
    config.CLOUDINARY_API_SECRET!
  );

  return {
    timestamp,
    signature,
    cloudName: config.CLOUDINARY_CLOUD_NAME,
    apiKey: config.CLOUDINARY_API_KEY,
    folder,
  };
}

import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not set. Image generation will not work.');
}

// Singleton instance
let geminiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    geminiClient = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
    });
  }
  return geminiClient;
}

export interface GenerateImageOptions {
  prompt: string;
  imageSize?: '256' | '512' | '1K' | '2K';
}

export interface GenerateImageResult {
  success: boolean;
  imageData?: string; // Base64 encoded image
  mimeType?: string;
  error?: string;
}

/**
 * Generate an image using Gemini's image generation model
 */
export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResult> {
  try {
    const ai = getGeminiClient();

    const config = {
      responseModalities: ['IMAGE', 'TEXT'] ,
      imageConfig: {
        imageSize: options.imageSize || '1K',
      },
    };

    const model = 'gemini-3-pro-image-preview';

    const response = await ai.models.generateContent({
      model,
      config,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: options.prompt,
            },
          ],
        },
      ],
    });

    // Extract image from response
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          if ('inlineData' in part && part.inlineData) {
            return {
              success: true,
              imageData: part.inlineData.data,
              mimeType: part.inlineData.mimeType,
            };
          }
        }
      }
    }

    return {
      success: false,
      error: 'No image was generated in the response',
    };
  } catch (error) {
    console.error('Gemini image generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Generate an image and return it as a Buffer (useful for uploading to S3)
 */
export async function generateImageAsBuffer(
  options: GenerateImageOptions
): Promise<{ success: boolean; buffer?: Buffer; mimeType?: string; error?: string }> {
  const result = await generateImage(options);

  if (!result.success || !result.imageData) {
    return {
      success: false,
      error: result.error || 'No image data available',
    };
  }

  const buffer = Buffer.from(result.imageData, 'base64');

  return {
    success: true,
    buffer,
    mimeType: result.mimeType,
  };
}


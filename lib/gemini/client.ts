import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SWS_LOGO_URL = 'https://whatsapp-automation-perssonify.s3.us-east-1.amazonaws.com/sws-logo.png';

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
  temperature?: number;
  topP?: number;
  aspectRatio?: string;
}

export interface GenerateImageResult {
  success: boolean;
  imageData?: string; // Base64 encoded image
  mimeType?: string;
  error?: string;
}

// Cache for logo buffer to avoid fetching repeatedly
let cachedLogoBuffer: Buffer | null = null;

/**
 * Fetch the logo image as a buffer
 */
async function fetchLogoBuffer(): Promise<Buffer | null> {
  if (cachedLogoBuffer) {
    return cachedLogoBuffer;
  }

  try {
    const response = await fetch(SWS_LOGO_URL);
    if (!response.ok) {
      console.error('Failed to fetch logo:', response.statusText);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    cachedLogoBuffer = Buffer.from(arrayBuffer);
    return cachedLogoBuffer;
  } catch (error) {
    console.error('Error fetching logo:', error);
    return null;
  }
}

export interface LogoOverlayOptions {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  padding?: number;
  logoWidth?: number;
}

export interface InfoBoxOverlayOptions {
  caseType?: string;
  companyName: string;
  exchange: string;
  ticker: string;
  leadPlaintiffDeadline: string;
  classPeriodStart: string;
  classPeriodEnd: string;
}

/**
 * Overlay the logo on an image buffer
 */
export async function overlayLogoOnImage(
  imageBuffer: Buffer,
  options: LogoOverlayOptions = {}
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  const {
    position = 'top-left',
    padding = 20,
    logoWidth = 80,
  } = options;

  try {
    const logoBuffer = await fetchLogoBuffer();
    if (!logoBuffer) {
      console.warn('Could not fetch logo, returning original image');
      return { success: true, buffer: imageBuffer };
    }

    // Get image dimensions
    const imageMetadata = await sharp(imageBuffer).metadata();
    const imgWidth = imageMetadata.width || 1024;
    const imgHeight = imageMetadata.height || 1024;

    // Resize logo to desired width while maintaining aspect ratio
    const resizedLogo = await sharp(logoBuffer)
      .resize({ width: logoWidth })
      .toBuffer();

    const logoMetadata = await sharp(resizedLogo).metadata();
    const logoHeight = logoMetadata.height || logoWidth;

    // Calculate position
    let left: number;
    let top: number;

    switch (position) {
      case 'top-right':
        left = imgWidth - logoWidth - padding;
        top = padding;
        break;
      case 'bottom-left':
        left = padding;
        top = imgHeight - logoHeight - padding;
        break;
      case 'bottom-right':
        left = imgWidth - logoWidth - padding;
        top = imgHeight - logoHeight - padding;
        break;
      case 'top-left':
      default:
        left = padding;
        top = padding;
        break;
    }

    // Composite logo onto image
    const resultBuffer = await sharp(imageBuffer)
      .composite([
        {
          input: resizedLogo,
          left: Math.round(left),
          top: Math.round(top),
        },
      ])
      .toBuffer();

    return { success: true, buffer: resultBuffer };
  } catch (error) {
    console.error('Error overlaying logo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to overlay logo',
    };
  }
}

/**
 * Wrap text to fit within a maximum width (approximate character count)
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // If a single word is longer than max, we still add it (will overflow but better than breaking)
      currentLine = word;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * Overlay info boxes (orange case update badge and grey main info box) on an image
 */
export async function overlayInfoBoxes(
  imageBuffer: Buffer,
  options: InfoBoxOverlayOptions
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  const {
    caseType = 'CASE UPDATE',
    companyName,
    exchange,
    ticker,
    leadPlaintiffDeadline,
    classPeriodStart,
    classPeriodEnd,
  } = options;

  try {
    // Get image dimensions
    const imageMetadata = await sharp(imageBuffer).metadata();
    const imgWidth = imageMetadata.width || 1280;
    const imgHeight = imageMetadata.height || 720;

    // Calculate dimensions based on image size
    const padding = Math.round(imgWidth * 0.03);
    const boxWidth = Math.round(imgWidth * 0.55); // Increased from 0.45 to 0.55 for more space
    
    // Font sizes (relative to image height)
    const largeFontSize = Math.round(imgHeight * 0.04); // Slightly reduced for better fit
    const smallFontSize = Math.round(imgHeight * 0.028);
    const badgeFontSize = Math.round(imgHeight * 0.025);

    // Orange badge dimensions
    const badgePaddingX = Math.round(imgWidth * 0.015);
    const badgePaddingY = Math.round(imgHeight * 0.008);
    const badgeWidth = Math.round(badgeFontSize * caseType.length * 0.65) + badgePaddingX * 2;
    const badgeHeight = badgeFontSize + badgePaddingY * 2;

    // Grey box dimensions
    const greyBoxPadding = Math.round(imgWidth * 0.02);
    const lineHeight = Math.round(imgHeight * 0.05);
    const largeLineHeight = Math.round(imgHeight * 0.055);
    
    // Calculate max characters per line based on box width and font size
    // Approximate: average character width is ~0.55 of font size for bold sans-serif
    const maxTextWidth = boxWidth - greyBoxPadding * 2;
    const avgCharWidth = largeFontSize * 0.55;
    const maxCharsPerLine = Math.floor(maxTextWidth / avgCharWidth);
    
    // Wrap company name if too long
    const companyNameLines = wrapText(companyName, maxCharsPerLine);
    const numCompanyLines = companyNameLines.length;
    
    // Calculate grey box height: company name lines + ticker + deadline + class period
    const greyBoxHeight = (numCompanyLines * largeLineHeight) + (lineHeight * 3) + greyBoxPadding * 2;
    
    const greyBoxY = imgHeight - padding - greyBoxHeight;
    const greyBoxX = padding;

    // Orange badge position (above grey box)
    const badgeX = greyBoxX;
    const badgeY = greyBoxY - badgeHeight - Math.round(imgHeight * 0.01);

    // Generate company name text elements (multiple lines if wrapped)
    const companyNameSvg = companyNameLines.map((line, index) => `
        <text 
          x="${greyBoxX + greyBoxPadding}" 
          y="${greyBoxY + greyBoxPadding + largeFontSize + (index * largeLineHeight)}" 
          class="company-text" 
          font-size="${largeFontSize}"
        >${escapeXml(line)}</text>`
    ).join('');
    
    // Calculate Y positions for remaining text after company name
    const afterCompanyY = greyBoxY + greyBoxPadding + largeFontSize + ((numCompanyLines - 1) * largeLineHeight);

    // Create SVG overlay for the boxes and text
    const svgOverlay = `
      <svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&amp;display=swap');
            .badge-text { font-family: 'Inter', 'Arial', sans-serif; font-weight: 700; fill: white; }
            .company-text { font-family: 'Inter', 'Arial', sans-serif; font-weight: 700; fill: white; }
            .info-text { font-family: 'Inter', 'Arial', sans-serif; font-weight: 400; fill: white; }
          </style>
        </defs>
        
        <!-- Orange Badge (Case Update) -->
        <rect 
          x="${badgeX}" 
          y="${badgeY}" 
          width="${badgeWidth}" 
          height="${badgeHeight}" 
          rx="4" 
          fill="#E85D3F"
        />
        <text 
          x="${badgeX + badgePaddingX}" 
          y="${badgeY + badgeHeight - badgePaddingY - 2}" 
          class="badge-text" 
          font-size="${badgeFontSize}"
        >${caseType}</text>
        
        <!-- Grey Main Info Box -->
        <rect 
          x="${greyBoxX}" 
          y="${greyBoxY}" 
          width="${boxWidth}" 
          height="${greyBoxHeight}" 
          rx="8" 
          fill="rgba(51, 51, 51, 0.75)"
        />
        
        <!-- Company Name (may be multiple lines) -->
        ${companyNameSvg}
        
        <!-- Ticker Symbol -->
        <text 
          x="${greyBoxX + greyBoxPadding}" 
          y="${afterCompanyY + lineHeight}" 
          class="company-text" 
          font-size="${largeFontSize}"
        >(${escapeXml(exchange)}: ${escapeXml(ticker)})</text>
        
        <!-- Lead Plaintiff Deadline -->
        <text 
          x="${greyBoxX + greyBoxPadding}" 
          y="${afterCompanyY + lineHeight * 2}" 
          class="info-text" 
          font-size="${smallFontSize}"
        >Lead Plaintiff Deadline: ${escapeXml(leadPlaintiffDeadline)}</text>
        
        <!-- Class Period -->
        <text 
          x="${greyBoxX + greyBoxPadding}" 
          y="${afterCompanyY + lineHeight * 3}" 
          class="info-text" 
          font-size="${smallFontSize}"
        >Class Period: ${escapeXml(classPeriodStart)} – ${escapeXml(classPeriodEnd)}</text>
      </svg>
    `;

    // Composite SVG overlay onto image
    const resultBuffer = await sharp(imageBuffer)
      .composite([
        {
          input: Buffer.from(svgOverlay),
          top: 0,
          left: 0,
        },
      ])
      .toBuffer();

    return { success: true, buffer: resultBuffer };
  } catch (error) {
    console.error('Error overlaying info boxes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to overlay info boxes',
    };
  }
}

/**
 * Escape special XML characters for SVG text
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate an image using Gemini's image generation model
 */
export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResult> {
  try {
    const ai = getGeminiClient();

    const config: Record<string, unknown> = {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: {
        imageSize: options.imageSize || '1K',
        ...(options.aspectRatio && { aspectRatio: options.aspectRatio }),
      },
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.topP !== undefined && { topP: options.topP }),
    };

    const model = 'gemini-3-pro-image-preview';

    const response = await ai.models.generateContent({
      model,
      config,
      contents: [
        {
          role: 'user',
          parts: [{ text: options.prompt }],
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

export interface GenerateImageAsBufferOptions extends GenerateImageOptions {
  overlayLogo?: boolean;
  logoOptions?: LogoOverlayOptions;
  overlayInfoBoxes?: boolean;
  infoBoxOptions?: InfoBoxOverlayOptions;
}

/**
 * Generate an image and return it as a Buffer (useful for uploading to S3)
 * Optionally overlays the company logo and info boxes on the generated image
 */
export async function generateImageAsBuffer(
  options: GenerateImageAsBufferOptions
): Promise<{ success: boolean; buffer?: Buffer; mimeType?: string; error?: string }> {
  const result = await generateImage(options);

  if (!result.success || !result.imageData) {
    return {
      success: false,
      error: result.error || 'No image data available',
    };
  }

  let buffer: Buffer = Buffer.from(result.imageData, 'base64');

  // Overlay info boxes if requested and options provided
  if (options.overlayInfoBoxes !== false && options.infoBoxOptions) {
    const infoBoxResult = await overlayInfoBoxes(buffer, options.infoBoxOptions);
    if (infoBoxResult.success && infoBoxResult.buffer) {
      buffer = infoBoxResult.buffer as Buffer;
    }
    // If overlay fails, we still continue with the original image
  }

  // Overlay logo if requested (default: true)
  if (options.overlayLogo !== false) {
    const overlayResult = await overlayLogoOnImage(buffer, options.logoOptions);
    if (overlayResult.success && overlayResult.buffer) {
      buffer = overlayResult.buffer as Buffer;
    }
    // If overlay fails, we still return the original image
  }

  return {
    success: true,
    buffer,
    mimeType: result.mimeType,
  };
}

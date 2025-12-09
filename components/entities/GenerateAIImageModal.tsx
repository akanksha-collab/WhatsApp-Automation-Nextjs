'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Loader2, 
  AlertCircle,
  RefreshCw,
  Building,
  FileText,
  Wand2,
  Check
} from 'lucide-react';

interface EntityInfo {
  companyName: string;
  tickerSymbol: string;
  allegations?: string;
  leadPlaintiffDate?: string;
  classPeriodStart?: string;
  classPeriodEnd?: string;
  exchange?: string;
  industry?: string;
  caseType?: string;
}

interface GenerateAIImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  entity: EntityInfo;
  onSuccess: () => void;
}

export default function GenerateAIImageModal({
  isOpen,
  onClose,
  entityId,
  entity,
  onSuccess,
}: GenerateAIImageModalProps) {
  const [prompt, setPrompt] = useState('');
  const [guidelines, setGuidelines] = useState('');
  
  const [isLoadingGuidelines, setIsLoadingGuidelines] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [wasGenerated, setWasGenerated] = useState(false);
  const [progress, setProgress] = useState(0);

  // Fetch guidelines on mount
  useEffect(() => {
    if (isOpen) {
      fetchGuidelines();
    }
  }, [isOpen]);

  // Auto-generate prompt when guidelines are loaded or entity changes
  useEffect(() => {
    if (isOpen && !prompt) {
      generatePrompt();
    }
  }, [isOpen, guidelines, entity]);

  const fetchGuidelines = async () => {
    setIsLoadingGuidelines(true);
    try {
      const res = await fetch('/api/settings/image-generation');
      if (res.ok) {
        const data = await res.json();
        setGuidelines(data.guidelines || '');
      }
    } catch (err) {
      console.error('Failed to fetch guidelines:', err);
    } finally {
      setIsLoadingGuidelines(false);
    }
  };

  const generatePrompt = () => {
    // Parse ticker symbol - format can be "(NASDAQ) TLX" or just "TLX"
    let exchange = 'NYSE/NASDAQ';
    let ticker = entity.tickerSymbol || '';
    
    // Check if ticker contains exchange in parentheses, e.g., "(NASDAQ) TLX"
    const tickerMatch = ticker.match(/^\(([^)]+)\)\s*(.+)$/);
    if (tickerMatch) {
      exchange = tickerMatch[1]; // Extract exchange from parentheses
      ticker = tickerMatch[2].trim(); // Extract actual ticker symbol
    }
    
    const industry = entity.industry || 'Determine based on company name';

    const corePrompt = `Create a photorealistic hero banner background image for a securities class action lawsuit legal update.

COMPANY: ${entity.companyName} (${exchange}: ${ticker})
First, use your knowledge to understand what ${entity.companyName} does - their products, services, and industry. Then generate a background scene that visually represents their actual business.

INDUSTRY: ${industry}

BACKGROUND IMAGE REQUIREMENTS:
Generate a FULL-BLEED photorealistic scene representing the company's industry. The entire image should show the relevant scene - do NOT leave any dark/empty areas. The bottom-left area should have slightly darker tones to accommodate text overlay.

INDUSTRY VISUAL EXAMPLES:
- Healthcare/Biotech/Pharma → vaccine vials on reflective surface with virus/cell particles floating, laboratory setting, blue-teal color tones
- Technology/Software → modern tech workspace, servers, screens with data
- Cybersecurity → dark server room corridor with red/blue LED lights
- Finance/Banking → trading floor, financial screens, city skyline
- Advertising/Marketing → creative agency, presentation screens, meeting rooms

VISUAL STYLE:
- Photorealistic background - looks like real stock photography
- Professional, clean, modern aesthetic
- High production value suitable for legal/financial marketing
- Cinematic depth of field on the background
- Leave the bottom-left area slightly darker or with less detail for text overlay

MUST AVOID:
- NO recognizable faces or identifiable people
- NO visible hands
- NO text or typography in the image
- NO Company logos or branding
- NO overlays, boxes, or badges

${guidelines ? `\n---\nADDITIONAL GUIDELINES:\n${guidelines}\n---` : ''}`;

    setPrompt(corePrompt);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setError('');
    setProgress(0);

    // Simulate progress while generating
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return 90; // Cap at 90% until complete
        const next = prev + Math.random() * 15;
        return Math.min(next, 90); // Never exceed 90%
      });
    }, 500);

    // Parse ticker symbol - format can be "(NASDAQ) TLX" or just "TLX"
    let exchange = 'NYSE/NASDAQ';
    let ticker = entity.tickerSymbol || '';
    
    const tickerMatch = ticker.match(/^\(([^)]+)\)\s*(.+)$/);
    if (tickerMatch) {
      exchange = tickerMatch[1];
      ticker = tickerMatch[2].trim();
    }

    // Format dates
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return 'TBD';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      } catch {
        return dateStr;
      }
    };

    try {
      const res = await fetch(`/api/entities/${entityId}/content/generate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          caseType: entity.caseType || 'CASE UPDATE',
          exchange,
          ticker,
          leadPlaintiffDeadline: formatDate(entity.leadPlaintiffDate),
          classPeriodStart: formatDate(entity.classPeriodStart),
          classPeriodEnd: formatDate(entity.classPeriodEnd),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }

      clearInterval(progressInterval);
      setProgress(100);
      setWasGenerated(true);
      onSuccess(); // Refresh the content list
    } catch (err) {
      clearInterval(progressInterval);
      setProgress(0);
      setError(err instanceof Error ? err.message : 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setPrompt('');
    setError('');
    setWasGenerated(false);
    setProgress(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Generate AI Image</h2>
              <p className="text-sm text-gray-500">Create an image using AI</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Case Details (Read-only) */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Building size={16} />
              Case Details
            </h3>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Company:</span>
                <span className="font-medium text-gray-900">
                  {entity.companyName}
                  {entity.tickerSymbol && (
                    <span className="ml-2 px-2 py-0.5 bg-whatsapp-light-green text-whatsapp-dark-teal rounded-full text-xs">
                      {entity.tickerSymbol}
                    </span>
                  )}
                </span>
              </div>
              {entity.allegations && (
                <div>
                  <span className="text-gray-500">Allegations:</span>
                  <p className="text-gray-700 mt-1 line-clamp-3">
                    {entity.allegations}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Image Prompt */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FileText size={16} />
                Image Prompt
              </label>
              <button
                onClick={generatePrompt}
                disabled={isLoadingGuidelines}
                className="flex items-center gap-1 text-sm text-whatsapp-teal hover:text-whatsapp-dark-teal transition-colors"
              >
                <Wand2 size={14} />
                Auto-generate prompt
              </button>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent resize-none text-sm"
              placeholder="Describe the image you want to generate..."
            />
            <p className="text-xs text-gray-500 mt-1">
              The prompt will be sent to the AI image generation service.
            </p>
          </div>

          {/* Generation Status */}
          {(isGenerating || wasGenerated) && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {isGenerating ? 'Generating Image...' : 'Generation Complete'}
                </span>
                <span className="text-sm font-semibold text-whatsapp-dark-teal">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    progress === 100 
                      ? 'bg-green-500' 
                      : 'bg-gradient-to-r from-purple-500 to-pink-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {isGenerating && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" />
                  This may take a few seconds...
                </p>
              )}
              {wasGenerated && !isGenerating && (
                <p className="text-xs text-green-600 mt-2 flex items-center gap-2">
                  <Check size={12} />
                  Image generated and saved to content library
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            {wasGenerated ? 'Close' : 'Cancel'}
          </button>
          <div className="flex items-center gap-3">
            {wasGenerated && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Check size={16} />
                Image saved to content
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating...
                </>
              ) : wasGenerated ? (
                <>
                  <RefreshCw size={18} />
                  Regenerate
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


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
}

interface GenerateAIImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  entity: EntityInfo;
  onSuccess: () => void;
}

const IMAGE_STYLES = [
  { value: 'professional', label: 'Professional / Legal' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'financial', label: 'Financial' },
  { value: 'news', label: 'News Style' },
];

export default function GenerateAIImageModal({
  isOpen,
  onClose,
  entityId,
  entity,
  onSuccess,
}: GenerateAIImageModalProps) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('professional');
  const [guidelines, setGuidelines] = useState('');
  
  const [isLoadingGuidelines, setIsLoadingGuidelines] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [wasGenerated, setWasGenerated] = useState(false);

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
    const parts: string[] = [];
    
    // Main description
    parts.push(`Create a professional image for a securities class action lawsuit about ${entity.companyName}`);
    
    if (entity.tickerSymbol) {
      parts[0] += ` (${entity.tickerSymbol})`;
    }
    parts[0] += '.';
    
    // Add allegations if present
    if (entity.allegations) {
      const summary = entity.allegations.length > 200 
        ? entity.allegations.substring(0, 200) + '...'
        : entity.allegations;
      parts.push(`Case summary: ${summary}`);
    }
    
    // Add guidelines if present
    if (guidelines) {
      parts.push(`Guidelines: ${guidelines}`);
    }
    
    // Default instructions
    parts.push('The image should be suitable for WhatsApp-style legal updates. It should look clean, trustworthy, professional, and convey urgency for investor action.');
    
    setPrompt(parts.join('\n\n'));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setError('');
    setGeneratedImageUrl(null);

    try {
      const res = await fetch(`/api/entities/${entityId}/content/generate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }

      setGeneratedImageUrl(data.contentItem.fileUrl);
      setWasGenerated(true);
      onSuccess(); // Refresh the content list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setPrompt('');
    setStyle('professional');
    setGeneratedImageUrl(null);
    setError('');
    setWasGenerated(false);
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

          {/* Style Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image Style
            </label>
            <div className="grid grid-cols-2 gap-2">
              {IMAGE_STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    style === s.value
                      ? 'bg-whatsapp-green text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview Area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview
            </label>
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 min-h-[200px] flex items-center justify-center">
              {isGenerating ? (
                <div className="text-center p-8">
                  <Loader2 size={40} className="animate-spin text-whatsapp-green mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Generating image...</p>
                  <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
                </div>
              ) : generatedImageUrl ? (
                <img
                  src={generatedImageUrl}
                  alt="Generated AI Image"
                  className="max-w-full max-h-[400px] object-contain"
                />
              ) : (
                <div className="text-center p-8">
                  <Sparkles size={40} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No image yet</p>
                  <p className="text-xs text-gray-400">Click &quot;Generate&quot; to create an image</p>
                </div>
              )}
            </div>
          </div>
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
              ) : generatedImageUrl ? (
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


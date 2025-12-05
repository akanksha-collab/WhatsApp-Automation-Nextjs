'use client';

import { useState } from 'react';
import { 
  X, 
  Image as ImageIcon, 
  Video, 
  Download, 
  ExternalLink,
  Bot,
  ChevronLeft,
  ChevronRight,
  FileText,
  Calendar,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';

interface ContentItem {
  _id: string;
  contentType: 'image' | 'video';
  fileName: string;
  fileUrl: string;
  thumbnailUrl: string;
  usageCount: number;
  createdAt: string;
  isAiGenerated?: boolean;
  aiPrompt?: string;
}

interface ContentViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: ContentItem | null;
  allContent?: ContentItem[];
  onNavigate?: (content: ContentItem) => void;
}

export default function ContentViewModal({ 
  isOpen, 
  onClose, 
  content,
  allContent = [],
  onNavigate
}: ContentViewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  if (!isOpen || !content) return null;

  // Find current index for navigation
  const currentIndex = allContent.findIndex(item => item._id === content._id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allContent.length - 1;

  const handlePrevious = () => {
    if (hasPrevious && onNavigate) {
      onNavigate(allContent[currentIndex - 1]);
      setIsLoading(true);
    }
  };

  const handleNext = () => {
    if (hasNext && onNavigate) {
      onNavigate(allContent[currentIndex + 1]);
      setIsLoading(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') onClose();
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = content.fileUrl;
    link.download = content.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(content.fileUrl, '_blank');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Dark Backdrop */}
      <div 
        className="absolute inset-0 bg-black/90 animate-fade-in" 
        onClick={onClose}
      />
      
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {content.contentType === 'image' ? (
            <ImageIcon size={20} className="text-whatsapp-green" />
          ) : (
            <Video size={20} className="text-purple-400" />
          )}
          <div className="flex items-center gap-2">
            <span className="text-white font-medium truncate max-w-[200px] sm:max-w-[400px]">
              {content.fileName}
            </span>
            {content.isAiGenerated && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium rounded-full">
                <Bot size={12} />
                AI
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Navigation Counter */}
          {allContent.length > 1 && (
            <span className="text-gray-400 text-sm mr-2">
              {currentIndex + 1} / {allContent.length}
            </span>
          )}
          
          {/* Toggle Details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`p-2 rounded-lg transition-colors ${
              showDetails ? 'bg-whatsapp-green text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
            title="Show details"
          >
            <FileText size={20} />
          </button>
          
          {/* Download */}
          <button
            onClick={handleDownload}
            className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Download"
          >
            <Download size={20} />
          </button>
          
          {/* Open in new tab */}
          <button
            onClick={handleOpenInNewTab}
            className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={20} />
          </button>
          
          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden">
        {/* Previous Button */}
        {allContent.length > 1 && (
          <button
            onClick={handlePrevious}
            disabled={!hasPrevious}
            className={`absolute left-4 z-20 p-3 rounded-full transition-all ${
              hasPrevious 
                ? 'bg-white/10 text-white hover:bg-white/20 cursor-pointer' 
                : 'bg-white/5 text-gray-600 cursor-not-allowed'
            }`}
          >
            <ChevronLeft size={32} />
          </button>
        )}

        {/* Content Display */}
        <div className="relative max-w-full max-h-full flex items-center justify-center">
          {content.contentType === 'image' ? (
            <img
              src={content.fileUrl}
              alt={content.fileName}
              className={`max-w-full max-h-[calc(100vh-160px)] object-contain rounded-lg shadow-2xl transition-opacity duration-300 ${
                isLoading ? 'opacity-0' : 'opacity-100'
              }`}
              onLoad={() => setIsLoading(false)}
            />
          ) : (
            <video
              src={content.fileUrl}
              controls
              autoPlay
              className="max-w-full max-h-[calc(100vh-160px)] rounded-lg shadow-2xl"
              onLoadedData={() => setIsLoading(false)}
            >
              Your browser does not support the video tag.
            </video>
          )}
          
          {/* Loading Spinner */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-whatsapp-green border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Next Button */}
        {allContent.length > 1 && (
          <button
            onClick={handleNext}
            disabled={!hasNext}
            className={`absolute right-4 z-20 p-3 rounded-full transition-all ${
              hasNext 
                ? 'bg-white/10 text-white hover:bg-white/20 cursor-pointer' 
                : 'bg-white/5 text-gray-600 cursor-not-allowed'
            }`}
          >
            <ChevronRight size={32} />
          </button>
        )}
      </div>

      {/* Details Panel */}
      {showDetails && (
        <div className="relative z-10 bg-black/50 backdrop-blur-sm border-t border-white/10 p-4 animate-slide-up">
          <div className="max-w-4xl mx-auto">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* File Name */}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide">File Name</label>
                <p className="text-white text-sm mt-1 truncate">{content.fileName}</p>
              </div>
              
              {/* Type */}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide">Type</label>
                <p className="text-white text-sm mt-1 flex items-center gap-2">
                  {content.contentType === 'image' ? (
                    <>
                      <ImageIcon size={14} className="text-whatsapp-green" />
                      Image
                    </>
                  ) : (
                    <>
                      <Video size={14} className="text-purple-400" />
                      Video
                    </>
                  )}
                  {content.isAiGenerated && (
                    <span className="text-purple-400">(AI Generated)</span>
                  )}
                </p>
              </div>
              
              {/* Usage Count */}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide">Usage Count</label>
                <p className="text-white text-sm mt-1 flex items-center gap-2">
                  <Eye size={14} className="text-gray-400" />
                  Used {content.usageCount} {content.usageCount === 1 ? 'time' : 'times'}
                </p>
              </div>
              
              {/* Created Date */}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide">Created</label>
                <p className="text-white text-sm mt-1 flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  {format(new Date(content.createdAt), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
            
            {/* AI Prompt (if available) */}
            {content.isAiGenerated && content.aiPrompt && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <label className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-2">
                  <Bot size={12} />
                  AI Generation Prompt
                </label>
                <p className="text-white text-sm mt-2 bg-white/5 rounded-lg p-3 max-h-[100px] overflow-y-auto">
                  {content.aiPrompt}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keyboard Shortcut Hints */}
      <div className="relative z-10 flex items-center justify-center gap-6 py-2 bg-black/30 text-gray-500 text-xs">
        {allContent.length > 1 && (
          <>
            <span>← Previous</span>
            <span>→ Next</span>
          </>
        )}
        <span>Esc Close</span>
      </div>
    </div>
  );
}


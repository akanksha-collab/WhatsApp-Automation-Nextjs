'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Image as ImageIcon, 
  Video, 
  Trash2, 
  ChevronDown,
  Loader2,
  AlertCircle,
  Play,
  Sparkles,
  Bot
} from 'lucide-react';
import UploadImageModal from './UploadImageModal';
import UploadVideoModal from './UploadVideoModal';
import GenerateAIImageModal from './GenerateAIImageModal';

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

interface EntityInfo {
  companyName: string;
  tickerSymbol: string;
  allegations?: string;
  leadPlaintiffDate?: string;
}

interface ContentTabProps {
  entityId: string;
  entity: EntityInfo;
}

export default function ContentTab({ entityId, entity }: ContentTabProps) {
  const [images, setImages] = useState<ContentItem[]>([]);
  const [videos, setVideos] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [uploadImageModalOpen, setUploadImageModalOpen] = useState(false);
  const [uploadVideoModalOpen, setUploadVideoModalOpen] = useState(false);
  const [generateAIModalOpen, setGenerateAIModalOpen] = useState(false);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchContent();
  }, [entityId]);

  const fetchContent = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/entities/${entityId}/content`);
      if (!res.ok) throw new Error('Failed to fetch content');
      const data = await res.json();
      setImages(data.images || []);
      setVideos(data.videos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (contentId: string, contentType: 'image' | 'video') => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/entities/${entityId}/content/${contentId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      
      // Remove from local state
      if (contentType === 'image') {
        setImages(prev => prev.filter(img => img._id !== contentId));
      } else {
        setVideos(prev => prev.filter(vid => vid._id !== contentId));
      }
      
      setDeleteConfirmId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUploadSuccess = () => {
    fetchContent();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-whatsapp-green" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchContent}
          className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const hasContent = images.length > 0 || videos.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-whatsapp-dark-teal">Content</h2>
          <p className="text-sm text-gray-600">Manage images and videos for this case</p>
        </div>
        
        {/* Add New Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors"
          >
            <Plus size={18} />
            Add New
            <ChevronDown size={16} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {dropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px]">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    setUploadImageModalOpen(true);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-whatsapp-beige text-left text-sm transition-colors"
                >
                  <ImageIcon size={18} className="text-whatsapp-teal" />
                  Upload Image
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    setUploadVideoModalOpen(true);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-whatsapp-beige text-left text-sm transition-colors border-t border-gray-100"
                >
                  <Video size={18} className="text-whatsapp-teal" />
                  Upload Video
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    setGenerateAIModalOpen(true);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-purple-50 text-left text-sm transition-colors border-t border-gray-100"
                >
                  <Bot size={18} className="text-purple-500" />
                  <span className="flex-1">Generate AI Image</span>
                  <Sparkles size={14} className="text-purple-400" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Empty State */}
      {!hasContent && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="flex justify-center gap-4 mb-4">
            <ImageIcon size={32} className="text-gray-400" />
            <Video size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No content yet</h3>
          <p className="text-gray-600 mb-6">
            Click &quot;+ Add New&quot; to upload images or videos for this case.
          </p>
        </div>
      )}

      {/* Images Section */}
      {images.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
            IMAGES ({images.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {images.map((image) => (
              <div 
                key={image._id} 
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="aspect-square relative overflow-hidden bg-gray-100">
                  <img
                    src={image.thumbnailUrl}
                    alt={image.fileName}
                    className="w-full h-full object-cover"
                  />
                  {/* AI Badge */}
                  {image.isAiGenerated && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium rounded-full shadow-sm">
                      <Bot size={12} />
                      AI Generated
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 truncate" title={image.fileName}>
                    {image.fileName}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">
                      Used: {image.usageCount}x
                    </span>
                    <button
                      onClick={() => setDeleteConfirmId(image._id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Videos Section */}
      {videos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
            VIDEOS ({videos.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {videos.map((video) => (
              <div 
                key={video._id} 
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="aspect-video relative overflow-hidden bg-gray-900 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                      <Play size={24} className="text-whatsapp-dark-teal ml-1" />
                    </div>
                  </div>
                  <Video size={32} className="text-gray-500" />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 truncate" title={video.fileName}>
                    {video.fileName}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">
                      Used: {video.usageCount}x
                    </span>
                    <button
                      onClick={() => setDeleteConfirmId(video._id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Content?</h3>
              <p className="text-gray-600 mb-6">
                This will permanently delete this file from storage. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const item = [...images, ...videos].find(i => i._id === deleteConfirmId);
                    if (item) {
                      handleDelete(deleteConfirmId, item.contentType);
                    }
                  }}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modals */}
      <UploadImageModal
        isOpen={uploadImageModalOpen}
        onClose={() => setUploadImageModalOpen(false)}
        entityId={entityId}
        onSuccess={handleUploadSuccess}
      />
      
      <UploadVideoModal
        isOpen={uploadVideoModalOpen}
        onClose={() => setUploadVideoModalOpen(false)}
        entityId={entityId}
        onSuccess={handleUploadSuccess}
      />

      <GenerateAIImageModal
        isOpen={generateAIModalOpen}
        onClose={() => setGenerateAIModalOpen(false)}
        entityId={entityId}
        entity={entity}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}


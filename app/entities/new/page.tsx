'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  AlertCircle, 
  Calendar, 
  Link as LinkIcon, 
  FileText, 
  Video as VideoIcon,
  Image as ImageIcon,
  Upload,
  X,
  Loader2,
  CheckCircle
} from 'lucide-react';

interface FileWithPreview {
  file: File;
  preview?: string;
  id: string;
}

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/mov'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

export default function NewEntityPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    // Basic Info
    companyName: '',
    tickerSymbol: '',
    
    // Important Dates
    leadPlaintiffDate: '',
    classPeriodStart: '',
    classPeriodEnd: '',
    caseDate: '',
    
    // Case Details
    allegations: '',
    
    // Links
    joinLink: '',
    avatarVideo: '',
    aiVideo: '',
    podcastLink: '',
    blogLink: '',
    youtubeLink: '',
    articleLinks: [''],
  });

  // File upload state
  const [imagesToUpload, setImagesToUpload] = useState<FileWithPreview[]>([]);
  const [videosToUpload, setVideosToUpload] = useState<FileWithPreview[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  // Drag state
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);

  // Refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleArticleLinkChange = (index: number, value: string) => {
    const newLinks = [...formData.articleLinks];
    newLinks[index] = value;
    setFormData(prev => ({ ...prev, articleLinks: newLinks }));
  };

  const addArticleLink = () => {
    setFormData(prev => ({ ...prev, articleLinks: [...prev.articleLinks, ''] }));
  };

  const removeArticleLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      articleLinks: prev.articleLinks.filter((_, i) => i !== index),
    }));
  };

  // File validation
  const validateImageFile = (file: File): string | null => {
    if (!IMAGE_TYPES.includes(file.type)) {
      return `"${file.name}" is not a valid image. Supported: JPG, PNG, WebP`;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return `"${file.name}" is too large (${formatFileSize(file.size)}). Max: 10MB`;
    }
    return null;
  };

  const validateVideoFile = (file: File): string | null => {
    if (!VIDEO_TYPES.includes(file.type)) {
      return `"${file.name}" is not a valid video. Supported: MP4, MOV, WebM`;
    }
    if (file.size > MAX_VIDEO_SIZE) {
      return `"${file.name}" is too large (${formatFileSize(file.size)}). Max: 50MB`;
    }
    return null;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle image selection
  const handleImageSelect = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newErrors: string[] = [];
    const validFiles: FileWithPreview[] = [];

    fileArray.forEach(file => {
      const error = validateImageFile(file);
      if (error) {
        newErrors.push(error);
      } else {
        // Check for duplicates
        const isDuplicate = imagesToUpload.some(
          existing => existing.file.name === file.name && existing.file.size === file.size
        );
        if (!isDuplicate) {
          // Create preview
          const reader = new FileReader();
          reader.onload = (e) => {
            setImagesToUpload(prev => 
              prev.map(f => 
                f.id === id ? { ...f, preview: e.target?.result as string } : f
              )
            );
          };
          reader.readAsDataURL(file);

          const id = `${file.name}-${Date.now()}-${Math.random()}`;
          validFiles.push({ file, id });
        }
      }
    });

    if (newErrors.length > 0) {
      setFileErrors(prev => [...prev, ...newErrors]);
      // Clear errors after 5 seconds
      setTimeout(() => setFileErrors([]), 5000);
    }

    if (validFiles.length > 0) {
      setImagesToUpload(prev => [...prev, ...validFiles]);
    }
  }, [imagesToUpload]);

  // Handle video selection
  const handleVideoSelect = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newErrors: string[] = [];
    const validFiles: FileWithPreview[] = [];

    fileArray.forEach(file => {
      const error = validateVideoFile(file);
      if (error) {
        newErrors.push(error);
      } else {
        // Check for duplicates
        const isDuplicate = videosToUpload.some(
          existing => existing.file.name === file.name && existing.file.size === file.size
        );
        if (!isDuplicate) {
          const id = `${file.name}-${Date.now()}-${Math.random()}`;
          validFiles.push({ file, id });
        }
      }
    });

    if (newErrors.length > 0) {
      setFileErrors(prev => [...prev, ...newErrors]);
      setTimeout(() => setFileErrors([]), 5000);
    }

    if (validFiles.length > 0) {
      setVideosToUpload(prev => [...prev, ...validFiles]);
    }
  }, [videosToUpload]);

  // Remove files
  const removeImage = (id: string) => {
    setImagesToUpload(prev => prev.filter(f => f.id !== id));
  };

  const removeVideo = (id: string) => {
    setVideosToUpload(prev => prev.filter(f => f.id !== id));
  };

  // Drag handlers for images
  const handleImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImage(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageSelect(files);
    }
  }, [handleImageSelect]);

  const handleImageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImage(true);
  }, []);

  const handleImageDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImage(false);
  }, []);

  // Drag handlers for videos
  const handleVideoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingVideo(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleVideoSelect(files);
    }
  }, [handleVideoSelect]);

  const handleVideoDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingVideo(true);
  }, []);

  const handleVideoDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingVideo(false);
  }, []);

  // Upload a single file
  const uploadFile = async (entityId: string, file: File, contentType: 'image' | 'video'): Promise<boolean> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('contentType', contentType);

    try {
      const res = await fetch(`/api/entities/${entityId}/content/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      return true;
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setUploadProgress('');

    try {
      // Step 1: Create the entity
      setUploadProgress('Creating case...');
      const res = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          articleLinks: formData.articleLinks.filter(link => link.trim()),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create entity');
        return;
      }

      const entityId = data._id;

      // Step 2: Upload files if any
      const totalFiles = imagesToUpload.length + videosToUpload.length;
      
      if (totalFiles === 0) {
        // No files to upload, redirect immediately
        router.push(`/entities/${entityId}`);
        return;
      }

      // Upload images
      let uploadedCount = 0;
      const failedUploads: string[] = [];

      for (const imageFile of imagesToUpload) {
        setUploadProgress(`Uploading image ${uploadedCount + 1}/${totalFiles}...`);
        const success = await uploadFile(entityId, imageFile.file, 'image');
        if (!success) {
          failedUploads.push(imageFile.file.name);
        }
        uploadedCount++;
      }

      // Upload videos
      for (const videoFile of videosToUpload) {
        setUploadProgress(`Uploading video ${uploadedCount + 1}/${totalFiles}...`);
        const success = await uploadFile(entityId, videoFile.file, 'video');
        if (!success) {
          failedUploads.push(videoFile.file.name);
        }
        uploadedCount++;
      }

      // Show results
      if (failedUploads.length > 0) {
        alert(`Case created! Some files failed to upload: ${failedUploads.join(', ')}`);
      }

      // Redirect to entity page
      router.push(`/entities/${entityId}`);
    } catch {
      setError('Something went wrong');
    } finally {
      setIsLoading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <header className="flex items-center gap-4">
        <Link
          href="/entities"
          className="p-2 hover:bg-whatsapp-beige rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-whatsapp-dark-teal">
            Add New Case
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Create a new securities class action case for marketing
          </p>
        </div>
      </header>

      {/* Form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* File Errors */}
          {fileErrors.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700 text-sm font-medium mb-1">
                <AlertCircle size={16} />
                File Validation Errors
              </div>
              <ul className="text-sm text-amber-600 list-disc list-inside">
                {fileErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Basic Info */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
              <FileText size={16} />
              BASIC INFORMATION
            </h3>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
                  placeholder="Tesla Inc"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ticker Symbol *
                </label>
                <input
                  type="text"
                  name="tickerSymbol"
                  value={formData.tickerSymbol}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all uppercase"
                  placeholder="TSLA"
                  required
                />
              </div>
            </div>
          </div>

          {/* Important Dates */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
              <Calendar size={16} />
              IMPORTANT DATES
            </h3>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lead Plaintiff Deadline *
                </label>
                <input
                  type="date"
                  name="leadPlaintiffDate"
                  value={formData.leadPlaintiffDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class Period Start
                </label>
                <input
                  type="date"
                  name="classPeriodStart"
                  value={formData.classPeriodStart}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class Period End
                </label>
                <input
                  type="date"
                  name="classPeriodEnd"
                  value={formData.classPeriodEnd}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Case Filing Date
                </label>
                <input
                  type="date"
                  name="caseDate"
                  value={formData.caseDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          {/* Case Details */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
              <FileText size={16} />
              CASE DETAILS
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allegations
              </label>
              <textarea
                name="allegations"
                value={formData.allegations}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all resize-none"
                placeholder="The company allegedly misled investors by..."
              />
            </div>
          </div>

          {/* Links Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
              <LinkIcon size={16} />
              LINKS
            </h3>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Join Link
                </label>
                <input
                  type="url"
                  name="joinLink"
                  value={formData.joinLink}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
                  placeholder="https://suewallst.com/case/..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Blog Link
                </label>
                <input
                  type="url"
                  name="blogLink"
                  value={formData.blogLink}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
                  placeholder="https://blog.example.com/..."
                />
              </div>
            </div>
          </div>

          {/* Video Links Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
              <VideoIcon size={16} />
              VIDEO & AUDIO LINKS
            </h3>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Avatar Video
                </label>
                <input
                  type="url"
                  name="avatarVideo"
                  value={formData.avatarVideo}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AI Video
                </label>
                <input
                  type="url"
                  name="aiVideo"
                  value={formData.aiVideo}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube Link
                </label>
                <input
                  type="url"
                  name="youtubeLink"
                  value={formData.youtubeLink}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
                  placeholder="https://youtube.com/..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Podcast Link
                </label>
                <input
                  type="url"
                  name="podcastLink"
                  value={formData.podcastLink}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
                  placeholder="https://spotify.com/..."
                />
              </div>
            </div>
          </div>

          {/* Article Links */}
          <div className="border-t border-gray-200 pt-6">
            <label className="block text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
              ARTICLE LINKS
            </label>
            {formData.articleLinks.map((link, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="url"
                  value={link}
                  onChange={(e) => handleArticleLinkChange(index, e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
                  placeholder="https://..."
                />
                {formData.articleLinks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeArticleLink(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addArticleLink}
              className="text-sm text-whatsapp-teal hover:text-whatsapp-dark-teal font-medium"
            >
              + Add another link
            </button>
          </div>

          {/* Content Upload Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-2">
              <Upload size={16} />
              CONTENT (OPTIONAL)
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Attach images and videos for this case. You can manage them later in the Content tab.
            </p>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Images Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="flex items-center gap-2">
                    <ImageIcon size={16} />
                    Images
                  </span>
                </label>
                
                {/* Drop Zone */}
                <div
                  onDrop={handleImageDrop}
                  onDragOver={handleImageDragOver}
                  onDragLeave={handleImageDragLeave}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                    isDraggingImage
                      ? 'border-whatsapp-green bg-whatsapp-light-green/30'
                      : 'border-gray-300 hover:border-whatsapp-green hover:bg-gray-50'
                  }`}
                >
                  <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-2">
                    Drag & drop images here
                  </p>
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="text-sm text-whatsapp-teal hover:text-whatsapp-dark-teal font-medium"
                  >
                    or Browse Files
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    JPG, PNG, WebP (Max 10MB each)
                  </p>
                </div>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  multiple
                  onChange={(e) => e.target.files && handleImageSelect(e.target.files)}
                  className="hidden"
                />

                {/* Selected Images */}
                {imagesToUpload.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {imagesToUpload.map((item) => (
                      <div 
                        key={item.id}
                        className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                          {item.preview ? (
                            <img 
                              src={item.preview} 
                              alt={item.file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon size={20} className="text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(item.file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(item.id)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Videos Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="flex items-center gap-2">
                    <VideoIcon size={16} />
                    Videos
                  </span>
                </label>
                
                {/* Drop Zone */}
                <div
                  onDrop={handleVideoDrop}
                  onDragOver={handleVideoDragOver}
                  onDragLeave={handleVideoDragLeave}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                    isDraggingVideo
                      ? 'border-whatsapp-green bg-whatsapp-light-green/30'
                      : 'border-gray-300 hover:border-whatsapp-green hover:bg-gray-50'
                  }`}
                >
                  <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-2">
                    Drag & drop videos here
                  </p>
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="text-sm text-whatsapp-teal hover:text-whatsapp-dark-teal font-medium"
                  >
                    or Browse Files
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    MP4, MOV, WebM (Max 50MB each)
                  </p>
                </div>

                <input
                  ref={videoInputRef}
                  type="file"
                  accept=".mp4,.mov,.webm"
                  multiple
                  onChange={(e) => e.target.files && handleVideoSelect(e.target.files)}
                  className="hidden"
                />

                {/* Selected Videos */}
                {videosToUpload.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {videosToUpload.map((item) => (
                      <div 
                        key={item.id}
                        className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-900 flex-shrink-0 flex items-center justify-center">
                          <VideoIcon size={20} className="text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(item.file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeVideo(item.id)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Files Summary */}
            {(imagesToUpload.length > 0 || videosToUpload.length > 0) && (
              <div className="mt-4 p-3 bg-whatsapp-light-green/50 rounded-lg flex items-center gap-2 text-sm text-whatsapp-dark-teal">
                <CheckCircle size={16} />
                <span>
                  {imagesToUpload.length} image{imagesToUpload.length !== 1 ? 's' : ''} and {videosToUpload.length} video{videosToUpload.length !== 1 ? 's' : ''} ready to upload
                </span>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Link
              href="/entities"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px] justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {uploadProgress || 'Creating...'}
                </>
              ) : (
                <>
                  <Save size={18} />
                  Create Case
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

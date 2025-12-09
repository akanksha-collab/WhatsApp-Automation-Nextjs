'use client';

import { useState } from 'react';
import { X, Image, Video, FileText, Link as LinkIcon, Calendar, Clock, Building2, Tag, Trash2, AlertTriangle } from 'lucide-react';
import { format, isBefore } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// All date/time display should use NY timezone for consistency
const NY_TIMEZONE = 'America/New_York';

interface ScheduledPost {
  _id: string;
  entityId: string;
  contentType: 'image' | 'video' | 'text' | 'youtube' | 'podcast' | 'article';
  contentId?: string;
  mediaUrl?: string;
  message: string;
  link?: string;
  templateId?: string;
  templateName?: string;
  scheduledAt: string;
  scheduledDay: string;
  status: 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';
  sentAt?: string;
  errorMessage?: string;
  entity?: {
    companyName: string;
    tickerSymbol: string;
    leadPlaintiffDate?: string;
  };
}

interface PostPreviewModalProps {
  post: ScheduledPost | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (postId: string) => Promise<void>;
}

export default function PostPreviewModal({ post, isOpen, onClose, onDelete }: PostPreviewModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen || !post) return null;

  const canDelete = post.status === 'scheduled' && !isBefore(new Date(post.scheduledAt), new Date());

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(post._id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image size={20} className="text-whatsapp-teal" />;
      case 'video': return <Video size={20} className="text-purple-500" />;
      case 'youtube': return <LinkIcon size={20} className="text-red-500" />;
      case 'podcast': return <LinkIcon size={20} className="text-orange-500" />;
      case 'article': return <LinkIcon size={20} className="text-blue-500" />;
      default: return <FileText size={20} className="text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: 'bg-whatsapp-light-green text-whatsapp-dark-teal',
      processing: 'bg-amber-100 text-amber-700',
      sent: 'bg-blue-100 text-blue-700',
      failed: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-700',
    };
    return styles[status] || styles.scheduled;
  };

  const getContentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      image: 'Image Post',
      video: 'Video Post',
      text: 'Text Only',
      youtube: 'YouTube Link',
      podcast: 'Podcast Link',
      article: 'Article Link',
    };
    return labels[type] || 'Post';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 animate-fade-in" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-whatsapp-beige/50">
          <div className="flex items-center gap-3">
            {getContentIcon(post.contentType)}
            <div>
              <h2 className="font-semibold text-gray-900">{getContentTypeLabel(post.contentType)}</h2>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getStatusBadge(post.status)}`}>
                {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Entity Info */}
          {post.entity && (
            <div className="bg-whatsapp-light-green/30 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={16} className="text-whatsapp-dark-teal" />
                <span className="font-semibold text-whatsapp-dark-teal">Entity</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-gray-900">{post.entity.companyName}</span>
                <span className="px-2 py-0.5 bg-whatsapp-dark-teal text-white rounded text-sm font-medium">
                  {post.entity.tickerSymbol}
                </span>
              </div>
              {post.entity.leadPlaintiffDate && (
                <p className="text-sm text-gray-600 mt-1">
                  Lead Plaintiff Deadline: {format(new Date(post.entity.leadPlaintiffDate), 'MMMM d, yyyy')}
                </p>
              )}
            </div>
          )}

          {/* Schedule Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-500">Scheduled Date</span>
              </div>
              <p className="font-semibold text-gray-900">
                {format(toZonedTime(new Date(post.scheduledAt), NY_TIMEZONE), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-500">Scheduled Time <span className="text-xs text-blue-500">(NY)</span></span>
              </div>
              <p className="font-semibold text-gray-900">
                {format(toZonedTime(new Date(post.scheduledAt), NY_TIMEZONE), 'h:mm a')}
              </p>
            </div>
          </div>

          {/* Template Used */}
          {post.templateName && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Tag size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-500">Template Used</span>
              </div>
              <p className="text-gray-900">{post.templateName}</p>
            </div>
          )}

          {/* Media Preview */}
          {post.mediaUrl && (post.contentType === 'image' || post.contentType === 'video') && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                {post.contentType === 'image' ? (
                  <Image size={16} className="text-gray-500" />
                ) : (
                  <Video size={16} className="text-gray-500" />
                )}
                <span className="text-sm font-medium text-gray-500">
                  {post.contentType === 'image' ? 'Image' : 'Video'} Attachment
                </span>
              </div>
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                {post.contentType === 'image' ? (
                  <img 
                    src={post.mediaUrl} 
                    alt="Post attachment" 
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <video 
                    src={post.mediaUrl} 
                    controls 
                    className="w-full h-48 object-cover"
                  />
                )}
              </div>
            </div>
          )}

          {/* Message Content */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-500">Message Content</span>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-inner">
              <pre className="whitespace-pre-wrap text-gray-900 font-sans text-sm leading-relaxed">
                {post.message}
              </pre>
            </div>
          </div>

          {/* Link (if any) */}
          {post.link && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <LinkIcon size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-500">Link</span>
              </div>
              <a 
                href={post.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-whatsapp-teal hover:text-whatsapp-dark-teal break-all"
              >
                {post.link}
              </a>
            </div>
          )}

          {/* Sent Info (if sent) */}
          {post.status === 'sent' && post.sentAt && (
            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-blue-500" />
                <span className="text-sm font-medium text-blue-700">
                  Sent on {format(toZonedTime(new Date(post.sentAt), NY_TIMEZONE), 'MMMM d, yyyy')} at {format(toZonedTime(new Date(post.sentAt), NY_TIMEZONE), 'h:mm a')} <span className="text-xs text-blue-500">(NY)</span>
                </span>
              </div>
            </div>
          )}

          {/* Error Message (if failed) */}
          {post.status === 'failed' && post.errorMessage && (
            <div className="bg-red-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <X size={16} className="text-red-500" />
                <span className="text-sm font-medium text-red-700">Error</span>
              </div>
              <p className="text-red-600 text-sm">{post.errorMessage}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between">
            {/* Delete Button - only show for scheduled posts that haven't passed */}
            <div>
              {canDelete && onDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 size={18} />
                  Delete Scheduled Post
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/30" 
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Delete Scheduled Post?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this scheduled post? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Post
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


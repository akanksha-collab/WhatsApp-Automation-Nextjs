'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, AlertCircle, Loader2, Calendar, Link as LinkIcon, FileText, Video } from 'lucide-react';

interface EntityData {
  _id: string;
  companyName: string;
  tickerSymbol: string;
  leadPlaintiffDate: string;
  classPeriodStart: string;
  classPeriodEnd: string;
  caseDate: string;
  allegations: string;
  joinLink: string;
  avatarVideo: string;
  aiVideo: string;
  podcastLink: string;
  blogLink: string;
  youtubeLink: string;
  articleLinks: string[];
  status: 'active' | 'completed' | 'paused';
}

export default function EditEntityPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<EntityData | null>(null);

  useEffect(() => {
    fetchEntity();
  }, [id]);

  const fetchEntity = async () => {
    try {
      const res = await fetch(`/api/entities/${id}`);
      if (!res.ok) {
        setError('Entity not found');
        return;
      }
      const data = await res.json();
      setFormData({
        ...data,
        leadPlaintiffDate: data.leadPlaintiffDate?.split('T')[0] || '',
        classPeriodStart: data.classPeriodStart?.split('T')[0] || '',
        classPeriodEnd: data.classPeriodEnd?.split('T')[0] || '',
        caseDate: data.caseDate?.split('T')[0] || '',
        allegations: data.allegations || '',
        joinLink: data.joinLink || '',
        avatarVideo: data.avatarVideo || '',
        aiVideo: data.aiVideo || '',
        podcastLink: data.podcastLink || '',
        blogLink: data.blogLink || '',
        youtubeLink: data.youtubeLink || '',
        articleLinks: data.articleLinks?.length > 0 ? data.articleLinks : [''],
      });
    } catch {
      setError('Failed to load entity');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!formData) return;
    const { name, value } = e.target;
    setFormData(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleArticleLinkChange = (index: number, value: string) => {
    if (!formData) return;
    const newLinks = [...formData.articleLinks];
    newLinks[index] = value;
    setFormData(prev => prev ? { ...prev, articleLinks: newLinks } : null);
  };

  const addArticleLink = () => {
    if (!formData) return;
    setFormData(prev => prev ? { ...prev, articleLinks: [...prev.articleLinks, ''] } : null);
  };

  const removeArticleLink = (index: number) => {
    if (!formData) return;
    setFormData(prev => prev ? {
      ...prev,
      articleLinks: prev.articleLinks.filter((_, i) => i !== index),
    } : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    
    setError('');
    setIsSaving(true);

    try {
      const res = await fetch(`/api/entities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          articleLinks: formData.articleLinks.filter(link => link.trim()),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update entity');
        return;
      }

      router.push('/entities');
    } catch {
      setError('Something went wrong');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-whatsapp-green" />
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Entity not found</h2>
        <Link href="/entities" className="text-whatsapp-teal hover:text-whatsapp-dark-teal">
          Back to entities
        </Link>
      </div>
    );
  }

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
            Edit Case
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Update {formData.companyName} ({formData.tickerSymbol})
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

          {/* Basic Info */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
              <FileText size={16} />
              BASIC INFORMATION
            </h3>
            <div className="grid gap-6 md:grid-cols-3">
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
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent bg-white"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
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
              <Video size={16} />
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
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

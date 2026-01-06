"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  admin_replied_at: string | null;
  created_at: string;
  attachments?: Array<{
    url: string;
    filename: string;
    size: number;
    content_type: string;
    uploaded_at: string;
  }>;
}

interface FileAttachment {
  url: string;
  filename: string;
  size: number;
  content_type: string;
  uploaded_at: string;
}

interface HelpDeskPublicProps {
  user: { id: string; name: string; email: string };
  userType: 'influencer' | 'brand';
}

const t = {
  el: {
    title: "Help Desk",
    subtitle: "Στείλτε μας το ερώτημά σας",
    back: "← Πίσω",
    newTicket: "Νέο Ticket",
    myTickets: "Τα Tickets μου",
    subject: "Θέμα",
    message: "Μήνυμα",
    send: "Αποστολή",
    sending: "Αποστολή...",
    success: "✅ Το ticket σας δημιουργήθηκε! Θα λάβετε email επιβεβαίωσης.",
    error: "❌ Σφάλμα:",
    placeholderSubject: "Π.χ. Ερώτηση για το προφίλ μου",
    placeholderMessage: "Περιγράψτε το πρόβλημά σας ή την ερώτησή σας...",
    attachFiles: "Επισυνάψτε Αρχεία",
    removeFile: "Αφαίρεση",
    uploading: "Ανέβασμα...",
    noTickets: "Δεν έχετε tickets ακόμα.",
    status: "Κατάσταση",
    created: "Δημιουργήθηκε",
    reply: "Απάντηση",
    open: "Ανοιχτό",
    in_progress: "Σε Εξέλιξη",
    resolved: "Επιλυμένο",
    closed: "Κλειστό",
    waiting: "Αναμονή Απάντησης",
    viewReply: "Προβολή Απάντησης",
    replyToTicket: "Απάντηση στο Ticket",
    replyPlaceholder: "Γράψτε την απάντησή σας...",
    sendReply: "Αποστολή Απάντησης",
    sendingReply: "Αποστολή...",
    replySuccess: "✅ Η απάντηση σας στάλθηκε! Το ticket άνοιξε ξανά.",
    close: "Κλείσιμο",
  },
  en: {
    title: "Help Desk",
    subtitle: "Send us your question",
    back: "← Back",
    newTicket: "New Ticket",
    myTickets: "My Tickets",
    subject: "Subject",
    message: "Message",
    send: "Send",
    sending: "Sending...",
    success: "✅ Your ticket has been created! You will receive a confirmation email.",
    error: "❌ Error:",
    placeholderSubject: "E.g. Question about my profile",
    placeholderMessage: "Describe your problem or question...",
    attachFiles: "Attach Files",
    removeFile: "Remove",
    uploading: "Uploading...",
    noTickets: "You don't have any tickets yet.",
    status: "Status",
    created: "Created",
    reply: "Reply",
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
    waiting: "Waiting for Reply",
    viewReply: "View Reply",
    replyToTicket: "Reply to Ticket",
    replyPlaceholder: "Write your reply...",
    sendReply: "Send Reply",
    sendingReply: "Sending...",
    replySuccess: "✅ Your reply has been sent! The ticket has been reopened.",
    close: "Close",
  }
};

export default function HelpDeskPublic({ user, userType }: HelpDeskPublicProps) {
  const lang = 'el';
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [uploadingReplyFiles, setUploadingReplyFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<FileAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [user.id, userType]);

  const loadTickets = async () => {
    try {
      setLoadingTickets(true);
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .eq('user_type', userType)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error: any) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<FileAttachment[]> => {
    if (selectedFiles.length === 0) return [];

    setUploading(true);
    const uploaded: FileAttachment[] = [];

    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', user.id);

        const response = await fetch('/api/tickets/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (data.success) {
          uploaded.push(data.file);
        } else {
          throw new Error(data.error || 'Upload failed');
        }
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setUploading(false);
    }

    return uploaded;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject || !message) {
      setResult({ type: 'error', message: 'Παρακαλώ συμπλήρωσε όλα τα πεδία' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      // Upload files first
      let attachments: FileAttachment[] = [];
      if (selectedFiles.length > 0) {
        attachments = await uploadFiles();
      }

      const response = await fetch('/api/tickets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          user_type: userType,
          user_email: user.email,
          user_name: user.name,
          subject,
          message,
          attachments,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({ type: 'success', message: t[lang].success });
        setSubject('');
        setMessage('');
        setSelectedFiles([]);
        setUploadedFiles([]);
        setShowNewTicket(false);
        // Reload tickets
        await loadTickets();
      } else {
        setResult({ type: 'error', message: `${t[lang].error} ${data.error || 'Unknown error'}` });
      }
    } catch (error: any) {
      setResult({ type: 'error', message: `${t[lang].error} ${error.message}` });
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      open: t[lang].open,
      in_progress: t[lang].in_progress,
      resolved: t[lang].resolved,
      closed: t[lang].closed,
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      open: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  const uploadReplyFiles = async (): Promise<FileAttachment[]> => {
    if (replyFiles.length === 0) return [];

    setUploadingReplyFiles(true);
    const uploaded: FileAttachment[] = [];

    try {
      for (const file of replyFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', user.id);

        const response = await fetch('/api/tickets/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (data.success) {
          uploaded.push(data.file);
        } else {
          throw new Error(data.error || 'Upload failed');
        }
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setUploadingReplyFiles(false);
    }

    return uploaded;
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTicket || !replyMessage.trim()) {
      return;
    }

    setSendingReply(true);

    try {
      // Upload files first
      let attachments: FileAttachment[] = [];
      if (replyFiles.length > 0) {
        attachments = await uploadReplyFiles();
      }

      const response = await fetch('/api/tickets/user-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket_id: selectedTicket.id,
          user_message: replyMessage.trim(),
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setReplyMessage('');
        setReplyFiles([]);
        // Reload tickets to get updated status
        await loadTickets();
        // Update selected ticket with the new data from server
        if (data.ticket) {
          setSelectedTicket(data.ticket);
        }
        alert(t[lang].replySuccess);
      } else {
        alert(`${t[lang].error} ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`${t[lang].error} ${error.message}`);
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link 
                href={userType === 'influencer' ? '/dashboard' : '/brand/dashboard'} 
                className="text-sm text-gray-900 hover:text-gray-700 mb-2 inline-block"
              >
                {t[lang].back}
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">{t[lang].title}</h1>
              <p className="text-sm text-gray-900 mt-1">{t[lang].subtitle}</p>
            </div>
            <button
              onClick={() => {
                setShowNewTicket(!showNewTicket);
                setResult(null);
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              {showNewTicket ? '✕' : '+ ' + t[lang].newTicket}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* New Ticket Form */}
        {showNewTicket && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">{t[lang].newTicket}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  {t[lang].subject}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t[lang].placeholderSubject}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  {t[lang].message}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t[lang].placeholderMessage}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  {t[lang].attachFiles}
                </label>
                <input
                  type="file"
                  onChange={handleFileSelect}
                  multiple
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900"
                  accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                />
                {selectedFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                        <span className="text-gray-900">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-red-600 hover:text-red-700 text-xs"
                        >
                          {t[lang].removeFile}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {uploading && (
                  <div className="mt-2 text-sm text-gray-900">{t[lang].uploading}</div>
                )}
              </div>

              {result && (
                <div
                  className={`p-4 rounded-lg ${
                    result.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {result.message}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={sending}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {sending ? t[lang].sending : t[lang].send}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewTicket(false);
                    setSubject('');
                    setMessage('');
                    setResult(null);
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Ακύρωση
                </button>
              </div>
            </form>
          </div>
        )}

        {/* My Tickets */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">{t[lang].myTickets}</h2>
          
          {loadingTickets ? (
            <div className="text-center text-gray-900 py-8">Loading...</div>
          ) : tickets.length === 0 ? (
            <div className="text-center text-gray-900 py-8">{t[lang].noTickets}</div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{ticket.subject}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(ticket.status)}`}>
                          {getStatusLabel(ticket.status)}
                        </span>
                        {ticket.admin_reply && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                            ✅ {t[lang].reply}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 mb-2 line-clamp-2">{ticket.message}</p>
                      <div className="text-xs text-gray-900">
                        {t[lang].created}: {formatDate(ticket.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">{selectedTicket.subject}</h2>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(selectedTicket.status)}`}>
                    {getStatusLabel(selectedTicket.status)}
                  </span>
                  <span className="text-sm text-gray-900">
                    {t[lang].created}: {formatDate(selectedTicket.created_at)}
                  </span>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Το Μήνυμά σας:</h3>
                  <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-sm text-gray-900">
                    {selectedTicket.message}
                  </div>
                  {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-medium text-gray-900 mb-2">Επισυναπτόμενα Αρχεία:</h4>
                      <div className="space-y-1">
                        {selectedTicket.attachments.map((file, idx) => (
                          <a
                            key={idx}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            📎 {file.filename} ({(file.size / 1024).toFixed(1)} KB)
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {selectedTicket.admin_reply ? (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Απάντηση:</h3>
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg whitespace-pre-wrap text-sm text-gray-900 mb-4">
                      {selectedTicket.admin_reply}
                    </div>
                    <div className="text-xs text-gray-900 mb-4">
                      {t[lang].reply}: {formatDate(selectedTicket.admin_replied_at!)}
                    </div>
                    
                    {/* User Reply Form */}
                    <div className="border-t border-gray-200 pt-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">{t[lang].replyToTicket}</h3>
                      <form onSubmit={handleReplySubmit}>
                        <textarea
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder={t[lang].replyPlaceholder}
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-3 text-gray-900"
                          required
                        />
                        
                        {/* File Upload for Reply */}
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-900 mb-2">
                            Επισυναπτόμενα Αρχεία (Προαιρετικά)
                          </label>
                          <input
                            type="file"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              setReplyFiles(files);
                            }}
                            multiple
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900"
                            accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                          />
                          {replyFiles.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {replyFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                                  <span className="text-gray-900">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                                  <button
                                    type="button"
                                    onClick={() => setReplyFiles(prev => prev.filter((_, i) => i !== index))}
                                    className="text-red-600 hover:text-red-700 text-xs"
                                  >
                                    {t[lang].removeFile}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {uploadingReplyFiles && (
                            <div className="mt-2 text-sm text-gray-900">{t[lang].uploading}</div>
                          )}
                        </div>

                        <button
                          type="submit"
                          disabled={sendingReply || !replyMessage.trim() || uploadingReplyFiles}
                          className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {sendingReply ? t[lang].sendingReply : t[lang].sendReply}
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-sm text-yellow-800">
                    {t[lang].waiting}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setSelectedTicket(null);
                  setReplyMessage('');
                  setReplyFiles([]);
                }}
                className="w-full px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t[lang].close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


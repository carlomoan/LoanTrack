// components/forms/ModernFileUpload.tsx
'use client'
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, File, CheckCircle } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';

export function ModernFileUpload({ endpoint }: { endpoint: string }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleFile = async (file: File) => {
    setUploadedFile(file);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('File uploaded successfully!');
    } catch (error) {
      toast.error('Upload failed. Please try again.');
      setUploadedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      }}
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'}`}
    >
      <input type="file" className="hidden" id="file-input" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

      <AnimatePresence mode="wait">
        {uploadedFile ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-2"
          >
            {isUploading ? (
              <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            )}
            <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
            <button onClick={() => document.getElementById('file-input')?.click()} className="text-xs text-blue-600 hover:underline mt-2">
              Replace file
            </button>
          </motion.div>
        ) : (
          <motion.label
            key="empty"
            htmlFor="file-input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2 cursor-pointer"
          >
            <div className={`p-3 rounded-full transition-colors ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <UploadCloud className={`w-6 h-6 ${isDragging ? 'text-blue-500' : 'text-gray-500'}`} />
            </div>
            <p className="text-sm font-medium text-gray-700">
              {isDragging ? 'Drop file here' : 'Drag & drop or click to upload'}
            </p>
            <p className="text-xs text-gray-400">PDF, PNG, or JPG (max 5MB)</p>
          </motion.label>
        )}
      </AnimatePresence>
    </div>
  );
}

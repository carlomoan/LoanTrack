'use client';

import { useState } from 'react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { apiHelpers } from '@/api/client';
import { toast } from 'sonner';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      // Get tenant subdomain from auth store or extract from current hostname
      const tenantSubdomain = window.location.hostname.split('.')[0];
      
      const result = await apiHelpers.uploadCSV(file, (progress) => {
        setProgress(progress);
      });
      
      setUploadResult(result.data);
      toast.success('CSV uploaded successfully!');
    } catch (error) {
      toast.error('Failed to upload CSV');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import CSV Data</h1>
        <p className="text-gray-600">Upload a CSV file to import MFI data (branches, members, loans)</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CSV File
            </label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {file ? (
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Selected file: {file.name}</p>
                      <p className="text-xs text-gray-500">({(file.size / 1024).toFixed(2)} KB)</p>
                    </div>
                  ) : (
                    <>
                      <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-1M6 13h2a3 3 0 0 0 0-6h-2M4 13h6M4 6h12M4 10h12"/>
                      </svg>
                      <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                      <p className="text-xs text-gray-500">CSV files only</p>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </label>
            </div>
          </div>

          {progress > 0 && progress < 100 && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-4">
            <button
              onClick={() => {
                setFile(null);
                setUploadResult(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
              disabled={isUploading}
            >
              Clear
            </button>
            <button
              onClick={handleUpload}
              className="px-4 py-2 text-sm font-medium text-white bg-violet-600 border border-transparent rounded-md hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!file || isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload CSV'}
            </button>
          </div>
        </div>
      </div>

      {uploadResult && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-green-800 mb-2">Upload Successful!</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-green-700">Branches Created:</p>
              <p className="text-green-600">{uploadResult.branches_created || 0}</p>
            </div>
            <div>
              <p className="font-medium text-green-700">Loan Officers Created:</p>
              <p className="text-green-600">{uploadResult.loan_officers_created || 0}</p>
            </div>
            <div>
              <p className="font-medium text-green-700">Members Created:</p>
              <p className="text-green-600">{uploadResult.members_created || 0}</p>
            </div>
            <div>
              <p className="font-medium text-green-700">Loans Created:</p>
              <p className="text-green-600">{uploadResult.loans_created || 0}</p>
            </div>
          </div>
          {uploadResult.errors && uploadResult.errors.length > 0 && (
            <div className="mt-4">
              <p className="font-medium text-red-700">Errors ({uploadResult.errors.length}):</p>
              <ul className="list-disc list-inside text-sm text-red-600 mt-1 max-h-32 overflow-y-auto">
                {uploadResult.errors.map((error: string, index: number) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
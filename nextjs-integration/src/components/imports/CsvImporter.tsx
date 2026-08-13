'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileUp, CheckCircle, AlertTriangle, FileText, Loader2, X } from 'lucide-react';

export function CsvImporter() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const { data: taskStatus, isLoading } = useQuery({
    queryKey: ['csv-task', taskId],
    queryFn: () => api.get(`/tasks/status/${taskId}/`).then(res => res.data),
    enabled: !!taskId, // Only start polling when we have a task ID
    refetchInterval: (query) =>
      query.state.data?.state === 'PENDING' || query.state.data?.state === 'STARTED' ? 1000 : false,
  });

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post('/imports/csv/', formData);
    setTaskId(res.data.task_id); // Django responds with the Celery task ID
  };

  const progress = taskStatus?.progress || 0;
  const isDone = taskStatus?.state === 'SUCCESS';

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-2xl">
      <h2 className="text-xl font-bold mb-4">Bulk Import Members/Loans</h2>

      {!taskId ? (
        <div className="space-y-4">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            onClick={handleUpload}
            disabled={!file}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
          >
            <FileUp className="w-4 h-4" /> Start Upload
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {isDone ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
              <span className="font-medium">
                {isDone ? 'Import Complete' : 'Processing file...'}
              </span>
            </div>
            {isDone && (
              <button onClick={() => { setTaskId(null); setFile(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <motion.div
              className="bg-blue-600 h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <AnimatePresence>
            {isDone && taskStatus?.result?.errors?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-50 border border-red-100 rounded-md p-4 overflow-y-auto max-h-40"
              >
                <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                  <AlertTriangle className="w-4 h-4" /> {taskStatus.result.errors.length} Errors Found
                </div>
                <ul className="space-y-1 text-sm text-red-600">
                  {taskStatus.result.errors.map((err: any, i: number) => (
                    <li key={i}>Row {err.row}: {err.error}</li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

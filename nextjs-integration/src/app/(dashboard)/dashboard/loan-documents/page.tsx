'use client';

import { useState } from 'react';
import { useLoanDocuments } from '@/hooks/useLoanDocuments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export default function LoanDocumentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data: documents, isLoading } = useLoanDocuments({
    page: page,
    page_size: 10,
    search: searchTerm || undefined,
    document_type: typeFilter || undefined,
  });

  const getDocumentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'RCT': 'bg-blue-100 text-blue-800',
      'AGR': 'bg-green-100 text-green-800',
      'IDD': 'bg-purple-100 text-purple-800',
      'COL': 'bg-orange-100 text-orange-800',
      'OTH': 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getDocumentTypeText = (type: string) => {
    const types: Record<string, string> = {
      'RCT': 'Receipt',
      'AGR': 'Agreement',
      'IDD': 'ID Document',
      'COL': 'Collateral',
      'OTH': 'Other',
    };
    return types[type] || type;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Loan Documents</h1>
        <p className="text-gray-600">Manage all loan documents and attachments</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter documents by type or search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <Input
                placeholder="Search by loan number or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document Type
              </label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="RCT">Receipt</SelectItem>
                  <SelectItem value="AGR">Agreement</SelectItem>
                  <SelectItem value="IDD">ID Document</SelectItem>
                  <SelectItem value="COL">Collateral</SelectItem>
                  <SelectItem value="OTH">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Loan Documents ({documents?.count || 0})</CardTitle>
          <CardDescription>All loan documents in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading documents...</p>
            </div>
          ) : documents?.results?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No documents found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {documents?.results?.map((document) => (
                <div key={document.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      Loan #{document.loan_number} - {getDocumentTypeText(document.document_type)}
                    </p>
                    <p className="text-sm text-gray-500">{document.description || 'No description'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Type</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDocumentTypeColor(document.document_type)}`}>
                      {getDocumentTypeText(document.document_type)}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Uploaded By</p>
                    <p className="font-medium text-gray-900">
                      {document.uploaded_by_name || 'N/A'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Uploaded</p>
                    <p className="font-medium text-gray-900">
                      {new Date(document.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(document.file_url, '_blank')}
                    >
                      View Document
                    </Button>
                  </div>
                </div>
              ))}
              {(documents?.results?.length ?? 0) > 0 && (
                <div className="flex justify-between items-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {page} of {Math.ceil((documents?.count || 0) / 10)}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil((documents?.count || 0) / 10)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useMFIReports, useGenerateMFIReport } from '@/hooks/useReports';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  const { data: mfiReports, isLoading: reportsLoading } = useMFIReports();
  const generateMFIReport = useGenerateMFIReport();

  const handleGenerateReport = async () => {
    if (!selectedPeriod) {
      toast.error('Please select a period');
      return;
    }

    try {
      await generateMFIReport.mutateAsync(selectedPeriod);
      toast.success('MFI report generated successfully!');
    } catch (error) {
      toast.error('Failed to generate report');
    }
  };

  const getPeriodOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    for (let month = 1; month <= 12; month++) {
      const period = `${currentYear}-${String(month).padStart(2, '0')}-01`;
      const label = new Date(period).toLocaleDateString('default', { month: 'long', year: 'numeric' });
      options.push({ value: period, label });
    }
    return options;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-600">Generate and view MFI performance reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generate Report Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Generate Report</CardTitle>
            <CardDescription>Select period to generate MFI report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reporting Period
              </label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {getPeriodOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerateReport}
              disabled={!selectedPeriod || generateMFIReport.isPending}
              className="w-full"
            >
              {generateMFIReport.isPending ? 'Generating...' : 'Generate Report'}
            </Button>
          </CardContent>
        </Card>

        {/* Report Summary Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Report Summary</CardTitle>
            <CardDescription>Overview of generated MFI reports</CardDescription>
          </CardHeader>
          <CardContent>
            {reportsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading reports...</p>
              </div>
            ) : mfiReports?.results?.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No reports generated yet</p>
                <p className="text-sm text-gray-400 mt-1">Generate a report to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {mfiReports?.results?.slice(0, 5).map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        {report.mfi_name} - {new Date(report.period).toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-sm text-gray-500">
                        Status: <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full
                          ${report.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                            report.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                            report.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'}`}>
                          {report.status}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Generated</p>
                      <p className="font-medium text-gray-900">
                        {report.generated_at ? new Date(report.generated_at).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                ))}
                {(mfiReports?.results?.length ?? 0) > 5 && (
                  <div className="text-center pt-4">
                    <p className="text-sm text-gray-500">
                      Showing 5 of {mfiReports?.count || 0} reports
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

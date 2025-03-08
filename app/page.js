'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Download } from 'lucide-react';

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [timestamps, setTimestamps] = useState('');
  const [processing, setProcessing] = useState(false);
  const [queueMessage, setQueueMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [activeTab, setActiveTab] = useState('extract'); // State to control active tab
  const [countdown, setCountdown] = useState(0); // Countdown in seconds
  
  const handleExtract = async () => {
    setProcessing(true);
    setQueueMessage('');
    setFiles([]);
    
    try {
      const response = await axios.post('/api/extract', { youtubeUrl, timestamps });
      setFiles(response.data);
      setActiveTab('downloads'); // Switch to Downloads tab when files are ready
      setCountdown(300); // Start a 5-minute countdown (300 seconds)
    } catch (error) {
      if (error.response?.status === 429) {
        setQueueMessage('Server is busy. Please wait and try again.');
      } else {
        alert('Error processing request');
      }
    }
    
    setProcessing(false);
  };
  
  // Countdown logic
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      
      return () => clearInterval(timer); // Cleanup on unmount
    } else if (countdown === 0 && files.length > 0) {
      // Delete files when countdown reaches 0
      setFiles([]);
    }
  }, [countdown, files]);
  
  // Format countdown into MM:SS
  const formatCountdown = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <Card className="w-full max-w-2xl shadow-lg rounded-xl bg-white">
        <CardHeader className="text-center py-8">
          <CardTitle className="text-3xl font-bold text-gray-800">
            YouTube MP3 Extractor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-full bg-gray-100 rounded-lg mb-6 p-1">
              <TabsTrigger
                value="extract"
                className="text-gray-600 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900"
              >
                Extract
              </TabsTrigger>
              <TabsTrigger
                value="downloads"
                className="text-gray-600 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900"
              >
                Downloads
              </TabsTrigger>
            </TabsList>
            <TabsContent value="extract" className="space-y-6 p-4">
              <Input
                className="bg-gray-50 text-gray-800 border-gray-200 !p-[10px_5px] rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                placeholder="Enter YouTube URL"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
              />
              <Textarea
                className="bg-gray-50 text-gray-800 border-gray-200 !p-[10px_5px] rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                placeholder="Enter timestamps (e.g., 00:00 Title)"
                rows={4}
                value={timestamps}
                onChange={(e) => setTimestamps(e.target.value)}
              />
              {queueMessage && <p className="text-red-500 text-sm">{queueMessage}</p>}
              <Button
                onClick={handleExtract}
                disabled={processing}
                className="w-full bg-blue-500 hover:bg-blue-600 !p-[10px_5px] rounded-lg text-white font-semibold transition-all"
              >
                {processing ? <Loader2 className="animate-spin mr-2" /> : 'Extract MP3'}
              </Button>
            </TabsContent>
            <TabsContent value="downloads" className="p-4 space-y-4">
              {countdown > 0 ? (
                <>
                  <div className="text-sm text-gray-600 mb-4">
                    Files will be deleted in: <span className="font-bold">{formatCountdown(countdown)}</span>
                  </div>
                  {files?.files?.length > 0 && (
                    <ul className="space-y-2">
                      {files.files.map((file, index) => (
                        <li
                          key={index}
                          className="bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-all flex items-center justify-between"
                        >
                          <span className="text-gray-800">{file.name}</span>
                          <a
                            href={`/downloads/${file.name}`}
                            download
                            className="text-blue-500 hover:underline flex items-center"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {files?.zip && (
                    <div className="bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-all flex items-center justify-between">
                      <span className="text-gray-800">{files.zip}</span>
                      <a
                        href={`/downloads/${files.zip}`}
                        download
                        className="text-blue-500 hover:underline flex items-center"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download All
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-600 text-sm">Files have been deleted.</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
'use client';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, RotateCcw, ArrowRight } from 'lucide-react';

interface PhotoUploadProps {
  onSubmit: (photoDataUrl: string) => void;
}

export default function PhotoUpload({ onSubmit }: PhotoUploadProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings.',
          });
        }
      } else {
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Not Supported',
          description: 'Your browser does not support camera access.',
        });
      }
    };

    getCameraPermission();

    return () => {
      // Cleanup: stop video stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    }
  }, [toast]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleSubmit = () => {
    if (capturedImage) {
      setLoading(true);
      // We are not actually uploading, just passing the data URL to the parent
      // In a real app, you would upload to Firebase Storage here.
      onSubmit(capturedImage);
      // Parent will handle closing and loading state
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-4">
      <div className="w-full max-w-md aspect-video bg-muted rounded-md overflow-hidden relative">
        {capturedImage ? (
          <img src={capturedImage} alt="Captured proof of delivery" className="w-full h-full object-contain" />
        ) : (
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {hasCameraPermission === false && (
        <Alert variant="destructive">
          <AlertTitle>Camera Access Required</AlertTitle>
          <AlertDescription>
            Please allow camera access to take a photo.
          </AlertDescription>
        </Alert>
      )}

      {hasCameraPermission && (
        <div className="flex w-full justify-center space-x-4">
          {capturedImage ? (
            <>
              <Button variant="outline" onClick={handleRetake} disabled={loading}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Retake
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Submitting...' : <><ArrowRight className="mr-2 h-4 w-4" /> Submit Photo</>}
              </Button>
            </>
          ) : (
            <Button onClick={handleCapture} size="lg" className="rounded-full w-20 h-20">
              <ImageIcon className="h-8 w-8" />
              <span className="sr-only">Capture Photo</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

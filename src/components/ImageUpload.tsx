import React, { useRef, useState } from 'react';
import { Upload, Camera, X, Check, Loader2 } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { cn } from '../lib/utils';

interface ImageUploadProps {
  onUploadSuccess: (url: string) => void;
  initialValue?: string;
  className?: string;
  folder?: string;
  label?: string;
}

export default function ImageUpload({ 
  onUploadSuccess, 
  initialValue, 
  className,
  folder = 'profiles',
  label = 'Profile Photo'
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(initialValue || null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File): Promise<{ blob: Blob; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = async () => {
          let reqWidth = img.width;
          let reqHeight = img.height;
          
          // Step A: Crisp resolution cap of max 800px width/height for standard retina displays
          const MAX_DIM = 800;
          if (reqWidth > MAX_DIM || reqHeight > MAX_DIM) {
            if (reqWidth > reqHeight) {
              reqHeight = Math.round((reqHeight * MAX_DIM) / reqWidth);
              reqWidth = MAX_DIM;
            } else {
              reqWidth = Math.round((reqWidth * MAX_DIM) / reqHeight);
              reqHeight = MAX_DIM;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = reqWidth;
          canvas.height = reqHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ blob: file, dataUrl: e.target?.result as string });
            return;
          }

          ctx.drawImage(img, 0, 0, reqWidth, reqHeight);

          // Step B: Iteratively fine-tune compression metrics until size stays strictly under 100KB
          let quality = 0.8;
          let blob: Blob | null = null;
          let dataUrl = '';
          const targetMaxSizeBytes = 100 * 1024; // 100 KB
          
          for (let attempt = 0; attempt < 5; attempt++) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
            
            // Get blob representation
            blob = await new Promise<Blob | null>((resBlob) => canvas.toBlob(resBlob, 'image/jpeg', quality));
            
            if (blob && blob.size <= targetMaxSizeBytes) {
              break; // Image meets size guidelines!
            }
            
            // Decimate quality parameters or scale down canvas grid
            quality -= 0.15;
            if (quality < 0.25) {
              // Scale down dimensions for better scaling
              canvas.width = Math.round(canvas.width * 0.75);
              canvas.height = Math.round(canvas.height * 0.75);
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              quality = 0.7; // Restart quality for compact aspect
            }
          }

          if (blob) {
            resolve({ blob, dataUrl });
          } else {
            resolve({ blob: file, dataUrl: e.target?.result as string });
          }
        };
        img.onerror = () => resolve({ blob: file, dataUrl: e.target?.result as string });
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setStatusMsg(null);

    try {
      // 1. Instantly compress file so we get a small blob & base64 URL
      const compressed = await compressImage(file);
      
      // 2. Set optimistic layout preview instantly
      setPreview(compressed.dataUrl);

      // 3. Define the Firebase storage upload path
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      
      // 4. Race Firebase storage upload with sequential state progress indicators
      const uploadWithProgress = new Promise<string>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, compressed.blob);
        
        // Fail-safe timeout set to 6 seconds to give resumable a safe duration even on slower signals
        const timeoutId = setTimeout(() => {
          uploadTask.cancel();
          reject(new Error('Firebase Storage upload timed out after 6s (likely due to CORS / network blocks)'));
        }, 6000);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          }, 
          (error) => {
            clearTimeout(timeoutId);
            reject(error);
          }, 
          async () => {
            clearTimeout(timeoutId);
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            } catch (urlErr) {
              reject(urlErr);
            }
          }
        );
      });

      const finalUrl = await uploadWithProgress;
      onUploadSuccess(finalUrl);
      setStatusMsg({ text: 'Cloud upload completed!', type: 'success' });
    } catch (error: any) {
      console.warn('Firebase Storage upload blocked or failed, executing compressed Base64 self-healing fallback:', error);
      try {
        const compressed = await compressImage(file);
        setPreview(compressed.dataUrl);
        onUploadSuccess(compressed.dataUrl);
        setStatusMsg({ text: 'Saved locally (Storage CORS fallback active)', type: 'info' });
      } catch (fallbackError) {
        console.error('Compressed image fallback failed:', fallbackError);
        setStatusMsg({ text: 'Failed to process selected image', type: 'error' });
        setPreview(initialValue || null);
      }
    } finally {
      setUploading(false);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    setStatusMsg(null);
    setUploadProgress(0);
    onUploadSuccess('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
      
      <div className="relative group">
        <div className={cn(
          "w-full aspect-square max-w-[12rem] mx-auto rounded-[2rem] bg-slate-100 border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center transition-all",
          preview ? "border-solid border-indigo-600" : "hover:border-indigo-400 hover:bg-slate-50"
        )}>
          {preview ? (
            <div className="relative w-full h-full">
              <img src={preview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              {uploading && (
                <div className="absolute inset-0 bg-slate-900/75 flex flex-col items-center justify-center text-white text-center px-4">
                  <Loader2 className="w-6 h-6 animate-spin mb-2 text-indigo-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest mb-1.5 text-slate-100">Uploading...</span>
                  <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden max-w-[8rem] mb-1">
                    <div 
                      className="bg-indigo-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-black text-indigo-300 tracking-tight">{Math.round(uploadProgress)}%</span>
                </div>
              )}
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center cursor-pointer p-8 text-center"
            >
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 mb-3 group-hover:text-indigo-600 group-hover:scale-110 transition-all">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tap to Upload</p>
              <p className="text-[9px] font-medium text-slate-400 mt-1 uppercase tracking-tight">JPG, PNG (MAX. 5MB)</p>
            </div>
          )}
        </div>

        {preview && !uploading && (
          <div className="absolute -top-2 -right-2 flex gap-2">
            <button 
              onClick={clearPreview}
              className="p-2 bg-rose-500 text-white rounded-xl shadow-lg border border-white hover:scale-110 active:scale-95 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg border border-white hover:scale-110 active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {statusMsg && (
        <div className={cn(
          "text-[9px] font-black uppercase tracking-widest text-center py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 max-w-[12rem] mx-auto",
          statusMsg.type === 'success' && "bg-emerald-50 text-emerald-600 border border-emerald-100",
          statusMsg.type === 'info' && "bg-indigo-50 text-indigo-600 border border-indigo-100",
          statusMsg.type === 'error' && "bg-rose-50 text-rose-600 border border-rose-100",
        )}>
          {statusMsg.type === 'success' && <Check className="w-3 h-3 text-emerald-600" />}
          {statusMsg.type === 'info' && <Check className="w-3 h-3 text-indigo-600" />}
          {statusMsg.type === 'error' && <X className="w-3 h-3 text-rose-600" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}

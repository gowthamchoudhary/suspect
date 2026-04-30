import { useRef, useState, useCallback } from 'react';

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      mediaRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRef.current.start(100);
      setIsRecording(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (!mediaRef.current || mediaRef.current.state === 'inactive') {
        resolve(null);
        return;
      }
      mediaRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        mediaRef.current.stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        resolve(blob);
      };
      mediaRef.current.stop();
    });
  }, []);

  return { isRecording, startRecording, stopRecording };
}

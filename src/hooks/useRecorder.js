import { useRef, useState, useCallback } from 'react';

const MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
];

function getSupportedMimeType() {
  if (!window.MediaRecorder) return null;
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const mimeTypeRef = useRef('');

  const startRecording = useCallback(async () => {
    try {
      setRecordingError(null);
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error('Audio recording is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      if (mimeType === null) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('Audio recording is not supported in this browser.');
      }

      chunksRef.current = [];
      streamRef.current = stream;
      mimeTypeRef.current = mimeType || 'audio/webm';
      mediaRef.current = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRef.current.start(100);
      setIsRecording(true);
      return true;
    } catch (error) {
      setRecordingError(error.message || 'Microphone access failed.');
      setIsRecording(false);
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
        const type = mediaRef.current.mimeType || mimeTypeRef.current || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setIsRecording(false);
        resolve(blob);
      };
      mediaRef.current.stop();
    });
  }, []);

  return { isRecording, recordingError, startRecording, stopRecording };
}

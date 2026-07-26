import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { generateId } from '@/lib/utils/id';
import {
    putMuseChunk,
    getMuseChunks,
    deleteMuseChunks,
    putMuseManifest,
    deleteMuseManifest
} from '@/lib/idb/studioDB';
import { MuseManifest } from '@/types';

export function useMuseRecorder() {
    const [status, setStatus] = useState<'idle' | 'recording' | 'stopping' | 'error'>('idle');
    const [elapsedSec, setElapsedSec] = useState<number>(0);
    const [level, setLevel] = useState<number>(0);
    const [error, setError] = useState<string | undefined>(undefined);
    const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const wakeLockRef = useRef<{ release: () => Promise<void>; addEventListener: (type: string, listener: () => void) => void } | null>(null);
    
    const idRef = useRef<string>('');
    const seqRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const mimeTypeRef = useRef<string>('');
    
    const writePromisesRef = useRef<Promise<void>[]>([]);
    
    const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const levelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    
    const stopPromiseResolveRef = useRef<((val: { id: string; blob: Blob; duration: number; mimeType: string }) => void) | null>(null);

    // Request Screen Wake Lock
    const requestWakeLock = useCallback(async () => {
        if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
            try {
                const sentinel = await (navigator as unknown as { wakeLock: { request: (type: 'screen') => Promise<{ release: () => Promise<void>; addEventListener: (type: string, listener: () => void) => void }> } }).wakeLock.request('screen');
                wakeLockRef.current = sentinel;
                setWakeLockActive(true);
                sentinel.addEventListener('release', () => {
                    setWakeLockActive(false);
                });
            } catch (err) {
                console.warn('Wake Lock request failed:', err);
            }
        }
    }, []);

    // Release Screen Wake Lock
    const releaseWakeLock = useCallback(async () => {
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
            } catch (err) {
                console.warn('Wake Lock release failed:', err);
            }
            wakeLockRef.current = null;
            setWakeLockActive(false);
        }
    }, []);

    // Handle visibility change to re-acquire wake lock if recording
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (status === 'recording' && document.visibilityState === 'visible' && !wakeLockRef.current) {
                await requestWakeLock();
            }
        };
        if (typeof window !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }
        return () => {
            if (typeof window !== 'undefined') {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            }
        };
    }, [status, requestWakeLock]);

    const negotiateMimeType = (): string => {
        const candidateTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
            'audio/aac'
        ];
        for (const type of candidateTypes) {
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return ''; // browser default
    };

    const cleanupRecording = useCallback(async () => {
        // Clear intervals
        if (elapsedIntervalRef.current) {
            clearInterval(elapsedIntervalRef.current);
            elapsedIntervalRef.current = null;
        }
        if (levelIntervalRef.current) {
            clearInterval(levelIntervalRef.current);
            levelIntervalRef.current = null;
        }

        // Stop media recorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.stop();
            } catch {}
        }
        mediaRecorderRef.current = null;

        // Stop media tracks
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        // Close AudioContext
        if (audioContextRef.current) {
            try {
                await audioContextRef.current.close();
            } catch {}
            audioContextRef.current = null;
        }
        analyserRef.current = null;

        // Release wake lock
        await releaseWakeLock();
    }, [releaseWakeLock]);

    const start = async () => {
        setError(undefined);
        
        // 1. Check storage estimate
        if (typeof window !== 'undefined' && navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                const freeBytes = (estimate.quota || 0) - (estimate.usage || 0);
                // Require at least 100MB
                if (freeBytes < 100 * 1024 * 1024) {
                    throw new Error('Insufficient storage space (under 100MB free). Please free up space before recording.');
                }
            } catch (e) {
                const err = e as Error;
                setError(err.message || 'Storage check failed');
                setStatus('error');
                return;
            }
        }

        // Request persistence if possible
        if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persist) {
            try {
                const persisted = await navigator.storage.persist();
                if (!persisted) {
                    toast.warning("Storage isn't persisted — recordings may be cleared by the browser after a period of inactivity.", { id: 'storage-persist-warning' });
                }
            } catch {}
        }

        try {
            // 2. getUserMedia
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            streamRef.current = stream;

            // 3. Negotiate mime
            const mimeType = negotiateMimeType();
            mimeTypeRef.current = mimeType;

            // 4. Setup Audio Analyzer for Level Metering (battery friendly)
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const audioCtx = new AudioContextClass();
            audioContextRef.current = audioCtx;
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            // 5. Initialize manifest and identifiers
            const recId = generateId('muse-');
            idRef.current = recId;
            seqRef.current = 0;
            writePromisesRef.current = [];

            const manifest: MuseManifest = {
                id: recId,
                startedAt: new Date().toISOString(),
                mimeType,
                chunkCount: 0,
                status: 'recording'
            };
            await putMuseManifest(manifest);

            // 6. Setup MediaRecorder
            const options = mimeType ? { mimeType, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 };
            const recorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = recorder;

            // Chunks available callback
            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    const currentId = idRef.current;
                    const currentSeq = seqRef.current;
                    seqRef.current++;
                    
                    const chunkBlob = event.data;
                    const p = putMuseChunk(currentId, currentSeq, chunkBlob).then(async () => {
                        // Update manifest chunkCount
                        const currentManifest: MuseManifest = {
                            id: currentId,
                            startedAt: manifest.startedAt,
                            mimeType: mimeTypeRef.current,
                            chunkCount: currentSeq + 1,
                            status: 'recording'
                        };
                        await putMuseManifest(currentManifest);
                    });
                    writePromisesRef.current.push(p);
                }
            };

            // Stop event callback
            recorder.onstop = async () => {
                try {
                    // Wait for all chunk writes to finish
                    await Promise.all(writePromisesRef.current);
                    
                    // Retrieve all chunks from IndexedDB
                    const chunks = await getMuseChunks(idRef.current);
                    if (chunks.length === 0) {
                        throw new Error('No audio chunks recorded.');
                    }
                    
                    const finalBlob = new Blob(chunks, { type: mimeTypeRef.current || recorder.mimeType });
                    const finalDuration = Math.round((Date.now() - startTimeRef.current) / 1000);

                    // Update manifest to stopped status
                    const finalManifest: MuseManifest = {
                        id: idRef.current,
                        startedAt: manifest.startedAt,
                        mimeType: mimeTypeRef.current || recorder.mimeType,
                        chunkCount: chunks.length,
                        status: 'stopped'
                    };
                    await putMuseManifest(finalManifest);

                    if (stopPromiseResolveRef.current) {
                        stopPromiseResolveRef.current({
                            id: idRef.current,
                            blob: finalBlob,
                            duration: finalDuration,
                            mimeType: mimeTypeRef.current || recorder.mimeType
                        });
                        stopPromiseResolveRef.current = null;
                    }
                } catch (e) {
                    const err = e as Error;
                    console.error('Error during recorder onstop:', err);
                    setError(err.message || 'Failed to assemble audio.');
                    setStatus('error');
                }
            };

            // Request Wake Lock
            await requestWakeLock();

            // 7. Start recording
            startTimeRef.current = Date.now();
            recorder.start(20000); // 20s timeslices
            setStatus('recording');
            setElapsedSec(0);

            // Timer for elapsed seconds (accounting for background drift via Date.now())
            elapsedIntervalRef.current = setInterval(() => {
                const diff = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setElapsedSec(diff);
            }, 1000);

            // Level meter interval (200ms for battery efficiency)
            levelIntervalRef.current = setInterval(() => {
                if (analyserRef.current) {
                    const dataArray = new Float32Array(analyserRef.current.fftSize);
                    analyserRef.current.getFloatTimeDomainData(dataArray);
                    let sumSquares = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sumSquares += dataArray[i] * dataArray[i];
                    }
                    const rms = Math.sqrt(sumSquares / dataArray.length);
                    // Standard visual scaling for level meter
                    setLevel(Math.min(Math.max(rms * 4, 0), 1)); 
                }
            }, 200);

        } catch (e) {
            const err = e as DOMException;
            console.error('Error starting recording:', err);
            const message =
                err.name === 'NotAllowedError' ? 'Microphone access denied — enable it in Settings.' :
                err.name === 'NotFoundError' ? 'No microphone found on this device.' :
                err.name === 'OverconstrainedError' ? "Microphone doesn't support the requested audio settings." :
                err.message || 'Microphone access denied or audio device error.';
            setError(message);
            setStatus('error');
            await cleanupRecording();
        }
    };

    const stop = async (): Promise<{ id: string; blob: Blob; duration: number; mimeType: string }> => {
        if (status !== 'recording') {
            throw new Error('Not recording');
        }
        setStatus('stopping');
        
        return new Promise<{ id: string; blob: Blob; duration: number; mimeType: string }>(async (resolve, reject) => {
            stopPromiseResolveRef.current = resolve;
            
            // Cleanup UI timers and lock release
            if (elapsedIntervalRef.current) {
                clearInterval(elapsedIntervalRef.current);
                elapsedIntervalRef.current = null;
            }
            if (levelIntervalRef.current) {
                clearInterval(levelIntervalRef.current);
                levelIntervalRef.current = null;
            }
            await releaseWakeLock();

            // Trigger stop on recorder
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                try {
                    mediaRecorderRef.current.stop();
                } catch (e) {
                    reject(e);
                }
            } else {
                reject(new Error('MediaRecorder was not recording.'));
            }

            // Stop streams and close contexts
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            if (audioContextRef.current) {
                try {
                    await audioContextRef.current.close();
                } catch {}
                audioContextRef.current = null;
            }
            analyserRef.current = null;

            // Update status back to idle
            setStatus('idle');
        });
    };

    const discard = async () => {
        const currentId = idRef.current;
        await cleanupRecording();
        if (currentId) {
            await deleteMuseChunks(currentId);
            await deleteMuseManifest(currentId);
        }
        setStatus('idle');
        setElapsedSec(0);
        setLevel(0);
    };

    useEffect(() => {
        return () => {
            // Cleanup on unmount
            cleanupRecording();
        };
    }, [cleanupRecording]);

    return {
        status,
        elapsedSec,
        level,
        error,
        wakeLockActive,
        start,
        stop,
        discard
    };
}

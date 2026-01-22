import { Badge } from "@/components/ui/badge";
import { useScanSessionContext } from "@/contexts/scan-session.context";
import { useScanProgress } from "@/services/sse-service";
import React, { useEffect, useRef, useState } from "react";
import { ExternalToast, toast } from "sonner";
const toastOptions: ExternalToast = {
    duration: 5000,
    position: 'bottom-left',
}

export const ScanProgress = React.memo(() => {
    const { activeSessions, } = useScanSessionContext();
    const { progress: scanProgress, error } = useScanProgress(Array.from(activeSessions.values())[0]?.sessionId);

    const [progress, setProgress] = useState(0);
    // Track processed events to prevent duplicate toasts
    const processedEvents = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (scanProgress?.overallProgress !== undefined) {
            setProgress(scanProgress.overallProgress);
        }
    }, [scanProgress?.overallProgress]);

    // Handle scan.complete event
    useEffect(() => {
        if (scanProgress?.type === 'scan.complete') {
            const eventKey = `scan.complete-${scanProgress.timestamp}`;
            if (!processedEvents.current.has(eventKey)) {
                processedEvents.current.add(eventKey);
                toast.success('Scan complete', toastOptions);
            }
        }
    }, [scanProgress?.type, scanProgress?.timestamp]);

    // Handle scan.started event
    useEffect(() => {
        if (scanProgress?.type === 'scan.started') {
            const eventKey = `scan.started-${scanProgress.timestamp}`;
            if (!processedEvents.current.has(eventKey)) {
                processedEvents.current.add(eventKey);
                toast.info('Scan started', toastOptions);
            }
        }
    }, [scanProgress?.type, scanProgress?.timestamp]);

    // Handle track.complete event
    useEffect(() => {
        if (scanProgress?.type === 'track.complete' && scanProgress.data) {
            const eventKey = `track.complete-${scanProgress.timestamp}-${scanProgress.data.trackIndex}`;
            if (!processedEvents.current.has(eventKey)) {
                processedEvents.current.add(eventKey);
                toast.success(`${scanProgress.data.fileName} complete`, {
                    description: `Track ${scanProgress.data.trackIndex} of ${scanProgress.data.totalTracks} successfully processed`,
                    ...toastOptions,
                });
            }
        }
    }, [scanProgress?.type, scanProgress?.timestamp, scanProgress?.data?.trackIndex, scanProgress?.data?.fileName, scanProgress?.data?.totalTracks]);

    // Handle error events
    useEffect(() => {
        if (error?.type === 'error') {
            const eventKey = `error-${error.timestamp}`;
            if (!processedEvents.current.has(eventKey)) {
                processedEvents.current.add(eventKey);
                toast.error(error.error.message, toastOptions);
            }
        }
    }, [error?.type, error?.timestamp, error?.error?.message]);


    return (
        <div>
            {scanProgress ? (
                <div className="flex items-center gap-2">
                    <span>Progress: {progress}% | {scanProgress?.data?.status} </span>
                    <Badge variant="secondary" className="text-xs">
                        Active sessions:
                        {activeSessions.size}
                    </Badge>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <span>No scan in progress</span>
                </div>
            )}
        </div>
    )
})
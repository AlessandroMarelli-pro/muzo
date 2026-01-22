import { Badge } from "@/components/ui/badge";
import { useScanSessionContext } from "@/contexts/scan-session.context";
import { useScanProgress } from "@/services/sse-service";
import { formatDate, formatDuration, intervalToDuration } from "date-fns";
import { RefreshCw } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { ExternalToast, toast } from "sonner";
const toastOptions: ExternalToast = {
    duration: 5000,
    position: 'bottom-left',
}

export const ScanProgress = React.memo(() => {
    const { activeSessions, completedSessions, } = useScanSessionContext();

    const { progress: scanProgress, error } = useScanProgress(Array.from(activeSessions.values())[0]?.sessionId);
    console.log('activeSessions', activeSessions);
    const [progress, setProgress] = useState(activeSessions.values().next().value?.overallProgress || -1);
    // Track processed events to prevent duplicate toasts
    const processedEvents = useRef<Set<string>>(new Set());
    useEffect(() => {
        console.log('scanProgress', scanProgress);
        const overallProgress = scanProgress?.overallProgress;
        if (!overallProgress && overallProgress !== 0) {
            return;
        }
        setProgress(overallProgress || 0);


    }, [scanProgress?.overallProgress]);

    // Handle scan.complete event
    useEffect(() => {
        if (scanProgress?.type === 'scan.complete') {
            const eventKey = `scan.complete-${scanProgress.timestamp}`;
            if (!processedEvents.current.has(eventKey)) {
                const durationSec = scanProgress.data?.duration || 0;
                const duration = intervalToDuration({ start: 0, end: durationSec });
                processedEvents.current.add(eventKey);
                toast.success(`Scan completed in ${formatDuration(duration)}`, toastOptions);

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

    const lastScan = completedSessions.values().next().value;
    const lastScanStartedAt = lastScan?.startedAt;
    const lastScanCompletedAt = lastScan?.completedAt;
    const duration = lastScanCompletedAt ? intervalToDuration({ start: new Date(lastScanStartedAt).getTime(), end: new Date(lastScanCompletedAt).getTime() }) : undefined;
    return (
        <div className="flex flex-row gap-2 text-xs">
            {!scanProgress && lastScanCompletedAt && (
                <div className="flex items-center gap-2">
                    <span>Last scan completed: {formatDate(new Date(lastScanCompletedAt), 'MM/dd/yyyy HH:mm')} in {formatDuration(duration)}</span>
                </div>
            )}
            {progress >= 0 && (
                <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />

                    <span>Progress: {progress}% | {scanProgress?.data?.status} </span>
                    <Badge variant="secondary" className="text-xs">
                        Active sessions:
                        {activeSessions.size}
                    </Badge>
                </div>
            )}
        </div>
    )
})
import { Progress } from "@/components/ui/progress";
import { useScanSessionContext } from "@/contexts/scan-session.context";
import { useScanProgress } from "@/services/sse-service";
import { formatDate, formatDuration, intervalToDuration } from "date-fns";
import { Loader } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { ExternalToast, toast } from "sonner";
import { Field, FieldLabel } from "./ui/field";
const toastOptions: ExternalToast = {
    duration: 5000,
    position: 'bottom-right',
}

export const ScanProgress = React.memo(() => {
    const { activeSessions, completedSessions, } = useScanSessionContext();

    const { progress: scanProgress, error } = useScanProgress(Array.from(activeSessions.values())[0]?.sessionId);
    const [progress, setProgress] = useState(activeSessions.values().next().value?.overallProgress || -1);
    // Track processed events to prevent duplicate toasts
    const processedEvents = useRef<Set<string>>(new Set());
    useEffect(() => {
        const overallProgress = scanProgress?.overallProgress ? scanProgress.overallProgress / 100 : undefined;
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
        if (scanProgress?.type === 'scan.started') {
            const eventKey = `scan.started-${scanProgress.timestamp}`;
            if (!processedEvents.current.has(eventKey)) {
                processedEvents.current.add(eventKey);
                toast.info('Scan started', toastOptions);
            }
        }
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
    }, [scanProgress?.type, scanProgress?.timestamp]);


    const lastScan = completedSessions.values().next().value;
    const lastScanStartedAt = lastScan?.startedAt;
    const lastScanCompletedAt = lastScan?.completedAt;
    const duration = lastScanCompletedAt ? intervalToDuration({ start: new Date(lastScanStartedAt).getTime(), end: new Date(lastScanCompletedAt).getTime() }) : undefined;
    return (
        <div className="flex flex-row gap-2 text-xs max-w-md w-full">
            {!scanProgress && lastScanCompletedAt && (
                <div className="flex items-center gap-2 w-full">
                    <span>Last scan completed: {formatDate(new Date(lastScanCompletedAt), 'MM/dd/yyyy HH:mm')} in {formatDuration(duration)}</span>
                </div>
            )}
            {progress >= 0 && (
                <div className="flex flex-row items-center justify-between gap-2 w-full">
                    <Field className="w-full " orientation="horizontal">
                        <FieldLabel htmlFor="progress-scan">
                            <div className="flex flex-row items-center gap-2">
                                <Loader className="h-4 w-4 animate-spin" />  <span>Scan </span>
                            </div>
                            <span className="ml-auto">{progress}%</span>
                        </FieldLabel>
                        <Progress id="progress-scan" value={progress} max={100} className="h-1 w-full" />
                    </Field>
                </div>
            )}
        </div>
    )
})